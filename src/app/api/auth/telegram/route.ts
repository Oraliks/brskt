import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { sessions, users } from '@/lib/db/schema';
import { verifyTelegramHash } from '@/lib/auth/telegram-plugin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const telegramPayloadSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

const MAX_AGE_SECONDS = 86_400;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_COOKIE = 'better-auth.session_token';

/**
 * Whitelist d'admins par telegramId.
 * À chaque login, si le telegramId est dans cette liste, on set role='admin'
 * automatiquement en DB (sync avec la whitelist Vercel).
 */
function isAdminTelegramId(tgId: number): boolean {
  const raw = process.env.ADMIN_TELEGRAM_IDS;
  if (!raw || raw.trim() === '') return false;
  const ids = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.includes(tgId);
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return Response.json(
      { error: 'TELEGRAM_BOT_TOKEN missing' },
      { status: 500 }
    );
  }

  // Rate limit : 10 tentatives / 10 min par IP. Bloque brute-force du hash
  // Telegram (très improbable mais défense en profondeur). Fail-open si DB down.
  const ip = getClientIp(request);
  const rl = await checkRateLimit({
    key: `auth_tg:ip:${ip}`,
    limit: 10,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return Response.json(
      { error: 'rate_limited', resetIn: rl.resetIn },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.resetIn),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  const body = await request.json();
  const parsed = telegramPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const data = parsed.data;

  // 1) Fraîcheur
  const now = Math.floor(Date.now() / 1000);
  if (now - data.auth_date > MAX_AGE_SECONDS) {
    return Response.json({ error: 'auth_data_expired' }, { status: 401 });
  }

  // 2) Signature HMAC
  if (!verifyTelegramHash(data, botToken)) {
    return Response.json({ error: 'invalid_hash' }, { status: 401 });
  }

  // 3) Trouver ou créer l'utilisateur
  const existing = await db.query.users.findFirst({
    where: eq(users.telegramId, data.id),
  });

  const shouldBeAdmin = isAdminTelegramId(data.id);

  let userId: string;
  let isNewUser = false;

  if (existing) {
    userId = existing.id;
    // Update les champs Telegram + sync role si whitelist modifiée
    const newRole =
      shouldBeAdmin && existing.role !== 'admin'
        ? ('admin' as const)
        : existing.role;
    await db
      .update(users)
      .set({
        telegramUsername: data.username ?? existing.telegramUsername,
        telegramFirstName: data.first_name,
        telegramPhotoUrl: data.photo_url ?? existing.telegramPhotoUrl,
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
  } else {
    isNewUser = true;
    const [inserted] = await db
      .insert(users)
      .values({
        name: [data.first_name, data.last_name].filter(Boolean).join(' '),
        telegramId: data.id,
        telegramUsername: data.username,
        telegramFirstName: data.first_name,
        telegramPhotoUrl: data.photo_url,
        emailVerified: false,
        role: shouldBeAdmin ? 'admin' : 'user',
      })
      .returning();

    if (!inserted) {
      return Response.json(
        { error: 'user_creation_failed' },
        { status: 500 }
      );
    }
    userId = inserted.id;
  }

  // 4) Créer la session
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
    ipAddress: request.headers.get('x-forwarded-for') ?? null,
    userAgent: request.headers.get('user-agent') ?? null,
  });

  // 5) Set cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return Response.json({
    ok: true,
    isNewUser,
    redirectTo: isNewUser ? '/onboarding' : '/dashboard',
  });
}
