import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vipApplications } from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';
import VipReminderEmail from '@root/emails/vip-reminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON quotidien — relance les users dont le funnel VIP est en pause.
 *
 * Règles :
 *  - Étapes éligibles : non-terminales (pas in_group, pas ejected, pas réservées)
 *  - 1ère relance : à J+2 d'inactivité (updatedAt) si reminderCount = 0
 *  - 2ème relance : à J+7 d'inactivité (updatedAt) si reminderCount = 1
 *  - Stop après 2 relances — on n'insiste pas davantage
 *
 * À configurer dans vercel.json :
 *   { "path": "/api/cron/vip-reminders", "schedule": "0 9 * * *" }
 *   (9h UTC pour ne pas envoyer en pleine nuit ; ajuster selon audience)
 */

const ELIGIBLE_STEPS = [
  'link_generated',
  'signup_validated',
  'deposit_pending',
  'deposit_validated',
  'telegram_invited',
] as const;

type EligibleStep = (typeof ELIGIBLE_STEPS)[number];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Seuils
  const TWO_DAYS_AGO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Candidats : étape éligible + reminderCount < 2 + (jamais relancé OU dernière
  // relance > 5j). On filtre ensuite par updatedAt en JS pour gérer le seuil
  // différent selon reminderCount (J+2 ou J+7).
  const candidates = await db.query.vipApplications.findMany({
    where: and(
      inArray(vipApplications.step, [...ELIGIBLE_STEPS]),
      lte(vipApplications.reminderCount, 1),
      or(
        isNull(vipApplications.reminderSentAt),
        lte(
          vipApplications.reminderSentAt,
          new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        )
      )
    ),
    with: { user: true },
    limit: 200,
  });

  const results = {
    candidates: candidates.length,
    sent: 0,
    skippedNoEmail: 0,
    skippedTooRecent: 0,
    errors: 0,
  };

  for (const app of candidates) {
    // Filtrage temporel par étape : 1ère relance à J+2, 2ème à J+7
    const threshold =
      app.reminderCount === 0 ? TWO_DAYS_AGO : SEVEN_DAYS_AGO;
    if (app.updatedAt > threshold) {
      results.skippedTooRecent++;
      continue;
    }

    if (!app.user.email) {
      results.skippedNoEmail++;
      continue;
    }

    const reminderNumber = app.reminderCount === 0 ? 0 : 1;

    try {
      const result = await sendEmail({
        to: app.user.email,
        subject:
          reminderNumber === 0
            ? `Ton funnel VIP t'attend, ${app.user.telegramFirstName ?? app.user.name}`
            : '💎 Dernier rappel — VIP Boursikotons',
        react: VipReminderEmail({
          firstName:
            app.user.telegramFirstName ?? app.user.name ?? 'là',
          reminderNumber,
          step: app.step as EligibleStep,
        }),
      });

      if (!result.success) {
        console.error(
          `[vip-reminders] send failed for app ${app.id}`,
          result.error
        );
        results.errors++;
        continue;
      }

      // Marque le reminder comme envoyé
      await db
        .update(vipApplications)
        .set({
          reminderCount: app.reminderCount + 1,
          reminderSentAt: new Date(),
          // NB : on ne touche pas à updatedAt sinon on perd la signal "inactif"
        })
        .where(eq(vipApplications.id, app.id));

      results.sent++;
    } catch (err) {
      console.error(`[vip-reminders] exception for app ${app.id}`, err);
      results.errors++;
    }
  }

  return Response.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}

