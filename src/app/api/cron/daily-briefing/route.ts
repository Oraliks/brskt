import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { sendDirectMessage } from '@/lib/telegram/helpers';
import { getDailyBriefing } from '@/lib/settings/daily-briefing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON quotidien — pousse le briefing matinal aux users opt-in.
 *
 * Template stocké dans app_settings (key='daily_briefing'). Si `enabled=false`,
 * aucun envoi. Le placeholder {{firstName}} est remplacé par le prénom Telegram.
 *
 * Vercel cron : "0 7 * * *" = 7h UTC = 8h CET en hiver, 9h CET en été.
 * À ajuster selon l'audience.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const briefing = await getDailyBriefing();
  if (!briefing.enabled) {
    return Response.json({
      success: true,
      message: 'Daily briefing disabled by admin',
      sent: 0,
    });
  }

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
        const message = briefing.template.replace(
          /\{\{\s*firstName\s*\}\}/g,
          firstName
        );
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
    eligible: recipients.length,
    sent,
    failed,
  });
}
