import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';

const KEY = 'theme_mode';

/**
 * Mode d'affichage du thème :
 *  - `both` : l'user choisit (toggle visible, défaut)
 *  - `light_only` : force light, toggle masqué
 *  - `dark_only` : force dark, toggle masqué
 */
export type ThemeMode = 'both' | 'light_only' | 'dark_only';

const DEFAULT_MODE: ThemeMode = 'both';

export async function getThemeMode(): Promise<ThemeMode> {
  try {
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, KEY),
    });
    if (!row) return DEFAULT_MODE;
    const value = (row.value as { mode?: string })?.mode;
    if (value === 'light_only' || value === 'dark_only' || value === 'both') {
      return value;
    }
    return DEFAULT_MODE;
  } catch (err) {
    console.error('[settings] getThemeMode failed', err);
    return DEFAULT_MODE;
  }
}

export async function setThemeMode(mode: ThemeMode, userId: string): Promise<void> {
  const value: Record<string, unknown> = { mode };
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
