import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  bookings,
  funnelEvents,
  testimonials,
  users,
  vipApplications,
} from '@/lib/db/schema';
import { sendDirectMessage } from '@/lib/telegram/helpers';
import { getAutomations, renderTemplate } from '@/lib/settings/automations';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON quotidien (10h UTC) : demande un témoignage aux users qui sont
 *  - VIP qualifiés CPA depuis >= delayDays, OU
 *  - ont une formation `completed` depuis >= delayDays,
 * et qui n'ont jamais soumis de témoignage (toutes statuts confondus).
 *
 * On marque la demande via `vip_applications.reminderSentAt` OU
 * un flag dérivé pour éviter de redemander. Pour simplifier ce premier jet :
 * on regarde seulement les users qui n'ont *aucun* testimonial en DB.
 * Si l'user a déjà soumis (même si rejeté), on n'embête plus.
 *
 * Limite : on envoie 1 fois par user. Pas de retry. C'est volontaire,
 * spam = mauvais signal.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const config = (await getAutomations()).testimonialRequest;
  if (!config.enabled) {
    return Response.json({ success: true, skipped: 'disabled' });
  }

  const now = new Date();
  const threshold = new Date(
    now.getTime() - config.delayDays * 24 * 3600 * 1000
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';

  // Anti-spam : on ne demande qu'une seule fois par user.
  // (a) Les users qui ont déjà soumis un testimonial (peu importe status)
  // (b) Les users à qui on a déjà envoyé le DM de demande
  //     (marqué via funnel_events.eventName = 'testimonial_asked')
  const [existingAuthors, askedEvents] = await Promise.all([
    db.select({ userId: testimonials.userId }).from(testimonials),
    db
      .select({ userId: funnelEvents.userId })
      .from(funnelEvents)
      .where(eq(funnelEvents.eventName, 'testimonial_asked')),
  ]);
  const alreadyAsked = new Set<string>([
    ...existingAuthors.map((r) => r.userId),
    ...askedEvents.map((r) => r.userId).filter((id): id is string => !!id),
  ]);

  // 1) VIP qualifiés depuis assez longtemps
  const qualifiedVips = await db
    .select({
      userId: vipApplications.userId,
      telegramId: users.telegramId,
      firstName: users.telegramFirstName,
      userName: users.name,
    })
    .from(vipApplications)
    .innerJoin(users, eq(users.id, vipApplications.userId))
    .where(
      and(
        eq(vipApplications.cpaQualified, true),
        eq(vipApplications.step, 'in_group'),
        lt(vipApplications.currentStepEnteredAt, threshold),
        isNotNull(users.telegramId)
      )
    )
    .limit(200);

  // 2) Formations completed depuis assez longtemps
  const completedFormations = await db
    .select({
      userId: bookings.userId,
      telegramId: users.telegramId,
      firstName: users.telegramFirstName,
      userName: users.name,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .where(
      and(
        eq(bookings.status, 'completed'),
        lt(bookings.updatedAt, threshold),
        isNotNull(users.telegramId)
      )
    )
    .limit(200);

  // Déduplication par userId — un user peut être éligible 2x (VIP qualifié
  // ET formation complétée), on lui envoie qu'une seule fois.
  const sent = new Set<string>();
  let sentCount = 0;
  let failed = 0;

  async function dm(
    userId: string,
    telegramId: number | null,
    firstName: string | null,
    userName: string,
    context: string
  ) {
    if (sent.has(userId) || alreadyAsked.has(userId) || !telegramId) return;
    sent.add(userId);
    try {
      const message = renderTemplate(config.template, {
        firstName: firstName ?? userName ?? 'Trader',
        context,
        appUrl,
      });
      await sendDirectMessage(Number(telegramId), message);
      // Marque la demande pour ne pas redemander au prochain CRON
      await db.insert(funnelEvents).values({
        userId,
        sessionId: userId,
        eventName: 'testimonial_asked',
        metadata: { context },
      });
      sentCount++;
    } catch (err) {
      logger.error('[testimonial-request] DM failed', err, { userId });
      failed++;
    }
  }

  for (const v of qualifiedVips) {
    await dm(
      v.userId,
      v.telegramId,
      v.firstName,
      v.userName,
      'membre VIP qualifié'
    );
  }
  for (const f of completedFormations) {
    await dm(
      f.userId,
      f.telegramId,
      f.firstName,
      f.userName,
      'formé chez nous'
    );
  }

  return Response.json({
    success: true,
    qualifiedVips: qualifiedVips.length,
    completedFormations: completedFormations.length,
    sent: sentCount,
    failed,
  });
}
