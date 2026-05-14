/**
 * Compteur de membres du canal Telegram — override manuel.
 *
 * Quand l'admin ne peut pas mettre le bot dans le canal (canal privé > 200
 * membres, restriction Telegram), il peut configurer manuellement le count
 * affiché. Ce setting prend le pas sur l'API Telegram.
 *
 * Stocké dans `app_settings` key='community_count_override'.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';

const KEY = 'community_count_override';

export interface CommunityCountOverride {
  /** Si true, on affiche `value` au lieu de tenter l'API Telegram. */
  enabled: boolean;
  /** Nombre de membres à afficher quand enabled. */
  value: number;
}

const DEFAULT: CommunityCountOverride = { enabled: false, value: 0 };

export async function getCommunityCountOverride(): Promise<CommunityCountOverride> {
  try {
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, KEY),
    });
    if (!row) return DEFAULT;
    return { ...DEFAULT, ...(row.value as Partial<CommunityCountOverride>) };
  } catch (err) {
    console.error('[settings] getCommunityCountOverride failed', err);
    return DEFAULT;
  }
}

export async function setCommunityCountOverride(
  override: CommunityCountOverride,
  userId: string
): Promise<void> {
  const value = override as unknown as Record<string, unknown>;
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
