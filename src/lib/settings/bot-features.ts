import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';

const KEY = 'bot_features';

/**
 * Toggles ON/OFF pour les features bot/CRONs. Editable via /admin/bot.
 *
 * Chaque flag est checké par :
 *  - Le CRON correspondant (skip silencieusement si false)
 *  - Les commandes bot associées (répondent "désactivé temporairement")
 *  - L'inline mode (skip si false)
 *
 * Pas dans cette structure (gérés ailleurs) :
 *  - daily briefing template : lib/settings/daily-briefing.ts (a son propre
 *    enabled flag pour la simplicité historique — on l'inclut dans le UI
 *    /admin/bot pour l'unification visuelle).
 *  - welcome bonus : lib/settings/welcome-bonus.ts (côté /vip, pas bot)
 */
export interface BotFeatures {
  /** /quiz, /leaderboard, CRON daily-quiz */
  quiz: boolean;
  /** /events, /subscribe events, CRON check-economic-alerts */
  economicAlerts: boolean;
  /** /alert, /alerts, /unalert, CRON check-price-alerts */
  priceAlerts: boolean;
  /** /invite + tracking /start ref_<code> + dashboard widget */
  referral: boolean;
  /** inline_query handler (@bot dans n'importe quel chat) */
  inline: boolean;
  /** /size, /rr, /pip, /convert */
  calculators: boolean;
  /** /streak + tracking bumpBotStreak */
  streak: boolean;
  /** /qualify questionnaire */
  qualify: boolean;
}

const DEFAULT_FEATURES: BotFeatures = {
  quiz: true,
  economicAlerts: true,
  priceAlerts: true,
  referral: true,
  inline: true,
  calculators: true,
  streak: true,
  qualify: true,
};

/**
 * Lit les toggles bot. Si pas configurés en DB → renvoie le défaut
 * (tout activé). Fail-safe (default-on) pour éviter de désactiver
 * accidentellement des features en cas de DB down.
 */
export async function getBotFeatures(): Promise<BotFeatures> {
  try {
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, KEY),
    });
    if (!row) return DEFAULT_FEATURES;
    // Merge avec les défauts pour gérer les nouvelles features ajoutées
    return { ...DEFAULT_FEATURES, ...(row.value as Partial<BotFeatures>) };
  } catch (err) {
    console.error('[settings] getBotFeatures failed (fail-open)', err);
    return DEFAULT_FEATURES;
  }
}

export async function setBotFeatures(
  updates: Partial<BotFeatures>,
  userId: string
): Promise<void> {
  const current = await getBotFeatures();
  const next = { ...current, ...updates };
  const value = next as unknown as Record<string, unknown>;
  await db
    .insert(appSettings)
    .values({
      key: KEY,
      value,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy: userId, updatedAt: new Date() },
    });
}
