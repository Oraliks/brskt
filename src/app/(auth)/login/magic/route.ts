import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { sessions, users } from '@/lib/db/schema';
import { verifyMagicToken } from '@/lib/auth/magic-link';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_COOKIE = 'better-auth.session_token';

/**
 * Magic link login (Route Handler — pas Server Component).
 *
 * Pourquoi un Route Handler et pas une page ?
 * Next.js interdit `cookies().set()` dans un Server Component. Cette
 * route fait précisément ça (set du cookie de session), donc on est
 * obligé de passer par route.ts qui peut faire NextResponse + cookies().
 *
 * Flow : ?token=... → vérifie HMAC → crée/trouve user → crée session
 *  → set cookie → 302 vers /dashboard (ou /onboarding, ou /login?error=...).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const redirectTo = url.searchParams.get('redirectTo');
  const baseUrl = url.origin;

  function redirectWithError(reason: string): Response {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(reason)}`,
      302
    );
  }

  if (!token) {
    return redirectWithError('missing_token');
  }

  // Rate limit anti-bruteforce HMAC
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '0.0.0.0';
  const rl = await checkRateLimit({
    key: `magic_login:ip:${ip}`,
    limit: 20,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return redirectWithError('rate_limited');
  }

  const verification = verifyMagicToken(token);
  if (!verification.valid) {
    return redirectWithError(verification.reason);
  }

  // Trouve ou crée l'user
  let user = await db.query.users.findFirst({
    where: eq(users.telegramId, verification.tgId),
  });

  if (!user) {
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
      return redirectWithError('user_create_failed');
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
    userAgent: request.headers.get('user-agent') ?? null,
  });

  // Destination après login : si pas d'email → onboarding, sinon redirectTo
  // (whitelist : doit commencer par '/' pour éviter open-redirect) ou
  // /dashboard par défaut.
  const dest = !user.email
    ? '/onboarding'
    : redirectTo && redirectTo.startsWith('/')
    ? redirectTo
    : '/dashboard';

  const response = NextResponse.redirect(`${baseUrl}${dest}`, 302);
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  return response;
}
