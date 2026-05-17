import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { patternMemoryRuns } from '@/lib/db/schema';
import { addXp } from './xp';
import { getParisDate } from './markets';

/**
 * Pattern Memory : on flash 5 patterns techniques sur 3s chacun, puis on
 * demande à l'user à quelle position était chaque pattern. Mesure la
 * vitesse de reconnaissance / mémoire visuelle des figures classiques.
 *
 * Limite : 1 run / jour calendaire (Paris).
 */

export interface ChartPattern {
  id: number;
  name: string;
  label: string;
  description: string;
  /** Points de la courbe (viewBox 100x60) */
  points: Array<[number, number]>;
}

/**
 * Patterns chartistes classiques. Coords dans viewBox 100×60.
 * Y inversé en CSS (0 en haut) → on dessine en pensant "0 = haut, 60 = bas",
 * et le SVG s'occupe du rendu naturellement.
 */
export const CHART_PATTERNS: ChartPattern[] = [
  {
    id: 1,
    name: 'bull_flag',
    label: 'Drapeau haussier',
    description:
      'Impulsion verticale puis consolidation en canal descendant, suivie d\'une cassure haussière.',
    points: [
      [0, 50],
      [10, 45],
      [20, 25],
      [30, 15],
      [40, 22],
      [50, 28],
      [60, 25],
      [70, 32],
      [80, 28],
      [90, 12],
      [100, 5],
    ],
  },
  {
    id: 2,
    name: 'bear_flag',
    label: 'Drapeau baissier',
    description:
      "Impulsion baissière puis rebond en canal ascendant, suivie d'une cassure baissière.",
    points: [
      [0, 10],
      [10, 15],
      [20, 35],
      [30, 45],
      [40, 38],
      [50, 32],
      [60, 36],
      [70, 30],
      [80, 33],
      [90, 50],
      [100, 55],
    ],
  },
  {
    id: 3,
    name: 'double_top',
    label: 'Double top',
    description:
      'Deux sommets quasi égaux séparés par un creux. Signal de retournement baissier.',
    points: [
      [0, 50],
      [15, 30],
      [25, 12],
      [35, 25],
      [45, 35],
      [55, 28],
      [65, 12],
      [75, 25],
      [90, 40],
      [100, 50],
    ],
  },
  {
    id: 4,
    name: 'double_bottom',
    label: 'Double bottom',
    description:
      'Deux creux quasi égaux séparés par un sommet. Signal de retournement haussier.',
    points: [
      [0, 10],
      [15, 30],
      [25, 48],
      [35, 35],
      [45, 25],
      [55, 32],
      [65, 48],
      [75, 35],
      [90, 20],
      [100, 10],
    ],
  },
  {
    id: 5,
    name: 'asc_triangle',
    label: 'Triangle ascendant',
    description:
      'Résistance horizontale + creux de plus en plus hauts. Cassure haussière probable.',
    points: [
      [0, 50],
      [10, 18],
      [20, 35],
      [30, 18],
      [40, 30],
      [50, 18],
      [60, 25],
      [70, 18],
      [80, 22],
      [90, 18],
      [100, 8],
    ],
  },
  {
    id: 6,
    name: 'desc_triangle',
    label: 'Triangle descendant',
    description:
      'Support horizontal + sommets de plus en plus bas. Cassure baissière probable.',
    points: [
      [0, 10],
      [10, 42],
      [20, 25],
      [30, 42],
      [40, 30],
      [50, 42],
      [60, 35],
      [70, 42],
      [80, 38],
      [90, 42],
      [100, 55],
    ],
  },
  {
    id: 7,
    name: 'head_shoulders',
    label: 'Tête-épaules',
    description:
      'Trois sommets : un central plus haut entre deux plus bas. Signal de top.',
    points: [
      [0, 45],
      [10, 30],
      [20, 18],
      [30, 28],
      [40, 25],
      [50, 8],
      [60, 25],
      [70, 28],
      [80, 18],
      [90, 30],
      [100, 50],
    ],
  },
  {
    id: 8,
    name: 'inv_head_shoulders',
    label: 'Tête-épaules inversée',
    description:
      'Trois creux : un central plus bas entre deux plus hauts. Signal de bottom.',
    points: [
      [0, 15],
      [10, 30],
      [20, 42],
      [30, 32],
      [40, 35],
      [50, 52],
      [60, 35],
      [70, 32],
      [80, 42],
      [90, 30],
      [100, 10],
    ],
  },
  {
    id: 9,
    name: 'range',
    label: 'Range (canal)',
    description:
      'Oscillation entre un support et une résistance horizontaux. Marché indécis.',
    points: [
      [0, 30],
      [10, 18],
      [20, 42],
      [30, 22],
      [40, 38],
      [50, 20],
      [60, 40],
      [70, 22],
      [80, 38],
      [90, 20],
      [100, 35],
    ],
  },
  {
    id: 10,
    name: 'breakout',
    label: 'Breakout (cassure)',
    description:
      'Long range étroit suivi d\'une cassure verticale forte. Souvent en V volume.',
    points: [
      [0, 32],
      [10, 28],
      [20, 35],
      [30, 30],
      [40, 33],
      [50, 28],
      [60, 32],
      [70, 30],
      [80, 25],
      [90, 12],
      [100, 4],
    ],
  },
];

export const PATTERNS_PER_RUN = 5;

/**
 * Génère une séquence de 5 patterns distincts, randomisée.
 */
export function pickPatternsForRun(seed?: number): ChartPattern[] {
  const list = [...CHART_PATTERNS];
  // Fisher-Yates
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(
      (seed !== undefined ? pseudoRandom(seed + i) : Math.random()) * (i + 1)
    );
    const a = list[i]!;
    const b = list[j]!;
    list[i] = b;
    list[j] = a;
  }
  return list.slice(0, PATTERNS_PER_RUN);
}

function pseudoRandom(seed: number): number {
  // mulberry32
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * XP en fonction du nombre de réponses correctes (0-5).
 */
export function patternMemoryXpFor(correct: number): number {
  const c = Math.max(0, Math.min(5, Math.floor(correct)));
  if (c >= 5) return 150;
  if (c >= 4) return 100;
  if (c >= 3) return 50;
  if (c >= 2) return 25;
  return 10;
}

export interface PatternMemoryState {
  canPlay: boolean;
  lastRun: {
    score: number;
    xpAwarded: number;
    createdAt: Date;
  } | null;
  history: Array<{ score: number; createdAt: Date }>;
  bestScore: number;
}

/**
 * Renvoie true si l'user n'a pas encore fait de run aujourd'hui (Paris).
 */
async function hasRunToday(userId: string): Promise<boolean> {
  const today = getParisDate();
  // On regarde les runs depuis minuit Paris : en pratique on prend 48h
  // glissantes côté DB et on filtre côté code par getParisDate sur createdAt.
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const rows = await db
    .select({ createdAt: patternMemoryRuns.createdAt })
    .from(patternMemoryRuns)
    .where(
      and(
        eq(patternMemoryRuns.userId, userId),
        gte(patternMemoryRuns.createdAt, since)
      )
    );
  return rows.some((r) => getParisDate(r.createdAt) === today);
}

export async function getPatternMemoryState(
  userId: string
): Promise<PatternMemoryState> {
  try {
    const rows = await db
      .select()
      .from(patternMemoryRuns)
      .where(eq(patternMemoryRuns.userId, userId))
      .orderBy(desc(patternMemoryRuns.createdAt))
      .limit(20);

    const today = getParisDate();
    const doneToday = rows.some((r) => getParisDate(r.createdAt) === today);

    const bestScore = rows.reduce((m, r) => Math.max(m, r.score), 0);

    return {
      canPlay: !doneToday,
      lastRun: rows[0]
        ? {
            score: rows[0].score,
            xpAwarded: rows[0].xpAwarded,
            createdAt: rows[0].createdAt,
          }
        : null,
      history: rows.map((r) => ({
        score: r.score,
        createdAt: r.createdAt,
      })),
      bestScore,
    };
  } catch (err) {
    console.warn('[pattern-memory] state fallback', err);
    return { canPlay: true, lastRun: null, history: [], bestScore: 0 };
  }
}

export type SubmitPatternMemoryResult =
  | {
      ok: true;
      score: number;
      xpAwarded: number;
      newTotal: number;
      correctIds: number[];
    }
  | {
      ok: false;
      error: 'invalid_run' | 'daily_limit' | 'unknown';
    };

export async function submitPatternMemoryRun(
  userId: string,
  patternsShown: number[],
  answers: number[]
): Promise<SubmitPatternMemoryResult> {
  if (
    !Array.isArray(patternsShown) ||
    patternsShown.length !== PATTERNS_PER_RUN ||
    !Array.isArray(answers) ||
    answers.length !== PATTERNS_PER_RUN
  ) {
    return { ok: false, error: 'invalid_run' };
  }
  const validIds = new Set(CHART_PATTERNS.map((p) => p.id));
  if (
    !patternsShown.every((id) => validIds.has(id)) ||
    !answers.every((id) => validIds.has(id))
  ) {
    return { ok: false, error: 'invalid_run' };
  }
  // patternsShown doivent être distincts
  if (new Set(patternsShown).size !== PATTERNS_PER_RUN) {
    return { ok: false, error: 'invalid_run' };
  }

  // Daily limit
  if (await hasRunToday(userId)) {
    return { ok: false, error: 'daily_limit' };
  }

  // Score = nombre de slots où answer = patternsShown
  let score = 0;
  for (let i = 0; i < PATTERNS_PER_RUN; i++) {
    if (answers[i] === patternsShown[i]) score++;
  }
  const xpAwarded = patternMemoryXpFor(score);

  try {
    await db.insert(patternMemoryRuns).values({
      userId,
      patternsShown,
      answers,
      score,
      xpAwarded,
    });

    const newTotal = await addXp({
      userId,
      amount: xpAwarded,
      reason: 'wheel_spin',
      metadata: {
        source: 'pattern_memory',
        score,
      },
    });

    return {
      ok: true,
      score,
      xpAwarded,
      newTotal,
      correctIds: patternsShown,
    };
  } catch (err) {
    console.warn('[pattern-memory] submit failed', err);
    return { ok: false, error: 'unknown' };
  }
}
