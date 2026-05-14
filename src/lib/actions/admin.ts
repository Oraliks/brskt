'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';
import { after } from 'next/server';
import { db } from '@/lib/db';
import {
  bookings,
  manualIronfxStatus,
  vipApplications,
} from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth/server';
import {
  adminBookingActionSchema,
  adminProgressUpdateSchema,
  ironfxModeSchema,
  manualIronfxUpdateSchema,
} from '@/lib/validations';
import { setIronFXMode } from '@/lib/ironfx';
import { ejectFromTelegram } from '@/lib/telegram/helpers';
import { notifyUser } from '@/lib/notify';
import BookingConfirmedEmail from '@root/emails/booking-confirmed';
import BookingProposedEmail from '@root/emails/booking-proposed';
import BookingRefusedEmail from '@root/emails/booking-refused';
import VipSignupValidatedEmail from '@root/emails/vip-signup-validated';
import VipDepositValidatedEmail from '@root/emails/vip-deposit-validated';
import { formatDate } from '@/lib/utils';
import type { ActionResult } from './bookings';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

// ============================================================
// BOOKINGS
// ============================================================

export async function adminBookingAction(
  input: unknown
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = adminBookingActionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, data.bookingId),
    with: { user: true, formation: true },
  });

  if (!booking) {
    return { success: false, error: 'Réservation introuvable' };
  }

  const firstName =
    booking.user.telegramFirstName ?? booking.user.name ?? '';

  if (data.action === 'confirm') {
    await db
      .update(bookings)
      .set({
        confirmedDate: data.confirmedDate,
        status: 'confirmed',
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, data.bookingId));

    after(() =>
      notifyUser(booking.user, {
        email: {
          subject: `Confirmé — ${booking.formation.title}`,
          react: BookingConfirmedEmail({
            firstName,
            formationTitle: booking.formation.title,
            isOnsite: booking.formation.mode === 'onsite',
            confirmedDate: formatDate(data.confirmedDate),
            bookingId: booking.id,
          }),
        },
        telegram:
          `✅ <b>Ta formation est confirmée</b>\n\n` +
          `<b>${escapeHtml(booking.formation.title)}</b>\n` +
          `Date : <b>${escapeHtml(formatDate(data.confirmedDate))}</b>\n\n` +
          `Tu recevras les détails pratiques quelques jours avant.\n` +
          `Voir : ${APP_URL}/dashboard`,
      })
    );
  } else if (data.action === 'propose_alternative') {
    await db
      .update(bookings)
      .set({
        adminProposedDate: data.proposedDate,
        adminNotes: data.notes ?? null,
        status: 'date_proposed',
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, data.bookingId));

    after(() =>
      notifyUser(booking.user, {
        email: {
          subject: `Nouvelle date proposée — ${booking.formation.title}`,
          react: BookingProposedEmail({
            firstName,
            formationTitle: booking.formation.title,
            proposedDate: formatDate(data.proposedDate),
            adminNotes: data.notes,
            bookingId: booking.id,
          }),
        },
        telegram:
          `📅 <b>L'équipe te propose une autre date</b>\n\n` +
          `<b>${escapeHtml(booking.formation.title)}</b>\n` +
          `Date proposée : <b>${escapeHtml(formatDate(data.proposedDate))}</b>\n` +
          (data.notes ? `\n<i>«${escapeHtml(data.notes)}»</i>\n` : '') +
          `\nTu peux accepter ou refuser depuis ton dashboard :\n${APP_URL}/dashboard`,
      })
    );
  } else if (data.action === 'refuse') {
    const reason = data.notes ?? 'Pas de raison précisée.';
    await db
      .update(bookings)
      .set({
        status: 'cancelled',
        adminNotes: data.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, data.bookingId));

    after(() =>
      notifyUser(booking.user, {
        email: {
          subject: `Réservation refusée — ${booking.formation.title}`,
          react: BookingRefusedEmail({
            firstName,
            formationTitle: booking.formation.title,
            adminNotes: reason,
            bookingId: booking.id,
          }),
        },
        telegram:
          `❌ <b>Réservation refusée</b>\n\n` +
          `<b>${escapeHtml(booking.formation.title)}</b>\n\n` +
          `<i>«${escapeHtml(reason)}»</i>\n\n` +
          `Tu seras remboursé intégralement dans les 48h.\n` +
          `Détails : ${APP_URL}/dashboard`,
      })
    );
  }

  revalidatePath('/admin/bookings');
  revalidatePath('/dashboard');
  return { success: true, data: undefined };
}

// ============================================================
// VIP
// ============================================================

export async function adminValidateSignupAction(
  applicationId: string
): Promise<ActionResult> {
  await requireAdmin();

  const app = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.id, applicationId),
    with: { user: true },
  });
  if (!app) return { success: false, error: 'Application introuvable' };

  await db
    .update(vipApplications)
    .set({ step: 'signup_validated', updatedAt: new Date() })
    .where(eq(vipApplications.id, applicationId));

  const firstName = app.user.telegramFirstName ?? app.user.name ?? '';

  after(() =>
    notifyUser(app.user, {
      email: {
        subject: 'Inscription broker validée — étape suivante',
        react: VipSignupValidatedEmail({ firstName }),
      },
      telegram:
        `✅ <b>Ton inscription broker est validée</b>\n\n` +
        `Tu peux maintenant déposer (250€ minimum) puis revenir sur ` +
        `${APP_URL}/vip pour déclarer ton dépôt.`,
    })
  );

  revalidatePath('/admin/vip');
  revalidatePath('/vip');
  return { success: true, data: undefined };
}

export async function adminValidateDepositAction(
  applicationId: string
): Promise<ActionResult> {
  await requireAdmin();

  const app = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.id, applicationId),
    with: { user: true },
  });
  if (!app) return { success: false, error: 'Application introuvable' };

  await db
    .update(vipApplications)
    .set({ step: 'deposit_validated', updatedAt: new Date() })
    .where(eq(vipApplications.id, applicationId));

  const firstName = app.user.telegramFirstName ?? app.user.name ?? '';

  after(() =>
    notifyUser(app.user, {
      email: {
        subject: 'Dépôt validé — récupère ton lien Telegram VIP',
        react: VipDepositValidatedEmail({ firstName }),
      },
      telegram:
        `🎉 <b>Bienvenue dans le VIP</b>\n\n` +
        `Ton dépôt est validé. Récupère ton lien d'invitation Telegram ` +
        `(à usage unique, expire en 24h) :\n${APP_URL}/vip`,
    })
  );

  revalidatePath('/admin/vip');
  revalidatePath('/vip');
  return { success: true, data: undefined };
}

export async function adminEjectAction(
  userId: string,
  reason: string
): Promise<ActionResult> {
  await requireAdmin();
  const res = await ejectFromTelegram(userId, reason);
  if (!res.success) {
    return { success: false, error: res.error ?? 'Éjection échouée' };
  }
  revalidatePath('/admin/vip');
  revalidatePath('/vip');
  revalidatePath('/dashboard');
  return { success: true, data: undefined };
}

/**
 * Met à jour la progression de trading d'un user (mode manuel IronFX).
 *
 * Pattern : l'admin ajuste un % de 0 à 100. Quand le % atteint 100,
 * on flag cpaQualified=true sur manualIronfxStatus ET vipApplications,
 * et on envoie une notif "Félicitations" au user.
 *
 * Auto-crée le row manual_ironfx_status si pas encore présent.
 */
export async function adminSetTradingProgressAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = adminProgressUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Données invalides' };
  }

  const { accountId, userId, tradingProgressPct } = parsed.data;
  const nowQualified = tradingProgressPct >= 100;

  // Upsert manual_ironfx_status
  await db
    .insert(manualIronfxStatus)
    .values({
      accountId,
      userId,
      tradingProgressPct,
      cpaQualified: nowQualified,
      updatedBy: session.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: manualIronfxStatus.accountId,
      set: {
        tradingProgressPct,
        cpaQualified: nowQualified,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
    });

  // Sync vipApplications.cpaQualified (le CRON le fait aussi, mais on
  // veut que ce soit instantané pour la notif)
  const vipApp = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.userId, userId),
    with: { user: true },
  });

  if (vipApp && nowQualified && !vipApp.cpaQualified) {
    await db
      .update(vipApplications)
      .set({
        cpaQualified: true,
        cpaQualifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(vipApplications.id, vipApp.id));

    // Notif "Félicitations" au user
    after(() => {
      const firstName =
        vipApp.user.telegramFirstName ?? vipApp.user.name ?? '';
      return notifyUser(vipApp.user, {
        telegram:
          `🎉 <b>Félicitations ${escapeHtml(firstName)} !</b>\n\n` +
          `Tu es maintenant à <b>100%</b> de progression de trading.\n` +
          `Ta place dans le VIP est sécurisée — pas de risque d'éjection sur retrait.`,
        // Pas d'email dédié pour l'instant, juste Telegram (event rare)
      });
    });

    // Invalide le cache du compteur "X membres qualifiés" sur la landing
    updateTag('vip-qualified-count');
  }

  revalidatePath('/admin/vip');
  revalidatePath('/vip');
  revalidatePath('/dashboard');
  return { success: true, data: undefined };
}

export async function adminUpdateManualIronfxAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = manualIronfxUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const {
    accountId,
    userId,
    signupDetected,
    depositTotal,
    cpaQualified,
    accountClosed,
    hasWithdrawn,
    notes,
  } = parsed.data;

  await db
    .insert(manualIronfxStatus)
    .values({
      accountId,
      userId,
      signupDetected: signupDetected ?? false,
      depositTotal: depositTotal !== undefined ? String(depositTotal) : '0',
      cpaQualified: cpaQualified ?? false,
      accountClosed: accountClosed ?? false,
      hasWithdrawn: hasWithdrawn ?? false,
      notes: notes ?? null,
      updatedBy: session.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: manualIronfxStatus.accountId,
      set: {
        signupDetected,
        depositTotal:
          depositTotal !== undefined ? String(depositTotal) : undefined,
        cpaQualified,
        accountClosed,
        hasWithdrawn,
        notes,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
    });

  // Invalide le compteur landing si on a touché cpaQualified
  if (cpaQualified !== undefined) {
    updateTag('vip-qualified-count');
  }

  revalidatePath('/admin/vip');
  return { success: true, data: undefined };
}

// ============================================================
// SETTINGS
// ============================================================

export async function adminSetIronfxModeAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = ironfxModeSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: 'Mode invalide' };
  }

  await setIronFXMode(parsed.data.mode, session.user.id);
  revalidatePath('/admin/settings');
  return { success: true, data: undefined };
}

// ============================================================
// Helpers
// ============================================================

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
