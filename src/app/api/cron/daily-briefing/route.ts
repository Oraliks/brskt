import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { sendDirectMessage } from '@/lib/telegram/helpers';
import { getDailyBriefing } from '@/lib/settings/daily-briefing';
import { getAutomations } from '@/lib/settings/automations';
import { generateAutoBriefing } from '@/lib/briefing-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON quotidien (7h UTC) — pousse le briefing matinal aux users opt-in.
 *
 * 2 modes (configurable via /admin/automations) :
 *  - `auto` : briefing composé en runtime depuis Yahoo Finance + macro
 *    events. Aucune intervention admin.
 *  - `manual` : template stocké dans app_settings, édité depuis
 *    /admin/settings → tab Daily briefing.
 *
 * Master switch : daily_briefing.enabled (legacy) reste prioritaire. Si OFF,
 * aucun envoi quel que soit le mode.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [briefingLegacy, automations] = await Promise.all([
    getDailyBriefing(),
    getAutomations(),
  ]);

  if (!briefingLegacy.enabled) {
    return Response.json({
      success: true,
      message: 'Daily briefing disabled by admin',
      sent: 0,
    });
  }

  const baseTemplate =
    automations.briefingMode === 'auto'
      ? await generateAutoBriefing()
      : briefingLegacy.template;

  // Users opt-in pour le briefing + ayant déjà interagi avec le bot
  const recipients = await db.query.users.findMany({
    where: and(
      eq(users.botSubscribedBriefing, true),
      isNotNull(users.botLastInteractionAt)
    ),
    columns: { telegramId: true, telegramFirstName: true, name: true },
  });

  const BATCH_SIZE = 20;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (u) => {
        if (!u.telegramId) return false;
        const firstName = u.telegramFirstName ?? u.name ?? '';
        // Support des 2 syntaxes : {firstName} (auto) ET {{firstName}} (legacy)
        const message = baseTemplate
          .replace(/\{firstName\}/g, firstName)
          .replace(/\{\{\s*firstName\s*\}\}/g, firstName);
        return sendDirectMessage(Number(u.telegramId), message, {
          disableWebPreview: true,
        });
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value === true) sent++;
      else failed++;
    }
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((res) => setTimeout(res, 1000));
    }
  }

  return Response.json({
    success: true,
    mode: automations.briefingMode,
    eligible: recipients.length,
    sent,
    failed,
  });
}
