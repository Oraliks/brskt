import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, vipApplications } from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';
import VipEjectedEmail from '@root/emails/vip-ejected';
import { getBot } from './bot';

const VIP_GROUP_ID = Number(process.env.VIP_GROUP_CHAT_ID);

/**
 * Génère un lien d'invitation Telegram à usage unique pour un user.
 *
 * - Si l'user a déjà un lien actif, on le RÉVOQUE d'abord (évite plusieurs
 *   liens valides simultanément que l'user pourrait partager).
 * - Le lien est `member_limit: 1` → consommé après 1 join.
 * - Expire après 24h (Telegram).
 * - Au join, on retrouve l'application via `telegramInviteLink = invite_link`
 *   (le `name` Telegram est limité à 32 chars donc on n'y stocke pas l'UUID
 *   complet — voir handleUserJoinedVip).
 */
export async function generateVipInvite(
  applicationId: string
): Promise<string> {
  const bot = getBot();

  if (!VIP_GROUP_ID) {
    throw new Error('VIP_GROUP_CHAT_ID not configured');
  }

  // Révoque l'ancien lien s'il existe (anti-partage)
  const existing = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.id, applicationId),
  });
  if (existing?.telegramInviteLink) {
    try {
      await bot.api.revokeChatInviteLink(
        VIP_GROUP_ID,
        existing.telegramInviteLink
      );
    } catch (err) {
      // Lien déjà expiré / révoqué → on ignore
      console.warn('[Telegram] revoke old invite failed (probably already expired)', err);
    }
  }

  const expireDate = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  const invite = await bot.api.createChatInviteLink(VIP_GROUP_ID, {
    expire_date: expireDate,
    member_limit: 1, // single-use
    // Telegram name limit = 32 chars. UUID = 36, donc on tronque à 8 chars
    // pour l'affichage admin. Le lookup au join se fait par invite_link (URL).
    name: `vip-${applicationId.slice(0, 8)}`,
  });

  await db
    .update(vipApplications)
    .set({
      telegramInviteLink: invite.invite_link,
      telegramInviteUsed: false,
      step: 'telegram_invited',
      updatedAt: new Date(),
    })
    .where(eq(vipApplications.id, applicationId));

  return invite.invite_link;
}

/**
 * Éjecte un utilisateur du groupe VIP.
 * Pattern : ban + unban (= kick sans bannir définitivement).
 * Met à jour la DB et stocke la raison consultable par l'utilisateur.
 */
export async function ejectFromTelegram(
  userId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const bot = getBot();

  if (!VIP_GROUP_ID) {
    return { success: false, error: 'VIP_GROUP_CHAT_ID not configured' };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user?.telegramId) {
    return { success: false, error: 'User has no Telegram ID' };
  }

  try {
    // Ban (kick)
    await bot.api.banChatMember(VIP_GROUP_ID, user.telegramId);
    // Unban immédiatement pour permettre une éventuelle réintégration future
    await bot.api.unbanChatMember(VIP_GROUP_ID, user.telegramId, {
      only_if_banned: true,
    });
  } catch (err) {
    console.error('[Telegram] ejection error', err);
    return { success: false, error: (err as Error).message };
  }

  await db
    .update(vipApplications)
    .set({
      step: 'ejected',
      ejectedAt: new Date(),
      ejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(vipApplications.userId, userId));

  // Notif privée Telegram
  try {
    await bot.api.sendMessage(
      Number(user.telegramId),
      `⚠️ Tu as été retiré du groupe VIP.\n\nRaison : ${reason}\n\nDétails et conditions de réintégration : ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/ejected`
    );
  } catch {
    // Pas grave si l'utilisateur a bloqué le bot
  }

  // Email
  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: 'Tu as été retiré du groupe VIP — Boursikotons',
      react: VipEjectedEmail({
        firstName: user.telegramFirstName ?? user.name ?? '',
        reason,
      }),
    });
  }

  // Alerte admins : message dans le channel d'alertes internes (best-effort)
  await notifyAdminsEjection({
    userName:
      user.telegramFirstName ??
      user.name ??
      (user.telegramUsername ? `@${user.telegramUsername}` : 'user inconnu'),
    userId,
    telegramId: Number(user.telegramId),
    reason,
  });

  return { success: true };
}

/**
 * Envoie un message au channel admin Telegram (defini par
 * ADMIN_ALERT_CHAT_ID en env). Best-effort : si l'env var est absente
 * ou si Telegram échoue, on log mais on continue. Utile pour notifier
 * une éjection automatique sans devoir checker manuellement la DB.
 */
export async function notifyAdminsEjection(opts: {
  userName: string;
  userId: string;
  telegramId: number | null;
  reason: string;
}): Promise<void> {
  const chatId = process.env.ADMIN_ALERT_CHAT_ID;
  if (!chatId) return; // Pas configuré → silencieux

  try {
    const bot = getBot();
    const lines = [
      `🚨 <b>Éjection automatique VIP</b>`,
      ``,
      `User : <b>${escapeHtml(opts.userName)}</b>`,
      opts.telegramId ? `Telegram ID : <code>${opts.telegramId}</code>` : '',
      `User ID : <code>${opts.userId.slice(0, 8)}…</code>`,
      ``,
      `Raison : ${escapeHtml(opts.reason)}`,
      ``,
      `Voir l'historique : ${process.env.NEXT_PUBLIC_APP_URL}/admin/audit`,
    ].filter(Boolean);

    await bot.api.sendMessage(Number(chatId), lines.join('\n'), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    console.warn('[Telegram] notifyAdminsEjection failed', err);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Envoie un message privé à un utilisateur via son telegramId.
 */
export async function sendDirectMessage(
  telegramId: number,
  message: string,
  options?: { disableWebPreview?: boolean }
): Promise<boolean> {
  try {
    const bot = getBot();
    await bot.api.sendMessage(telegramId, message, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: options?.disableWebPreview ?? true },
    });
    return true;
  } catch (err) {
    // Causes typiques: l'user n'a jamais fait /start au bot, ou a bloqué le bot.
    // C'est best-effort, on log mais on ne throw pas.
    console.warn('[Telegram] sendDirectMessage failed', err);
    return false;
  }
}
