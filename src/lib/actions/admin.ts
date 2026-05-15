'use server';

import { randomUUID } from 'node:crypto';
import { and, count, eq, isNull, ne } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';
import { after } from 'next/server';
import { db } from '@/lib/db';
import {
  bookings,
  formations,
  manualIronfxStatus,
  offlineCoachings,
  promoCodes,
  testimonials,
  userBans,
  users,
  vipApplications,
} from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth/server';
import {
  adminBookingActionSchema,
  adminBulkImportOfflineCoachingSchema,
  adminCreateOfflineCoachingSchema,
  adminCreatePromoSchema,
  adminDeletePromoSchema,
  adminDeleteOfflineCoachingSchema,
  adminModerateTestimonialSchema,
  adminProgressUpdateSchema,
  adminSetUserBannedSchema,
  adminUpdateFormationSchema,
  adminUpdateOfflineCoachingSchema,
  adminUpdatePromoSchema,
  adminVipOverrideSchema,
  automationsPatchSchema,
  botFeaturesSchema,
  communityCountOverrideSchema,
  dailyBriefingSchema,
  ironfxModeSchema,
  manualIronfxUpdateSchema,
  welcomeBonusSchema,
} from '@/lib/validations';
import { setIronFXMode } from '@/lib/ironfx';
import { setWelcomeBonus } from '@/lib/settings/welcome-bonus';
import { setBotFeatures } from '@/lib/settings/bot-features';
import { setDailyBriefing } from '@/lib/settings/daily-briefing';
import { setCommunityCountOverride } from '@/lib/settings/community-count';
import { setAutomations } from '@/lib/settings/automations';
import { ejectFromTelegram } from '@/lib/telegram/helpers';
import { notifyUser } from '@/lib/notify';
import { logAdminAction } from '@/lib/admin/audit';
import { emitFunnelEvent } from '@/lib/analytics/funnel';
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

/**
 * Compte le nombre de bookings non-annulés déjà placés sur une date donnée
 * pour une formation donnée. Sert au check de capacité au moment du
 * confirm / propose_alternative.
 *
 * On match aussi bien `confirmedDate` que `adminProposedDate` car les deux
 * occupent une "place" — un user qui a une date proposée peut l'accepter,
 * il prend donc déjà un slot. `excludeBookingId` permet de ne pas se
 * compter soi-même quand on déplace son propre booking.
 */
async function countDailySessionLoad(
  formationId: string,
  date: string,
  excludeBookingId: string | null
): Promise<number> {
  const conditions = [
    eq(bookings.formationId, formationId),
    ne(bookings.status, 'cancelled'),
  ];
  if (excludeBookingId) {
    conditions.push(ne(bookings.id, excludeBookingId));
  }

  const [confirmedCount, proposedCount] = await Promise.all([
    db
      .select({ c: count() })
      .from(bookings)
      .where(and(...conditions, eq(bookings.confirmedDate, date))),
    db
      .select({ c: count() })
      .from(bookings)
      .where(
        and(
          ...conditions,
          isNull(bookings.confirmedDate),
          eq(bookings.adminProposedDate, date)
        )
      ),
  ]);

  return (confirmedCount[0]?.c ?? 0) + (proposedCount[0]?.c ?? 0);
}

export async function adminBookingAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
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
    // Check capacity sauf si l'admin force l'override (déjà vu le warning UI)
    if (!data.overrideCapacity) {
      const current = await countDailySessionLoad(
        booking.formationId,
        data.confirmedDate,
        booking.id
      );
      const capacity = booking.formation.dailyCapacity;
      if (current >= capacity) {
        return {
          success: false,
          error: `Cette date a déjà ${current}/${capacity} participant(s) sur cette formation.`,
          code: 'capacity_exceeded',
          meta: { current, capacity, date: data.confirmedDate },
        };
      }
    }

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
    if (!data.overrideCapacity) {
      const current = await countDailySessionLoad(
        booking.formationId,
        data.proposedDate,
        booking.id
      );
      const capacity = booking.formation.dailyCapacity;
      if (current >= capacity) {
        return {
          success: false,
          error: `Cette date a déjà ${current}/${capacity} participant(s) sur cette formation.`,
          code: 'capacity_exceeded',
          meta: { current, capacity, date: data.proposedDate },
        };
      }
    }

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
  } else if (data.action === 'force_cancel') {
    if (booking.status === 'completed') {
      return {
        success: false,
        error: 'Impossible d\'annuler une formation déjà terminée',
      };
    }
    await db
      .update(bookings)
      .set({
        status: 'cancelled',
        adminNotes: data.notes,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, data.bookingId));

    after(() =>
      notifyUser(booking.user, {
        telegram:
          `⚠️ <b>Réservation annulée par l'équipe</b>\n\n` +
          `<b>${escapeHtml(booking.formation.title)}</b>\n\n` +
          `<i>«${escapeHtml(data.notes)}»</i>\n\n` +
          `Si tu as déjà payé, on revient vers toi pour le remboursement.`,
      })
    );
  } else if (data.action === 'update_notes') {
    await db
      .update(bookings)
      .set({
        adminNotes: data.notes,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, data.bookingId));
  }

  // Audit log
  await logAdminAction({
    adminId: session.user.id,
    action: `booking_${data.action}`,
    targetType: 'booking',
    targetId: booking.id,
    before: {
      status: booking.status,
      confirmedDate: booking.confirmedDate,
      adminProposedDate: booking.adminProposedDate,
    },
    after:
      data.action === 'confirm'
        ? { status: 'confirmed', confirmedDate: data.confirmedDate }
        : data.action === 'propose_alternative'
        ? {
            status: 'date_proposed',
            adminProposedDate: data.proposedDate,
            notes: data.notes,
          }
        : data.action === 'update_notes'
        ? { notes: data.notes }
        : { status: 'cancelled', notes: data.notes },
  });

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
  const session = await requireAdmin();

  const app = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.id, applicationId),
    with: { user: true },
  });
  if (!app) return { success: false, error: 'Application introuvable' };

  await db
    .update(vipApplications)
    .set({
      step: 'signup_validated',
      currentStepEnteredAt: new Date(),
      updatedAt: new Date(),
    })
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

  await emitFunnelEvent({
    userId: app.userId,
    sessionId: app.userId,
    eventName: 'vip_signup_validated',
    metadata: { applicationId: app.id, validatedByAdmin: session.user.id },
  });

  await logAdminAction({
    adminId: session.user.id,
    action: 'vip_validate_signup',
    targetType: 'vip_application',
    targetId: app.id,
    before: { step: app.step },
    after: { step: 'signup_validated' },
  });

  revalidatePath('/admin/vip');
  revalidatePath('/vip');
  return { success: true, data: undefined };
}

export async function adminValidateDepositAction(
  applicationId: string
): Promise<ActionResult> {
  const session = await requireAdmin();

  const app = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.id, applicationId),
    with: { user: true },
  });
  if (!app) return { success: false, error: 'Application introuvable' };

  await db
    .update(vipApplications)
    .set({
      step: 'deposit_validated',
      currentStepEnteredAt: new Date(),
      updatedAt: new Date(),
    })
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

  await emitFunnelEvent({
    userId: app.userId,
    sessionId: app.userId,
    eventName: 'vip_deposit_validated',
    metadata: { applicationId: app.id, validatedByAdmin: session.user.id },
  });

  await logAdminAction({
    adminId: session.user.id,
    action: 'vip_validate_deposit',
    targetType: 'vip_application',
    targetId: app.id,
    before: { step: app.step },
    after: { step: 'deposit_validated' },
  });

  revalidatePath('/admin/vip');
  revalidatePath('/vip');
  return { success: true, data: undefined };
}

export async function adminEjectAction(
  userId: string,
  reason: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  const res = await ejectFromTelegram(userId, reason);
  if (!res.success) {
    return { success: false, error: res.error ?? 'Éjection échouée' };
  }
  await logAdminAction({
    adminId: session.user.id,
    action: 'vip_eject_manual',
    targetType: 'user',
    targetId: userId,
    after: { reason },
  });
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

    // Event funnel
    await emitFunnelEvent({
      userId,
      sessionId: userId,
      eventName: 'vip_qualified',
      metadata: { applicationId: vipApp.id, byAdmin: session.user.id },
    });
  }

  // Audit log : on stocke le delta avant/après le %
  await logAdminAction({
    adminId: session.user.id,
    action: 'progress_set',
    targetType: 'manual_ironfx_status',
    targetId: accountId,
    after: { tradingProgressPct, cpaQualified: nowQualified, userId },
  });

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

  await logAdminAction({
    adminId: session.user.id,
    action: 'manual_ironfx_update',
    targetType: 'manual_ironfx_status',
    targetId: accountId,
    after: {
      userId,
      signupDetected,
      depositTotal,
      cpaQualified,
      accountClosed,
      hasWithdrawn,
      notes,
    },
  });

  revalidatePath('/admin/vip');
  return { success: true, data: undefined };
}

// ============================================================
// VIP OVERRIDES (manual admin controls — bugs, exceptions)
// ============================================================

/**
 * Action admin manuelle sur une application VIP.
 *
 * Permet de :
 *  - Forcer une étape arbitraire (skip / debug)
 *  - Reset le funnel complet
 *  - Clear un warning pré-éjection
 *  - Forcer cpaQualified (true ou false) sans passer par le %
 *
 * Toutes ces actions sont loggées dans admin_audit_logs avec la raison
 * pour traçabilité. À utiliser parcimonieusement — l'usage normal passe
 * par les validations standard.
 */
export async function adminVipOverrideAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = adminVipOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { applicationId, action, targetStep, reason } = parsed.data;

  const app = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.id, applicationId),
    with: { user: true },
  });
  if (!app) return { success: false, error: 'Application introuvable' };

  const before = {
    step: app.step,
    cpaQualified: app.cpaQualified,
    ejectionWarnedAt: app.ejectionWarnedAt,
  };
  const updates: Partial<typeof vipApplications.$inferInsert> = {
    updatedAt: new Date(),
  };

  switch (action) {
    case 'set_step':
      if (!targetStep) {
        return {
          success: false,
          error: 'targetStep requis pour action set_step',
        };
      }
      updates.step = targetStep;
      updates.currentStepEnteredAt = new Date();
      // Si on passe à ejected, set ejectedAt + reason
      if (targetStep === 'ejected') {
        updates.ejectedAt = new Date();
        updates.ejectionReason = `[Override admin] ${reason}`;
      } else {
        // Si on sort de ejected vers autre chose, reset les champs
        updates.ejectedAt = null;
        updates.ejectionReason = null;
      }
      break;
    case 'reset_funnel':
      updates.step = 'link_generated';
      updates.currentStepEnteredAt = new Date();
      updates.brokerAccountId = null;
      updates.depositAmount = null;
      updates.telegramInviteLink = null;
      updates.telegramInviteUsed = false;
      updates.cpaQualified = false;
      updates.cpaQualifiedAt = null;
      updates.ejectedAt = null;
      updates.ejectionReason = null;
      updates.ejectionWarnedAt = null;
      updates.reminderCount = 0;
      updates.reminderSentAt = null;
      break;
    case 'clear_warning':
      updates.ejectionWarnedAt = null;
      break;
    case 'force_qualified':
      updates.cpaQualified = true;
      updates.cpaQualifiedAt = new Date();
      updateTag('vip-qualified-count');
      break;
    case 'unqualify':
      updates.cpaQualified = false;
      updates.cpaQualifiedAt = null;
      updateTag('vip-qualified-count');
      break;
  }

  await db
    .update(vipApplications)
    .set(updates)
    .where(eq(vipApplications.id, applicationId));

  await logAdminAction({
    adminId: session.user.id,
    action: `vip_override_${action}`,
    targetType: 'vip_application',
    targetId: app.id,
    before,
    after: { ...updates, reason },
  });

  revalidatePath('/admin/vip');
  revalidatePath('/vip');
  revalidatePath('/dashboard');
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

  await logAdminAction({
    adminId: session.user.id,
    action: 'ironfx_mode_set',
    targetType: 'settings',
    targetId: 'ironfx_mode',
    after: { mode: parsed.data.mode },
  });

  revalidatePath('/admin/settings');
  return { success: true, data: undefined };
}

/**
 * Update partiel des toggles features bot (depuis /admin/bot).
 * Update une ou plusieurs features à la fois — merge côté server.
 */
export async function adminSetBotFeaturesAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = botFeaturesSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await setBotFeatures(parsed.data, session.user.id);

  await logAdminAction({
    adminId: session.user.id,
    action: 'bot_features_update',
    targetType: 'settings',
    targetId: 'bot_features',
    after: parsed.data,
  });

  revalidatePath('/admin/bot');
  return { success: true, data: undefined };
}

/**
 * Configure le welcome bonus IronFX (toggle + contenu).
 * Quand enabled=true, affiché sur la page /vip et la landing.
 */
export async function adminSetWelcomeBonusAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = welcomeBonusSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await setWelcomeBonus(parsed.data, session.user.id);

  await logAdminAction({
    adminId: session.user.id,
    action: 'welcome_bonus_update',
    targetType: 'settings',
    targetId: 'welcome_bonus',
    after: parsed.data,
  });

  revalidatePath('/admin/settings');
  revalidatePath('/vip');
  revalidatePath('/');
  return { success: true, data: undefined };
}

/**
 * Configure le daily briefing du bot (toggle + template).
 * Push CRON à 7h UTC.
 */
export async function adminSetDailyBriefingAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = dailyBriefingSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await setDailyBriefing(parsed.data, session.user.id);

  await logAdminAction({
    adminId: session.user.id,
    action: 'daily_briefing_update',
    targetType: 'settings',
    targetId: 'daily_briefing',
    after: { enabled: parsed.data.enabled, templateLength: parsed.data.template.length },
  });

  revalidatePath('/admin/settings');
  revalidatePath('/admin/bot');
  return { success: true, data: undefined };
}

// ============================================================
// USERS
// ============================================================

// Note : Les rôles admin sont gérés UNIQUEMENT via la variable d'env
// ADMIN_TELEGRAM_IDS (cf. /api/auth/telegram qui synchronise le role à
// chaque login). Pas d'action de promotion via l'UI — c'est volontaire pour
// éviter qu'un admin compromis ne puisse promouvoir des complices.

/**
 * Ban ou un-ban un utilisateur. Le ban est stocké dans une table dédiée
 * `user_bans` (history-friendly) plutôt que dans `users`. Un user a au plus
 * un ban actif (`revoked_at IS NULL`) — index unique partiel le garantit.
 *
 * Quand banné :
 *  - Sessions actives doivent être révoquées (check à la requête)
 *  - Le bot Telegram refuse les interactions
 *  - L'utilisateur ne peut plus se reconnecter
 */
export async function adminSetUserBannedAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = adminSetUserBannedSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: 'Données invalides' };
  }

  if (parsed.data.userId === session.user.id) {
    return { success: false, error: 'Tu ne peux pas te bannir toi-même' };
  }

  const target = await db.query.users.findFirst({
    where: eq(users.id, parsed.data.userId),
    columns: { id: true, role: true, name: true },
  });

  if (!target) {
    return { success: false, error: 'Utilisateur introuvable' };
  }

  if (target.role === 'admin' && parsed.data.banned) {
    return {
      success: false,
      error: "Impossible de bannir un autre admin. Retire son rôle d'abord.",
    };
  }

  const activeBan = await db.query.userBans.findFirst({
    where: and(eq(userBans.userId, target.id), isNull(userBans.revokedAt)),
    columns: { id: true },
  });

  if (parsed.data.banned) {
    if (activeBan) {
      // Déjà banni — no-op idempotent
      return { success: true, data: undefined };
    }
    await db.insert(userBans).values({
      userId: target.id,
      bannedBy: session.user.id,
      reason: parsed.data.reason ?? null,
    });
  } else {
    if (!activeBan) {
      return { success: true, data: undefined };
    }
    await db
      .update(userBans)
      .set({ revokedAt: new Date(), revokedBy: session.user.id })
      .where(eq(userBans.id, activeBan.id));
  }

  await logAdminAction({
    adminId: session.user.id,
    action: parsed.data.banned ? 'user_banned' : 'user_unbanned',
    targetType: 'user',
    targetId: parsed.data.userId,
    before: { wasBanned: !!activeBan },
    after: { reason: parsed.data.reason ?? null },
  });

  revalidatePath('/admin/users');
  return { success: true, data: undefined };
}

/**
 * Override manuel du compteur de membres du canal Telegram.
 * Utilisé quand le bot ne peut pas être ajouté au canal (>200 membres,
 * canal privé sans option admin pour bot).
 */
export async function adminSetCommunityCountAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = communityCountOverrideSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: 'Données invalides' };
  }

  await setCommunityCountOverride(parsed.data, session.user.id);

  await logAdminAction({
    adminId: session.user.id,
    action: 'community_count_override',
    targetType: 'settings',
    targetId: 'community_count_override',
    after: parsed.data,
  });

  revalidatePath('/admin');
  revalidatePath('/admin/settings');
  revalidatePath('/dashboard');
  return { success: true, data: undefined };
}

/**
 * Update partiel des toggles / délais / templates pour les automatisations CRON.
 * Lu par chaque CRON au début de son run via getAutomations().
 */
export async function adminSetAutomationsAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = automationsPatchSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await setAutomations(parsed.data, session.user.id);

  await logAdminAction({
    adminId: session.user.id,
    action: 'automations_update',
    targetType: 'settings',
    targetId: 'automations',
    after: parsed.data,
  });

  revalidatePath('/admin/automations');
  return { success: true, data: undefined };
}

// ============================================================
// TESTIMONIALS
// ============================================================

/**
 * Publie ou rejette un témoignage soumis par un user via /temoignage.
 * Status transitionnel : pending → published / rejected.
 */
export async function adminModerateTestimonialAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = adminModerateTestimonialSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: 'Données invalides' };
  }

  const target = await db.query.testimonials.findFirst({
    where: eq(testimonials.id, parsed.data.testimonialId),
    columns: { id: true, status: true, userId: true },
  });

  if (!target) {
    return { success: false, error: 'Témoignage introuvable' };
  }

  const newStatus = parsed.data.action === 'publish' ? 'published' : 'rejected';

  await db
    .update(testimonials)
    .set({
      status: newStatus,
      moderatedBy: session.user.id,
      moderatedAt: new Date(),
      moderationNotes: parsed.data.notes ?? null,
    })
    .where(eq(testimonials.id, target.id));

  await logAdminAction({
    adminId: session.user.id,
    action: `testimonial_${parsed.data.action}`,
    targetType: 'testimonial',
    targetId: target.id,
    before: { status: target.status },
    after: { status: newStatus, notes: parsed.data.notes ?? null },
  });

  // DM le user (best-effort) pour le tenir au courant
  after(async () => {
    const u = await db.query.users.findFirst({
      where: eq(users.id, target.userId),
      columns: { telegramId: true, telegramFirstName: true },
    });
    if (!u?.telegramId) return;
    const { sendDirectMessage } = await import('@/lib/telegram/helpers');
    const msg =
      newStatus === 'published'
        ? `🎉 Ton témoignage est publié ! Merci.\n\n${APP_URL}/temoignages`
        : `Ton témoignage n'a pas été retenu cette fois.${
            parsed.data.notes ? `\n\nRaison : ${parsed.data.notes}` : ''
          }\n\nTu peux en soumettre un autre avec /temoignage <ton avis>.`;
    await sendDirectMessage(Number(u.telegramId), msg).catch(() => {});
  });

  revalidatePath('/admin/testimonials');
  revalidatePath('/temoignages');
  return { success: true, data: undefined };
}

// ============================================================
// FORMATIONS (édition admin : prix, titre, desc, durée, actif)
// ============================================================

/**
 * Update partiel d'une formation. Toutes les colonnes sont optionnelles,
 * on ne met à jour que les champs fournis. Garde le slug et le mode
 * inchangés (changer ces deux-là casserait les bookings existants).
 *
 * Note : changer le prix n'impacte PAS les bookings déjà créés. Les
 * paiements en cours utilisent le prix au moment de la réservation
 * (stocké côté payment provider via providerSessionId). Le nouveau prix
 * ne s'applique qu'aux futures réservations.
 */
export async function adminUpdateFormationAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = adminUpdateFormationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const target = await db.query.formations.findFirst({
    where: eq(formations.id, parsed.data.formationId),
  });
  if (!target) {
    return { success: false, error: 'Formation introuvable' };
  }

  const before = {
    title: target.title,
    description: target.description,
    priceEur: target.priceEur,
    durationDays: target.durationDays,
    dailyCapacity: target.dailyCapacity,
    active: target.active,
  };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description;
  if (parsed.data.priceEur !== undefined)
    updates.priceEur = String(parsed.data.priceEur);
  if (parsed.data.durationDays !== undefined)
    updates.durationDays = parsed.data.durationDays;
  if (parsed.data.dailyCapacity !== undefined)
    updates.dailyCapacity = parsed.data.dailyCapacity;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;

  await db
    .update(formations)
    .set(updates)
    .where(eq(formations.id, parsed.data.formationId));

  await logAdminAction({
    adminId: session.user.id,
    action: 'formation_update',
    targetType: 'formation',
    targetId: parsed.data.formationId,
    before,
    after: parsed.data,
  });

  revalidatePath('/admin/formations');
  revalidatePath('/formation');
  revalidatePath('/formation/reserver');
  return { success: true, data: undefined };
}

// ============================================================
// PROMO CODES
// ============================================================

export async function adminCreatePromoAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = adminCreatePromoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const code = data.code.toUpperCase();

  // Check unicité — gère gracieusement la collision (l'index unique le
  // rattraperait sinon mais avec un message Postgres opaque).
  const existing = await db.query.promoCodes.findFirst({
    where: eq(promoCodes.code, code),
  });
  if (existing) {
    return { success: false, error: `Le code "${code}" existe déjà.` };
  }

  await db.insert(promoCodes).values({
    code,
    discountType: data.discountType,
    discountValue: String(data.discountValue),
    validFrom: data.validFrom ? new Date(data.validFrom) : null,
    validUntil: data.validUntil ? new Date(data.validUntil) : null,
    maxUses: data.maxUses ?? null,
    applicableMode: data.applicableMode ?? null,
    active: data.active,
    notes: data.notes ?? null,
    createdBy: session.user.id,
  });

  await logAdminAction({
    adminId: session.user.id,
    action: 'promo_create',
    targetType: 'promo',
    targetId: code,
    after: data,
  });

  revalidatePath('/admin/promos');
  return { success: true, data: undefined };
}

export async function adminUpdatePromoAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = adminUpdatePromoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Données invalides' };
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;
  if (parsed.data.discountValue !== undefined)
    updates.discountValue = String(parsed.data.discountValue);
  if (parsed.data.validUntil !== undefined)
    updates.validUntil = parsed.data.validUntil
      ? new Date(parsed.data.validUntil)
      : null;
  if (parsed.data.maxUses !== undefined) updates.maxUses = parsed.data.maxUses;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

  await db
    .update(promoCodes)
    .set(updates)
    .where(eq(promoCodes.id, parsed.data.promoId));

  await logAdminAction({
    adminId: session.user.id,
    action: 'promo_update',
    targetType: 'promo',
    targetId: parsed.data.promoId,
    after: parsed.data,
  });

  revalidatePath('/admin/promos');
  return { success: true, data: undefined };
}

export async function adminDeletePromoAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = adminDeletePromoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Données invalides' };
  }

  // Soft delete via active=false plutôt que vraie suppression : si un
  // booking référence ce code via booking_promo_codes, on perd la trace.
  await db
    .update(promoCodes)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(promoCodes.id, parsed.data.promoId));

  await logAdminAction({
    adminId: session.user.id,
    action: 'promo_delete',
    targetType: 'promo',
    targetId: parsed.data.promoId,
  });

  revalidatePath('/admin/promos');
  return { success: true, data: undefined };
}

// ============================================================
// OFFLINE COACHINGS
// ============================================================

export async function adminCreateOfflineCoachingAction(
  input: unknown
): Promise<ActionResult<{ coachingId: string }>> {
  const session = await requireAdmin();
  const parsed = adminCreateOfflineCoachingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const [inserted] = await db
    .insert(offlineCoachings)
    .values({
      fullName: parsed.data.fullName,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      mode: parsed.data.mode,
      totalAmountEur: String(parsed.data.totalAmountEur),
      paidAmountEur: String(parsed.data.paidAmountEur),
      scheduledDate: parsed.data.scheduledDate ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning({ id: offlineCoachings.id });

  await logAdminAction({
    adminId: session.user.id,
    action: 'offline_coaching_create',
    targetType: 'offline_coaching',
    targetId: inserted?.id ?? '',
    after: parsed.data,
  });

  revalidatePath('/admin/coachings');
  revalidatePath('/admin/calendar');
  return inserted
    ? { success: true, data: { coachingId: inserted.id } }
    : { success: false, error: 'Création échouée' };
}

/**
 * Import bulk depuis paste Excel. Insert en transaction — tout ou rien.
 * Renvoie le nombre de lignes insérées.
 */
export async function adminBulkImportOfflineCoachingsAction(
  input: unknown
): Promise<ActionResult<{ inserted: number }>> {
  const session = await requireAdmin();
  const parsed = adminBulkImportOfflineCoachingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const rows = parsed.data.items.map((item) => ({
    fullName: item.fullName,
    email: item.email ?? null,
    phone: item.phone ?? null,
    mode: item.mode,
    totalAmountEur: String(item.totalAmountEur),
    paidAmountEur: String(item.paidAmountEur),
    scheduledDate: item.scheduledDate ?? null,
    notes: item.notes ?? null,
  }));

  await db.insert(offlineCoachings).values(rows);

  await logAdminAction({
    adminId: session.user.id,
    action: 'offline_coaching_bulk_import',
    targetType: 'offline_coaching',
    targetId: 'bulk',
    after: { count: rows.length },
  });

  revalidatePath('/admin/coachings');
  revalidatePath('/admin/calendar');
  return { success: true, data: { inserted: rows.length } };
}

export async function adminUpdateOfflineCoachingAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = adminUpdateOfflineCoachingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Données invalides' };
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of [
    'fullName',
    'email',
    'phone',
    'mode',
    'scheduledDate',
    'notes',
    'status',
  ] as const) {
    if (parsed.data[k] !== undefined) updates[k] = parsed.data[k];
  }
  if (parsed.data.totalAmountEur !== undefined)
    updates.totalAmountEur = String(parsed.data.totalAmountEur);
  if (parsed.data.paidAmountEur !== undefined)
    updates.paidAmountEur = String(parsed.data.paidAmountEur);

  await db
    .update(offlineCoachings)
    .set(updates)
    .where(eq(offlineCoachings.id, parsed.data.coachingId));

  await logAdminAction({
    adminId: session.user.id,
    action: 'offline_coaching_update',
    targetType: 'offline_coaching',
    targetId: parsed.data.coachingId,
    after: parsed.data,
  });

  revalidatePath('/admin/coachings');
  revalidatePath('/admin/calendar');
  return { success: true, data: undefined };
}

export async function adminDeleteOfflineCoachingAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = adminDeleteOfflineCoachingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Données invalides' };
  }

  await db
    .delete(offlineCoachings)
    .where(eq(offlineCoachings.id, parsed.data.coachingId));

  await logAdminAction({
    adminId: session.user.id,
    action: 'offline_coaching_delete',
    targetType: 'offline_coaching',
    targetId: parsed.data.coachingId,
  });

  revalidatePath('/admin/coachings');
  revalidatePath('/admin/calendar');
  return { success: true, data: undefined };
}

// ============================================================
// iCal feed token (sync Apple Calendar / Google / Outlook)
// ============================================================

/**
 * Récupère le token iCal de l'admin courant, ou le génère si absent.
 * Le token permet de construire l'URL `webcal://.../api/calendar/feed/{token}`
 * à abonner dans n'importe quel client compatible iCal.
 */
export async function getOrCreateAdminIcalTokenAction(): Promise<
  ActionResult<{ token: string }>
> {
  const session = await requireAdmin();
  const fresh = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { icalToken: true },
  });
  if (fresh?.icalToken) {
    return { success: true, data: { token: fresh.icalToken } };
  }
  const token = randomUUID();
  await db
    .update(users)
    .set({ icalToken: token, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));
  await logAdminAction({
    adminId: session.user.id,
    action: 'ical_token_create',
    targetType: 'user',
    targetId: session.user.id,
  });
  return { success: true, data: { token } };
}

/**
 * Régénère un nouveau token iCal — invalide l'ancienne URL.
 * À utiliser quand l'admin pense que l'URL a fuité.
 */
export async function regenerateAdminIcalTokenAction(): Promise<
  ActionResult<{ token: string }>
> {
  const session = await requireAdmin();
  const token = randomUUID();
  await db
    .update(users)
    .set({ icalToken: token, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));
  await logAdminAction({
    adminId: session.user.id,
    action: 'ical_token_rotate',
    targetType: 'user',
    targetId: session.user.id,
  });
  return { success: true, data: { token } };
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
