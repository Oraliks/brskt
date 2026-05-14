import { Bot, type Context } from 'grammy';

let botInstance: Bot<Context> | null = null;

export function getBot(): Bot<Context> {
  if (botInstance) return botInstance;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');

  const bot = new Bot<Context>(token);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // === Commandes ===
  bot.command('start', async (ctx) => {
    const firstName = ctx.from?.first_name ?? '';
    const greeting = firstName ? `👋 Salut ${firstName} !` : '👋 Bienvenue !';

    await ctx.reply(
      `${greeting}\n\n` +
        `Tu es bien connecté au bot Boursikotons. À partir d'ici tu vas recevoir en temps réel :\n` +
        `• Confirmations de réservation formation\n` +
        `• Validations VIP (inscription, dépôt, accès Telegram)\n` +
        `• Messages de l'équipe\n\n` +
        `🔗 Mon espace : ${appUrl}/dashboard\n` +
        `💎 VIP Telegram (gratuit) : ${appUrl}/vip\n` +
        `📚 Réserver une formation : ${appUrl}/formation`,
      { link_preview_options: { is_disabled: true } }
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `<b>Commandes disponibles</b>\n\n` +
        `/start — Démarrer\n` +
        `/dashboard — Mon espace\n` +
        `/vip — Funnel VIP\n` +
        `/help — Cette aide\n\n` +
        `Site : ${appUrl}`,
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
    );
  });

  bot.command('dashboard', async (ctx) => {
    await ctx.reply(`🔗 Mon espace : ${appUrl}/dashboard`, {
      link_preview_options: { is_disabled: true },
    });
  });

  bot.command('vip', async (ctx) => {
    await ctx.reply(
      `💎 <b>VIP Telegram — 100% gratuit</b>\n\n` +
        `Tu payes 0€ à Boursikotons. Notre rémunération vient du broker partenaire quand tu trades.\n\n` +
        `Funnel : ${appUrl}/vip`,
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
    );
  });

  // === Listener chat_member (quand quelqu'un rejoint ou quitte le groupe VIP) ===
  bot.on('chat_member', async (ctx) => {
    const update = ctx.chatMember;
    if (!update) return;

    const groupId = Number(process.env.VIP_GROUP_CHAT_ID);
    if (update.chat.id !== groupId) return;

    const newStatus = update.new_chat_member.status;
    const telegramUserId = update.new_chat_member.user.id;
    // L'invite_link utilisé pour rejoindre (si applicable)
    const inviteLinkName = update.invite_link?.name ?? null;
    const inviteLinkUrl = update.invite_link?.invite_link ?? null;

    if (newStatus === 'member') {
      await handleUserJoinedVip(telegramUserId, inviteLinkName, inviteLinkUrl);
    } else if (newStatus === 'left' || newStatus === 'kicked') {
      await handleUserLeftVip(telegramUserId);
    }
  });

  botInstance = bot;
  return bot;
}

async function handleUserJoinedVip(
  telegramUserId: number,
  _inviteLinkName: string | null,
  inviteLinkUrl: string | null
) {
  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');
  const { users, vipApplications } = await import('@/lib/db/schema');

  // 1. Trouver le user qui a rejoint
  const joiningUser = await db.query.users.findFirst({
    where: eq(users.telegramId, telegramUserId),
  });

  // 2. Identifier à QUELLE application le lien d'invite était destiné en
  //    cherchant par URL (le `name` Telegram est limité à 32 chars donc on
  //    ne peut pas y stocker un UUID complet — on s'appuie sur la persistence
  //    `telegramInviteLink` côté DB).
  const intendedApp = inviteLinkUrl
    ? await db.query.vipApplications.findFirst({
        where: eq(vipApplications.telegramInviteLink, inviteLinkUrl),
        with: { user: true },
      })
    : null;

  // 3. Cas A : on a trouvé l'application destinatrice
  if (intendedApp) {
    // 3.a. Si l'user qui rejoint EST l'user attendu → OK
    if (joiningUser && joiningUser.id === intendedApp.userId) {
      await db
        .update(vipApplications)
        .set({
          step: 'in_group',
          telegramInviteUsed: true,
          updatedAt: new Date(),
        })
        .where(eq(vipApplications.id, intendedApp.id));
      return;
    }

    // 3.b. Squat — quelqu'un d'autre a utilisé le lien
    //      Auto-kick l'usurpateur et révoque le lien (déjà consommé mais sait-on jamais).
    console.warn(
      `[chat_member] SQUATTER detected: tg=${telegramUserId} used invite for app=${intendedApp.id} (user=${intendedApp.userId}). Auto-kicking.`
    );
    const bot = getBot();
    try {
      const groupId = Number(process.env.VIP_GROUP_CHAT_ID);
      await bot.api.banChatMember(groupId, telegramUserId);
      await bot.api.unbanChatMember(groupId, telegramUserId, {
        only_if_banned: true,
      });
    } catch (err) {
      console.error('[chat_member] auto-kick squatter failed', err);
    }
    if (inviteLinkUrl) {
      try {
        await bot.api.revokeChatInviteLink(
          Number(process.env.VIP_GROUP_CHAT_ID),
          inviteLinkUrl
        );
      } catch (err) {
        console.warn('[chat_member] revoke squatter invite failed', err);
      }
    }
    // L'intended user n'a pas pu utiliser son lien → on remet sa step à deposit_validated
    // pour qu'il puisse en générer un nouveau via le wizard.
    await db
      .update(vipApplications)
      .set({
        telegramInviteLink: null,
        telegramInviteUsed: false,
        step: 'deposit_validated',
        updatedAt: new Date(),
      })
      .where(eq(vipApplications.id, intendedApp.id));
    return;
  }

  // 4. Cas B : pas d'application destinatrice trouvée (lien admin manuel,
  //    ajout direct par l'admin, ou lien expiré déjà supprimé en DB).
  //    On marque l'user comme in_group si on le trouve en DB avec une app active.
  if (joiningUser) {
    await db
      .update(vipApplications)
      .set({ step: 'in_group', updatedAt: new Date() })
      .where(eq(vipApplications.userId, joiningUser.id));
  }
}

async function handleUserLeftVip(telegramUserId: number) {
  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');
  const { users, vipApplications } = await import('@/lib/db/schema');

  const user = await db.query.users.findFirst({
    where: eq(users.telegramId, telegramUserId),
  });
  if (!user) return;

  // On marque comme "ejected" si le statut était in_group
  // (pour distinguer "parti volontairement" vs "kické", on peut affiner)
  const app = await db.query.vipApplications.findFirst({
    where: eq(vipApplications.userId, user.id),
  });

  if (app && app.step === 'in_group') {
    await db
      .update(vipApplications)
      .set({
        step: 'ejected',
        ejectedAt: new Date(),
        ejectionReason:
          app.ejectionReason ?? 'Utilisateur a quitté le groupe',
        updatedAt: new Date(),
      })
      .where(eq(vipApplications.userId, user.id));
  }
}
