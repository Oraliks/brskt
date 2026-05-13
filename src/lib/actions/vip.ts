'use server';

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { db } from '@/lib/db';
import { adminNotifications, vipApplications } from '@/lib/db/schema';
import { requireOnboarded } from '@/lib/auth/server';
import { generateVipInvite } from '@/lib/telegram/helpers';
import {
  vipBrokerAccountSchema,
  vipDepositSchema,
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
  const baseLink =
    process.env.IRONFX_AFFILIATE_BASE_LINK ?? 'https://ironfx.com/?ref=';
  const affiliateLink = `${baseLink}${ref}`;

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
      updatedAt: new Date(),
    })
    .where(eq(vipApplications.userId, session.user.id));

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
      updatedAt: new Date(),
    })
    .where(eq(vipApplications.id, app.id));

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
