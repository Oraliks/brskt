import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomBytes } from 'node:crypto';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { sessions, users } from '@/lib/db/schema';
import { verifyMagicToken } from '@/lib/auth/magic-link';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_COOKIE = 'better-auth.session_token';

interface PageProps {
  searchParams: Promise<{ token?: string; redirectTo?: string }>;
}

/**
 * Magic link login : le user arrive ici depuis un lien envoyé par le bot
 * (commande `/login` dans Telegram).
 *
 * Vérifie le token HMAC, crée une session, set le cookie, redirige vers
 * le dashboard (ou onboarding si nouveau).
 *
 * Le token contient juste le `tgId` — le user doit déjà exister en DB
 * (créé via le widget classique ou un précédent /login). Si pas encore
 * en DB → on le crée à la volée.
 */
export default async function MagicLoginPage({ searchParams }: PageProps) {
  const { token, redirectTo } = await searchParams;

  if (!token) {
    return <ErrorScreen reason="Lien invalide : token manquant." />;
  }

  // Rate limit par IP (anti-brute force du HMAC)
  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    '0.0.0.0';
  const rl = await checkRateLimit({
    key: `magic_login:ip:${ip}`,
    limit: 20,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return (
      <ErrorScreen
        reason={`Trop de tentatives. Réessaye dans ${Math.ceil(
          rl.resetIn / 60
        )} min.`}
      />
    );
  }

  const verification = verifyMagicToken(token);
  if (!verification.valid) {
    const messages: Record<typeof verification.reason, string> = {
      malformed: 'Lien malformé. Demande un nouveau lien via /login dans le bot.',
      invalid_signature:
        'Lien invalide ou modifié. Demande un nouveau lien via /login dans le bot.',
      expired:
        'Lien expiré (validité 10 min). Renvoie /login dans le bot pour en obtenir un nouveau.',
    };
    return <ErrorScreen reason={messages[verification.reason]} />;
  }

  // Trouve ou crée l'user — seul cas où on accepte le tgId du token comme
  // identité fiable (HMAC garantit qu'on l'a bien généré nous-même).
  let user = await db.query.users.findFirst({
    where: eq(users.telegramId, verification.tgId),
  });

  if (!user) {
    // Premier login via magic link → on crée le user. On a juste le tgId,
    // pas first_name/photo etc. — ces champs seront remplis au prochain
    // login via le widget classique.
    const [inserted] = await db
      .insert(users)
      .values({
        name: `User ${verification.tgId}`,
        telegramId: verification.tgId,
        telegramFirstName: '',
        emailVerified: false,
      })
      .returning();
    if (!inserted) {
      return <ErrorScreen reason="Erreur création du compte. Réessaye." />;
    }
    user = inserted;
  }

  // Crée la session
  const sessionToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.insert(sessions).values({
    userId: user.id,
    token: sessionToken,
    expiresAt,
    ipAddress: ip,
    userAgent: headersList.get('user-agent') ?? null,
  });

  // Set cookie + redirect
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  // Si pas encore d'email → onboarding. Sinon dashboard (ou redirectTo).
  const dest = !user.email
    ? '/onboarding'
    : redirectTo && redirectTo.startsWith('/')
    ? redirectTo
    : '/dashboard';
  redirect(dest);
}

function ErrorScreen({ reason }: { reason: string }) {
  // Suppress unused import warning
  void getClientIp;
  return (
    <div className="space-y-8 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 border border-rose-500/30 mx-auto">
        <AlertTriangle className="h-6 w-6 text-rose-400 light:text-rose-700" />
      </div>
      <div className="space-y-3">
        <h1 className="font-serif text-3xl text-gradient">
          Connexion impossible
        </h1>
        <p className="text-sm text-[var(--color-text-dim)]">{reason}</p>
      </div>
      <div className="glass rounded-[var(--radius-lg)] p-5 text-sm text-left space-y-2">
        <p className="font-medium">Comment obtenir un nouveau lien :</p>
        <ol className="space-y-1 text-[var(--color-text-dim)] list-decimal list-inside">
          <li>Ouvre Telegram</li>
          <li>
            Tape <code className="font-mono">/login</code> dans la conversation
            avec notre bot
          </li>
          <li>Clique sur le lien renvoyé par le bot</li>
        </ol>
      </div>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la connexion classique
      </Link>
    </div>
  );
}
