import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';

const KEY = 'welcome_bonus';

export interface WelcomeBonus {
  /** Si false, ne s'affiche pas (toggle off). */
  enabled: boolean;
  /** Titre affiché à l'user (court, accrocheur). */
  title: string;
  /** Description courte (1-2 phrases). */
  description: string;
  /** Texte secondaire / conditions (optionnel). */
  fineprint?: string;
}

const DEFAULT_BONUS: WelcomeBonus = {
  enabled: false,
  title: 'Bonus de bienvenue IronFX',
  description:
    'À négocier avec le broker — placeholder pour quand l\'offre sera prête.',
  fineprint: undefined,
};

/**
 * Lit la config du welcome bonus depuis app_settings.
 * Retourne le défaut (disabled) si pas encore configuré.
 */
export async function getWelcomeBonus(): Promise<WelcomeBonus> {
  try {
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, KEY),
    });
    if (!row) return DEFAULT_BONUS;
    return { ...DEFAULT_BONUS, ...(row.value as Partial<WelcomeBonus>) };
  } catch (err) {
    console.error('[settings] getWelcomeBonus failed', err);
    return DEFAULT_BONUS;
  }
}

/**
 * Met à jour la config du welcome bonus.
 * @param userId admin qui a fait le changement (pour traçabilité)
 */
export async function setWelcomeBonus(
  bonus: WelcomeBonus,
  userId: string
): Promise<void> {
  // appSettings.value est typé Record<string,unknown> — on cast notre
  // WelcomeBonus (qui n'a pas d'index signature) en cet objet.
  const value = bonus as unknown as Record<string, unknown>;
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
