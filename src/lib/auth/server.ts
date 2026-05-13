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

export async function requireAdmin(): Promise<AppSession> {
  const session = await requireAuth();
  if (session.user.role !== 'admin') redirect('/dashboard');
  return session;
}

export async function requireOnboarded(): Promise<AppSession> {
  const session = await requireAuth();
  if (!session.user.email || !session.user.onboardingCompletedAt) {
    redirect('/onboarding');
  }
  return session;
}
