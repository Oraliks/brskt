import { Bot, type Context, InlineKeyboard } from 'grammy';

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

    // Deeplink param : `/start vip_<source>`, `/start ref_<code>`, ou `/start hello` (default).
    const startParam = ctx.match?.trim() ?? '';

    // === Parrainage : /start ref_<code> ===
    if (startParam.startsWith('ref_') && ctx.from?.id) {
      const referralCode = startParam.slice(4);
      try {
        const { eq } = await import('drizzle-orm');
        const { db } = await import('@/lib/db');
        const { users } = await import('@/lib/db/schema');

        const referrer = await db.query.users.findFirst({
          where: eq(users.referralCode, referralCode),
        });
        const newUser = await db.query.users.findFirst({
          where: eq(users.telegramId, ctx.from.id),
        });

        // Cas 1 : referrer trouvé + newUser existe et n'a pas encore de parrain
        //         + ce n'est pas auto-parrainage
        if (
          referrer &&
          newUser &&
          !newUser.referredBy &&
          newUser.id !== referrer.id
        ) {
          await db
            .update(users)
            .set({ referredBy: referrer.id, updatedAt: new Date() })
            .where(eq(users.id, newUser.id));
        }
        // Cas 2 : referrer trouvé mais newUser n'existe pas encore (jamais
        //         connecté au site). On ne peut pas créer le user complet
        //         (pas de email etc), mais on note dans funnel_events pour
        //         créditer le parrain quand l'user s'inscrira.
        else if (referrer && !newUser) {
          const { emitFunnelEvent } = await import('@/lib/analytics/funnel');
          await emitFunnelEvent({
            userId: null,
            sessionId: `tg:${ctx.from.id}`,
            eventName: 'bot_deeplink',
            metadata: {
              type: 'referral_pending',
              referrerId: referrer.id,
              referralCode,
              telegramId: ctx.from.id,
            },
          });
        }
      } catch (err) {
        console.warn('[bot] referral tracking failed', err);
      }

      // Message de bienvenue pour le filleul
      await ctx.reply(
        `${firstName ? `Salut ${firstName} ! ` : 'Bienvenue ! '}` +
          `Tu viens d'un lien d'invitation 🎁\n\n` +
          `Boursikotons : formation trading + groupe VIP Telegram gratuit ` +
          `(rémunération via broker partenaire, pas par toi).\n\n` +
          `▶️ Démarre ici : ${appUrl}/login\n` +
          `💎 Funnel VIP : ${appUrl}/vip`,
        { link_preview_options: { is_disabled: true } }
      );
      return;
    }

    // === Deeplink /start login : auto-envoie un magic link ===
    // Utilisé par le bouton "Recevoir mon lien" sur /login (fallback mobile).
    if (startParam === 'login' && ctx.from?.id) {
      const hasSecret =
        !!process.env.MAGIC_LINK_SECRET?.trim() ||
        !!process.env.BETTER_AUTH_SECRET?.trim();
      if (!hasSecret) {
        await ctx.reply(
          `⚠️ Magic-link non configuré. Utilise le widget : ${appUrl}/login`,
          { link_preview_options: { is_disabled: true } }
        );
        return;
      }
      try {
        const { eq } = await import('drizzle-orm');
        const { db } = await import('@/lib/db');
        const { users } = await import('@/lib/db/schema');
        const { signMagicToken } = await import('@/lib/auth/magic-link');

        const user = await db.query.users.findFirst({
          where: eq(users.telegramId, ctx.from.id),
          columns: { id: true },
        });

        if (!user) {
          // 1re connexion : compte pas encore en DB, le widget reste obligatoire
          await ctx.reply(
            `${greeting}\n\n` +
              `Pour ta toute première connexion, utilise le widget Telegram sur ` +
              `${appUrl}/login (il crée ton compte automatiquement).\n\n` +
              `Une fois ton compte créé, ${appUrl}/login te renverra un lien direct ici via /login.`,
            { link_preview_options: { is_disabled: true } }
          );
          return;
        }

        const token = signMagicToken(ctx.from.id);
        const link = `${appUrl}/login/magic?token=${encodeURIComponent(token)}`;
        await ctx.reply(
          `🔑 <b>Lien de connexion instantané</b>\n\n` +
            `<a href="${link}">Clique ici pour te connecter</a>\n\n` +
            `<i>Valable 10 min. Ne partage pas ce lien.</i>`,
          { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
        );
        return;
      } catch (err) {
        console.error('[bot] /start login deeplink failed', err);
        await ctx.reply(
          `Désolé, génération du lien échouée. Utilise le widget : ${appUrl}/login`,
          { link_preview_options: { is_disabled: true } }
        );
        return;
      }
    }

    if (startParam.startsWith('vip_') && ctx.from?.id) {
      const source = startParam.slice(4); // 'landing', 'ads', 'instagram', etc.
      try {
        const { eq } = await import('drizzle-orm');
        const { db } = await import('@/lib/db');
        const { users } = await import('@/lib/db/schema');
        const { emitFunnelEvent } = await import('@/lib/analytics/funnel');
        const user = await db.query.users.findFirst({
          where: eq(users.telegramId, ctx.from.id),
        });
        await emitFunnelEvent({
          userId: user?.id ?? null,
          sessionId: user?.id ?? `tg:${ctx.from.id}`,
          eventName: 'bot_deeplink',
          metadata: {
            source,
            telegramId: ctx.from.id,
            telegramUsername: ctx.from.username,
          },
        });
      } catch (err) {
        console.warn('[bot] deeplink tracking failed', err);
      }

      await ctx.reply(
        `${greeting}\n\n` +
          `Tu viens de la source <b>${escapeUserText(source)}</b> — bien noté.\n\n` +
          `💎 Le groupe VIP Telegram est <b>100% gratuit</b>.\n` +
          `Tu déposes ton propre argent chez notre broker partenaire pour trader. ` +
          `Nous, on est payés par le broker — pas par toi.\n\n` +
          `<b>Suivante :</b> connecte-toi sur ${appUrl}/login (Telegram = 1 clic) ` +
          `puis démarre le funnel ici : ${appUrl}/vip`,
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
      );
      return;
    }

    // /start standard (hello ou pas de param)
    try {
      const { eq } = await import('drizzle-orm');
      const { db } = await import('@/lib/db');
      const { users } = await import('@/lib/db/schema');
      const { emitFunnelEvent } = await import('@/lib/analytics/funnel');
      if (ctx.from?.id) {
        const user = await db.query.users.findFirst({
          where: eq(users.telegramId, ctx.from.id),
        });
        await emitFunnelEvent({
          userId: user?.id ?? null,
          sessionId: user?.id ?? `tg:${ctx.from.id}`,
          eventName: 'bot_started',
          metadata: { telegramId: ctx.from.id },
        });
      }
    } catch {
      /* ignore tracking errors */
    }

    const botUser = process.env.TELEGRAM_BOT_USERNAME ?? 'boursikotonsbot';
    await ctx.reply(
      `${greeting}\n\n` +
        `<b>Bienvenue sur Boursikotons</b> — formation trading + groupe VIP Telegram gratuit.\n\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `<b>🚀 Démarrer</b>\n` +
        `• <a href="${appUrl}/login">Se connecter au site</a> (1 clic Telegram)\n` +
        `• <a href="${appUrl}/vip">Funnel VIP</a> (gratuit)\n` +
        `• <a href="${appUrl}/formation">Réserver une formation</a>\n` +
        `• <a href="${appUrl}/dashboard">Mon espace</a>\n\n` +
        `<b>🛠 Calculatrices trading</b>\n` +
        `/size — Taille de position\n` +
        `/rr — Ratio risk/reward\n` +
        `/pip — Valeur du pip\n` +
        `/convert — Conversion devises live\n\n` +
        `<b>🔔 Alertes & macro</b>\n` +
        `/alert /alerts /unalert — Alertes prix FX/crypto\n` +
        `/events — Calendrier économique\n` +
        `/subscribe /unsubscribe — Briefing matinal & events\n\n` +
        `<b>🎁 Parrainage & témoignages</b>\n` +
        `/invite — Mon lien d'invitation perso\n` +
        `/temoignage <i>&lt;ton avis&gt;</i> — Laisser un avis (publié sur le site après validation)\n\n` +
        `<b>💬 Mode inline</b>\n` +
        `Tape <code>@${botUser} EURUSD</code> dans n'importe quel chat pour partager un prix live.\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `<i>Liste complète : /help</i>`,
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `<b>📋 Toutes les commandes</b>\n\n` +
        `<b>Compte</b>\n` +
        `/start — Démarrer\n` +
        `/login — Lien de connexion direct au site\n` +
        `/status — Ma progression VIP & CPA\n` +
        `/streak — Mon streak d'interaction quotidien\n` +
        `/qualify — Personnalise ton suivi\n` +
        `/dashboard — Mon espace web\n` +
        `/vip — Funnel VIP\n\n` +
        `<b>🛠 Calculatrices trading</b>\n` +
        `/size — Taille de position (capital, risk%, SL pips)\n` +
        `/rr — Ratio risk/reward (entry, SL, TP)\n` +
        `/pip — Valeur du pip (paire, lots)\n` +
        `/convert — Conversion devises live\n\n` +
        `<b>🔔 Alertes prix</b>\n` +
        `/alert — Créer une alerte (FX ou crypto)\n` +
        `/alerts — Mes alertes actives\n` +
        `/unalert — Supprimer une alerte\n\n` +
        `<b>📅 Briefings & macro</b>\n` +
        `/subscribe — S'inscrire briefing/events\n` +
        `/unsubscribe — Se désinscrire\n` +
        `/events — Prochains événements macro\n\n` +
        `<b>🎓 Quiz</b>\n` +
        `/quiz — Question du jour\n` +
        `/leaderboard — Classement hebdo\n\n` +
        `<b>🔄 Inline</b>\n` +
        `Tape <code>@boursikotonsbot EURUSD</code> dans n'importe quel chat\n\n` +
        `<b>🎁 Parrainage</b>\n` +
        `/invite — Mon lien d'invitation perso\n\n` +
        `<b>⭐ Témoignages</b>\n` +
        `/temoignage <i>&lt;ton avis&gt;</i> — Laisser un avis qui sera publié sur le site après validation\n\n` +
        `<b>Aide</b>\n` +
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

  // ============================================================
  // Calculatrices trading
  // ============================================================

  // /size <capital> <risk%> <sl_pips>
  bot.command('size', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'calculators'))) return;
    if (ctx.from?.id) {
      const { bumpBotStreak } = await import('@/lib/bot/streak');
      void bumpBotStreak(ctx.from.id);
    }
    const args = (ctx.match ?? '').trim().split(/\s+/);
    if (args.length < 3 || args[0] === '') {
      await ctx.reply(
        `📐 <b>Calcul de taille de position</b>\n\n` +
          `Usage : <code>/size &lt;capital&gt; &lt;risk%&gt; &lt;sl_pips&gt;</code>\n\n` +
          `Exemple : <code>/size 10000 1 50</code>\n` +
          `(capital 10 000€, risque 1%, stop-loss 50 pips)`,
        { parse_mode: 'HTML' }
      );
      return;
    }
    const { calcPositionSize } = await import('@/lib/bot/calculators');
    const result = calcPositionSize(
      Number(args[0]),
      Number(args[1]),
      Number(args[2])
    );
    if ('error' in result) {
      await ctx.reply(`❌ ${result.error}`);
      return;
    }
    await ctx.reply(
      `📐 <b>Taille de position</b>\n\n` +
        `Capital : <b>${args[0]}</b>\n` +
        `Risque : <b>${args[1]}%</b> = <b>${result.riskMoney}€</b>\n` +
        `SL : <b>${args[2]} pips</b>\n\n` +
        `🎯 <b>Taille à trader : ${result.lots} lots</b>\n\n` +
        `<i>Note : assume 10€/pip par lot standard (paires USD-quote). ` +
        `Pour les exotiques, calcul à ajuster.</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // /rr <entry> <sl> <tp>
  bot.command('rr', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'calculators'))) return;
    if (ctx.from?.id) {
      const { bumpBotStreak } = await import('@/lib/bot/streak');
      void bumpBotStreak(ctx.from.id);
    }
    const args = (ctx.match ?? '').trim().split(/\s+/);
    if (args.length < 3 || args[0] === '') {
      await ctx.reply(
        `⚖️ <b>Ratio risk/reward</b>\n\n` +
          `Usage : <code>/rr &lt;entry&gt; &lt;sl&gt; &lt;tp&gt;</code>\n\n` +
          `Exemple : <code>/rr 1.0900 1.0850 1.0980</code>\n` +
          `(entry 1.0900, SL 1.0850, TP 1.0980 → R:R 1.6)`,
        { parse_mode: 'HTML' }
      );
      return;
    }
    const { calcRiskReward } = await import('@/lib/bot/calculators');
    const result = calcRiskReward(
      Number(args[0]),
      Number(args[1]),
      Number(args[2])
    );
    if ('error' in result) {
      await ctx.reply(`❌ ${result.error}`);
      return;
    }
    const verdict =
      result.ratio >= 2
        ? '✅ Excellent'
        : result.ratio >= 1.5
        ? '👍 Bon'
        : result.ratio >= 1
        ? '⚠️ Médiocre'
        : '❌ Mauvais';
    await ctx.reply(
      `⚖️ <b>R:R = ${result.ratio} ${verdict}</b>\n\n` +
        `Direction : <b>${result.direction === 'long' ? '📈 Long' : '📉 Short'}</b>\n` +
        `Risque : ${result.risk}\n` +
        `Reward : ${result.reward}\n\n` +
        `<i>Vise R:R ≥ 2 pour un edge solide sur le long terme.</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // /pip <pair> <lots>
  bot.command('pip', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'calculators'))) return;
    if (ctx.from?.id) {
      const { bumpBotStreak } = await import('@/lib/bot/streak');
      void bumpBotStreak(ctx.from.id);
    }
    const args = (ctx.match ?? '').trim().split(/\s+/);
    if (args.length < 2 || args[0] === '') {
      await ctx.reply(
        `💰 <b>Valeur du pip</b>\n\n` +
          `Usage : <code>/pip &lt;paire&gt; &lt;lots&gt;</code>\n\n` +
          `Exemple : <code>/pip EURUSD 1</code>\n` +
          `(1 lot standard sur EURUSD)`,
        { parse_mode: 'HTML' }
      );
      return;
    }
    const { calcPipValue } = await import('@/lib/bot/calculators');
    const result = calcPipValue(args[0] ?? '', Number(args[1]));
    if ('error' in result) {
      await ctx.reply(`❌ ${result.error}`);
      return;
    }
    await ctx.reply(
      `💰 <b>Valeur du pip</b>\n\n` +
        `Paire : <b>${args[0]?.toUpperCase()}</b>\n` +
        `Taille : <b>${args[1]} lot(s)</b>\n\n` +
        `🎯 <b>1 pip = ${result.value} ${result.currency}</b>`,
      { parse_mode: 'HTML' }
    );
  });

  // /convert <amount> <from> <to>
  bot.command('convert', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'calculators'))) return;
    if (ctx.from?.id) {
      const { bumpBotStreak } = await import('@/lib/bot/streak');
      void bumpBotStreak(ctx.from.id);
    }
    const args = (ctx.match ?? '').trim().split(/\s+/);
    if (args.length < 3 || args[0] === '') {
      await ctx.reply(
        `💱 <b>Conversion de devises</b>\n\n` +
          `Usage : <code>/convert &lt;montant&gt; &lt;de&gt; &lt;vers&gt;</code>\n\n` +
          `Exemple : <code>/convert 1000 EUR USD</code>\n` +
          `<i>Taux ECB live via Frankfurter API.</i>`,
        { parse_mode: 'HTML' }
      );
      return;
    }
    await ctx.replyWithChatAction('typing');
    const { convertCurrency } = await import('@/lib/bot/calculators');
    const result = await convertCurrency(
      Number(args[0]),
      args[1] ?? '',
      args[2] ?? ''
    );
    if ('error' in result) {
      await ctx.reply(`❌ ${result.error}`);
      return;
    }
    await ctx.reply(
      `💱 <b>${args[0]} ${args[1]?.toUpperCase()} = ${result.converted} ${args[2]?.toUpperCase()}</b>\n\n` +
        `Taux : 1 ${args[1]?.toUpperCase()} = ${result.rate} ${args[2]?.toUpperCase()}\n` +
        `Date : ${result.date}`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // Subscriptions : daily briefing + economic events alerts
  // ============================================================

  // /subscribe <briefing|events|all>
  bot.command('subscribe', async (ctx) => {
    if (!ctx.from?.id) return;
    const arg = (ctx.match ?? '').trim().toLowerCase();
    const { eq } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { users } = await import('@/lib/db/schema');

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, ctx.from.id),
    });
    if (!user) {
      await ctx.reply(`Connecte-toi d'abord : ${appUrl}/login`);
      return;
    }

    if (arg === 'briefing') {
      await db.update(users).set({ botSubscribedBriefing: true }).where(eq(users.id, user.id));
      await ctx.reply(`✓ Inscrit au briefing matinal (envoyé vers 8h CET).`);
    } else if (arg === 'events') {
      await db.update(users).set({ botSubscribedEvents: true }).where(eq(users.id, user.id));
      await ctx.reply(`✓ Inscrit aux alertes calendrier macro (30 min avant chaque event).`);
    } else if (arg === 'all' || arg === '') {
      await db
        .update(users)
        .set({ botSubscribedBriefing: true, botSubscribedEvents: true })
        .where(eq(users.id, user.id));
      await ctx.reply(
        `✓ Inscrit aux deux flux :\n` +
          `• Briefing matinal (vers 8h CET)\n` +
          `• Alertes calendrier macro (30 min avant)\n\n` +
          `Désinscription : <code>/unsubscribe briefing</code> ou <code>/unsubscribe events</code>`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.reply(
        `Usage : <code>/subscribe briefing</code>, <code>/subscribe events</code>, ou <code>/subscribe all</code>`,
        { parse_mode: 'HTML' }
      );
    }
  });

  // /unsubscribe <briefing|events|all>
  bot.command('unsubscribe', async (ctx) => {
    if (!ctx.from?.id) return;
    const arg = (ctx.match ?? '').trim().toLowerCase();
    const { eq } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { users } = await import('@/lib/db/schema');

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, ctx.from.id),
    });
    if (!user) return;

    if (arg === 'briefing') {
      await db.update(users).set({ botSubscribedBriefing: false }).where(eq(users.id, user.id));
      await ctx.reply(`✓ Désinscrit du briefing matinal.`);
    } else if (arg === 'events') {
      await db.update(users).set({ botSubscribedEvents: false }).where(eq(users.id, user.id));
      await ctx.reply(`✓ Désinscrit des alertes calendrier.`);
    } else if (arg === 'all' || arg === '') {
      await db
        .update(users)
        .set({ botSubscribedBriefing: false, botSubscribedEvents: false })
        .where(eq(users.id, user.id));
      await ctx.reply(`✓ Désinscrit de tous les flux automatiques.`);
    } else {
      await ctx.reply(
        `Usage : <code>/unsubscribe briefing</code>, <code>events</code>, ou <code>all</code>`,
        { parse_mode: 'HTML' }
      );
    }
  });

  // /events — affiche le calendrier des prochains événements macro
  bot.command('events', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'economicAlerts'))) return;
    if (!ctx.from?.id) return;
    const { bumpBotStreak } = await import('@/lib/bot/streak');
    void bumpBotStreak(ctx.from.id);

    const { gte, asc } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { economicEvents } = await import('@/lib/db/schema');

    const upcoming = await db.query.economicEvents.findMany({
      where: gte(economicEvents.eventAt, new Date()),
      orderBy: [asc(economicEvents.eventAt)],
      limit: 10,
    });

    if (upcoming.length === 0) {
      await ctx.reply(
        `📅 <b>Calendrier macro</b>\n\n` +
          `Aucun event programmé. L'admin met à jour la liste régulièrement.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const lines = upcoming.map((e) => {
      const date = new Date(e.eventAt).toLocaleString('fr-FR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris',
      });
      const impactEmoji =
        e.impact === 'high' ? '🔴' : e.impact === 'medium' ? '🟠' : '🟡';
      return `${impactEmoji} <b>${escapeUserText(e.name)}</b>${
        e.currency ? ` · ${e.currency}` : ''
      }\n   ${date}`;
    });

    await ctx.reply(
      `📅 <b>Prochains événements macro</b>\n\n${lines.join('\n\n')}\n\n` +
        `<i>Alertes auto 30 min avant : /subscribe events</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // Price alerts
  // ============================================================

  // /alert <symbol> <threshold> <above|below>
  bot.command('alert', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'priceAlerts'))) return;
    if (!ctx.from?.id) return;
    const { bumpBotStreak } = await import('@/lib/bot/streak');
    void bumpBotStreak(ctx.from.id);

    const args = (ctx.match ?? '').trim().split(/\s+/);
    if (args.length < 3 || !args[0]) {
      await ctx.reply(
        `🔔 <b>Alerte de prix</b>\n\n` +
          `Usage : <code>/alert &lt;symbol&gt; &lt;prix&gt; &lt;above|below&gt;</code>\n\n` +
          `Exemples :\n` +
          `<code>/alert EURUSD 1.0900 above</code>\n` +
          `<code>/alert BTC 100000 above</code>\n` +
          `<code>/alert ETH 2500 below</code>\n\n` +
          `Sources : FX (paires 6 chars) ou crypto (BTC, ETH, SOL...).\n` +
          `Le bot te DM dès que le prix franchit le seuil.\n\n` +
          `Voir tes alertes : /alerts\n` +
          `Supprimer : /unalert &lt;numéro&gt;`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const symbol = (args[0] ?? '').toUpperCase().replace(/[/\s]/g, '');
    const threshold = Number(args[1]);
    const directionStr = (args[2] ?? '').toLowerCase();

    if (!Number.isFinite(threshold) || threshold <= 0) {
      await ctx.reply(`❌ Prix invalide : "${args[1]}"`);
      return;
    }
    if (directionStr !== 'above' && directionStr !== 'below') {
      await ctx.reply(
        `❌ Direction invalide. Utilise <code>above</code> ou <code>below</code>.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Détermine la source : FX si 6 chars [A-Z], crypto sinon
    let source: 'fx' | 'crypto';
    if (/^[A-Z]{6}$/.test(symbol)) {
      source = 'fx';
    } else if (/^[A-Z]{2,8}$/.test(symbol)) {
      source = 'crypto';
      // Vérifie qu'on connaît ce crypto
      const { lookupQuote } = await import('@/lib/bot/inline-quotes');
      const q = await lookupQuote(symbol);
      if (!q || q.type !== 'crypto') {
        await ctx.reply(
          `❌ Symbol "${symbol}" non reconnu. Cryptos supportés : BTC, ETH, SOL, BNB, XRP, ADA, DOGE et ~25 autres.`
        );
        return;
      }
    } else {
      await ctx.reply(`❌ Symbol invalide : "${symbol}"`);
      return;
    }

    const { eq } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { users, priceAlerts } = await import('@/lib/db/schema');
    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, ctx.from.id),
    });
    if (!user) {
      await ctx.reply(
        `Tu n'as pas encore de compte. Connecte-toi : ${appUrl}/login`,
        { link_preview_options: { is_disabled: true } }
      );
      return;
    }

    await db.insert(priceAlerts).values({
      userId: user.id,
      symbol,
      source,
      threshold: String(threshold),
      direction: directionStr,
    });

    await ctx.reply(
      `🔔 <b>Alerte créée</b>\n\n` +
        `${symbol} ${directionStr === 'above' ? '⬆️ au-dessus de' : '⬇️ en-dessous de'} <b>${threshold}</b>\n\n` +
        `Le bot te ping dès que c'est franchi.\n` +
        `Liste : /alerts`,
      { parse_mode: 'HTML' }
    );
  });

  // /alerts — liste les alertes actives
  bot.command('alerts', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'priceAlerts'))) return;
    if (!ctx.from?.id) return;
    const { bumpBotStreak } = await import('@/lib/bot/streak');
    void bumpBotStreak(ctx.from.id);

    const { eq, and, isNull, desc } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { users, priceAlerts } = await import('@/lib/db/schema');

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, ctx.from.id),
    });
    if (!user) {
      await ctx.reply(`Connecte-toi : ${appUrl}/login`);
      return;
    }

    const list = await db.query.priceAlerts.findMany({
      where: and(
        eq(priceAlerts.userId, user.id),
        isNull(priceAlerts.triggeredAt)
      ),
      orderBy: [desc(priceAlerts.createdAt)],
      limit: 20,
    });

    if (list.length === 0) {
      await ctx.reply(
        `🔔 <b>Aucune alerte active</b>\n\n` +
          `Crée-en une avec :\n` +
          `<code>/alert EURUSD 1.0900 above</code>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const lines = list.map((a, i) => {
      const arrow = a.direction === 'above' ? '⬆️' : '⬇️';
      return `${i + 1}. ${a.symbol} ${arrow} <b>${a.threshold}</b>`;
    });
    await ctx.reply(
      `🔔 <b>Tes alertes (${list.length})</b>\n\n${lines.join('\n')}\n\n` +
        `Supprimer : <code>/unalert &lt;numéro&gt;</code>`,
      { parse_mode: 'HTML' }
    );
  });

  // /unalert <num> — supprime une alerte
  bot.command('unalert', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'priceAlerts'))) return;
    if (!ctx.from?.id) return;
    const arg = (ctx.match ?? '').trim();
    const num = Number(arg);
    if (!Number.isInteger(num) || num < 1) {
      await ctx.reply(`Usage : <code>/unalert &lt;numéro&gt;</code>`, {
        parse_mode: 'HTML',
      });
      return;
    }

    const { eq, and, isNull, desc } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { users, priceAlerts } = await import('@/lib/db/schema');

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, ctx.from.id),
    });
    if (!user) {
      await ctx.reply(`Connecte-toi : ${appUrl}/login`);
      return;
    }

    const list = await db.query.priceAlerts.findMany({
      where: and(
        eq(priceAlerts.userId, user.id),
        isNull(priceAlerts.triggeredAt)
      ),
      orderBy: [desc(priceAlerts.createdAt)],
      limit: 20,
    });

    const target = list[num - 1];
    if (!target) {
      await ctx.reply(`❌ Pas d'alerte n°${num}. Voir /alerts.`);
      return;
    }

    await db.delete(priceAlerts).where(eq(priceAlerts.id, target.id));
    await ctx.reply(
      `✓ Alerte supprimée : ${target.symbol} ${target.direction === 'above' ? '⬆️' : '⬇️'} ${target.threshold}`
    );
  });

  // ============================================================
  // Quiz quotidien
  // ============================================================

  // /quiz — propose la dernière question quotidienne ou la prochaine non-répondue
  bot.command('quiz', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'quiz'))) return;
    if (!ctx.from?.id) return;
    const { bumpBotStreak } = await import('@/lib/bot/streak');
    void bumpBotStreak(ctx.from.id);

    const { eq, and, desc, isNotNull, not, inArray, sql } = await import(
      'drizzle-orm'
    );
    const { db } = await import('@/lib/db');
    const { users, quizQuestions, quizResponses } = await import(
      '@/lib/db/schema'
    );

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, ctx.from.id),
    });
    if (!user) {
      await ctx.reply(
        `Tu n'as pas encore de compte. Connecte-toi : ${appUrl}/login`,
        { link_preview_options: { is_disabled: true } }
      );
      return;
    }

    // Cherche une question déjà envoyée (sent_at non null) et non répondue
    // par cet user. À défaut, prend la dernière question envoyée.
    const answered = await db
      .select({ qid: quizResponses.questionId })
      .from(quizResponses)
      .where(eq(quizResponses.userId, user.id));
    const answeredIds = answered.map((r) => r.qid);

    const candidates = await db.query.quizQuestions.findMany({
      where: and(
        eq(quizQuestions.active, true),
        isNotNull(quizQuestions.sentAt),
        answeredIds.length > 0
          ? not(inArray(quizQuestions.id, answeredIds))
          : undefined
      ),
      orderBy: [desc(quizQuestions.sentAt)],
      limit: 1,
    });

    if (candidates.length === 0) {
      // Toutes les questions déjà répondues → stats perso
      const stats = await db
        .select({
          total: sql<number>`count(*)::int`,
          correct: sql<number>`sum(case when ${quizResponses.correct} then 1 else 0 end)::int`,
        })
        .from(quizResponses)
        .where(eq(quizResponses.userId, user.id));
      const s = stats[0];
      const total = s?.total ?? 0;
      const correct = s?.correct ?? 0;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      await ctx.reply(
        `🎓 <b>Bravo, tu as répondu à toutes les questions !</b>\n\n` +
          `Tes stats : <b>${correct}/${total}</b> (${pct}%)\n\n` +
          `Reviens demain : une nouvelle question chaque jour à 18h CET.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const q = candidates[0]!;
    const kb = new InlineKeyboard();
    q.choices.forEach((choice, i) => {
      kb.text(
        `${String.fromCharCode(65 + i)}. ${choice}`.slice(0, 60),
        `quiz:${q.id}:${i}`
      );
      if (i < q.choices.length - 1) kb.row();
    });
    await ctx.reply(
      `📝 <b>Question du jour</b>${
        q.category ? ` · <i>${escapeUserText(q.category)}</i>` : ''
      }\n\n${escapeUserText(q.question)}`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  });

  // Callback NPS : "nps:{bookingId}:{score}" (cf. /api/cron/nps-request)
  bot.callbackQuery(/^nps:([0-9a-f-]+):(\d+)$/, async (ctx) => {
    const [, bookingId, scoreStr] = ctx.match ?? [];
    if (!bookingId || !scoreStr) return;
    const score = Number(scoreStr);
    if (!Number.isFinite(score) || score < 0 || score > 10) return;

    try {
      const { eq } = await import('drizzle-orm');
      const { db } = await import('@/lib/db');
      const { bookingAutomationState } = await import('@/lib/db/schema');
      const now = new Date();

      await db
        .insert(bookingAutomationState)
        .values({
          bookingId,
          npsScore: score,
          npsAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: bookingAutomationState.bookingId,
          set: { npsScore: score, npsAt: now, updatedAt: now },
        });

      // Réponse contextuelle selon le score
      const reply =
        score >= 9
          ? '🎉 Merci ! Tu es un promoteur, ça fait plaisir. Si tu veux partager publiquement, /temoignage.'
          : score >= 7
          ? '🙏 Merci pour ton retour. Si tu as un point d\'amélioration en tête, dis-le moi en privé.'
          : '🙏 Merci pour ta franchise. On va s\'améliorer — si tu veux partager ce qui a coincé, je suis tout ouïe.';

      await ctx.answerCallbackQuery({ text: `Note envoyée : ${score}/10` });
      // Edite le message original pour cacher les boutons et afficher le merci
      try {
        await ctx.editMessageReplyMarkup(undefined);
      } catch {
        // Ignore si déjà edité ou trop vieux
      }
      await ctx.reply(reply, {
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      console.error('[bot] nps callback failed', err);
      await ctx.answerCallbackQuery({
        text: 'Erreur, réessaye plus tard.',
        show_alert: true,
      });
    }
  });

  // Callback pour les réponses au quiz
  bot.callbackQuery(/^quiz:([0-9a-f-]+):(\d+)$/, async (ctx) => {
    const [, qid, idxStr] = ctx.match ?? [];
    if (!qid || !idxStr || !ctx.from?.id) return;
    const chosenIndex = Number(idxStr);

    const { eq } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { users, quizQuestions, quizResponses } = await import(
      '@/lib/db/schema'
    );

    const [user, question] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.telegramId, ctx.from.id) }),
      db.query.quizQuestions.findFirst({ where: eq(quizQuestions.id, qid) }),
    ]);
    if (!user || !question) {
      await ctx.answerCallbackQuery({
        text: 'Question introuvable',
        show_alert: true,
      });
      return;
    }

    // A déjà répondu ?
    const existing = await db.query.quizResponses.findFirst({
      where: eq(quizResponses.questionId, question.id),
    });
    if (existing && existing.userId === user.id) {
      await ctx.answerCallbackQuery({
        text: 'Tu as déjà répondu à celle-ci',
        show_alert: true,
      });
      return;
    }

    const correct = chosenIndex === question.correctIndex;
    try {
      await db.insert(quizResponses).values({
        userId: user.id,
        questionId: question.id,
        chosenIndex,
        correct,
      });
    } catch {
      // Race condition : insert simultané — on traite comme déjà répondu
      await ctx.answerCallbackQuery({
        text: 'Réponse déjà enregistrée',
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery({
      text: correct ? '✓ Bonne réponse !' : '✗ Mauvaise réponse',
    });

    const correctLetter = String.fromCharCode(65 + question.correctIndex);
    const correctText = question.choices[question.correctIndex] ?? '';
    const result = correct
      ? `✅ <b>Bravo !</b>`
      : `❌ <b>Raté.</b> La bonne réponse était <b>${correctLetter}. ${escapeUserText(correctText)}</b>`;
    await ctx.editMessageText(
      `📝 <b>Question du jour</b>\n\n` +
        `${escapeUserText(question.question)}\n\n` +
        `${result}` +
        (question.explanation
          ? `\n\n<i>${escapeUserText(question.explanation)}</i>`
          : '') +
        `\n\nTape /leaderboard pour le classement de la semaine.`,
      { parse_mode: 'HTML' }
    );
  });

  // /leaderboard — top 10 répondeurs (7 derniers jours)
  bot.command('leaderboard', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'quiz'))) return;
    if (!ctx.from?.id) return;
    const { bumpBotStreak } = await import('@/lib/bot/streak');
    void bumpBotStreak(ctx.from.id);

    const { sql, gte } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { users, quizResponses } = await import('@/lib/db/schema');

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const top = await db
      .select({
        userId: quizResponses.userId,
        name: users.telegramFirstName,
        username: users.telegramUsername,
        correct: sql<number>`sum(case when ${quizResponses.correct} then 1 else 0 end)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(quizResponses)
      .innerJoin(users, sql`${users.id} = ${quizResponses.userId}`)
      .where(gte(quizResponses.answeredAt, weekAgo))
      .groupBy(
        quizResponses.userId,
        users.telegramFirstName,
        users.telegramUsername
      )
      .orderBy(
        sql`sum(case when ${quizResponses.correct} then 1 else 0 end) desc`
      )
      .limit(10);

    if (top.length === 0) {
      await ctx.reply(
        `🏆 <b>Classement quiz</b>\n\n` +
          `Personne n'a encore répondu cette semaine. ` +
          `Tape /quiz pour démarrer.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const lines = top.map((r, i) => {
      const medal =
        i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const handle = r.username ? `@${r.username}` : r.name ?? 'Anon';
      return `${medal} <b>${escapeUserText(handle)}</b> — ${r.correct}/${r.total}`;
    });

    await ctx.reply(
      `🏆 <b>Classement quiz</b> · 7 derniers jours\n\n${lines.join('\n')}`,
      { parse_mode: 'HTML' }
    );
  });

  // ============================================================
  // Parrainage
  // ============================================================

  // /invite — génère/retourne le lien d'invitation perso
  bot.command('invite', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'referral'))) return;
    if (!ctx.from?.id) return;
    const { bumpBotStreak } = await import('@/lib/bot/streak');
    void bumpBotStreak(ctx.from.id);

    const { eq } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { users } = await import('@/lib/db/schema');
    const { nanoid } = await import('nanoid');

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, ctx.from.id),
    });
    if (!user) {
      await ctx.reply(
        `Tu dois d'abord te connecter : ${appUrl}/login`,
        { link_preview_options: { is_disabled: true } }
      );
      return;
    }

    // Génère le code s'il n'existe pas encore (idempotent)
    let code = user.referralCode;
    if (!code) {
      code = nanoid(8);
      await db
        .update(users)
        .set({ referralCode: code, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? 'BoursikotonsBot';
    const inviteUrl = `https://t.me/${botUsername}?start=ref_${code}`;

    // Compte combien il a parrainé jusqu'ici
    const { count } = await import('drizzle-orm');
    const [stats] = await db
      .select({ c: count() })
      .from(users)
      .where(eq(users.referredBy, user.id));
    const referrals = stats?.c ?? 0;

    await ctx.reply(
      `🎁 <b>Ton lien d'invitation</b>\n\n` +
        `Partage ce lien — quand quelqu'un démarre le bot via ce lien, ` +
        `tu es enregistré comme parrain :\n\n` +
        `<a href="${inviteUrl}">${inviteUrl}</a>\n\n` +
        `<b>Tu as parrainé : ${referrals}</b> personne${referrals > 1 ? 's' : ''}\n\n` +
        `<i>Top parrain visible sur ${appUrl}/dashboard. Pas de récompense ` +
        `matérielle pour l'instant — juste la fierté.</i>`,
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
    );
  });

  // /temoignage — l'utilisateur soumet un avis (en attente de modération)
  bot.command('temoignage', async (ctx) => {
    if (!ctx.from?.id) return;
    const { eq, and } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { users, testimonials, adminNotifications } = await import(
      '@/lib/db/schema'
    );

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, ctx.from.id),
    });
    if (!user) {
      await ctx.reply(
        `Tu dois d'abord te connecter : ${appUrl}/login`,
        { link_preview_options: { is_disabled: true } }
      );
      return;
    }

    // Le texte du témoignage = tout ce qui suit la commande
    const body = (ctx.match ?? '').toString().trim();
    if (body.length < 20) {
      await ctx.reply(
        `📝 <b>Laisse-nous un témoignage</b>\n\n` +
          `Format : <code>/temoignage Ton avis ici</code>\n\n` +
          `Minimum 20 caractères. Une fois validé par l'équipe, ` +
          `il apparaîtra sur ${appUrl}/temoignages avec ton @ Telegram cliquable.\n\n` +
          `Tu peux écrire ce que tu veux : ton expérience formation, le groupe VIP, le bot, etc.`,
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
      );
      return;
    }
    if (body.length > 600) {
      await ctx.reply(
        `Trop long (max 600 caractères). Là tu en as ${body.length}.`
      );
      return;
    }

    // Anti-doublon : si l'user a déjà un témoignage pending, on update
    const existing = await db.query.testimonials.findFirst({
      where: and(
        eq(testimonials.userId, user.id),
        eq(testimonials.status, 'pending')
      ),
    });

    if (existing) {
      await db
        .update(testimonials)
        .set({ body, createdAt: new Date() })
        .where(eq(testimonials.id, existing.id));
      await ctx.reply(
        `✓ Ton témoignage en attente a été mis à jour.\n\n` +
          `On le relit et on te répond rapidement par message.`
      );
      return;
    }

    const [inserted] = await db
      .insert(testimonials)
      .values({
        userId: user.id,
        body,
        status: 'pending',
      })
      .returning({ id: testimonials.id });

    if (inserted) {
      // Notif admin (visible dans /admin/testimonials)
      await db.insert(adminNotifications).values({
        type: 'testimonial_pending',
        payload: {
          testimonialId: inserted.id,
          userId: user.id,
          preview: body.slice(0, 120),
        },
      });
    }

    await ctx.reply(
      `🙏 <b>Merci pour ton témoignage</b>\n\n` +
        `On le valide rapidement et il apparaîtra sur ${appUrl}/temoignages avec ton ${
          user.telegramUsername ? `@${user.telegramUsername}` : 'prénom'
        } cliquable.\n\n` +
        `<i>Si on le rejette (rare), on t'enverra un message pour expliquer.</i>`,
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
    );
  });

  // /streak — affiche le streak d'interaction quotidien
  bot.command('streak', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'streak'))) return;
    if (!ctx.from?.id) return;
    const { bumpBotStreak } = await import('@/lib/bot/streak');
    const newStreak = await bumpBotStreak(ctx.from.id);
    if (newStreak === 0) {
      await ctx.reply(
        `Tu n'as pas encore de compte. Connecte-toi : ${appUrl}/login`,
        { link_preview_options: { is_disabled: true } }
      );
      return;
    }
    const emoji =
      newStreak >= 30
        ? '🔥🔥🔥'
        : newStreak >= 14
        ? '🔥🔥'
        : newStreak >= 7
        ? '🔥'
        : '✨';
    const milestone =
      newStreak === 7
        ? '\n\n🎉 1 semaine d\'affilée !'
        : newStreak === 30
        ? '\n\n🏆 30 jours — tu es vraiment dans le truc.'
        : newStreak === 100
        ? '\n\n👑 100 jours. Hall of fame.'
        : '';
    await ctx.reply(
      `${emoji} <b>Streak : ${newStreak} jour${newStreak > 1 ? 's' : ''}</b>${milestone}\n\n` +
        `Reviens demain pour continuer la série. Si tu sautes un jour, le streak retombe à 1.`,
      { parse_mode: 'HTML' }
    );
  });

  // /login — fallback magic-link quand le Telegram Login Widget bugue
  // (BotFather domain pas configuré, popup bloquée, etc.)
  bot.command('login', async (ctx) => {
    const tgId = ctx.from?.id;
    if (!tgId) return;

    // Check env vars en amont pour donner un message clair (vs erreur opaque)
    const hasSecret =
      !!process.env.MAGIC_LINK_SECRET?.trim() ||
      !!process.env.BETTER_AUTH_SECRET?.trim();
    if (!hasSecret) {
      console.error('[bot] /login: no secret configured');
      await ctx.reply(
        `⚠️ Le service de magic-link n'est pas encore configuré côté serveur.\n\n` +
          `Préviens l'admin : <code>MAGIC_LINK_SECRET</code> ou <code>BETTER_AUTH_SECRET</code> ` +
          `doit être défini dans les variables d'environnement Vercel.\n\n` +
          `En attendant, essaye le widget classique : ${appUrl}/login`,
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
      );
      // Alerte admin Telegram
      await alertAdmins(
        `🚨 <b>/login command failed</b>\n\n` +
          `User Telegram ID : <code>${tgId}</code>\n` +
          `Cause : aucun secret configuré (MAGIC_LINK_SECRET ni BETTER_AUTH_SECRET)\n\n` +
          `Set la var sur Vercel et redéploie.`
      );
      return;
    }

    if (!appUrl) {
      console.error('[bot] /login: NEXT_PUBLIC_APP_URL missing');
      await ctx.reply(
        `⚠️ Configuration manquante (NEXT_PUBLIC_APP_URL). Préviens l'admin.`
      );
      await alertAdmins(
        `🚨 <b>/login command failed</b>\n\nNEXT_PUBLIC_APP_URL not set.`
      );
      return;
    }

    try {
      const { signMagicToken } = await import('@/lib/auth/magic-link');
      const token = signMagicToken(tgId);
      const url = `${appUrl}/login/magic?token=${encodeURIComponent(token)}`;
      await ctx.reply(
        `🔑 <b>Lien de connexion</b>\n\n` +
          `Clique ici pour te connecter sur Boursikotons :\n` +
          `<a href="${url}">Se connecter maintenant</a>\n\n` +
          `Le lien expire dans <b>10 minutes</b>. Pas de partage : il te ` +
          `connecte directement à ton compte.`,
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[bot] /login unexpected error', err);
      await ctx.reply(
        `❌ Erreur inattendue lors de la génération du lien.\n\n` +
          `Détails techniques (montre à l'admin) :\n` +
          `<code>${escapeUserText(msg).slice(0, 200)}</code>\n\n` +
          `Réessaye dans 30s ou utilise ${appUrl}/login`,
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
      );
      await alertAdmins(
        `🚨 <b>/login command crashed</b>\n\n` +
          `User Telegram ID : <code>${tgId}</code>\n` +
          `Error : <code>${escapeUserText(msg).slice(0, 500)}</code>`
      );
    }
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

  // /qualify — questions de qualification (3 quick questions via inline keyboard)
  bot.command('qualify', async (ctx) => {
    const { requireFeature } = await import('@/lib/bot/require-feature');
    if (!(await requireFeature(ctx, 'qualify'))) return;
    await ctx.reply(
      `🎯 <b>Quelques questions rapides</b>\n\n` +
        `Pour mieux te suivre et personnaliser les analyses, dis-moi ` +
        `<b>ton expérience en trading</b> :`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('🌱 Aucune', 'qual:exp:none')
          .text('🔰 Débutant', 'qual:exp:beginner')
          .row()
          .text('📊 Intermédiaire', 'qual:exp:intermediate')
          .text('💼 Avancé', 'qual:exp:advanced'),
      }
    );
  });

  // Callback queries pour /qualify — multi-step inline conversation
  bot.callbackQuery(/^qual:(exp|goal|time):(.+)$/, async (ctx) => {
    const [, field, value] = ctx.match ?? [];
    if (!field || !value || !ctx.from?.id) return;

    const { eq } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { users, vipApplications } = await import('@/lib/db/schema');

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, ctx.from.id),
    });
    if (!user) {
      await ctx.answerCallbackQuery({
        text: 'Compte non trouvé — connecte-toi d\'abord',
        show_alert: true,
      });
      return;
    }

    const app = await db.query.vipApplications.findFirst({
      where: eq(vipApplications.userId, user.id),
    });
    if (!app) {
      await ctx.answerCallbackQuery({
        text: 'Démarre d\'abord le funnel VIP sur le site',
        show_alert: true,
      });
      return;
    }

    const prev = app.qualificationAnswers ?? {};
    const updated = { ...prev };
    if (field === 'exp') {
      updated.experience = value as typeof updated.experience;
    } else if (field === 'goal') {
      updated.goal = value as typeof updated.goal;
    } else if (field === 'time') {
      updated.timeAvailable = value as typeof updated.timeAvailable;
    }
    updated.askedAt = new Date().toISOString();

    await db
      .update(vipApplications)
      .set({ qualificationAnswers: updated, updatedAt: new Date() })
      .where(eq(vipApplications.id, app.id));

    await ctx.answerCallbackQuery({ text: '✓ Noté' });

    // Suivante question selon le field
    if (field === 'exp') {
      await ctx.editMessageText(
        `✓ Expérience : <b>${value}</b>\n\n` +
          `<b>Quel est ton objectif principal</b> avec le trading ?`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('💰 Revenus complémentaires', 'qual:goal:income')
            .row()
            .text('📚 Apprendre', 'qual:goal:learn')
            .text('🏦 Long terme', 'qual:goal:long_term')
            .row()
            .text('🤔 Curiosité', 'qual:goal:curiosity'),
        }
      );
    } else if (field === 'goal') {
      await ctx.editMessageText(
        `✓ Objectif : <b>${value}</b>\n\n` +
          `<b>Combien de temps</b> tu peux y consacrer ?`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('🕐 Quelques heures/sem', 'qual:time:few_hours')
            .row()
            .text('🌙 Mes soirées', 'qual:time:evenings')
            .row()
            .text('💼 Temps plein', 'qual:time:full_time'),
        }
      );
    } else if (field === 'time') {
      await ctx.editMessageText(
        `🎉 <b>Merci ${user.telegramFirstName ?? user.name ?? ''} !</b>\n\n` +
          `Tes réponses :\n` +
          `• Expérience : <b>${updated.experience}</b>\n` +
          `• Objectif : <b>${updated.goal}</b>\n` +
          `• Temps : <b>${updated.timeAvailable}</b>\n\n` +
          `On va personnaliser ton suivi en conséquence. Continue ton funnel ici : ${appUrl}/vip`,
        {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        }
      );
    }
  });

  // ============================================================
  // Inline mode : @boursikotonsbot <query> dans n'importe quel chat
  // ============================================================
  // Nécessite que /setinline soit fait chez @BotFather pour activer l'inline.
  bot.on('inline_query', async (ctx) => {
    // Check feature toggle (admin peut désactiver l'inline)
    const { getBotFeatures } = await import('@/lib/settings/bot-features');
    const features = await getBotFeatures();
    if (!features.inline) {
      await ctx.answerInlineQuery([], { cache_time: 5 });
      return;
    }

    const query = ctx.inlineQuery.query.trim();
    const { lookupQuote, formatQuote } = await import(
      '@/lib/bot/inline-quotes'
    );

    // Empty query : carte "Découvre Boursikotons" + suggestions
    if (!query) {
      await ctx.answerInlineQuery(
        [
          {
            type: 'article',
            id: 'discover',
            title: '💎 Boursikotons VIP — gratuit',
            description: 'Groupe Telegram de signaux + formation trading',
            thumbnail_url: `${appUrl}/og.png`,
            input_message_content: {
              message_text:
                `💎 <b>Boursikotons VIP Telegram</b>\n\n` +
                `Signaux quotidiens, analyses, communauté de traders.\n` +
                `100% gratuit (rémunération via broker partenaire).\n\n` +
                `→ ${appUrl}/vip`,
              parse_mode: 'HTML',
              link_preview_options: { is_disabled: true },
            },
          },
          {
            type: 'article',
            id: 'tips',
            title: '🛠 Astuce : tape une paire FX ou crypto',
            description: 'Ex : @boursikotonsbot EURUSD · ou BTC, ETH, SOL...',
            input_message_content: {
              message_text:
                `<i>Astuce : @boursikotonsbot &lt;symbol&gt;</i>\n` +
                `Ex : <code>@boursikotonsbot EURUSD</code> ou <code>BTC</code>\n\n` +
                `Renvoie le prix live, partageable dans n'importe quel chat.`,
              parse_mode: 'HTML',
            },
          },
        ],
        { cache_time: 60 }
      );
      return;
    }

    // Cherche un quote correspondant à la query
    const quote = await lookupQuote(query);
    if (quote) {
      const f = formatQuote(quote);
      await ctx.answerInlineQuery(
        [
          {
            type: 'article',
            id: `quote_${quote.type}_${
              quote.type === 'fx' ? quote.pair : quote.symbol
            }`,
            title: f.title,
            description: f.description,
            input_message_content: {
              message_text: f.message,
              parse_mode: 'HTML',
              link_preview_options: { is_disabled: true },
            },
          },
        ],
        // cache 30s pour limiter le hit sur les APIs gratuites
        { cache_time: 30 }
      );
      return;
    }

    // Pas de match → carte "non trouvé" avec hint
    await ctx.answerInlineQuery(
      [
        {
          type: 'article',
          id: 'not_found',
          title: `❌ "${query.slice(0, 30)}" non reconnu`,
          description: 'Essaye une paire FX (EURUSD) ou un symbol crypto (BTC, ETH...)',
          input_message_content: {
            message_text:
              `Le bot n'a pas reconnu "${query.slice(0, 50)}".\n\n` +
              `<b>Formats supportés :</b>\n` +
              `• Paires FX : <code>EURUSD</code>, <code>GBPJPY</code>, <code>USDCHF</code>...\n` +
              `• Cryptos top : <code>BTC</code>, <code>ETH</code>, <code>SOL</code>, <code>BNB</code>...`,
            parse_mode: 'HTML',
          },
        },
      ],
      { cache_time: 5 }
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

/**
 * Échappe les caractères HTML pour les insérer en sécurité dans un message
 * `parse_mode: 'HTML'`. Évite que `<i>spoof</i>` injecté par un user soit
 * interprété par Telegram.
 */
function escapeUserText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Envoie un message au channel admin Telegram (ADMIN_ALERT_CHAT_ID).
 * Silencieux si l'env var n'est pas configurée. Best-effort.
 */
async function alertAdmins(message: string): Promise<void> {
  const chatId = process.env.ADMIN_ALERT_CHAT_ID;
  if (!chatId) return;
  try {
    const bot = getBot();
    await bot.api.sendMessage(Number(chatId), message, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    console.warn('[bot] alertAdmins failed', err);
  }
}
