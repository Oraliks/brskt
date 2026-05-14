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
        `/status — Ma progression VIP & CPA\n` +
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

  // /status — où en suis-je dans le funnel + progression CPA si in_group
  bot.command('status', async (ctx) => {
    const tgId = ctx.from?.id;
    if (!tgId) return;

    const { eq } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { users, vipApplications, manualIronfxStatus } = await import(
      '@/lib/db/schema'
    );

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, tgId),
    });
    if (!user) {
      await ctx.reply(
        `Je ne te trouve pas en base. Connecte-toi d'abord ici :\n${appUrl}/login`,
        { link_preview_options: { is_disabled: true } }
      );
      return;
    }

    const app = await db.query.vipApplications.findFirst({
      where: eq(vipApplications.userId, user.id),
    });
    if (!app) {
      await ctx.reply(
        `Tu n'as pas encore démarré le funnel VIP.\n\nC'est gratuit et ça prend 5 min : ${appUrl}/vip`,
        { link_preview_options: { is_disabled: true } }
      );
      return;
    }

    // Cas in_group : on affiche progression + warning éventuel
    if (app.step === 'in_group') {
      const status = app.brokerAccountId
        ? await db.query.manualIronfxStatus.findFirst({
            where: eq(manualIronfxStatus.accountId, app.brokerAccountId),
          })
        : null;
      const pct = status?.tradingProgressPct ?? 0;
      const qualified = status?.cpaQualified ?? false;
      const withdrawnUnqualified =
        !qualified && (status?.hasWithdrawn ?? false);

      const lines = [
        `💎 <b>Statut VIP : Membre actif</b>`,
        ``,
        `Progression trading : <b>${pct}%</b>`,
        `Qualification CPA : <b>${qualified ? '✅ Qualifié' : '⏳ En cours'}</b>`,
      ];

      if (withdrawnUnqualified) {
        lines.push('');
        lines.push(
          `🚨 <b>ATTENTION</b> — un retrait est détecté sur ton compte broker ` +
            `mais tu n'es pas encore qualifié. Au prochain check quotidien tu ` +
            `seras automatiquement éjecté du groupe.\n\nContacte-nous vite si ` +
            `tu peux annuler le retrait.`
        );
      } else if (!qualified) {
        lines.push('');
        lines.push(
          `Continue à trader pour générer le CPA. <b>Pas de retrait</b> avant qualification.`
        );
      } else {
        lines.push('');
        lines.push(`✓ Ta place est sécurisée — bon trading.`);
      }

      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
      return;
    }

    // Cas ejected
    if (app.step === 'ejected') {
      await ctx.reply(
        `🚫 <b>Tu as été éjecté du groupe VIP</b>\n\n` +
          `Raison : ${app.ejectionReason ?? 'non spécifiée'}\n\n` +
          `Conditions de réintégration : ${appUrl}/dashboard/ejected`,
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
      );
      return;
    }

    // Funnel en cours
    const stepLabels: Record<string, string> = {
      link_generated: 'Lien affilié généré — va t\'inscrire chez le broker',
      clicked: 'Tu as cliqué sur le lien — finalise ton inscription',
      signup_pending: 'Inscription en attente de validation',
      signup_validated: 'Inscription validée — fais ton premier dépôt',
      deposit_pending: 'Dépôt en attente de validation',
      deposit_validated: 'Dépôt validé — récupère ton lien Telegram',
      telegram_invited: 'Lien Telegram envoyé — rejoins le groupe',
    };
    const label = stepLabels[app.step] ?? app.step;
    await ctx.reply(
      `📍 <b>Étape ${app.step}</b>\n${label}\n\nContinue ici : ${appUrl}/vip`,
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
          currentStepEnteredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(vipApplications.id, intendedApp.id));
      // Event funnel
      const { emitFunnelEvent } = await import('@/lib/analytics/funnel');
      await emitFunnelEvent({
        userId: joiningUser.id,
        sessionId: joiningUser.id,
        eventName: 'vip_joined_group',
        metadata: { applicationId: intendedApp.id },
      });
      // DM de bienvenue (best-effort — peut échouer si l'user n'a jamais
      // ouvert le bot, auquel cas Telegram interdit le DM).
      await sendVipWelcomeDM(telegramUserId, joiningUser.telegramFirstName);
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
    // Idem case 3.a : on DM la bienvenue (best-effort)
    await sendVipWelcomeDM(telegramUserId, joiningUser.telegramFirstName);
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

/**
 * DM de bienvenue envoyé quand un user rejoint le groupe VIP via son lien
 * d'invite validé. Rappelle la règle CPA + warning sur l'éjection auto en
 * cas de retrait avant qualification, et présente les commandes utiles.
 *
 * Best-effort : si l'user n'a jamais ouvert le bot (pas de /start), Telegram
 * refuse les DM avec une erreur 403 — on log et on continue.
 */
async function sendVipWelcomeDM(
  telegramUserId: number,
  firstName: string | null
) {
  const bot = getBot();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const greeting = firstName ? `🎉 Bienvenue ${firstName} !` : '🎉 Bienvenue !';

  try {
    await bot.api.sendMessage(
      telegramUserId,
      `${greeting}\n\n` +
        `Tu es maintenant <b>membre du groupe VIP Boursikotons</b>. ` +
        `Profite des signaux, des analyses et de la communauté.\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `<b>⚠️ Règle importante à connaître</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `Ta place dans le groupe est <b>conditionnée à la génération de la ` +
        `commission CPA</b> via ton compte broker partenaire (IronFX).\n\n` +
        `🚫 Tant que tu n'es pas <b>qualifié CPA</b>, tout retrait depuis ` +
        `ton compte broker entraîne une <b>éjection automatique</b> du groupe ` +
        `au prochain check quotidien.\n\n` +
        `📈 Concrètement : trade un peu, génère le CPA (volume minimum), ` +
        `puis tu pourras retirer librement. On te tient au courant.\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `<b>Commandes utiles</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `/status — Voir ma progression CPA en temps réel\n` +
        `/dashboard — Mon espace web\n` +
        `/help — Toutes les commandes\n\n` +
        `Bon trading. 🚀`,
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
    );
  } catch (err) {
    // 403 typique si l'user n'a jamais /start le bot
    console.warn(
      `[bot] welcome DM to tg=${telegramUserId} failed (user has not started the bot?)`,
      err
    );
  }

  // Lien dashboard en message séparé pour bénéficier du preview Telegram
  if (appUrl) {
    try {
      await bot.api.sendMessage(
        telegramUserId,
        `🔗 Mon espace : ${appUrl}/dashboard`,
        { link_preview_options: { is_disabled: true } }
      );
    } catch {
      /* l'erreur a déjà été loggée sur le premier sendMessage */
    }
  }
}
