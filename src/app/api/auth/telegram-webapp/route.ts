import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, users } from '@/lib/db/schema';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_COOKIE = 'better-auth.session_token';
/**
 * Délai max acceptable depuis l'auth_date Telegram. Au-delà, on refuse
 * pour limiter le rejeu de signatures capturées. Telegram WebApp donne
 * un nouveau initData à chaque ouverture donc 1h est large.
 */
const MAX_AUTH_AGE_SECONDS = 60 * 60;

/**
 * Endpoint d'auth pour les Mini Apps Telegram.
 *
 * Le client envoie `initData` (string URL-encoded fournie par
 * `Telegram.WebApp.initData`). On valide la signature HMAC-SHA256 contre
 * `TELEGRAM_BOT_TOKEN` selon la spec officielle :
 *   https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Si valide, on trouve/crée le user puis on set le cookie de session.
 * Le mini app peut ensuite naviguer normalement comme un user authentifié.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '0.0.0.0';

  // Rate limit anti-bruteforce HMAC
  const rl = await checkRateLimit({
    key: `tg_webapp:ip:${ip}`,
    limit: 20,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let initData: string;
  try {
    const body = (await request.json()) as { initData?: string };
    if (!body.initData || typeof body.initData !== 'string') {
      return NextResponse.json({ error: 'missing_initData' }, { status: 400 });
    }
    initData = body.initData;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'bot_token_not_configured' },
      { status: 500 }
    );
  }

  // ============ Validation signature HMAC ============
  const parsed = new URLSearchParams(initData);
  const providedHash = parsed.get('hash');
  if (!providedHash) {
    return NextResponse.json({ error: 'no_hash' }, { status: 400 });
  }
  parsed.delete('hash');

  // data_check_string = clés triées alphabétiquement, format key=value, séparées par \n
  const dataCheckString = [...parsed.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // secret_key = HMAC-SHA256(bot_token) avec clé "WebAppData"
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(token)
    .digest();
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Timing-safe compare
  const a = Buffer.from(computedHash, 'hex');
  const b = Buffer.from(providedHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  // ============ Validation âge ============
  const authDateStr = parsed.get('auth_date');
  const authDate = authDateStr ? Number(authDateStr) : 0;
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (!authDate || ageSeconds > MAX_AUTH_AGE_SECONDS) {
    return NextResponse.json({ error: 'expired' }, { status: 401 });
  }

  // ============ Parse user ============
  const userJson = parsed.get('user');
  if (!userJson) {
    return NextResponse.json({ error: 'no_user' }, { status: 400 });
  }
  let tgUser: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  };
  try {
    tgUser = JSON.parse(userJson);
  } catch {
    return NextResponse.json({ error: 'invalid_user_json' }, { status: 400 });
  }

  if (!tgUser.id) {
    return NextResponse.json({ error: 'no_user_id' }, { status: 400 });
  }

  // ============ Find or create user ============
  let user = await db.query.users.findFirst({
    where: eq(users.telegramId, tgUser.id),
  });

  if (!user) {
    const [inserted] = await db
      .insert(users)
      .values({
        name: tgUser.first_name ?? `User ${tgUser.id}`,
        telegramId: tgUser.id,
        telegramFirstName: tgUser.first_name ?? '',
        telegramUsername: tgUser.username ?? null,
        telegramPhotoUrl: tgUser.photo_url ?? null,
        emailVerified: false,
      })
      .returning();
    if (!inserted) {
      return NextResponse.json({ error: 'create_failed' }, { status: 500 });
    }
    user = inserted;
  }

  // ============ Crée la session ============
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.insert(sessions).values({
    userId: user.id,
    token: sessionToken,
    expiresAt,
    ipAddress: ip,
    userAgent: request.headers.get('user-agent') ?? null,
  });

  const response = NextResponse.json({
    ok: true,
    needsOnboarding: !user.email || !user.onboardingCompletedAt,
  });
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  return response;
}
