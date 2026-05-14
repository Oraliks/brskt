import { and, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { economicEvents, users } from '@/lib/db/schema';
import { sendDirectMessage } from '@/lib/telegram/helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON toutes les 30 min : check les events économiques qui vont avoir
 * lieu dans 30-60 minutes, et DM les users opt-in.
 *
 * Stratégie :
 *  1. Liste les events avec eventAt ∈ [NOW+30min, NOW+60min] ET notifiedAt=null
 *  2. Pour chaque event, marque notifiedAt=NOW (avant le DM pour éviter
 *     double envoi si le CRON est doublé / re-trigger)
 *  3. DM tous les users avec botSubscribedEvents=true et botLastInteractionAt
 *
 * Vercel cron : "*\/30 * * * *" (toutes les 30 min)
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { getBotFeatures } = await import('@/lib/settings/bot-features');
  const features = await getBotFeatures();
  if (!features.economicAlerts) {
    return Response.json({
      success: true,
      message: 'Economic alerts désactivées par admin (toggle off)',
      notifiedEvents: 0,
    });
  }

  const now = new Date();
  const in30min = new Date(now.getTime() + 30 * 60 * 1000);
  const in60min = new Date(now.getTime() + 60 * 60 * 1000);

  // 1. Events qui arrivent dans 30-60 min
  const upcoming = await db.query.economicEvents.findMany({
    where: and(
      gte(economicEvents.eventAt, in30min),
      lte(economicEvents.eventAt, in60min),
      isNull(economicEvents.notifiedAt)
    ),
  });

  if (upcoming.length === 0) {
    return Response.json({ success: true, notifiedEvents: 0 });
  }

  // 2. Marque tous ces events comme notifiés AVANT d'envoyer (anti-double)
  await db
    .update(economicEvents)
    .set({ notifiedAt: now })
    .where(
      and(
        gte(economicEvents.eventAt, in30min),
        lte(economicEvents.eventAt, in60min),
        isNull(economicEvents.notifiedAt)
      )
    );

  // 3. Liste les users opt-in
  const recipients = await db.query.users.findMany({
    where: and(
      eq(users.botSubscribedEvents, true),
      isNotNull(users.botLastInteractionAt)
    ),
    columns: { telegramId: true },
  });

  // Construit le message commun
  const eventLines = upcoming.map((e) => {
    const time = new Date(e.eventAt).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    });
    const impactEmoji =
      e.impact === 'high' ? '🔴' : e.impact === 'medium' ? '🟠' : '🟡';
    return (
      `${impactEmoji} <b>${escapeHtml(e.name)}</b>` +
      (e.currency ? ` · ${e.currency}` : '') +
      ` · <b>${time}</b>` +
      (e.notes ? `\n   <i>${escapeHtml(e.notes)}</i>` : '')
    );
  });

  const message =
    `📅 <b>Actualités macro dans 30-60 min</b>\n\n` +
    eventLines.join('\n\n') +
    `\n\n<i>Prudence sur tes positions avant la news. Pour te désinscrire : /unsubscribe events</i>`;

  const BATCH_SIZE = 20;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((u) =>
        u.telegramId
          ? sendDirectMessage(Number(u.telegramId), message, {
              disableWebPreview: true,
            })
          : Promise.resolve(false)
      )
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
    notifiedEvents: upcoming.length,
    eligible: recipients.length,
    sent,
    failed,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
