import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { fomoRuns } from '@/lib/db/schema';
import { addXp } from './xp';

/** 24h cooldown entre 2 runs. */
export const FOMO_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Temps max par décision (ms). Au-delà, comptabilisé comme 'hold' (par défaut). */
export const FOMO_DECISION_TIMEOUT_MS = 4_000;

export type FomoChoice = 'buy' | 'hold' | 'sell';

export interface FomoScenario {
  id: number;
  name: string;
  /** Pattern visuel : 10 bougies relatives normalisées + bougie courante "pulsante". */
  candles: Array<{ open: number; close: number; low: number; high: number }>;
  /** Réponse optimale selon la lecture du pattern. */
  optimal: FomoChoice;
  /** Explication montrée après le choix. */
  explanation: string;
}

/**
 * 10 scénarios pré-construits. Patterns choisis pour tester différents
 * biais : FOMO sur pump, peur sur dip réel, indécision sur range, etc.
 *
 * Coordonnées candles : open/close/low/high normalisés 0-100. La candle
 * dernière (courante) est celle où l'user doit décider, visualisée en
 * pulse pour matérialiser la "pression du moment".
 */
export const FOMO_SCENARIOS: FomoScenario[] = [
  {
    id: 1,
    name: 'Pump suspect (flat → spike)',
    candles: [
      { open: 50, close: 51, low: 48, high: 52 },
      { open: 51, close: 49, low: 47, high: 53 },
      { open: 49, close: 52, low: 47, high: 54 },
      { open: 52, close: 50, low: 48, high: 53 },
      { open: 50, close: 51, low: 49, high: 52 },
      { open: 51, close: 53, low: 50, high: 54 },
      { open: 53, close: 55, low: 52, high: 56 },
      { open: 55, close: 60, low: 55, high: 62 },
      { open: 60, close: 70, low: 59, high: 72 },
      { open: 70, close: 78, low: 69, high: 80 }, // spike brut sans volume
    ],
    optimal: 'hold',
    explanation:
      "Range pendant 7 bougies puis spike brutal. Sans volume confirmé c'est typiquement un fake breakout — laisse passer.",
  },
  {
    id: 2,
    name: 'Dip réel sur support',
    candles: [
      { open: 60, close: 58, low: 57, high: 61 },
      { open: 58, close: 55, low: 54, high: 59 },
      { open: 55, close: 52, low: 50, high: 56 },
      { open: 52, close: 50, low: 48, high: 53 },
      { open: 50, close: 49, low: 47, high: 51 },
      { open: 49, close: 50, low: 47, high: 51 },
      { open: 50, close: 51, low: 49, high: 52 },
      { open: 51, close: 50, low: 48, high: 52 },
      { open: 50, close: 49, low: 47, high: 51 },
      { open: 49, close: 51, low: 47, high: 53 }, // marteau sur support
    ],
    optimal: 'buy',
    explanation:
      'Tendance baissière qui se stabilise sur un support net (~48). Marteau de fin confirme — entrée à risque limité (SL sous le support).',
  },
  {
    id: 3,
    name: 'Range neutre prolongé',
    candles: [
      { open: 50, close: 51, low: 48, high: 52 },
      { open: 51, close: 50, low: 49, high: 52 },
      { open: 50, close: 51, low: 48, high: 53 },
      { open: 51, close: 49, low: 48, high: 52 },
      { open: 49, close: 51, low: 48, high: 52 },
      { open: 51, close: 50, low: 49, high: 52 },
      { open: 50, close: 51, low: 48, high: 53 },
      { open: 51, close: 50, low: 49, high: 52 },
      { open: 50, close: 52, low: 49, high: 53 },
      { open: 52, close: 50, low: 49, high: 53 }, // toujours dans le range
    ],
    optimal: 'hold',
    explanation:
      "Range serré sans direction claire. Trader un range étroit = commission + slippage qui mangent la perf. Reste flat.",
  },
  {
    id: 4,
    name: 'Cassure haussière confirmée',
    candles: [
      { open: 45, close: 46, low: 44, high: 47 },
      { open: 46, close: 47, low: 45, high: 48 },
      { open: 47, close: 47, low: 45, high: 48 },
      { open: 47, close: 48, low: 46, high: 49 },
      { open: 48, close: 48, low: 47, high: 49 },
      { open: 48, close: 49, low: 47, high: 50 },
      { open: 49, close: 50, low: 48, high: 51 },
      { open: 50, close: 53, low: 49, high: 54 }, // cassure
      { open: 53, close: 54, low: 52, high: 55 }, // retest
      { open: 54, close: 57, low: 53, high: 58 }, // suite
    ],
    optimal: 'buy',
    explanation:
      "Bull flag avec cassure puis retest support nouvellement formé. Suite confirme. Entry sur le retest = setup ideal.",
  },
  {
    id: 5,
    name: 'Cassure baissière',
    candles: [
      { open: 55, close: 54, low: 53, high: 56 },
      { open: 54, close: 55, low: 53, high: 56 },
      { open: 55, close: 53, low: 52, high: 56 },
      { open: 53, close: 54, low: 52, high: 55 },
      { open: 54, close: 53, low: 52, high: 55 },
      { open: 53, close: 52, low: 51, high: 54 },
      { open: 52, close: 50, low: 49, high: 53 }, // cassure support
      { open: 50, close: 48, low: 47, high: 51 },
      { open: 48, close: 46, low: 45, high: 49 },
      { open: 46, close: 44, low: 43, high: 47 }, // continuation
    ],
    optimal: 'sell',
    explanation:
      "Cassure de support nette suivie de 3 bougies rouges. Tendance baissière confirmée — sell ou rester flat (ne pas acheter le 'dip' tant que pas de signe d'inversion).",
  },
  {
    id: 6,
    name: 'Squeeze fake (manipulation)',
    candles: [
      { open: 50, close: 51, low: 49, high: 52 },
      { open: 51, close: 50, low: 49, high: 52 },
      { open: 50, close: 47, low: 46, high: 51 }, // spike down
      { open: 47, close: 49, low: 46, high: 50 },
      { open: 49, close: 51, low: 48, high: 52 },
      { open: 51, close: 50, low: 49, high: 52 },
      { open: 50, close: 49, low: 48, high: 51 },
      { open: 49, close: 48, low: 47, high: 50 },
      { open: 48, close: 47, low: 46, high: 49 },
      { open: 47, close: 45, low: 44, high: 48 }, // descente lente continue
    ],
    optimal: 'hold',
    explanation:
      "Spike down rapidement récupéré ressemble à un wick de manipulation, mais la suite est en lente descente. Mieux vaut attendre clarification que de FOMO short.",
  },
  {
    id: 7,
    name: 'Top double',
    candles: [
      { open: 45, close: 50, low: 44, high: 51 },
      { open: 50, close: 55, low: 49, high: 56 },
      { open: 55, close: 60, low: 54, high: 61 }, // 1er top
      { open: 60, close: 57, low: 56, high: 61 },
      { open: 57, close: 55, low: 54, high: 58 },
      { open: 55, close: 58, low: 54, high: 59 },
      { open: 58, close: 60, low: 57, high: 61 }, // 2e top même niveau
      { open: 60, close: 58, low: 56, high: 61 },
      { open: 58, close: 56, low: 55, high: 59 },
      { open: 56, close: 53, low: 52, high: 57 }, // commence à casser
    ],
    optimal: 'sell',
    explanation:
      "Double top à 60-61 + cassure du low intermédiaire = pattern d'inversion classique. Sell ou prendre profits si tu étais long.",
  },
  {
    id: 8,
    name: 'Consolidation après pump',
    candles: [
      { open: 40, close: 45, low: 39, high: 46 },
      { open: 45, close: 50, low: 44, high: 51 },
      { open: 50, close: 55, low: 49, high: 56 },
      { open: 55, close: 58, low: 54, high: 59 }, // pump
      { open: 58, close: 56, low: 55, high: 59 },
      { open: 56, close: 57, low: 55, high: 58 },
      { open: 57, close: 58, low: 56, high: 59 },
      { open: 58, close: 57, low: 56, high: 59 },
      { open: 57, close: 58, low: 56, high: 59 },
      { open: 58, close: 57, low: 56, high: 59 }, // range serré au top
    ],
    optimal: 'hold',
    explanation:
      "Après un pump, range serré horizontal = digestion saine. Trop tôt pour acheter (FOMO du top), trop tôt pour vendre. Attendre la rupture du range.",
  },
  {
    id: 9,
    name: 'Bottom puis reverse',
    candles: [
      { open: 60, close: 55, low: 54, high: 61 },
      { open: 55, close: 50, low: 49, high: 56 },
      { open: 50, close: 45, low: 44, high: 51 }, // chute
      { open: 45, close: 43, low: 42, high: 46 },
      { open: 43, close: 44, low: 42, high: 45 }, // ralentit
      { open: 44, close: 46, low: 43, high: 47 },
      { open: 46, close: 49, low: 45, high: 50 }, // engulfing bullish
      { open: 49, close: 51, low: 48, high: 52 },
      { open: 51, close: 54, low: 50, high: 55 },
      { open: 54, close: 57, low: 53, high: 58 }, // continuation
    ],
    optimal: 'buy',
    explanation:
      "Chute puis bottoming pattern : engulfing bullish + 3 bougies vertes consécutives. Signal de reverse haussier, entry avec stop sous le low.",
  },
  {
    id: 10,
    name: 'Bougie isolée explosive',
    candles: [
      { open: 50, close: 51, low: 49, high: 52 },
      { open: 51, close: 50, low: 49, high: 52 },
      { open: 50, close: 51, low: 49, high: 52 },
      { open: 51, close: 50, low: 49, high: 52 },
      { open: 50, close: 51, low: 49, high: 52 },
      { open: 51, close: 50, low: 49, high: 52 },
      { open: 50, close: 51, low: 49, high: 52 },
      { open: 51, close: 50, low: 49, high: 52 },
      { open: 50, close: 51, low: 49, high: 52 },
      { open: 51, close: 80, low: 50, high: 82 }, // bougie folle isolée
    ],
    optimal: 'hold',
    explanation:
      "Bougie verte isolée énorme après 9 bougies plates. C'est probablement un news bot, un fat finger, ou une mèche manipulatrice. Ne touche pas tant que la suite n'est pas claire.",
  },
];

/**
 * Calcule le FOMO score à partir des décisions.
 *  - Pour chaque décision où user ≠ optimal, on incrémente
 *  - 100 = toutes mauvaises ; 0 = toutes bonnes
 *  - Bonus : si l'user a décidé très vite (< 1s) ET la décision n'était
 *    pas optimal, c'est de l'impulsivité — pénalité légère ajoutée
 */
export function computeFomoScore(
  decisions: Array<{
    choice: FomoChoice;
    optimal: FomoChoice;
    latencyMs: number;
  }>
): number {
  if (decisions.length === 0) return 0;
  let raw = 0;
  for (const d of decisions) {
    if (d.choice !== d.optimal) {
      // Pénalité de base : 10 points / mauvaise réponse
      raw += 10;
      // Pénalité impulsivité : +3 si répondu en moins de 1s
      if (d.latencyMs < 1000) raw += 3;
    }
  }
  return Math.min(100, raw);
}

/**
 * XP en fonction du FOMO score (inversé : moins de FOMO = plus de XP).
 */
export function fomoXpFor(score: number): number {
  if (score <= 20) return 200;
  if (score <= 40) return 100;
  if (score <= 60) return 50;
  return 20;
}

export interface FomoState {
  canPlay: boolean;
  nextRunAt: Date | null;
  lastRun: {
    score: number;
    completedAt: Date;
  } | null;
  history: Array<{ score: number; createdAt: Date }>;
}

export async function getFomoState(userId: string): Promise<FomoState> {
  try {
    const rows = await db
      .select({
        score: fomoRuns.fomoScore,
        createdAt: fomoRuns.createdAt,
      })
      .from(fomoRuns)
      .where(eq(fomoRuns.userId, userId))
      .orderBy(desc(fomoRuns.createdAt))
      .limit(30);

    const lastRun = rows[0];
    const now = Date.now();
    const canPlay =
      !lastRun || now - lastRun.createdAt.getTime() >= FOMO_COOLDOWN_MS;
    const nextRunAt = lastRun
      ? new Date(lastRun.createdAt.getTime() + FOMO_COOLDOWN_MS)
      : null;

    return {
      canPlay,
      nextRunAt: canPlay ? null : nextRunAt,
      lastRun: lastRun
        ? { score: lastRun.score, completedAt: lastRun.createdAt }
        : null,
      history: rows.map((r) => ({ score: r.score, createdAt: r.createdAt })),
    };
  } catch (err) {
    console.warn('[fomo] state fallback', err);
    return { canPlay: true, nextRunAt: null, lastRun: null, history: [] };
  }
}

export type SubmitFomoResult =
  | {
      ok: true;
      score: number;
      xpAwarded: number;
      newTotal: number;
    }
  | {
      ok: false;
      error: 'invalid_decisions' | 'cooldown' | 'unknown';
      nextRunAt?: Date;
    };

/**
 * Soumet un run complet (10 décisions). Validation : 10 décisions, choices
 * dans {buy, hold, sell}, latency raisonnable (0-10s).
 */
export async function submitFomoRun(
  userId: string,
  decisions: Array<{
    scenarioId: number;
    choice: FomoChoice;
    latencyMs: number;
  }>
): Promise<SubmitFomoResult> {
  if (
    !Array.isArray(decisions) ||
    decisions.length !== FOMO_SCENARIOS.length
  ) {
    return { ok: false, error: 'invalid_decisions' };
  }
  for (const d of decisions) {
    if (
      !['buy', 'hold', 'sell'].includes(d.choice) ||
      d.latencyMs < 0 ||
      d.latencyMs > 10_000
    ) {
      return { ok: false, error: 'invalid_decisions' };
    }
  }

  // Cooldown
  const state = await getFomoState(userId);
  if (!state.canPlay) {
    return {
      ok: false,
      error: 'cooldown',
      nextRunAt: state.nextRunAt ?? undefined,
    };
  }

  // Enrichit avec l'optimal côté serveur (anti-cheat)
  const enriched = decisions.map((d) => {
    const sc = FOMO_SCENARIOS.find((s) => s.id === d.scenarioId);
    return {
      scenarioId: d.scenarioId,
      choice: d.choice,
      optimal: sc?.optimal ?? 'hold',
      latencyMs: d.latencyMs,
    };
  });

  const score = computeFomoScore(enriched);
  const xp = fomoXpFor(score);

  try {
    await db.insert(fomoRuns).values({
      userId,
      decisions: enriched,
      fomoScore: score,
      xpAwarded: xp,
    });

    const newTotal = await addXp({
      userId,
      amount: xp,
      reason: 'wheel_spin',
      metadata: { source: 'fomo_test', score, decisions: enriched.length },
    });

    return { ok: true, score, xpAwarded: xp, newTotal };
  } catch (err) {
    console.warn('[fomo] submit failed', err);
    return { ok: false, error: 'unknown' };
  }
}

/**
 * Interprétation du FOMO score (texte affiché à l'user).
 */
export function interpretFomoScore(score: number): {
  level: 'low' | 'moderate' | 'high' | 'very_high';
  label: string;
  desc: string;
} {
  if (score <= 20) {
    return {
      level: 'low',
      label: 'Trader patient',
      desc: "Tu résistes bien aux pumps et aux pièges. C'est le profil le plus rare et le plus rentable sur le long terme.",
    };
  }
  if (score <= 40) {
    return {
      level: 'moderate',
      label: 'Légère impulsivité',
      desc: "Quelques décisions précipitées mais globalement tu lis bien le marché. Travaille la patience sur les setups ambigus.",
    };
  }
  if (score <= 60) {
    return {
      level: 'high',
      label: 'FOMO marqué',
      desc: "Tu rentres ou sors souvent quand il fallait attendre. Le marché te 'parle' : apprends à écouter sans agir.",
    };
  }
  return {
    level: 'very_high',
    label: 'Très impulsif',
    desc: "Tu réagis à chaque mouvement. C'est le piège classique. Routine pré-session + journal d'émotion = ton meilleur allié.",
  };
}

export type { FomoScenario as FomoScenarioType };
