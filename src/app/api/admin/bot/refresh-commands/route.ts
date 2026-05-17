import { getBot } from '@/lib/telegram/bot';
import { requireAdmin } from '@/lib/auth/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pousse la liste des commandes du bot vers Telegram (`setMyCommands`).
 *
 * Appelle ça une fois après chaque ajout/suppression de commandes — Telegram
 * mémorise la liste côté client pour l'autocomplete "/" et le menu "Bot
 * commands". L'endpoint est admin-only.
 *
 * À déclencher manuellement depuis l'admin (futur bouton dans /admin/bot)
 * ou via `curl -X POST /api/admin/bot/refresh-commands` après login admin.
 */
export async function POST() {
  await requireAdmin();

  const bot = getBot();

  const commands: { command: string; description: string }[] = [
    // Compte
    { command: 'start', description: 'Démarrer' },
    { command: 'dashboard', description: 'Mon espace web' },
    { command: 'status', description: 'Ma progression VIP & CPA' },
    { command: 'streak', description: 'Mon streak quotidien' },
    { command: 'qualify', description: 'Personnaliser mon suivi' },

    // App & contenu
    { command: 'app', description: "Ouvrir l'app intégrée Telegram" },
    { command: 'videos', description: 'Ma chaîne YouTube' },

    // Formations & VIP
    { command: 'formation', description: 'Réserver une formation' },
    { command: 'vip', description: 'Rejoindre le VIP Telegram' },

    // Jeux & XP
    { command: 'jouer', description: 'Hub des jeux & XP' },
    { command: 'predict', description: 'Pronostic chandelier du jour' },
    { command: 'roue', description: 'Roue de la fortune (1×/semaine)' },
    { command: 'clic', description: 'Combo de clic (3×/jour)' },
    { command: 'journal', description: "Journal d'émotion quotidien" },
    { command: 'fomo', description: 'FOMO Test (10 décisions, 4s chacune)' },
    { command: 'patience', description: 'Patience Trainer (chart real-time)' },
    { command: 'aversion', description: "Test d'aversion à la perte (1×/sem)" },
    { command: 'classement', description: 'Top traders Boursikotons' },

    // Calculatrices trading
    { command: 'size', description: 'Taille de position' },
    { command: 'rr', description: 'Ratio risk/reward' },
    { command: 'pip', description: 'Valeur du pip' },
    { command: 'convert', description: 'Conversion devises live' },

    // Alertes
    { command: 'alert', description: 'Créer une alerte de prix' },
    { command: 'alerts', description: 'Mes alertes actives' },
    { command: 'unalert', description: 'Supprimer une alerte' },

    // Briefings & macro
    { command: 'subscribe', description: 'Briefing quotidien on' },
    { command: 'unsubscribe', description: 'Briefing quotidien off' },
    { command: 'events', description: 'Prochains événements macro' },

    // Quiz
    { command: 'quiz', description: 'Question du jour' },
    { command: 'leaderboard', description: 'Classement quiz' },

    // Communauté
    { command: 'invite', description: 'Mon lien de parrainage' },
    { command: 'temoignage', description: 'Laisser un avis' },
    { command: 'support', description: 'Contacter le support' },

    { command: 'help', description: 'Toutes les commandes' },
  ];

  await bot.api.setMyCommands(commands);

  return Response.json({
    success: true,
    count: commands.length,
    commands,
  });
}
