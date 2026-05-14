import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sessions, type User } from '@/lib/db/schema';

const SESSION_COOKIE = 'better-auth.session_token';

export interface AppSession {
  user: User;
  sessionToken: string;
}

/**
 * Récupère la session courante. Lit le cookie, fait un join avec la DB.
 *
 * On n'utilise pas Better Auth ici parce que notre auth Telegram custom
 * insère directement dans `sessions` / `users` (voir /api/auth/telegram).
 */
export async function getSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await db.query.sessions.findFirst({
    where: and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())),
    with: { user: true },
  });

  if (!row || !row.user) return null;

  return { user: row.user as User, sessionToken: token };
}

export async function requireAuth(): Promise<AppSession> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

/**
 * Whitelist d'admins par telegramId — défense en profondeur.
 * Même si le role='admin' était set en DB par un attaquant, il faudrait
 * également que son telegramId soit dans cette env var (vit dans Vercel,
 * pas en DB) pour passer.
 *
 * Format: `ADMIN_TELEGRAM_IDS=123,456,789` (séparé par virgule)
 * Si la var n'est pas définie : aucun admin n'est autorisé (mode safe).
 */
function getAdminWhitelist(): Set<number> | null {
  const raw = process.env.ADMIN_TELEGRAM_IDS;
  if (!raw || raw.trim() === '') return null;
  const ids = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return new Set(ids);
}

/**
 * Vérifie sans throw qu'un user est admin (role DB + whitelist Telegram ID).
 * Utilisé côté UI pour afficher conditionnellement le lien "Admin".
 *
 * Pour bloquer l'accès à une route, utiliser `requireAdmin()` qui renvoie un 404.
 */
export function isAdminUser(user: User | null | undefined): boolean {
  if (!user || user.role !== 'admin') return false;
  const whitelist = getAdminWhitelist();
  if (!whitelist) return false; // Aucun admin si whitelist non définie
  const tgId = user.telegramId ? Number(user.telegramId) : 0;
  return whitelist.has(tgId);
}

/**
 * Protège les routes /admin/*.
 *
 * Renvoie un 404 (notFound) au lieu d'un redirect dans tous les cas non-admin :
 *  - Pas authentifié
 *  - Authentifié mais role !== 'admin'
 *  - Authentifié + role admin mais telegramId pas dans ADMIN_TELEGRAM_IDS
 *
 * Le 404 est volontaire (security through obscurity) : un attaquant non
 * authentifié ne doit même pas savoir que /admin existe.
 */
export async function requireAdmin(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    notFound();
  }

  if (!isAdminUser(session.user)) {
    if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_TELEGRAM_IDS) {
      console.warn(
        '[requireAdmin] ADMIN_TELEGRAM_IDS not set in prod — no admin can access /admin'
      );
    }
    notFound();
  }

  return session;
}

export async function requireOnboarded(): Promise<AppSession> {
  const session = await requireAuth();
  if (!session.user.email || !session.user.onboardingCompletedAt) {
    redirect('/onboarding');
  }
  return session;
}
