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
    const userId = update.new_chat_member.user.id;

    if (newStatus === 'member') {
      // Quelqu'un a rejoint le groupe VIP → on log côté DB
      await handleUserJoinedVip(userId);
    } else if (newStatus === 'left' || newStatus === 'kicked') {
      await handleUserLeftVip(userId);
    }
  });

  botInstance = bot;
  return bot;
}

async function handleUserJoinedVip(telegramUserId: number) {
  // Import dynamique pour éviter cycle
  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');
  const { users, vipApplications } = await import('@/lib/db/schema');

  const user = await db.query.users.findFirst({
    where: eq(users.telegramId, telegramUserId),
  });
  if (!user) return;

  await db
    .update(vipApplications)
    .set({ step: 'in_group', updatedAt: new Date() })
    .where(eq(vipApplications.userId, user.id));
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
