import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { candleHopRuns, userXpStates } from '@/lib/db/schema';
import { addXp, getUserXpState } from './xp';
import { getParisDate } from './markets';

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

// ============================================================
// V2 : skins, power-ups, challenges, achievements
// ============================================================

export interface CandleHopSkin {
  id: string;
  label: string;
  unlockXp: number;
  /** Couleurs : fill + border + glow. */
  fill: string;
  border: string;
  glow: string;
  description: string;
}

/**
 * Skins cosmétiques. Débloqués via xp total (lecture seule depuis
 * `user_xp_states.xpTotal`). Le choix actif est stocké en localStorage
 * côté client uniquement — pas besoin de DB.
 */
export const CANDLE_HOP_SKINS: CandleHopSkin[] = [
  {
    id: 'classic',
    label: 'Classic',
    unlockXp: 0,
    fill: '#fbbf24',
    border: '#f59e0b',
    glow: 'rgba(251, 191, 36, 0.5)',
    description: 'Le bougie jaune de base. Toujours là pour toi.',
  },
  {
    id: 'bull',
    label: 'Bull',
    unlockXp: 500,
    fill: '#10b981',
    border: '#059669',
    glow: 'rgba(16, 185, 129, 0.5)',
    description: 'Vert haussier. Pour ceux qui ne pensent qu\'à la hausse.',
  },
  {
    id: 'bear',
    label: 'Bear',
    unlockXp: 1500,
    fill: '#ef4444',
    border: '#dc2626',
    glow: 'rgba(239, 68, 68, 0.5)',
    description: 'Rouge baissier. Camouflage parmi les obstacles.',
  },
  {
    id: 'diamond',
    label: 'Diamond',
    unlockXp: 3000,
    fill: '#06b6d4',
    border: '#0891b2',
    glow: 'rgba(6, 182, 212, 0.7)',
    description: 'Mains de diamant cristallines. Tu HODL même en saut.',
  },
  {
    id: 'whale',
    label: 'Whale',
    unlockXp: 6000,
    fill: '#8b5cf6',
    border: '#7c3aed',
    glow: 'rgba(139, 92, 246, 0.6)',
    description: 'Skin baleine pour les gros porteurs.',
  },
  {
    id: 'legend',
    label: 'Legend',
    unlockXp: 12000,
    fill: '#f43f5e',
    border: '#e11d48',
    glow: 'rgba(244, 63, 94, 0.8)',
    description: 'Or rose. Réservé aux légendes du graph.',
  },
];

export function getUnlockedSkins(xpTotal: number): CandleHopSkin[] {
  return CANDLE_HOP_SKINS.filter((s) => xpTotal >= s.unlockXp);
}

export interface CandleHopPowerUp {
  id: string;
  label: string;
  /** Durée d'effet en ms. */
  durationMs: number;
  description: string;
  color: string;
}

/**
 * Power-ups récupérables en jeu. Apparaissent aléatoirement (5% par paire
 * d'obstacles). Effet appliqué côté client.
 */
export const CANDLE_HOP_POWER_UPS: CandleHopPowerUp[] = [
  {
    id: 'bull_run',
    label: 'Bull Run',
    durationMs: 3000,
    color: '#fbbf24',
    description: 'Invincible 3 secondes — fonce.',
  },
  {
    id: 'magnet',
    label: 'Magnet',
    durationMs: 4000,
    color: '#10b981',
    description: 'Aspire les bougies vertes pendant 4 secondes.',
  },
  {
    id: 'slow_mo',
    label: 'Slow Mo',
    durationMs: 2500,
    color: '#06b6d4',
    description: 'Ralentit le scroll de 50%% pendant 2,5 secondes.',
  },
];

export interface CandleHopChallenge {
  id: string;
  label: string;
  bonusXp: number;
  /** Test de complétion à partir des stats du run. */
  check: (stats: {
    score: number;
    bonusesCollected: number;
    powerUpsUsed: number;
    durationMs: number;
  }) => boolean;
}

/**
 * Pool de défis quotidiens. On en pioche un par jour selon getParisDate().
 * Idempotent : le même jour donne toujours le même défi.
 */
export const CANDLE_HOP_CHALLENGES: CandleHopChallenge[] = [
  {
    id: 'score_25',
    label: 'Score au moins 25 dans un run',
    bonusXp: 75,
    check: (s) => s.score >= 25,
  },
  {
    id: 'score_40_no_pu',
    label: 'Score au moins 40 sans power-up',
    bonusXp: 100,
    check: (s) => s.score >= 40 && s.powerUpsUsed === 0,
  },
  {
    id: 'bonuses_5',
    label: 'Choppe 5 bougies vertes dans un run',
    bonusXp: 75,
    check: (s) => s.bonusesCollected >= 5,
  },
  {
    id: 'survive_30s',
    label: 'Survis 30 secondes dans un run',
    bonusXp: 75,
    check: (s) => s.durationMs >= 30_000,
  },
  {
    id: 'score_60',
    label: 'Score au moins 60 dans un run',
    bonusXp: 100,
    check: (s) => s.score >= 60,
  },
  {
    id: 'use_3_pu',
    label: 'Utilise 3 power-ups dans un même run',
    bonusXp: 75,
    check: (s) => s.powerUpsUsed >= 3,
  },
  {
    id: 'survive_60s',
    label: 'Survis 60 secondes dans un run',
    bonusXp: 125,
    check: (s) => s.durationMs >= 60_000,
  },
];

/**
 * Renvoie le défi du jour pour cet user (déterministe par date Paris).
 */
export function getTodayCandleHopChallenge(now: Date = new Date()): CandleHopChallenge {
  const dateStr = getParisDate(now);
  // hash simple
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % CANDLE_HOP_CHALLENGES.length;
  return CANDLE_HOP_CHALLENGES[idx]!;
}

export interface CandleHopAchievement {
  id: string;
  label: string;
  description: string;
  bonusXp: number;
  /** Test contre l'état global de l'user après le run. */
  check: (state: {
    bestScore: number;
    totalRuns: number;
    score: number; // score du run courant
  }) => boolean;
}

export const CANDLE_HOP_ACHIEVEMENTS: CandleHopAchievement[] = [
  {
    id: 'first_steps',
    label: 'Premier pas',
    description: 'Atteins un score de 5',
    bonusXp: 25,
    check: (s) => s.bestScore >= 5,
  },
  {
    id: 'solid_feathers',
    label: 'Plumes solides',
    description: 'Atteins un score de 25',
    bonusXp: 50,
    check: (s) => s.bestScore >= 25,
  },
  {
    id: 'trader_confirme',
    label: 'Trader confirmé',
    description: 'Atteins un score de 50',
    bonusXp: 100,
    check: (s) => s.bestScore >= 50,
  },
  {
    id: 'master_candle',
    label: 'Maître Candle',
    description: 'Atteins un score de 100',
    bonusXp: 200,
    check: (s) => s.bestScore >= 100,
  },
  {
    id: 'legend',
    label: 'Légende',
    description: 'Atteins un score de 200',
    bonusXp: 500,
    check: (s) => s.bestScore >= 200,
  },
  {
    id: 'endurance',
    label: 'Endurance',
    description: 'Joue 25 runs au total',
    bonusXp: 50,
    check: (s) => s.totalRuns >= 25,
  },
  {
    id: 'perseverance',
    label: 'Persévérance',
    description: 'Joue 100 runs au total',
    bonusXp: 150,
    check: (s) => s.totalRuns >= 100,
  },
];

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
  // V2
  /** Défi du jour avec status validé/non. */
  dailyChallenge: { challenge: CandleHopChallenge; done: boolean };
  /** Achievements débloqués (IDs). */
  achievementsUnlocked: string[];
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

    // V2 : challenge + achievements
    const todayChallenge = getTodayCandleHopChallenge();
    const today = getParisDate();
    let challengeDone = false;
    let achievementsUnlocked: string[] = [];
    try {
      const [xpRow] = await db
        .select({
          challengeDate: userXpStates.candleHopChallengeDoneDate,
          achievements: userXpStates.candleHopAchievements,
        })
        .from(userXpStates)
        .where(eq(userXpStates.userId, userId))
        .limit(1);
      challengeDone = xpRow?.challengeDate === today;
      achievementsUnlocked = xpRow?.achievements ?? [];
    } catch {
      // V2 columns might not exist yet on prod — fail-safe to defaults
    }

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
      dailyChallenge: { challenge: todayChallenge, done: challengeDone },
      achievementsUnlocked,
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
      dailyChallenge: {
        challenge: getTodayCandleHopChallenge(),
        done: false,
      },
      achievementsUnlocked: [],
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
      // V2
      challengeCompleted: { id: string; label: string; bonusXp: number } | null;
      newAchievements: Array<{ id: string; label: string; bonusXp: number }>;
    }
  | {
      ok: false;
      error: 'invalid_run' | 'daily_limit' | 'unknown';
    };

/**
 * Vérifie la cohérence du run et persiste. V2 : prend en plus
 * `bonusesCollected` et `powerUpsUsed` pour évaluer le défi du jour.
 */
export async function submitCandleHopRun(
  userId: string,
  input: {
    score: number;
    durationMs: number;
    taps: number;
    bonusesCollected?: number;
    powerUpsUsed?: number;
  }
): Promise<SubmitCandleHopResult> {
  const score = Math.floor(input.score);
  const durationMs = Math.floor(input.durationMs);
  const taps = Math.floor(input.taps);
  const bonusesCollected = Math.max(0, Math.floor(input.bonusesCollected ?? 0));
  const powerUpsUsed = Math.max(0, Math.floor(input.powerUpsUsed ?? 0));

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

    // V2 : Défi du jour
    let challengeCompleted: { id: string; label: string; bonusXp: number } | null = null;
    const today = getParisDate();
    if (!state.dailyChallenge.done) {
      const challenge = state.dailyChallenge.challenge;
      const stats = { score, bonusesCollected, powerUpsUsed, durationMs };
      if (challenge.check(stats)) {
        try {
          newTotal = await addXp({
            userId,
            amount: challenge.bonusXp,
            reason: 'wheel_spin',
            metadata: {
              source: 'candle_hop_challenge',
              challengeId: challenge.id,
            },
          });
          await db
            .update(userXpStates)
            .set({ candleHopChallengeDoneDate: today })
            .where(eq(userXpStates.userId, userId));
          challengeCompleted = {
            id: challenge.id,
            label: challenge.label,
            bonusXp: challenge.bonusXp,
          };
        } catch (err) {
          console.warn('[candle-hop] challenge award failed', err);
        }
      }
    }

    // V2 : Achievements
    const newAchievements: Array<{
      id: string;
      label: string;
      bonusXp: number;
    }> = [];
    const newBest = Math.max(state.bestScore, score);
    const newTotalRuns = state.totalRuns + 1;
    const alreadyUnlocked = new Set(state.achievementsUnlocked);
    const unlockedNow: string[] = [];
    for (const ach of CANDLE_HOP_ACHIEVEMENTS) {
      if (alreadyUnlocked.has(ach.id)) continue;
      if (
        ach.check({
          bestScore: newBest,
          totalRuns: newTotalRuns,
          score,
        })
      ) {
        unlockedNow.push(ach.id);
      }
    }
    if (unlockedNow.length > 0) {
      try {
        for (const id of unlockedNow) {
          const ach = CANDLE_HOP_ACHIEVEMENTS.find((a) => a.id === id)!;
          newTotal = await addXp({
            userId,
            amount: ach.bonusXp,
            reason: 'wheel_spin',
            metadata: {
              source: 'candle_hop_achievement',
              achievementId: id,
            },
          });
          newAchievements.push({
            id: ach.id,
            label: ach.label,
            bonusXp: ach.bonusXp,
          });
        }
        const merged = [...state.achievementsUnlocked, ...unlockedNow];
        await db
          .update(userXpStates)
          .set({ candleHopAchievements: merged })
          .where(eq(userXpStates.userId, userId));
      } catch (err) {
        console.warn('[candle-hop] achievements update failed', err);
      }
    }

    return {
      ok: true,
      score,
      xpAwarded,
      bonusXp: Math.min(bonusXp, xpAwarded),
      newTotal,
      isPersonalBest,
      runsLeftToday: state.runsLeftToday - 1,
      challengeCompleted,
      newAchievements,
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
