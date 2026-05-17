import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { lossAversionRuns } from '@/lib/db/schema';
import { addXp } from './xp';

/**
 * Pool de 10 questions de test d'aversion à la perte.
 *
 * Format : `safe` = option certaine, `lottery` = pari 50/50.
 * L'`expectedValue` de la loterie est généralement supérieur ou égal à
 * l'option safe — un agent risk-neutral choisit toujours la loterie.
 * Plus l'user prend `safe`, plus son aversion à la perte est haute.
 *
 * Source d'inspiration : Kahneman & Tversky (1979), Prospect Theory.
 */
export interface LossAversionQuestion {
  id: number;
  safe: { label: string; value: number };
  lottery: { winLabel: string; loseLabel: string; expectedValue: number };
  context?: string;
}

export const LOSS_AVERSION_QUESTIONS: LossAversionQuestion[] = [
  {
    id: 1,
    safe: { label: 'Empocher 100€ tout de suite', value: 100 },
    lottery: {
      winLabel: '50% : gagner 250€',
      loseLabel: '50% : 0€',
      expectedValue: 125,
    },
    context: 'Premier setup. Sûr vs loterie favorable.',
  },
  {
    id: 2,
    safe: { label: 'Empocher 50€ sûr', value: 50 },
    lottery: {
      winLabel: '50% : gagner 200€',
      loseLabel: '50% : 0€',
      expectedValue: 100,
    },
    context: 'La loterie a une espérance 2× supérieure.',
  },
  {
    id: 3,
    safe: { label: 'Ne rien faire (0€)', value: 0 },
    lottery: {
      winLabel: '50% : gagner 200€',
      loseLabel: '50% : perdre 100€',
      expectedValue: 50,
    },
    context: 'Tu peux gagner ou perdre. Tu tentes ?',
  },
  {
    id: 4,
    safe: { label: 'Empocher 100€', value: 100 },
    lottery: {
      winLabel: '50% : gagner 300€',
      loseLabel: '50% : perdre 100€',
      expectedValue: 100,
    },
    context: 'Espérance égale au sûr. Tu prends le risque ?',
  },
  {
    id: 5,
    safe: { label: '200€ garantis', value: 200 },
    lottery: {
      winLabel: '50% : gagner 400€',
      loseLabel: '50% : 0€',
      expectedValue: 200,
    },
    context: "Test 'au pair'. Pour un risk-neutral c'est indifférent.",
  },
  {
    id: 6,
    safe: { label: 'Empocher 100€', value: 100 },
    lottery: {
      winLabel: '50% : gagner 500€',
      loseLabel: '50% : perdre 200€',
      expectedValue: 150,
    },
    context: 'Stakes plus hauts des deux côtés.',
  },
  {
    id: 7,
    safe: { label: 'Empocher 80€', value: 80 },
    lottery: {
      winLabel: '50% : gagner 250€',
      loseLabel: '50% : perdre 50€',
      expectedValue: 100,
    },
    context: 'Petite perte possible vs gros gain.',
  },
  {
    id: 8,
    safe: { label: 'Ne rien faire (0€)', value: 0 },
    lottery: {
      winLabel: '50% : gagner 500€',
      loseLabel: '50% : perdre 300€',
      expectedValue: 100,
    },
    context: 'Bet "tout ou rien" avec un edge positif.',
  },
  {
    id: 9,
    safe: { label: 'Garantir 150€', value: 150 },
    lottery: {
      winLabel: '50% : gagner 400€',
      loseLabel: '50% : perdre 100€',
      expectedValue: 150,
    },
    context: 'Même espérance que le sûr, mais avec une perte possible.',
  },
  {
    id: 10,
    safe: { label: 'Empocher 50€', value: 50 },
    lottery: {
      winLabel: '50% : gagner 1 000€',
      loseLabel: '50% : perdre 400€',
      expectedValue: 300,
    },
    context: 'Le pari fait rêver, mais la perte est lourde.',
  },
];

/** Cooldown entre 2 runs : 7 jours. */
export const LOSS_AVERSION_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** XP pour avoir complété le test. */
export const LOSS_AVERSION_XP = 250;

/**
 * Calcule le coefficient lambda à partir du nombre de "safe" choisis sur 10.
 *
 * Mapping empirique (Kahneman moyenne ~2.25) :
 *  - 0 picks safe → 0.8 (risk-seeking)
 *  - 5 picks      → 2.25 (moyenne population)
 *  - 10 picks     → 4.5 (extrêmement loss-averse)
 *
 * Linéaire entre les bornes.
 */
export function computeLambda(safeCount: number): number {
  const clamped = Math.max(0, Math.min(10, safeCount));
  // 0 → 0.8 ; 10 → 4.5 (linéaire)
  const lambda = 0.8 + (clamped / 10) * (4.5 - 0.8);
  return Math.round(lambda * 100) / 100;
}

/**
 * Renvoie une interprétation textuelle du coefficient.
 */
export function interpretLambda(lambda: number): {
  level: 'low' | 'moderate' | 'average' | 'high' | 'very_high';
  label: string;
  desc: string;
} {
  if (lambda < 1.3) {
    return {
      level: 'low',
      label: 'Peu averse à la perte',
      desc: "Tu prends des risques sans crainte. Attention au sur-trading et aux setups marginaux.",
    };
  }
  if (lambda < 1.9) {
    return {
      level: 'moderate',
      label: 'Modérément averse',
      desc: 'Tu vois les opportunités sans surévaluer les pertes. Profil souvent observé chez les bons traders.',
    };
  }
  if (lambda < 2.6) {
    return {
      level: 'average',
      label: 'Moyenne population',
      desc: 'Coefficient proche de Kahneman (~2.25). Tu ressens les pertes ~2× plus que les gains équivalents.',
    };
  }
  if (lambda < 3.5) {
    return {
      level: 'high',
      label: 'Forte aversion',
      desc: 'Tu pourrais rater des setups à edge positif par peur de la perte. Garde un journal pour repérer.',
    };
  }
  return {
    level: 'very_high',
    label: 'Très forte aversion',
    desc: "Le risque te paralyse. Travaille la gestion de position et l'acceptation du drawdown.",
  };
}

export interface LossAversionState {
  canPlay: boolean;
  nextRunAt: Date | null;
  lastRun: {
    coefficient: number;
    safeCount: number;
    completedAt: Date;
  } | null;
  history: Array<{ coefficient: number; completedAt: Date }>;
}

/**
 * État du test pour un user : peut-il jouer maintenant ? Quand le prochain
 * run sera dispo ? Quel est son dernier coefficient ?
 */
export async function getLossAversionState(
  userId: string
): Promise<LossAversionState> {
  try {
    const rows = await db
      .select()
      .from(lossAversionRuns)
      .where(eq(lossAversionRuns.userId, userId))
      .orderBy(desc(lossAversionRuns.completedAt))
      .limit(20);

    const lastRun = rows[0];
    const now = Date.now();
    const canPlay =
      !lastRun ||
      now - lastRun.completedAt.getTime() >= LOSS_AVERSION_COOLDOWN_MS;
    const nextRunAt = lastRun
      ? new Date(lastRun.completedAt.getTime() + LOSS_AVERSION_COOLDOWN_MS)
      : null;

    return {
      canPlay,
      nextRunAt: canPlay ? null : nextRunAt,
      lastRun: lastRun
        ? {
            coefficient: Number(lastRun.coefficient),
            safeCount: lastRun.safeCount,
            completedAt: lastRun.completedAt,
          }
        : null,
      history: rows.map((r) => ({
        coefficient: Number(r.coefficient),
        completedAt: r.completedAt,
      })),
    };
  } catch (err) {
    console.warn('[loss-aversion] state fallback', err);
    return { canPlay: true, nextRunAt: null, lastRun: null, history: [] };
  }
}

export type SubmitLossAversionResult =
  | {
      ok: true;
      coefficient: number;
      safeCount: number;
      newTotal: number;
    }
  | {
      ok: false;
      error: 'invalid_choices' | 'cooldown' | 'unknown';
      nextRunAt?: Date;
    };

/**
 * Soumet un run complet (10 choix). Vérifie cooldown, calcule lambda,
 * persiste + attribue XP.
 */
export async function submitLossAversionRun(
  userId: string,
  choices: Array<'safe' | 'lottery'>
): Promise<SubmitLossAversionResult> {
  if (
    !Array.isArray(choices) ||
    choices.length !== LOSS_AVERSION_QUESTIONS.length ||
    choices.some((c) => c !== 'safe' && c !== 'lottery')
  ) {
    return { ok: false, error: 'invalid_choices' };
  }

  // Cooldown check
  const state = await getLossAversionState(userId);
  if (!state.canPlay) {
    return {
      ok: false,
      error: 'cooldown',
      nextRunAt: state.nextRunAt ?? undefined,
    };
  }

  const safeCount = choices.filter((c) => c === 'safe').length;
  const coefficient = computeLambda(safeCount);

  try {
    await db.insert(lossAversionRuns).values({
      userId,
      choices,
      safeCount,
      coefficient: String(coefficient),
    });

    const newTotal = await addXp({
      userId,
      amount: LOSS_AVERSION_XP,
      reason: 'wheel_spin',
      metadata: {
        source: 'loss_aversion_test',
        safeCount,
        coefficient,
      },
    });

    return { ok: true, coefficient, safeCount, newTotal };
  } catch (err) {
    console.warn('[loss-aversion] submit failed', err);
    return { ok: false, error: 'unknown' };
  }
}
