import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vipApplications } from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';
import { sendDirectMessage } from '@/lib/telegram/helpers';
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

const STEP_LABELS: Record<EligibleStep, string> = {
  link_generated: 'Lien affilié généré',
  signup_validated: 'Inscription validée — il manque le dépôt',
  deposit_pending: 'Dépôt en attente de validation',
  deposit_validated: 'Dépôt validé — récupère ton lien Telegram',
  telegram_invited: 'Lien Telegram envoyé — rejoins le groupe',
};

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
    emailSent: 0,
    telegramSent: 0,
    skippedNoChannel: 0,
    skippedTooRecent: 0,
    errors: 0,
  };

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://boursikotons.com';

  for (const app of candidates) {
    // Filtrage temporel par étape : 1ère relance à J+2, 2ème à J+7
    const threshold =
      app.reminderCount === 0 ? TWO_DAYS_AGO : SEVEN_DAYS_AGO;
    if (app.updatedAt > threshold) {
      results.skippedTooRecent++;
      continue;
    }

    const hasEmail = !!app.user.email;
    const hasTelegram = !!app.user.telegramId;
    if (!hasEmail && !hasTelegram) {
      results.skippedNoChannel++;
      continue;
    }

    const reminderNumber = app.reminderCount === 0 ? 0 : 1;
    const firstName = app.user.telegramFirstName ?? app.user.name ?? 'là';
    const stepLabel = STEP_LABELS[app.step as EligibleStep] ?? app.step;

    let anyChannelSucceeded = false;

    // === Canal 1 : Email ===
    if (hasEmail && app.user.email) {
      try {
        const result = await sendEmail({
          to: app.user.email,
          subject:
            reminderNumber === 0
              ? `Ton funnel VIP t'attend, ${firstName}`
              : '💎 Dernier rappel — VIP Boursikotons',
          react: VipReminderEmail({
            firstName,
            reminderNumber,
            step: app.step as EligibleStep,
          }),
        });
        if (result.success) {
          results.emailSent++;
          anyChannelSucceeded = true;
        } else {
          console.error(
            `[vip-reminders] email failed for app ${app.id}`,
            result.error
          );
        }
      } catch (err) {
        console.error(`[vip-reminders] email exception for ${app.id}`, err);
      }
    }

    // === Canal 2 : Telegram DM (open rate >90%) ===
    if (hasTelegram && app.user.telegramId) {
      const tgMessage =
        reminderNumber === 0
          ? `👋 <b>${firstName}, ton funnel VIP t'attend</b>\n\n` +
            `Tu es à l'étape : <b>${stepLabel}</b>\n\n` +
            `C'est rapide à finaliser — et toujours 100% gratuit.\n\n` +
            `▶️ Continue ici : ${appUrl}/vip`
          : `💎 <b>Dernier rappel — VIP Boursikotons</b>\n\n` +
            `Tu es bloqué à : <b>${stepLabel}</b> depuis un moment.\n\n` +
            `C'est la dernière notif automatique qu'on t'envoie. Tu peux ` +
            `reprendre quand tu veux.\n\n` +
            `▶️ ${appUrl}/vip\n\n` +
            `Besoin d'aide ? Contacte @boursi_support`;

      const sent = await sendDirectMessage(
        Number(app.user.telegramId),
        tgMessage,
        { disableWebPreview: true }
      );
      if (sent) {
        results.telegramSent++;
        anyChannelSucceeded = true;
      }
    }

    if (!anyChannelSucceeded) {
      results.errors++;
      continue;
    }

    // Marque le reminder comme envoyé (au moins un canal a réussi)
    await db
      .update(vipApplications)
      .set({
        reminderCount: app.reminderCount + 1,
        reminderSentAt: new Date(),
        // NB : on ne touche pas à updatedAt sinon on perd le signal "inactif"
      })
      .where(eq(vipApplications.id, app.id));
  }

  return Response.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}

