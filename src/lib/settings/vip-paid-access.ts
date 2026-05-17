import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';

const KEY = 'vip_paid_access';

/**
 * Configuration de l'accès VIP payant direct.
 *  - `priceEur` : montant unique en EUR (paiement unique, pas de 3x)
 *  - `enabled` : si false, l'option n'est plus proposée aux nouveaux users
 *    (les accès existants restent actifs)
 */
export interface VipPaidAccessConfig {
  enabled: boolean;
  priceEur: number;
}

const DEFAULT_CONFIG: VipPaidAccessConfig = {
  enabled: true,
  priceEur: 250,
};

export async function getVipPaidAccessConfig(): Promise<VipPaidAccessConfig> {
  try {
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, KEY),
    });
    if (!row) return DEFAULT_CONFIG;
    return {
      ...DEFAULT_CONFIG,
      ...(row.value as Partial<VipPaidAccessConfig>),
    };
  } catch (err) {
    console.error('[settings] getVipPaidAccessConfig failed', err);
    return DEFAULT_CONFIG;
  }
}

export async function setVipPaidAccessConfig(
  config: VipPaidAccessConfig,
  userId: string
): Promise<void> {
  const value = config as unknown as Record<string, unknown>;
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
