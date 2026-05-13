import { Bot, type Context } from 'grammy';

let botInstance: Bot<Context> | null = null;

export function getBot(): Bot<Context> {
  if (botInstance) return botInstance;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');

  const bot = new Bot<Context>(token);

  // === Commandes ===
  bot.command('start', async (ctx) => {
    await ctx.reply(
      `👋 Bienvenue chez Boursikotons.\n\n` +
        `Tout passe par le site web — formation, groupe VIP, suivi :\n` +
        `${process.env.NEXT_PUBLIC_APP_URL}`
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `Commandes disponibles :\n` +
        `/start — Démarrer\n` +
        `/status — Vérifier ton statut VIP\n` +
        `/help — Cette aide`
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
