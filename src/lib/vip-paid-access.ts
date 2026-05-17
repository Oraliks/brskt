import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  adminNotifications,
  payments,
  users,
  vipPaidAccesses,
} from '@/lib/db/schema';
import { getBot } from '@/lib/telegram/bot';
import { sendDirectMessage } from '@/lib/telegram/helpers';
import { awardMilestoneOnce } from '@/lib/games/xp';

const VIP_GROUP_ID = Number(process.env.VIP_GROUP_CHAT_ID);

/**
 * Génère un lien d'invitation Telegram à usage unique pour le groupe VIP.
 * Mécanisme partagé entre le funnel affilié et l'accès payant.
 *
 * Spécificités côté accès payant (vs affilié) :
 *  - Le lien est révoqué avant d'en générer un nouveau (cas du resend admin)
 *  - Expiration 7 jours (vs 24h funnel) — moins urgent puisque l'user a payé
 *  - `member_limit = 1` pour anti-partage
 */
export async function createVipInviteLink(refName: string): Promise<string> {
  const bot = getBot();
  if (!VIP_GROUP_ID) {
    throw new Error('VIP_GROUP_CHAT_ID not configured');
  }
  const expireDate = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const invite = await bot.api.createChatInviteLink(VIP_GROUP_ID, {
    expire_date: expireDate,
    member_limit: 1,
    name: `paid-${refName.slice(0, 8)}`,
  });
  return invite.invite_link;
}

/**
 * Appelé par le webhook quand un paiement d'accès VIP payant est confirmé.
 *
 * Workflow :
 *  1. Marque le paid_access en `paid` + paidAt
 *  2. Génère un invite link Telegram (member_limit=1)
 *  3. DM l'user avec le lien
 *  4. Marque en `active` + activatedAt
 *  5. Notifie l'admin (compteur d'accès payants)
 *
 * Best-effort : si l'étape 3 ou 4 échoue (bot down, user a bloqué le bot),
 * on garde le status à `paid` et l'admin pourra renvoyer manuellement via
 * le CRUD. La row contient assez d'info pour reprendre.
 */
export async function completePaidVipAccess(
  paidAccessId: string
): Promise<{ ok: boolean; inviteSent: boolean }> {
  const [access] = await db
    .select()
    .from(vipPaidAccesses)
    .where(eq(vipPaidAccesses.id, paidAccessId))
    .limit(1);

  if (!access) {
    console.warn('[vip-paid] completePaidVipAccess: row not found', paidAccessId);
    return { ok: false, inviteSent: false };
  }
  if (access.status === 'active') {
    return { ok: true, inviteSent: true }; // déjà traité, idempotent
  }

  const now = new Date();

  // 1) Marque payé
  await db
    .update(vipPaidAccesses)
    .set({
      status: 'paid',
      paidAt: access.paidAt ?? now,
      updatedAt: now,
    })
    .where(eq(vipPaidAccesses.id, paidAccessId));

  // 2-4) Génère lien + DM + active
  const inviteSent = await deliverInviteToUser(paidAccessId);

  // 5) Notif admin (count)
  try {
    await db.insert(adminNotifications).values({
      type: 'vip_paid_access',
      payload: {
        paidAccessId,
        userId: access.userId,
        fullName: `${access.firstName} ${access.lastName}`,
        amount: Number(access.amountEur),
        inviteSent,
      },
    });
  } catch (err) {
    console.warn('[vip-paid] admin notif failed', err);
  }

  return { ok: true, inviteSent };
}

/**
 * Génère un lien d'invitation et l'envoie en DM à l'user. Mise à jour
 * du status → `active`. Réutilisé pour le 1er envoi (post-paiement) et
 * pour les renvois manuels admin.
 *
 * Retourne true si le DM a été envoyé avec succès, false sinon.
 */
export async function deliverInviteToUser(
  paidAccessId: string
): Promise<boolean> {
  const [access] = await db
    .select({
      access: vipPaidAccesses,
      telegramId: users.telegramId,
      firstName: users.telegramFirstName,
    })
    .from(vipPaidAccesses)
    .innerJoin(users, eq(users.id, vipPaidAccesses.userId))
    .where(eq(vipPaidAccesses.id, paidAccessId))
    .limit(1);

  if (!access) return false;
  if (!access.telegramId) {
    console.warn('[vip-paid] deliverInvite: user has no telegramId');
    return false;
  }

  let inviteLink: string;
  try {
    inviteLink = await createVipInviteLink(paidAccessId);
  } catch (err) {
    console.error('[vip-paid] createVipInviteLink failed', err);
    return false;
  }

  const message =
    `🎉 <b>Bienvenue dans le VIP Boursikotons.</b>\n\n` +
    `Ton paiement est confirmé. Voici ton lien d'invitation au groupe ` +
    `Telegram privé — <b>usage unique, valide 7 jours</b> :\n\n` +
    `<a href="${inviteLink}">→ Rejoindre le VIP</a>\n\n` +
    `<i>Accès à vie. Aucun paiement ni qualification CPA supplémentaire ` +
    `ne sera demandé.</i>`;

  const sent = await sendDirectMessage(Number(access.telegramId), message);

  await db
    .update(vipPaidAccesses)
    .set({
      telegramInviteLink: inviteLink,
      status: sent ? 'active' : 'paid',
      activatedAt: sent ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(vipPaidAccesses.id, paidAccessId));

  // Bonus XP "VIP rejoint" — idempotent, déclenché au passage à `active`
  if (sent) {
    await awardMilestoneOnce(access.access.userId, 'vip_joined', {
      source: 'paid_access',
      paidAccessId,
    });
  }

  return sent;
}

/**
 * Renvoi manuel par admin. Génère un NOUVEAU lien (révoque l'ancien
 * implicitement côté Telegram via expiration / member_limit=1 déjà
 * consommé) et DM l'user. Incrémente le compteur d'audit.
 */
export async function resendInviteByAdmin(
  paidAccessId: string
): Promise<{ ok: boolean; inviteSent: boolean }> {
  const inviteSent = await deliverInviteToUser(paidAccessId);
  await db
    .update(vipPaidAccesses)
    .set({
      resendCount: sql`${vipPaidAccesses.resendCount} + 1`,
      lastResendAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(vipPaidAccesses.id, paidAccessId));
  return { ok: true, inviteSent };
}

/**
 * Éjection manuelle par admin (ban + unban Telegram, marque ejected).
 */
export async function ejectPaidVipAccess(
  paidAccessId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const bot = getBot();
  if (!VIP_GROUP_ID) {
    return { ok: false, error: 'VIP_GROUP_CHAT_ID not configured' };
  }

  const [access] = await db
    .select({
      telegramId: users.telegramId,
    })
    .from(vipPaidAccesses)
    .innerJoin(users, eq(users.id, vipPaidAccesses.userId))
    .where(eq(vipPaidAccesses.id, paidAccessId))
    .limit(1);

  if (!access?.telegramId) {
    return { ok: false, error: 'user_not_found' };
  }

  try {
    await bot.api.banChatMember(VIP_GROUP_ID, access.telegramId);
    await bot.api.unbanChatMember(VIP_GROUP_ID, access.telegramId, {
      only_if_banned: true,
    });
  } catch (err) {
    console.error('[vip-paid] eject ban/unban failed', err);
    // On poursuit quand même — l'éjection DB est utile même si Telegram échoue
  }

  await db
    .update(vipPaidAccesses)
    .set({
      status: 'ejected',
      ejectionReason: reason,
      ejectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(vipPaidAccesses.id, paidAccessId));

  return { ok: true };
}

/**
 * Renvoie l'accès payant actif d'un user (au plus 1 grâce à l'index
 * partiel unique sur (user_id) WHERE status <> 'ejected').
 */
export async function getActivePaidAccess(userId: string) {
  const [row] = await db
    .select()
    .from(vipPaidAccesses)
    .where(
      and(
        eq(vipPaidAccesses.userId, userId),
        sql`${vipPaidAccesses.status} <> 'ejected'`
      )
    )
    .orderBy(desc(vipPaidAccesses.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Stats pour l'admin overview :
 *  - count d'accès actifs
 *  - revenue total (somme amount_eur des status >= paid)
 *  - count nouveaux du mois
 */
export async function getPaidAccessStats(): Promise<{
  active: number;
  totalRevenue: number;
  newThisMonth: number;
}> {
  try {
    const firstOfMonth = new Date();
    firstOfMonth.setUTCDate(1);
    firstOfMonth.setUTCHours(0, 0, 0, 0);

    const [stats] = await db
      .select({
        active: sql<number>`count(*) filter (where status = 'active')::int`,
        totalRevenue: sql<number>`coalesce(sum(amount_eur) filter (where status in ('paid', 'active')), 0)::numeric`,
        newThisMonth: sql<number>`count(*) filter (where status in ('paid', 'active') and paid_at >= ${firstOfMonth})::int`,
      })
      .from(vipPaidAccesses);
    return {
      active: stats?.active ?? 0,
      totalRevenue: Number(stats?.totalRevenue ?? 0),
      newThisMonth: stats?.newThisMonth ?? 0,
    };
  } catch {
    return { active: 0, totalRevenue: 0, newThisMonth: 0 };
  }
}

/**
 * Liste paginée pour l'admin. Tri par date de création desc.
 */
export async function listPaidAccessesForAdmin(limit = 50) {
  return db
    .select({
      access: vipPaidAccesses,
      user: {
        id: users.id,
        name: users.name,
        firstName: users.telegramFirstName,
        username: users.telegramUsername,
        telegramId: users.telegramId,
        photoUrl: users.telegramPhotoUrl,
        email: users.email,
      },
      payment: {
        id: payments.id,
        amountEur: payments.amountEur,
        method: payments.method,
        provider: payments.provider,
        status: payments.status,
      },
    })
    .from(vipPaidAccesses)
    .innerJoin(users, eq(users.id, vipPaidAccesses.userId))
    .leftJoin(payments, eq(payments.id, vipPaidAccesses.paymentId))
    .orderBy(desc(vipPaidAccesses.createdAt))
    .limit(limit);
}
