import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { gameTapRuns } from '@/lib/db/schema';
import { addXp } from './xp';

/**
 * Paliers du mini-jeu de clic. Atteindre un palier donne un bonus XP au
 * moment où on soumet le run. Le client peut s'en servir pour afficher
 * "Niveau X atteint" pendant le run, mais c'est le serveur qui décide
 * du XP à attribuer.
 *
 * Vitesse exigée par palier : combo time qui se réduit (cf. TapGame).
 * Au-delà du niveau 5, on continue de compter les taps mais sans nouveau
 * palier (max théorique côté UI : run "infini" tant que tu tapes vite).
 */
export const TAP_LEVELS = [
  { level: 1, minTaps: 10, bonusXp: 5, icon: '🟢' },
  { level: 2, minTaps: 25, bonusXp: 15, icon: '🟡' },
  { level: 3, minTaps: 50, bonusXp: 30, icon: '🟠' },
  { level: 4, minTaps: 100, bonusXp: 60, icon: '🔴' },
  { level: 5, minTaps: 200, bonusXp: 120, icon: '🟣' },
] as const;

/** Max XP par run (anti-farm). Bonus paliers compris. */
export const TAP_RUN_MAX_XP = 200;

/** Limite de runs / jour / user. Reset à minuit Paris. */
export const TAP_DAILY_LIMIT = 3;

/** Taux max de taps/s plausible humainement. Au-delà → reject. */
const MAX_TAPS_PER_SECOND = 20;
/** Run trop court ou trop long = suspect, on rejette. */
const MIN_DURATION_MS = 500;
const MAX_DURATION_MS = 5 * 60 * 1000; // 5 min

export interface TapRunInput {
  /** Nombre total de taps dans le run. */
  taps: number;
  /** Durée totale du run en ms (1er tap → dernier tap). */
  durationMs: number;
}

export type TapRunResult =
  | {
      ok: true;
      xpAwarded: number;
      levelReached: number;
      newTotal: number;
      runsLeftToday: number;
    }
  | {
      ok: false;
      error: 'daily_limit' | 'invalid_run' | 'too_fast' | 'unknown';
      runsLeftToday?: number;
    };

/**
 * Calcule le niveau atteint pour un nombre de taps donné.
 */
export function tapLevelFor(taps: number): number {
  let level = 0;
  for (const tier of TAP_LEVELS) {
    if (taps >= tier.minTaps) level = tier.level;
    else break;
  }
  return level;
}

/**
 * Calcule l'XP gagné pour un run (taps + paliers atteints, cappé).
 *
 * Barème :
 *  - 1 XP par tranche de 5 taps (linéaire)
 *  - + bonus du palier max atteint
 *  - Cappé à TAP_RUN_MAX_XP
 */
export function tapXpFor(taps: number): { xp: number; level: number } {
  const level = tapLevelFor(taps);
  const linear = Math.floor(taps / 5);
  const bonus = TAP_LEVELS.find((t) => t.level === level)?.bonusXp ?? 0;
  const total = Math.min(TAP_RUN_MAX_XP, linear + bonus);
  return { xp: total, level };
}

/**
 * Compte les runs effectués par un user aujourd'hui (Paris time).
 * Utilise UTC en pratique : minuit Paris = 23h UTC (hiver) ou 22h UTC (été).
 * On approxime avec "24h glissantes" pour rester simple — un user qui
 * joue à 23h59 puis 00h01 aurait 2 runs comptés mais ça reste juste.
 */
async function runsLast24h(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(gameTapRuns)
    .where(and(eq(gameTapRuns.userId, userId), gte(gameTapRuns.createdAt, since)));
  return rows[0]?.c ?? 0;
}

/**
 * Soumet un run. Validation + persistance + attribution XP.
 *
 * Anti-cheat :
 *  - Durée plausible (500ms à 5 min)
 *  - Ratio taps/seconde ≤ 20 (humanly impossible au-dessus)
 *  - Daily limit 3 runs / 24h
 */
export async function submitTapRun(
  userId: string,
  input: TapRunInput
): Promise<TapRunResult> {
  // Sanitize
  const taps = Math.floor(input.taps);
  const durationMs = Math.floor(input.durationMs);

  if (
    !Number.isFinite(taps) ||
    !Number.isFinite(durationMs) ||
    taps < 1 ||
    durationMs < MIN_DURATION_MS ||
    durationMs > MAX_DURATION_MS
  ) {
    return { ok: false, error: 'invalid_run' };
  }

  // Anti-cheat : taps trop nombreux pour la durée
  const maxPlausibleTaps = Math.ceil((durationMs / 1000) * MAX_TAPS_PER_SECOND);
  if (taps > maxPlausibleTaps) {
    return { ok: false, error: 'too_fast' };
  }

  // Daily limit
  const done = await runsLast24h(userId);
  if (done >= TAP_DAILY_LIMIT) {
    return { ok: false, error: 'daily_limit', runsLeftToday: 0 };
  }

  const { xp, level } = tapXpFor(taps);

  try {
    await db.insert(gameTapRuns).values({
      userId,
      taps,
      maxLevel: level,
      durationMs,
      xpAwarded: xp,
    });

    const newTotal =
      xp > 0
        ? await addXp({
            userId,
            amount: xp,
            reason: 'wheel_spin', // pas d'enum dédié — on log avec un reason existant
            metadata: { source: 'tap_game', taps, level, durationMs },
          })
        : 0;

    return {
      ok: true,
      xpAwarded: xp,
      levelReached: level,
      newTotal,
      runsLeftToday: Math.max(0, TAP_DAILY_LIMIT - done - 1),
    };
  } catch (err) {
    console.warn('[tap] submit failed', err);
    return { ok: false, error: 'unknown' };
  }
}

/**
 * Historique des runs récents du user (récent en premier).
 */
export async function getTapRunHistory(
  userId: string,
  limit = 10
): Promise<
  Array<{
    id: string;
    taps: number;
    maxLevel: number;
    durationMs: number;
    xpAwarded: number;
    createdAt: Date;
  }>
> {
  try {
    return await db
      .select()
      .from(gameTapRuns)
      .where(eq(gameTapRuns.userId, userId))
      .orderBy(desc(gameTapRuns.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

/**
 * État pour la page : runs restants aujourd'hui, meilleur run all-time.
 */
export async function getTapState(userId: string): Promise<{
  runsLeftToday: number;
  bestTaps: number;
  bestLevel: number;
}> {
  try {
    const [done, [best]] = await Promise.all([
      runsLast24h(userId),
      db
        .select({
          taps: gameTapRuns.taps,
          maxLevel: gameTapRuns.maxLevel,
        })
        .from(gameTapRuns)
        .where(eq(gameTapRuns.userId, userId))
        .orderBy(desc(gameTapRuns.taps))
        .limit(1),
    ]);
    return {
      runsLeftToday: Math.max(0, TAP_DAILY_LIMIT - done),
      bestTaps: best?.taps ?? 0,
      bestLevel: best?.maxLevel ?? 0,
    };
  } catch {
    return { runsLeftToday: TAP_DAILY_LIMIT, bestTaps: 0, bestLevel: 0 };
  }
}
