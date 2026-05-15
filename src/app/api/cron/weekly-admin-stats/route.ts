import { and, count, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  bookings,
  formationWaitlist,
  payments,
  testimonials,
  users,
  vipApplications,
} from '@/lib/db/schema';
import { sendDirectMessage } from '@/lib/telegram/helpers';
import { getAutomations } from '@/lib/settings/automations';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON quotidien (toutes les heures pour matcher l'heure UTC choisie par
 * l'admin) : envoie un récap des 7 derniers jours aux admins.
 *
 * Idempotence : ne tourne que si on est sur le jour/heure configuré
 * (dayOfWeek + hourUtc). Sinon skip silencieusement.
 *
 * Récap calculé en SQL : bookings créés, paiements OK, VIP rejoints,
 * VIP qualifiés, VIP éjectés, waitlist, témoignages soumis.
 *
 * Destinataires : tous les telegramId dans ADMIN_TELEGRAM_IDS.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const config = (await getAutomations()).weeklyAdminStats;
  if (!config.enabled) {
    return Response.json({ success: true, skipped: 'disabled' });
  }

  const now = new Date();
  // Skip si on n'est pas sur le bon jour/heure (CRON tourne chaque heure).
  if (
    now.getUTCDay() !== config.dayOfWeek ||
    now.getUTCHours() !== config.hourUtc
  ) {
    return Response.json({
      success: true,
      skipped: `wrong slot (cur ${now.getUTCDay()}@${now.getUTCHours()}h UTC, target ${config.dayOfWeek}@${config.hourUtc}h)`,
    });
  }

  const adminIdsRaw = process.env.ADMIN_TELEGRAM_IDS;
  if (!adminIdsRaw) {
    return Response.json({
      success: false,
      error: 'ADMIN_TELEGRAM_IDS not configured',
    });
  }
  const adminIds = adminIdsRaw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  // Fenêtre : 7 jours glissants
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [
    [bookingsNew],
    [paymentsOk],
    [vipJoined],
    [vipQualified],
    [vipEjected],
    [waitlistNew],
    [testimonialsNew],
    [usersNew],
  ] = await Promise.all([
    db.select({ c: count() }).from(bookings).where(gte(bookings.createdAt, weekAgo)),
    db
      .select({ c: count() })
      .from(payments)
      .where(
        and(eq(payments.status, 'completed'), gte(payments.completedAt, weekAgo))
      ),
    db
      .select({ c: count() })
      .from(vipApplications)
      .where(
        and(
          eq(vipApplications.step, 'in_group'),
          gte(vipApplications.currentStepEnteredAt, weekAgo)
        )
      ),
    db
      .select({ c: count() })
      .from(vipApplications)
      .where(
        and(eq(vipApplications.cpaQualified, true), gte(vipApplications.updatedAt, weekAgo))
      ),
    db
      .select({ c: count() })
      .from(vipApplications)
      .where(
        and(
          eq(vipApplications.step, 'ejected'),
          gte(vipApplications.ejectedAt, weekAgo)
        )
      ),
    db
      .select({ c: count() })
      .from(formationWaitlist)
      .where(gte(formationWaitlist.createdAt, weekAgo)),
    db
      .select({ c: count() })
      .from(testimonials)
      .where(gte(testimonials.createdAt, weekAgo)),
    db.select({ c: count() }).from(users).where(gte(users.createdAt, weekAgo)),
  ]);

  const monday = new Date(weekAgo);
  const sunday = new Date(now);

  const message =
    `📊 <b>Récap semaine</b>\n` +
    `${formatDate(monday)} → ${formatDate(sunday)}\n\n` +
    `👤 Nouveaux users : <b>${usersNew?.c ?? 0}</b>\n` +
    `📚 Réservations : <b>${bookingsNew?.c ?? 0}</b>\n` +
    `💳 Paiements OK : <b>${paymentsOk?.c ?? 0}</b>\n\n` +
    `💎 VIP\n` +
    `  • Rejoints : <b>${vipJoined?.c ?? 0}</b>\n` +
    `  • Qualifiés CPA : <b>${vipQualified?.c ?? 0}</b>\n` +
    `  • Éjectés : <b>${vipEjected?.c ?? 0}</b>\n\n` +
    `⏳ Waitlist : <b>${waitlistNew?.c ?? 0}</b>\n` +
    `⭐ Témoignages soumis : <b>${testimonialsNew?.c ?? 0}</b>`;

  let sent = 0;
  let failed = 0;
  for (const id of adminIds) {
    try {
      await sendDirectMessage(id, message);
      sent++;
    } catch (err) {
      logger.error('[weekly-admin-stats] DM failed', err, { telegramId: id });
      failed++;
    }
  }

  return Response.json({
    success: true,
    recipients: adminIds.length,
    sent,
    failed,
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}
