import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, vipApplications } from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';
import VipEjectedEmail from '@root/emails/vip-ejected';
import { getBot } from './bot';

const VIP_GROUP_ID = Number(process.env.VIP_GROUP_CHAT_ID);

/**
 * Génère un lien d'invitation Telegram à usage unique, expirant en 24h.
 * Le lien est stocké dans la vipApplication et envoyé à l'utilisateur.
 */
export async function generateVipInvite(
  applicationId: string
): Promise<string> {
  const bot = getBot();

  if (!VIP_GROUP_ID) {
    throw new Error('VIP_GROUP_CHAT_ID not configured');
  }

  const expireDate = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  const invite = await bot.api.createChatInviteLink(VIP_GROUP_ID, {
    expire_date: expireDate,
    member_limit: 1, // single-use
    name: `vip-${applicationId.slice(0, 8)}`,
  });

  await db
    .update(vipApplications)
    .set({
      telegramInviteLink: invite.invite_link,
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

  return { success: true };
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
