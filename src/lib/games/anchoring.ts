import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { anchoringRuns } from '@/lib/db/schema';
import { addXp } from './xp';

/**
 * Test du biais d'ancrage (Tversky & Kahneman, 1974).
 *
 * Concept : on montre à l'user une "ancre" (chiffre arbitraire) avant
 * de lui demander une prédiction. La valeur de l'ancre ne devrait pas
 * influencer la prédiction (elle est non-informative), mais en pratique
 * les humains "s'accrochent" et glissent leur estimé vers l'ancre.
 *
 * Mécanique : 6 questions de prédiction marché. Pour chaque question,
 * on randomise quelle ancre montrer (haute ou basse). Comparaison ensuite
 * entre les prédictions vs les ancres pour mesurer l'effet.
 */

export interface AnchoringQuestion {
  id: number;
  /** Marché / topic affiché */
  market: string;
  /** Question complète posée à l'user */
  prompt: string;
  /** Unité de la réponse (%, $, etc.) */
  unit: '%' | '$' | '€' | 'pts';
  /** Bornes plausibles pour la saisie (validation côté serveur) */
  minAnswer: number;
  maxAnswer: number;
  /** Valeur "neutre" attendue d'une réponse non-ancrée (ex: rendement annuel moyen ~8%) */
  center: number;
  /** Ancre haute : ce qu'on affiche pour pousser l'estimé vers le haut */
  anchorHigh: { context: string; value: number; display: string };
  /** Ancre basse : ce qu'on affiche pour pousser l'estimé vers le bas */
  anchorLow: { context: string; value: number; display: string };
}

export const ANCHORING_QUESTIONS: AnchoringQuestion[] = [
  {
    id: 1,
    market: 'Nasdaq',
    prompt: "Selon toi, combien le Nasdaq fera-t-il sur les 12 prochains mois ?",
    unit: '%',
    minAnswer: -50,
    maxAnswer: 100,
    center: 10,
    anchorHigh: {
      context: 'Sur 12 mois, le Nasdaq a fait jusqu\'à +43% en 2023.',
      value: 43,
      display: '+43%',
    },
    anchorLow: {
      context: 'Sur 12 mois, le Nasdaq a perdu jusqu\'à -33% en 2022.',
      value: -33,
      display: '-33%',
    },
  },
  {
    id: 2,
    market: 'Bitcoin',
    prompt: 'Selon toi, quel prix touchera le Bitcoin à la fin de l\'année ?',
    unit: '$',
    minAnswer: 10_000,
    maxAnswer: 300_000,
    center: 75_000,
    anchorHigh: {
      context: "Standard Chartered table sur $200 000 d'ici fin d'année.",
      value: 200_000,
      display: '200 000 $',
    },
    anchorLow: {
      context: "Peter Schiff prédit un crash à 20 000 $ d'ici fin d'année.",
      value: 20_000,
      display: '20 000 $',
    },
  },
  {
    id: 3,
    market: 'Gold',
    prompt: 'Prix de l\'once d\'or dans 6 mois selon toi ?',
    unit: '$',
    minAnswer: 1500,
    maxAnswer: 4000,
    center: 2500,
    anchorHigh: {
      context: "Goldman Sachs vise 3 700 $ l'once sur 6 mois.",
      value: 3700,
      display: '3 700 $',
    },
    anchorLow: {
      context: "Citi prévoit un repli vers 1 900 $ l'once.",
      value: 1900,
      display: '1 900 $',
    },
  },
  {
    id: 4,
    market: 'SP500',
    prompt: 'Performance du SP500 sur 12 mois selon toi ?',
    unit: '%',
    minAnswer: -40,
    maxAnswer: 60,
    center: 8,
    anchorHigh: {
      context: "Morgan Stanley vise un rallye de +35% sur 12 mois.",
      value: 35,
      display: '+35%',
    },
    anchorLow: {
      context: "JP Morgan anticipe une correction de -25% sur 12 mois.",
      value: -25,
      display: '-25%',
    },
  },
  {
    id: 5,
    market: 'EUR/USD',
    prompt: 'Niveau de EUR/USD dans 3 mois selon toi ?',
    unit: 'pts',
    minAnswer: 0.85,
    maxAnswer: 1.5,
    center: 1.08,
    anchorHigh: {
      context: 'Deutsche Bank vise 1,30 sur 3 mois.',
      value: 1.3,
      display: '1,30',
    },
    anchorLow: {
      context: 'Goldman Sachs vise 0,95 (parité forte).',
      value: 0.95,
      display: '0,95',
    },
  },
  {
    id: 6,
    market: 'WTI',
    prompt: 'Prix du baril WTI dans 6 mois selon toi ?',
    unit: '$',
    minAnswer: 30,
    maxAnswer: 200,
    center: 75,
    anchorHigh: {
      context: 'JPM table sur 150 $ le baril sur 6 mois (tensions OPEC).',
      value: 150,
      display: '150 $',
    },
    anchorLow: {
      context: 'Citi anticipe 40 $ le baril (récession).',
      value: 40,
      display: '40 $',
    },
  },
];

/** Cooldown entre 2 runs : 7 jours. */
export const ANCHORING_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** XP de base par run complet. */
export const ANCHORING_BASE_XP = 200;
/** Bonus XP si l'indice d'ancrage est faible (< 30 = bonne résistance). */
export const ANCHORING_BONUS_XP = 50;

/**
 * Pour chaque user, on tire un seed pseudo-déterministe (sur user id +
 * jour de la semaine) qui décide quelles questions reçoivent ancre haute
 * vs basse. Comme ça si l'user F5 il revoit la même affectation,
 * mais d'un run à l'autre c'est mélangé.
 */
export function assignAnchorsForUser(
  userId: string,
  questions: AnchoringQuestion[]
): Array<{ question: AnchoringQuestion; variant: 'high' | 'low' }> {
  // hash simple userId → number
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  }
  // Week-of-year pour faire varier d'une semaine à l'autre
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const seed = (h ^ week) >>> 0;

  // Demi-haute / demi-basse → on génère un pattern alternant selon seed
  return questions.map((q, i) => {
    const bit = (seed >> (i % 32)) & 1;
    const variant: 'high' | 'low' = bit ? 'high' : 'low';
    return { question: q, variant };
  });
}

/**
 * Calcule le ratio d'ancrage pour une prédiction donnée.
 * Returns ∈ [-∞, ∞] :
 *   - 0 = répondu pile au centre (pas ancré)
 *   - 1 = répondu pile sur la valeur de l'ancre (totalement ancré)
 *   - < 0 = répondu de l'autre côté du centre (anti-ancrage)
 */
export function computeShiftRatio(
  prediction: number,
  anchorValue: number,
  center: number
): number {
  const denom = anchorValue - center;
  if (Math.abs(denom) < 1e-9) return 0;
  return (prediction - center) / denom;
}

/**
 * Indice d'ancrage 0-100 à partir des shifts individuels.
 * On clip chaque shift à [0, 1.5] avant moyenne (pour éviter qu'un user
 * "extreme" tire toute la moyenne). 0-100 = % d'inclinaison vers l'ancre.
 */
export function computeAnchoringIndex(shifts: number[]): number {
  if (shifts.length === 0) return 0;
  const clipped = shifts.map((s) => Math.max(0, Math.min(1.5, s)));
  const mean = clipped.reduce((a, b) => a + b, 0) / clipped.length;
  return Math.round(Math.max(0, Math.min(100, mean * 100)));
}

export interface AnchoringInterpretation {
  level: 'immune' | 'low' | 'moderate' | 'high' | 'very_high';
  label: string;
  desc: string;
}

export function interpretAnchoring(index: number): AnchoringInterpretation {
  if (index < 15) {
    return {
      level: 'immune',
      label: 'Quasi immunisé',
      desc: "Tu raisonnes presque indépendamment des ancres affichées. Profil rare et précieux en trading.",
    };
  }
  if (index < 35) {
    return {
      level: 'low',
      label: 'Peu sensible',
      desc: "Tu remarques l'ancre mais tu sais t'en détacher. Bonne discipline analytique.",
    };
  }
  if (index < 55) {
    return {
      level: 'moderate',
      label: 'Modérément ancré',
      desc: "L'ancre influence ton estimé d'un tiers environ. C'est dans la moyenne — vigilance avant chaque décision.",
    };
  }
  if (index < 75) {
    return {
      level: 'high',
      label: 'Fortement ancré',
      desc: "Ton estimé glisse beaucoup vers l'ancre montrée. À l'avenir : note ta thèse avant de lire l'avis des autres.",
    };
  }
  return {
    level: 'very_high',
    label: 'Très ancré',
    desc: "Tu adoptes presque la valeur de l'ancre comme prédiction. C'est exactement le biais qui fait suivre les FOMO calls.",
  };
}

export interface AnchoringState {
  canPlay: boolean;
  nextRunAt: Date | null;
  lastRun: {
    anchoringIndex: number;
    completedAt: Date;
  } | null;
  history: Array<{ anchoringIndex: number; completedAt: Date }>;
}

export async function getAnchoringState(
  userId: string
): Promise<AnchoringState> {
  try {
    const rows = await db
      .select()
      .from(anchoringRuns)
      .where(eq(anchoringRuns.userId, userId))
      .orderBy(desc(anchoringRuns.completedAt))
      .limit(20);

    const lastRun = rows[0];
    const now = Date.now();
    const canPlay =
      !lastRun ||
      now - lastRun.completedAt.getTime() >= ANCHORING_COOLDOWN_MS;
    const nextRunAt = lastRun
      ? new Date(lastRun.completedAt.getTime() + ANCHORING_COOLDOWN_MS)
      : null;

    return {
      canPlay,
      nextRunAt: canPlay ? null : nextRunAt,
      lastRun: lastRun
        ? {
            anchoringIndex: lastRun.anchoringIndex,
            completedAt: lastRun.completedAt,
          }
        : null,
      history: rows.map((r) => ({
        anchoringIndex: r.anchoringIndex,
        completedAt: r.completedAt,
      })),
    };
  } catch (err) {
    console.warn('[anchoring] state fallback', err);
    return { canPlay: true, nextRunAt: null, lastRun: null, history: [] };
  }
}

export type SubmitAnchoringResult =
  | {
      ok: true;
      anchoringIndex: number;
      xpAwarded: number;
      newTotal: number;
    }
  | {
      ok: false;
      error: 'invalid_predictions' | 'cooldown' | 'unknown';
      nextRunAt?: Date;
    };

export async function submitAnchoringRun(
  userId: string,
  predictions: Array<{
    questionId: number;
    anchorVariant: 'high' | 'low';
    userValue: number;
  }>
): Promise<SubmitAnchoringResult> {
  // Validate
  if (
    !Array.isArray(predictions) ||
    predictions.length !== ANCHORING_QUESTIONS.length
  ) {
    return { ok: false, error: 'invalid_predictions' };
  }

  const byId = new Map(ANCHORING_QUESTIONS.map((q) => [q.id, q]));
  const shifts: number[] = [];
  for (const p of predictions) {
    const q = byId.get(p.questionId);
    if (!q) return { ok: false, error: 'invalid_predictions' };
    if (
      typeof p.userValue !== 'number' ||
      !Number.isFinite(p.userValue) ||
      p.userValue < q.minAnswer ||
      p.userValue > q.maxAnswer
    ) {
      return { ok: false, error: 'invalid_predictions' };
    }
    if (p.anchorVariant !== 'high' && p.anchorVariant !== 'low') {
      return { ok: false, error: 'invalid_predictions' };
    }
    const anchor = p.anchorVariant === 'high' ? q.anchorHigh : q.anchorLow;
    shifts.push(computeShiftRatio(p.userValue, anchor.value, q.center));
  }

  // Cooldown check
  const state = await getAnchoringState(userId);
  if (!state.canPlay) {
    return {
      ok: false,
      error: 'cooldown',
      nextRunAt: state.nextRunAt ?? undefined,
    };
  }

  const anchoringIndex = computeAnchoringIndex(shifts);
  const xpAwarded =
    ANCHORING_BASE_XP + (anchoringIndex < 30 ? ANCHORING_BONUS_XP : 0);

  try {
    await db.insert(anchoringRuns).values({
      userId,
      predictions,
      anchoringIndex,
      xpAwarded,
    });

    const newTotal = await addXp({
      userId,
      amount: xpAwarded,
      reason: 'wheel_spin',
      metadata: {
        source: 'anchoring_test',
        anchoringIndex,
      },
    });

    return { ok: true, anchoringIndex, xpAwarded, newTotal };
  } catch (err) {
    console.warn('[anchoring] submit failed', err);
    return { ok: false, error: 'unknown' };
  }
}
