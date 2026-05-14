import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';

const KEY = 'daily_briefing';

export interface DailyBriefing {
  /** Si false, le CRON ne pousse rien (admin éteint manuellement). */
  enabled: boolean;
  /** Template Markdown/HTML envoyé tel quel par le bot.
   *  Supporte un placeholder {{firstName}} qui sera remplacé. */
  template: string;
}

const DEFAULT_BRIEFING: DailyBriefing = {
  enabled: false,
  template:
    `☀️ <b>Bonjour {{firstName}}</b>\n\n` +
    `Voici le briefing du jour :\n\n` +
    `📊 <b>Marchés overnight</b>\n` +
    `(à compléter par l'admin)\n\n` +
    `📅 <b>Agenda macro du jour</b>\n` +
    `(à compléter)\n\n` +
    `🎯 <b>Niveaux à surveiller</b>\n` +
    `(à compléter)\n\n` +
    `<i>Pour te désinscrire : /unsubscribe briefing</i>`,
};

export async function getDailyBriefing(): Promise<DailyBriefing> {
  try {
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, KEY),
    });
    if (!row) return DEFAULT_BRIEFING;
    return { ...DEFAULT_BRIEFING, ...(row.value as Partial<DailyBriefing>) };
  } catch (err) {
    console.error('[settings] getDailyBriefing failed', err);
    return DEFAULT_BRIEFING;
  }
}

export async function setDailyBriefing(
  briefing: DailyBriefing,
  userId: string
): Promise<void> {
  const value = briefing as unknown as Record<string, unknown>;
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
