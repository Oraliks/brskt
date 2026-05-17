'use server';

import { and, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { db } from '@/lib/db';
import {
  adminNotifications,
  payments,
  vipApplications,
  vipPaidAccesses,
} from '@/lib/db/schema';
import { requireAdmin, requireOnboarded } from '@/lib/auth/server';
import { generateVipInvite } from '@/lib/telegram/helpers';
import { checkRateLimit } from '@/lib/rate-limit';
import { emitFunnelEvent } from '@/lib/analytics/funnel';
import { getPaymentProvider } from '@/lib/payments';
import { getVipPaidAccessConfig } from '@/lib/settings/vip-paid-access';
import {
  ejectPaidVipAccess,
  resendInviteByAdmin,
} from '@/lib/vip-paid-access';
import {
  vipBrokerAccountSchema,
  vipDepositSchema,
  vipPaidAccessSchema,
} from '@/lib/validations';
import type { ActionResult } from './bookings';

/**
 * Étape 1 : génère le lien d'affiliation unique pour le user.
 */
export async function startVipFunnelAction(): Promise<
  ActionResult<{ affiliateLink: string; affiliateRef: string }>
> {
  const session = await requireOnboarded();

  const existing = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.userId, session.user.id),
  });

  if (existing) {
    return {
      success: true,
      data: {
        affiliateLink: existing.affiliateLink,
        affiliateRef: existing.affiliateRef,
      },
    };
  }

  const ref = nanoid(10);
  // Le lien d'affiliation passe par notre redirect interne pour tracker
  // l'event `vip_link_clicked` avant de rediriger vers IronFX (qui recevra
  // toujours le sub_id correctement).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const affiliateLink = `${appUrl}/api/affiliate-redirect?ref=${encodeURIComponent(ref)}`;

  const [app] = await db
    .insert(vipApplications)
    .values({
      userId: session.user.id,
      affiliateLink,
      affiliateRef: ref,
      step: 'link_generated',
    })
    .returning();

  if (!app) return { success: false, error: 'Création échouée' };

  await emitFunnelEvent({
    userId: session.user.id,
    sessionId: session.user.id,
    eventName: 'vip_funnel_started',
    metadata: { affiliateRef: ref },
  });
  await emitFunnelEvent({
    userId: session.user.id,
    sessionId: session.user.id,
    eventName: 'vip_link_generated',
    metadata: { affiliateRef: ref },
  });

  revalidatePath('/vip');
  return {
    success: true,
    data: { affiliateLink, affiliateRef: ref },
  };
}

/**
 * Étape 2 : l'utilisateur déclare son numéro de compte broker.
 */
export async function submitBrokerAccountAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireOnboarded();

  // Rate limit : 10 soumissions / heure par user. Comme submitDepositAction.
  const rl = await checkRateLimit({
    key: `vip_broker:user:${session.user.id}`,
    limit: 10,
    windowSec: 3600,
  });
  if (!rl.allowed) {
    return {
      success: false,
      error: `Trop de modifications. Réessaye dans ${Math.ceil(rl.resetIn / 60)} min.`,
    };
  }

  const parsed = vipBrokerAccountSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await db
    .update(vipApplications)
    .set({
      brokerAccountId: parsed.data.brokerAccountId,
      step: 'signup_pending',
      currentStepEnteredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(vipApplications.userId, session.user.id));

  await emitFunnelEvent({
    userId: session.user.id,
    sessionId: session.user.id,
    eventName: 'vip_broker_submitted',
    metadata: { brokerAccountId: parsed.data.brokerAccountId },
  });

  after(async () => {
    await db.insert(adminNotifications).values({
      type: 'vip_signup_pending',
      payload: {
        userId: session.user.id,
        brokerAccountId: parsed.data.brokerAccountId,
      },
    });
  });

  revalidatePath('/vip');
  return { success: true, data: undefined };
}

/**
 * Étape 3 : l'utilisateur déclare son dépôt.
 */
export async function submitDepositAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireOnboarded();

  // Rate limit : 10 soumissions / heure par user. Un user normal soumet 1x.
  // Au-delà = bug/exploration côté UI ou tentative de spam admin notif.
  const rl = await checkRateLimit({
    key: `vip_deposit:user:${session.user.id}`,
    limit: 10,
    windowSec: 3600,
  });
  if (!rl.allowed) {
    return {
      success: false,
      error: `Trop de modifications. Réessaye dans ${Math.ceil(rl.resetIn / 60)} min.`,
    };
  }

  const parsed = vipDepositSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const app = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.userId, session.user.id),
  });

  if (!app) {
    return { success: false, error: 'Application VIP introuvable' };
  }

  if (app.step !== 'signup_validated' && app.step !== 'deposit_pending') {
    return {
      success: false,
      error: "Tu dois d'abord faire valider ton inscription broker",
    };
  }

  await db
    .update(vipApplications)
    .set({
      depositAmount: String(parsed.data.amount),
      depositCurrency: parsed.data.currency,
      step: 'deposit_pending',
      currentStepEnteredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(vipApplications.id, app.id));

  await emitFunnelEvent({
    userId: session.user.id,
    sessionId: session.user.id,
    eventName: 'vip_deposit_submitted',
    metadata: { amount: parsed.data.amount, currency: parsed.data.currency },
  });

  after(async () => {
    await db.insert(adminNotifications).values({
      type: 'vip_deposit_pending',
      payload: {
        userId: session.user.id,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
      },
    });
  });

  revalidatePath('/vip');
  return { success: true, data: undefined };
}

/**
 * Auto-confirme l'appartenance au groupe VIP — appelé quand le user clique
 * "J'ai rejoint, vérifier" après avoir utilisé son lien Telegram.
 *
 * Robuste vis-à-vis de l'event chat_member (qui requiert que le bot soit
 * admin du groupe). Ici on interroge directement `getChatMember`, qui marche
 * dès que le bot est *membre* du groupe.
 *
 * Idempotent : si l'user est déjà 'in_group' on renvoie success sans rien
 * faire. Si l'user n'est pas (encore) dans le groupe, on renvoie une erreur
 * lisible pour qu'il puisse cliquer à nouveau dans quelques secondes.
 */
export async function confirmVipMembershipAction(): Promise<
  ActionResult<{ inGroup: boolean }>
> {
  const session = await requireOnboarded();

  if (!session.user.telegramId) {
    return {
      success: false,
      error: 'Aucun compte Telegram lié. Reconnecte-toi via le widget.',
    };
  }

  const app = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.userId, session.user.id),
  });

  if (!app) {
    return { success: false, error: 'Application VIP introuvable' };
  }

  if (app.step === 'in_group') {
    return { success: true, data: { inGroup: true } };
  }

  if (app.step !== 'telegram_invited') {
    return {
      success: false,
      error: "Tu dois d'abord recevoir ton invitation Telegram.",
    };
  }

  const groupId = Number(process.env.VIP_GROUP_CHAT_ID);
  if (!groupId) {
    return {
      success: false,
      error: 'Configuration serveur incomplète (VIP_GROUP_CHAT_ID).',
    };
  }

  const { getBot } = await import('@/lib/telegram/bot');
  const bot = getBot();

  let isMember = false;
  try {
    const member = await bot.api.getChatMember(
      groupId,
      Number(session.user.telegramId)
    );
    // 'member' | 'administrator' | 'creator' = OK. 'restricted' = OK aussi
    // (peut écrire/lire selon perms). 'left' | 'kicked' = pas membre.
    isMember = ['member', 'administrator', 'creator', 'restricted'].includes(
      member.status
    );
  } catch (err) {
    console.error('[VIP] getChatMember failed', err);
    return {
      success: false,
      error:
        "On n'arrive pas à vérifier ton appartenance pour l'instant. Réessaye dans 30 secondes.",
    };
  }

  if (!isMember) {
    return {
      success: false,
      error:
        "On ne te voit pas encore dans le groupe. Ouvre le lien Telegram et clique 'Rejoindre', puis réessaye.",
    };
  }

  await db
    .update(vipApplications)
    .set({
      step: 'in_group',
      telegramInviteUsed: true,
      currentStepEnteredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(vipApplications.id, app.id));

  await emitFunnelEvent({
    userId: session.user.id,
    sessionId: session.user.id,
    eventName: 'vip_joined_group',
    metadata: { applicationId: app.id, source: 'manual_confirm' },
  });

  revalidatePath('/vip');
  revalidatePath('/dashboard');
  return { success: true, data: { inGroup: true } };
}

/**
 * Étape finale : génère le lien d'invitation Telegram une fois deposit_validated.
 */
export async function requestTelegramInviteAction(): Promise<
  ActionResult<{ inviteLink: string }>
> {
  const session = await requireOnboarded();

  const app = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.userId, session.user.id),
  });

  if (!app) {
    return { success: false, error: 'Application VIP introuvable' };
  }

  if (app.step !== 'deposit_validated' && app.step !== 'telegram_invited') {
    return {
      success: false,
      error: "Ton dépôt n'a pas encore été validé",
    };
  }

  if (app.telegramInviteLink && app.step === 'telegram_invited') {
    return {
      success: true,
      data: { inviteLink: app.telegramInviteLink },
    };
  }

  try {
    const link = await generateVipInvite(app.id);
    await emitFunnelEvent({
      userId: session.user.id,
      sessionId: session.user.id,
      eventName: 'vip_invite_requested',
      metadata: { applicationId: app.id },
    });
    revalidatePath('/vip');
    return { success: true, data: { inviteLink: link } };
  } catch (err) {
    console.error('[VIP] generate invite error', err);
    return {
      success: false,
      error: "Impossible de générer le lien Telegram. Contacte l'équipe.",
    };
  }
}

// ============================================================
// VIP PAID ACCESS — accès direct payant 250€
// ============================================================

/**
 * Crée un accès VIP payant et initialise la session de paiement chez le
 * provider choisi. Renvoie l'URL de redirection.
 *
 *  1. Vérifie qu'il n'y a pas déjà un accès payant actif (status <> 'ejected')
 *  2. Lit le prix depuis app_settings (fallback 250€)
 *  3. Crée la row `vip_paid_accesses` en `pending_payment`
 *  4. Crée la row `payments` avec metadata.kind = 'vip_paid_access'
 *  5. Lance la session provider
 *  6. Lie le payment à l'accès, renvoie redirectUrl
 */
export async function createPaidVipAccessAction(
  input: unknown
): Promise<ActionResult<{ redirectUrl: string }>> {
  const session = await requireOnboarded();
  const parsed = vipPaidAccessSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Rate-limit anti-spam (3 tentatives / 10 min — l'user peut retenter
  // si le provider échoue, mais pas spammer).
  const rl = await checkRateLimit({
    key: `vip_paid:user:${session.user.id}`,
    limit: 3,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return {
      success: false,
      error: 'Trop de tentatives, réessaie dans quelques minutes.',
    };
  }

  // 1) Accès existant ?
  const existing = await db.query.vipPaidAccesses.findFirst({
    where: and(
      eq(vipPaidAccesses.userId, session.user.id),
      sql`${vipPaidAccesses.status} <> 'ejected'`
    ),
  });
  if (existing && existing.status !== 'pending_payment') {
    return {
      success: false,
      error: 'Tu as déjà un accès VIP payant actif.',
    };
  }

  // 2) Prix
  const config = await getVipPaidAccessConfig();
  if (!config.enabled) {
    return {
      success: false,
      error: "L'accès payant direct n'est pas activé pour le moment.",
    };
  }
  const amount = config.priceEur;

  // 3) Crée la row paid_access (ou réutilise si pending_payment)
  let paidAccessId: string;
  if (existing) {
    paidAccessId = existing.id;
    // Mets à jour les noms au cas où l'user les change avant retentative
    await db
      .update(vipPaidAccesses)
      .set({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        amountEur: String(amount),
        updatedAt: new Date(),
      })
      .where(eq(vipPaidAccesses.id, existing.id));
  } else {
    const [inserted] = await db
      .insert(vipPaidAccesses)
      .values({
        userId: session.user.id,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        amountEur: String(amount),
        status: 'pending_payment',
      })
      .returning({ id: vipPaidAccesses.id });
    if (!inserted) {
      return { success: false, error: 'Échec de la création.' };
    }
    paidAccessId = inserted.id;
  }

  // 4-5) Provider session
  const provider = getPaymentProvider(parsed.data.paymentMethod);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const sessionInfo = await provider.createSession({
      userId: session.user.id,
      bookingId: undefined,
      amount,
      currency: 'EUR',
      metadata: {
        kind: 'vip_paid_access',
        vipPaidAccessId: paidAccessId,
        fullName: `${parsed.data.firstName} ${parsed.data.lastName}`,
      },
      returnUrl: `${appUrl}/vip?paid=${paidAccessId}`,
      cancelUrl: `${appUrl}/vip/acces-direct?cancelled=1`,
    });

    const [payment] = await db
      .insert(payments)
      .values({
        userId: session.user.id,
        amountEur: String(amount),
        method: parsed.data.paymentMethod,
        provider: provider.name,
        providerSessionId: sessionInfo.sessionId,
        status: 'pending',
        metadata: {
          kind: 'vip_paid_access',
          vipPaidAccessId: paidAccessId,
          fullName: `${parsed.data.firstName} ${parsed.data.lastName}`,
        },
      })
      .returning({ id: payments.id });

    if (!payment) {
      return { success: false, error: 'Échec création paiement' };
    }

    // 6) Lie payment ↔ paid_access
    await db
      .update(vipPaidAccesses)
      .set({ paymentId: payment.id, updatedAt: new Date() })
      .where(eq(vipPaidAccesses.id, paidAccessId));

    if (!sessionInfo.redirectUrl) {
      return {
        success: false,
        error: "Le provider n'a pas retourné de redirection",
      };
    }

    return {
      success: true,
      data: { redirectUrl: sessionInfo.redirectUrl },
    };
  } catch (err) {
    console.error('[vip-paid] createSession error', err);
    return {
      success: false,
      error: "Le paiement n'a pas pu être initialisé. Réessaie ou choisis un autre mode.",
    };
  }
}

/**
 * Action admin : renvoie manuellement un lien d'invitation à l'user.
 * Utile si le 1er DM a échoué (user a bloqué le bot, etc.) ou si l'user
 * a perdu le message.
 */
export async function resendPaidVipInviteAction(
  paidAccessId: string
): Promise<ActionResult<{ inviteSent: boolean }>> {
  await requireAdmin();
  if (typeof paidAccessId !== 'string') {
    return { success: false, error: 'ID invalide' };
  }
  const result = await resendInviteByAdmin(paidAccessId);
  revalidatePath('/admin/vip');
  return { success: true, data: { inviteSent: result.inviteSent } };
}

/**
 * Action admin : éjecte un user du VIP payant (ban+unban Telegram).
 */
export async function ejectPaidVipAccessAction(
  paidAccessId: string,
  reason: string
): Promise<ActionResult<void>> {
  await requireAdmin();
  if (typeof paidAccessId !== 'string' || !reason?.trim()) {
    return { success: false, error: 'Paramètres invalides' };
  }
  const result = await ejectPaidVipAccess(paidAccessId, reason.trim());
  if (!result.ok) {
    return { success: false, error: result.error ?? 'Échec éjection' };
  }
  revalidatePath('/admin/vip');
  return { success: true, data: undefined };
}
