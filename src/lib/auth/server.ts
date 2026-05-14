import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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
 * Si la var n'est pas définie, on log un warning mais on autorise (legacy).
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

export async function requireAdmin(): Promise<AppSession> {
  const session = await requireAuth();

  if (session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const whitelist = getAdminWhitelist();
  if (whitelist !== null) {
    const tgId = session.user.telegramId ? Number(session.user.telegramId) : 0;
    if (!whitelist.has(tgId)) {
      console.warn(
        `[requireAdmin] User ${session.user.id} has role=admin but Telegram ID ${tgId} is not in ADMIN_TELEGRAM_IDS whitelist. Denying access.`
      );
      redirect('/dashboard');
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[requireAdmin] ADMIN_TELEGRAM_IDS not set — defense-in-depth disabled. Set it for prod safety.'
    );
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
