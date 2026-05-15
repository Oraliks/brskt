import { and, eq, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bookings, bookingAutomationState } from '@/lib/db/schema';
import { sendDirectMessage } from '@/lib/telegram/helpers';
import { getAutomations, renderTemplate } from '@/lib/settings/automations';
import { logger } from '@/lib/logger';
import { logAdminAction } from '@/lib/admin/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON quotidien (8h UTC) : relance les bookings restés en `pending_payment`
 * après X heures, puis auto-cancel après Y jours sans paiement.
 *
 * Stratégie en 3 étages (configurable via /admin/automations) :
 *  1. > firstNudgeHours (48h) ET nudgeCount=0 → DM template1, nudgeCount=1
 *  2. > secondNudgeHours (72h) ET nudgeCount=1 → DM template2, nudgeCount=2
 *  3. > autoCancelDays (7j) ET nudgeCount=2 → cancel + DM cancel + audit
 *
 * Le state des relances est dans `booking_automation_state` (table séparée),
 * pas dans `bookings` directement — évite de casser les queries existantes
 * si la migration n'est pas push immédiatement.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const config = (await getAutomations()).paymentReminder;
  if (!config.enabled) {
    return Response.json({ success: true, skipped: 'disabled' });
  }

  const now = new Date();
  const firstNudgeThreshold = new Date(
    now.getTime() - config.firstNudgeHours * 3600 * 1000
  );
  const secondNudgeThreshold = new Date(
    now.getTime() - config.secondNudgeHours * 3600 * 1000
  );
  const cancelThreshold = new Date(
    now.getTime() - config.autoCancelDays * 24 * 3600 * 1000
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';

  // LEFT JOIN : tous les bookings pending_payment + leur state (peut être null)
  const candidates = await db
    .select({
      bookingId: bookings.id,
      bookingCreatedAt: bookings.createdAt,
      userId: bookings.userId,
      paymentNudgeCount: bookingAutomationState.paymentNudgeCount,
    })
    .from(bookings)
    .leftJoin(
      bookingAutomationState,
      eq(bookingAutomationState.bookingId, bookings.id)
    )
    .where(
      and(
        eq(bookings.status, 'pending_payment'),
        lt(bookings.createdAt, firstNudgeThreshold)
      )
    )
    .limit(500);

  let nudged1 = 0;
  let nudged2 = 0;
  let cancelled = 0;
  let failed = 0;

  for (const row of candidates) {
    const nudgeCount = row.paymentNudgeCount ?? 0;
    if (nudgeCount >= 3) continue;

    const isOldEnoughToCancel = row.bookingCreatedAt < cancelThreshold;
    const isOldEnoughForSecond = row.bookingCreatedAt < secondNudgeThreshold;
    const daysOpen = Math.floor(
      (now.getTime() - row.bookingCreatedAt.getTime()) / (24 * 3600 * 1000)
    );

    // Charge le booking complet avec user + formation (rare donc 1 query/row OK)
    const detail = await db.query.bookings.findFirst({
      where: eq(bookings.id, row.bookingId),
      with: { user: true, formation: true },
    });
    if (!detail) continue;

    const vars: Record<string, string | number> = {
      firstName: detail.user.telegramFirstName ?? detail.user.name ?? 'Trader',
      formationTitle: detail.formation.title,
      checkoutUrl: `${appUrl}/checkout/${row.bookingId}`,
      appUrl,
      daysOpen,
    };

    try {
      if (isOldEnoughToCancel && nudgeCount >= 2) {
        await db
          .update(bookings)
          .set({
            status: 'cancelled',
            adminNotes:
              'Auto-cancel : pas payé après ' +
              config.autoCancelDays +
              ' jours.',
            updatedAt: now,
          })
          .where(eq(bookings.id, row.bookingId));
        await upsertNudgeState(row.bookingId, 3, now);
        if (detail.user.telegramId) {
          await sendDirectMessage(
            Number(detail.user.telegramId),
            renderTemplate(config.templateCancel, vars)
          );
        }
        await logAdminAction({
          adminId: row.userId,
          action: 'booking_auto_cancel',
          targetType: 'booking',
          targetId: row.bookingId,
          before: { status: 'pending_payment' },
          after: { reason: 'no_payment_after_days', daysOpen },
        });
        cancelled++;
      } else if (isOldEnoughForSecond && nudgeCount < 2) {
        if (detail.user.telegramId) {
          await sendDirectMessage(
            Number(detail.user.telegramId),
            renderTemplate(config.template2, vars)
          );
        }
        await upsertNudgeState(row.bookingId, 2, now);
        nudged2++;
      } else if (nudgeCount < 1) {
        if (detail.user.telegramId) {
          await sendDirectMessage(
            Number(detail.user.telegramId),
            renderTemplate(config.template1, vars)
          );
        }
        await upsertNudgeState(row.bookingId, 1, now);
        nudged1++;
      }
    } catch (err) {
      logger.error('[payment-reminders] failed', err, {
        bookingId: row.bookingId,
      });
      failed++;
    }
  }

  return Response.json({
    success: true,
    candidates: candidates.length,
    nudged1,
    nudged2,
    cancelled,
    failed,
  });
}

async function upsertNudgeState(
  bookingId: string,
  count: number,
  at: Date
): Promise<void> {
  await db
    .insert(bookingAutomationState)
    .values({
      bookingId,
      paymentNudgeCount: count,
      paymentNudgeAt: at,
      updatedAt: at,
    })
    .onConflictDoUpdate({
      target: bookingAutomationState.bookingId,
      set: {
        paymentNudgeCount: count,
        paymentNudgeAt: at,
        updatedAt: at,
      },
    });
}
