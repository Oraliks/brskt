import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { candleHopRuns } from '@/lib/db/schema';
import { addXp, getUserXpState } from './xp';

/**
 * Candle Hop : jeu Flappy-style themé trading.
 *
 * Game design :
 *  - Player = candlestick qui tombe sous gravité, tap = saut
 *  - Obstacles = paires de bougies rouges (haut+bas) avec gap
 *  - Bonus = bougies vertes flottantes (+3 pts si touchées)
 *  - Game over = collision ou sortie d'écran
 *  - Speed augmente +5% tous les 10 pts
 *
 * Économie :
 *  - 5 runs / 24h glissantes
 *  - 300 XP cap quotidien (au-delà : tu peux jouer mais XP=0)
 *  - Bonus +50 XP si nouveau personal best (max 1×/jour)
 */

export const CANDLE_HOP_DAILY_LIMIT = 5;
export const CANDLE_HOP_DAILY_XP_CAP = 300;
export const CANDLE_HOP_PB_BONUS_XP = 50;

/** Bornes anti-cheat */
const MAX_PLAUSIBLE_SCORE = 500;
const MIN_DURATION_MS = 1_500; // Faut au moins 1.5s pour un run plausible
const MAX_DURATION_MS = 10 * 60 * 1000; // 10 min
const MAX_TAPS = 10_000;
/** Un score N demande au moins N × 0.4s de jeu (tunable) */
const MIN_MS_PER_SCORE = 400;

/**
 * XP par palier de score. Strictement croissant, gros bond entre 30+ et 60+.
 */
export function candleHopXpFor(score: number): number {
  const s = Math.max(0, Math.floor(score));
  if (s >= 100) return 200;
  if (s >= 60) return 150;
  if (s >= 30) return 75;
  if (s >= 15) return 40;
  if (s >= 5) return 15;
  return 5;
}

export interface CandleHopState {
  canPlay: boolean;
  /** Runs encore dispos sur les 24h glissantes. */
  runsLeftToday: number;
  runsTotal: number;
  /** Meilleur score all-time. */
  bestScore: number;
  /** XP gagné sur les 24h glissantes pour ce jeu (pour cap). */
  xpEarnedToday: number;
  xpCap: number;
  lastRun: { score: number; xpAwarded: number; createdAt: Date } | null;
  recentRuns: Array<{ score: number; xpAwarded: number; createdAt: Date }>;
  /** Nombre total de runs de l'user. */
  totalRuns: number;
}

export async function getCandleHopState(
  userId: string
): Promise<CandleHopState> {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // On tape large pour avoir best + récents en une seule query.
    const allRuns = await db
      .select()
      .from(candleHopRuns)
      .where(eq(candleHopRuns.userId, userId))
      .orderBy(desc(candleHopRuns.createdAt))
      .limit(50);

    const last24 = allRuns.filter((r) => r.createdAt >= since24h);
    const bestScore = allRuns.reduce((m, r) => Math.max(m, r.score), 0);
    const xpEarnedToday = last24.reduce((s, r) => s + r.xpAwarded, 0);
    const runsLeftToday = Math.max(
      0,
      CANDLE_HOP_DAILY_LIMIT - last24.length
    );

    return {
      canPlay: runsLeftToday > 0,
      runsLeftToday,
      runsTotal: CANDLE_HOP_DAILY_LIMIT,
      bestScore,
      xpEarnedToday,
      xpCap: CANDLE_HOP_DAILY_XP_CAP,
      lastRun: allRuns[0]
        ? {
            score: allRuns[0].score,
            xpAwarded: allRuns[0].xpAwarded,
            createdAt: allRuns[0].createdAt,
          }
        : null,
      recentRuns: allRuns.slice(0, 10).map((r) => ({
        score: r.score,
        xpAwarded: r.xpAwarded,
        createdAt: r.createdAt,
      })),
      totalRuns: allRuns.length,
    };
  } catch (err) {
    console.warn('[candle-hop] state fallback', err);
    return {
      canPlay: true,
      runsLeftToday: CANDLE_HOP_DAILY_LIMIT,
      runsTotal: CANDLE_HOP_DAILY_LIMIT,
      bestScore: 0,
      xpEarnedToday: 0,
      xpCap: CANDLE_HOP_DAILY_XP_CAP,
      lastRun: null,
      recentRuns: [],
      totalRuns: 0,
    };
  }
}

export type SubmitCandleHopResult =
  | {
      ok: true;
      score: number;
      xpAwarded: number;
      bonusXp: number;
      newTotal: number;
      isPersonalBest: boolean;
      runsLeftToday: number;
    }
  | {
      ok: false;
      error: 'invalid_run' | 'daily_limit' | 'unknown';
    };

/**
 * Vérifie la cohérence du run et persiste.
 */
export async function submitCandleHopRun(
  userId: string,
  input: { score: number; durationMs: number; taps: number }
): Promise<SubmitCandleHopResult> {
  const score = Math.floor(input.score);
  const durationMs = Math.floor(input.durationMs);
  const taps = Math.floor(input.taps);

  if (
    !Number.isFinite(score) ||
    score < 0 ||
    score > MAX_PLAUSIBLE_SCORE
  ) {
    return { ok: false, error: 'invalid_run' };
  }
  if (
    !Number.isFinite(durationMs) ||
    durationMs < MIN_DURATION_MS ||
    durationMs > MAX_DURATION_MS
  ) {
    return { ok: false, error: 'invalid_run' };
  }
  if (!Number.isFinite(taps) || taps < 0 || taps > MAX_TAPS) {
    return { ok: false, error: 'invalid_run' };
  }
  // Durée minimale par point de score
  if (score > 0 && durationMs < score * MIN_MS_PER_SCORE) {
    return { ok: false, error: 'invalid_run' };
  }
  // Faut un nombre minimum de taps pour franchir des obstacles
  if (score > 5 && taps < Math.floor(score * 0.5)) {
    return { ok: false, error: 'invalid_run' };
  }

  const state = await getCandleHopState(userId);
  if (state.runsLeftToday <= 0) {
    return { ok: false, error: 'daily_limit' };
  }

  const isPersonalBest = score > state.bestScore;
  const baseXp = candleHopXpFor(score);
  const bonusXp = isPersonalBest && state.bestScore > 0
    ? CANDLE_HOP_PB_BONUS_XP
    : 0;
  const rawTotalXp = baseXp + bonusXp;
  const xpRoom = Math.max(0, CANDLE_HOP_DAILY_XP_CAP - state.xpEarnedToday);
  const xpAwarded = Math.min(rawTotalXp, xpRoom);

  try {
    await db.insert(candleHopRuns).values({
      userId,
      score,
      durationMs,
      taps,
      xpAwarded,
      isPersonalBest,
    });

    let newTotal: number;
    if (xpAwarded > 0) {
      newTotal = await addXp({
        userId,
        amount: xpAwarded,
        reason: 'wheel_spin',
        metadata: {
          source: 'candle_hop',
          score,
          isPersonalBest,
        },
      });
    } else {
      const xpState = await getUserXpState(userId);
      newTotal = xpState?.xpTotal ?? 0;
    }

    return {
      ok: true,
      score,
      xpAwarded,
      bonusXp: Math.min(bonusXp, xpAwarded),
      newTotal,
      isPersonalBest,
      runsLeftToday: state.runsLeftToday - 1,
    };
  } catch (err) {
    console.warn('[candle-hop] submit failed', err);
    return { ok: false, error: 'unknown' };
  }
}

/**
 * Renvoie le top N scores all-time (un par user, son best). Utilisé par
 * le hub pour afficher un mini-leaderboard.
 */
export async function getCandleHopTopScores(
  limit = 10
): Promise<Array<{ userId: string; bestScore: number }>> {
  try {
    const rows = await db
      .select({
        userId: candleHopRuns.userId,
        bestScore: sql<number>`MAX(${candleHopRuns.score})::int`,
      })
      .from(candleHopRuns)
      .groupBy(candleHopRuns.userId)
      .orderBy(desc(sql`MAX(${candleHopRuns.score})`))
      .limit(limit);
    return rows;
  } catch (err) {
    console.warn('[candle-hop] top scores fallback', err);
    return [];
  }
}

/**
 * Compteur global de runs (pour affichage hub).
 */
export async function getCandleHopRunCount(): Promise<number> {
  try {
    const rows = await db
      .select({ c: sql<number>`count(distinct user_id)::int` })
      .from(candleHopRuns);
    return rows[0]?.c ?? 0;
  } catch {
    return 0;
  }
}
