import { and, eq, isNotNull, lt, notInArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, vipApplications } from '@/lib/db/schema';
import { sendDirectMessage } from '@/lib/telegram/helpers';
import { getAutomations, renderTemplate } from '@/lib/settings/automations';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON quotidien (9h30 UTC) : relance les VIP en drop-off du funnel.
 *
 * Critère : application VIP avec un `step` non-final (pas `in_group`,
 * `ejected`, `deposit_validated`) qui n'a pas évolué (`currentStepEnteredAt`)
 * depuis >= firstNudgeDays.
 *
 * 2 étages :
 *  1. reminderCount=0 ET stagne >= firstNudgeDays → DM template1, count=1
 *  2. reminderCount=1 ET stagne >= secondNudgeDays → DM template2, count=2
 *  3. reminderCount=2 → on n'embête plus
 *
 * Réutilise les colonnes existantes `reminderCount` + `reminderSentAt`
 * sur vip_applications.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const config = (await getAutomations()).vipDropoff;
  if (!config.enabled) {
    return Response.json({ success: true, skipped: 'disabled' });
  }

  const now = new Date();
  const firstThreshold = new Date(
    now.getTime() - config.firstNudgeDays * 24 * 3600 * 1000
  );
  const secondThreshold = new Date(
    now.getTime() - config.secondNudgeDays * 24 * 3600 * 1000
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';

  // Steps terminaux qu'on exclut (le user a atteint le bout du funnel
  // ou en est sorti, pas la peine de relancer).
  const TERMINAL_STEPS: Array<
    'in_group' | 'ejected' | 'deposit_validated'
  > = ['in_group', 'ejected', 'deposit_validated'];

  // On charge tous les candidats avec leur user
  const apps = await db
    .select({
      appId: vipApplications.id,
      userId: vipApplications.userId,
      step: vipApplications.step,
      currentStepEnteredAt: vipApplications.currentStepEnteredAt,
      reminderCount: vipApplications.reminderCount,
      reminderSentAt: vipApplications.reminderSentAt,
      telegramId: users.telegramId,
      telegramFirstName: users.telegramFirstName,
      userName: users.name,
    })
    .from(vipApplications)
    .innerJoin(users, eq(users.id, vipApplications.userId))
    .where(
      and(
        notInArray(vipApplications.step, TERMINAL_STEPS),
        lt(vipApplications.currentStepEnteredAt, firstThreshold),
        isNotNull(users.telegramId)
      )
    )
    .limit(500);

  let nudged1 = 0;
  let nudged2 = 0;
  let failed = 0;

  for (const a of apps) {
    if (a.reminderCount >= 2) continue;

    const stagnatesSinceSecond = a.currentStepEnteredAt < secondThreshold;
    const firstName = a.telegramFirstName ?? a.userName ?? 'Trader';
    const vars: Record<string, string | number> = {
      firstName,
      appUrl,
    };

    try {
      if (stagnatesSinceSecond && a.reminderCount === 1) {
        // Étage 2
        await sendDirectMessage(
          Number(a.telegramId!),
          renderTemplate(config.template2, vars)
        );
        await db
          .update(vipApplications)
          .set({
            reminderCount: 2,
            reminderSentAt: now,
            updatedAt: now,
          })
          .where(eq(vipApplications.id, a.appId));
        nudged2++;
      } else if (a.reminderCount === 0) {
        // Étage 1
        await sendDirectMessage(
          Number(a.telegramId!),
          renderTemplate(config.template1, vars)
        );
        await db
          .update(vipApplications)
          .set({
            reminderCount: 1,
            reminderSentAt: now,
            updatedAt: now,
          })
          .where(eq(vipApplications.id, a.appId));
        nudged1++;
      }
    } catch (err) {
      logger.error('[vip-dropoff] failed', err, { appId: a.appId });
      failed++;
    }
  }

  return Response.json({
    success: true,
    candidates: apps.length,
    nudged1,
    nudged2,
    failed,
  });
}
