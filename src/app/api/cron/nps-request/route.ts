import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookingAutomationState, bookings, users } from '@/lib/db/schema';
import { getBot } from '@/lib/telegram/bot';
import { getAutomations, renderTemplate } from '@/lib/settings/automations';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON quotidien (11h UTC) : envoie une demande NPS aux users dont la
 * formation est terminée depuis >= delayDays et qui n'ont pas encore
 * été interrogés.
 *
 * Le DM contient une inline keyboard 0-10 (callback_data='nps:{bookingId}:{score}').
 * Quand l'user clique sur un score, le handler bot capture la réponse,
 * la stocke dans booking_automation_state.npsScore et remercie.
 *
 * Idempotence : npsAskedAt != null → on n'envoie pas. npsScore != null →
 * on a la réponse, plus rien à faire.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const config = (await getAutomations()).npsRequest;
  if (!config.enabled) {
    return Response.json({ success: true, skipped: 'disabled' });
  }

  const now = new Date();
  const threshold = new Date(
    now.getTime() - config.delayDays * 24 * 3600 * 1000
  );

  // LEFT JOIN : bookings completed depuis assez longtemps, sans état NPS
  // ou avec npsAskedAt null.
  const candidates = await db
    .select({
      bookingId: bookings.id,
      formationTitle: bookings.id, // placeholder, on récupère via with plus bas
      userId: bookings.userId,
      updatedAt: bookings.updatedAt,
      telegramId: users.telegramId,
      firstName: users.telegramFirstName,
      userName: users.name,
      npsAskedAt: bookingAutomationState.npsAskedAt,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .leftJoin(
      bookingAutomationState,
      eq(bookingAutomationState.bookingId, bookings.id)
    )
    .where(
      and(
        eq(bookings.status, 'completed'),
        lt(bookings.updatedAt, threshold),
        isNotNull(users.telegramId)
      )
    )
    .limit(200);

  const bot = getBot();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of candidates) {
    if (c.npsAskedAt) {
      skipped++;
      continue;
    }
    // Récupère le titre de la formation
    const detail = await db.query.bookings.findFirst({
      where: eq(bookings.id, c.bookingId),
      with: { formation: true },
    });
    if (!detail?.formation) continue;

    const question = renderTemplate(config.question, {
      firstName: c.firstName ?? c.userName ?? 'Trader',
      formationTitle: detail.formation.title,
    });

    try {
      await bot.api.sendMessage(Number(c.telegramId!), question, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: buildNpsKeyboard(c.bookingId),
        },
      });
      // Marque la demande
      await db
        .insert(bookingAutomationState)
        .values({
          bookingId: c.bookingId,
          npsAskedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: bookingAutomationState.bookingId,
          set: { npsAskedAt: now, updatedAt: now },
        });
      sent++;
    } catch (err) {
      logger.error('[nps-request] DM failed', err, {
        bookingId: c.bookingId,
      });
      failed++;
    }
  }

  return Response.json({
    success: true,
    candidates: candidates.length,
    sent,
    skipped,
    failed,
  });
}

/**
 * Construit l'inline keyboard 0-10 sur 3 rangées (0-3, 4-7, 8-10).
 * callback_data = "nps:{bookingId}:{score}"
 */
function buildNpsKeyboard(
  bookingId: string
): Array<Array<{ text: string; callback_data: string }>> {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  const make = (score: number) => ({
    text: String(score),
    callback_data: `nps:${bookingId}:${score}`,
  });
  rows.push([make(0), make(1), make(2), make(3)]);
  rows.push([make(4), make(5), make(6), make(7)]);
  rows.push([make(8), make(9), make(10)]);
  return rows;
}

// Suppress unused warning for isNull (utile pour une future variante)
void isNull;
