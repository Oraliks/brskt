import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { IronFXApiAdapter } from './api-adapter';
import { IronFXManualAdapter } from './manual-adapter';
import type { IronFXAdapter, IronFXMode } from './types';

const SETTINGS_KEY = 'ironfx_mode';
const DEFAULT_MODE: IronFXMode = 'manual';

/**
 * Cache court (1 minute) pour éviter de hit la DB à chaque appel.
 * Sur Vercel les fonctions sont stateless donc le cache ne survit pas entre invocations,
 * mais utile en local et dans des longues exécutions (CRON).
 */
let cachedMode: { mode: IronFXMode; expiresAt: number } | null = null;

export async function getIronFXMode(): Promise<IronFXMode> {
  if (cachedMode && cachedMode.expiresAt > Date.now()) {
    return cachedMode.mode;
  }

  const setting = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, SETTINGS_KEY),
  });

  const value = setting?.value as { mode?: IronFXMode } | undefined;
  const mode: IronFXMode = value?.mode === 'api' ? 'api' : DEFAULT_MODE;

  cachedMode = { mode, expiresAt: Date.now() + 60_000 };
  return mode;
}

export async function setIronFXMode(
  mode: IronFXMode,
  updatedBy: string
): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: SETTINGS_KEY,
      value: { mode },
      updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: { mode },
        updatedBy,
        updatedAt: new Date(),
      },
    });

  // Invalide le cache local
  cachedMode = null;
}

/**
 * Retourne l'adapter actif selon le mode configuré dans l'admin.
 * À utiliser systématiquement à la place d'instancier directement
 * IronFXApiAdapter ou IronFXManualAdapter.
 */
export async function getIronFXAdapter(): Promise<IronFXAdapter> {
  const mode = await getIronFXMode();

  if (mode === 'api') {
    try {
      return new IronFXApiAdapter();
    } catch (err) {
      // Si l'API est configurée comme active mais que les env vars manquent,
      // on fallback en manuel plutôt que de crasher.
      console.warn(
        '[IronFX] API mode active but config missing, falling back to manual',
        err
      );
      return new IronFXManualAdapter();
    }
  }

  return new IronFXManualAdapter();
}

export * from './types';
