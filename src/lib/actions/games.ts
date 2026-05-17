'use server';

import { revalidatePath } from 'next/cache';
import { requireOnboarded } from '@/lib/auth/server';
import {
  submitPrediction,
  type PredictionDirection,
} from '@/lib/games/predictions';
import { spinWheel } from '@/lib/games/wheel';
import {
  purchaseTapUpgrade,
  submitTapRun,
  TAP_UPGRADES,
  type TapMode,
  type TapUpgradeId,
} from '@/lib/games/tap';
import { MARKET_IDS, type MarketId } from '@/lib/games/markets';
import { submitEmotionEntry } from '@/lib/games/emotion-journal';
import {
  submitLossAversionRun,
  LOSS_AVERSION_QUESTIONS,
} from '@/lib/games/loss-aversion';
import { submitPatienceRun } from '@/lib/games/patience';
import { submitFomoRun, FOMO_SCENARIOS } from '@/lib/games/fomo';
import {
  submitAnchoringRun,
  ANCHORING_QUESTIONS,
} from '@/lib/games/anchoring';
import {
  submitPatternMemoryRun,
  PATTERNS_PER_RUN,
} from '@/lib/games/pattern-memory';
import { submitCandleHopRun } from '@/lib/games/candle-hop';
import { checkRateLimit } from '@/lib/rate-limit';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Server Action : soumet un pronostic chandelier journalier.
 *
 * Rate-limit : 20 tentatives / 10 min / user (couvre les 5 marchés ×
 * quelques retries en cas de bug réseau).
 */
export async function submitPredictionAction(input: {
  market: string;
  direction: string;
}): Promise<
  ActionResult<{
    xpAwarded: number;
    newTotal: number;
    streak: number;
  }>
> {
  const { user } = await requireOnboarded();

  if (!MARKET_IDS.includes(input.market as MarketId)) {
    return { success: false, error: 'Marché inconnu' };
  }
  if (input.direction !== 'up' && input.direction !== 'down') {
    return { success: false, error: 'Direction invalide' };
  }

  const rl = await checkRateLimit({
    key: `game_predict:user:${user.id}`,
    limit: 20,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return { success: false, error: 'Trop de tentatives, réessaie plus tard' };
  }

  const result = await submitPrediction({
    userId: user.id,
    market: input.market as MarketId,
    direction: input.direction as PredictionDirection,
  });

  if (!result.ok) {
    const msg =
      result.error === 'window_closed'
        ? 'La fenêtre de pronostic est fermée pour aujourd\'hui (21h Paris).'
        : result.error === 'already_predicted'
        ? 'Tu as déjà pronostiqué ce marché aujourd\'hui.'
        : result.error === 'candle_not_open'
        ? 'Marché pas encore ouvert au pronostic, repasse dans quelques minutes.'
        : 'Une erreur est survenue.';
    return { success: false, error: msg };
  }

  revalidatePath('/jeux/predict');
  revalidatePath('/jeux');

  return {
    success: true,
    data: {
      xpAwarded: result.xpAwarded,
      newTotal: result.newTotal,
      streak: result.streak,
    },
  };
}

/**
 * Server Action : fait spinner la roue. Cooldown 7 jours côté serveur.
 */
export async function spinWheelAction(): Promise<
  ActionResult<{
    label: string;
    rewardType: 'xp' | 'promo';
    promoCode?: string;
    segmentIndex: number;
    newXpTotal: number;
  }>
> {
  const { user } = await requireOnboarded();

  // Rate-limit accessoire : un seul spin / minute par user, en plus du
  // cooldown applicatif de 7j. Couvre les double-clicks/spam.
  const rl = await checkRateLimit({
    key: `game_wheel:user:${user.id}`,
    limit: 3,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return { success: false, error: 'Patiente quelques secondes…' };
  }

  const result = await spinWheel(user.id);
  if (!result.ok) {
    if (result.error === 'cooldown') {
      const nextDate = result.nextSpinAt.toLocaleString('fr-FR');
      return {
        success: false,
        error: `Ta prochaine roue arrive le ${nextDate}.`,
      };
    }
    return { success: false, error: 'Une erreur est survenue' };
  }

  revalidatePath('/jeux/roue');
  revalidatePath('/jeux');

  return {
    success: true,
    data: {
      label: result.segment.label,
      rewardType: result.segment.rewardType,
      promoCode: result.promoCode,
      segmentIndex: result.segmentIndex,
      newXpTotal: result.newXpTotal,
    },
  };
}

/**
 * Server Action : soumet un run du mini-jeu de clic (mode combo ou burst).
 */
export async function submitTapRunAction(input: {
  taps: number;
  durationMs: number;
  mode: 'combo' | 'burst';
}): Promise<
  ActionResult<{
    xpAwarded: number;
    bonusXp: number;
    levelReached: number;
    newTotal: number;
    runsLeftToday: number;
    challengeCompleted: boolean;
  }>
> {
  const { user } = await requireOnboarded();

  const rl = await checkRateLimit({
    key: `game_tap:user:${user.id}`,
    limit: 6,
    windowSec: 300,
  });
  if (!rl.allowed) {
    return { success: false, error: 'Trop de tentatives, attends un peu.' };
  }

  const mode: TapMode = input.mode === 'burst' ? 'burst' : 'combo';
  const result = await submitTapRun(user.id, {
    taps: input.taps,
    durationMs: input.durationMs,
    mode,
  });
  if (!result.ok) {
    const msg =
      result.error === 'daily_limit'
        ? 'Tu as utilisé tes 3 essais du jour. Reviens demain.'
        : result.error === 'too_fast'
        ? 'Vitesse de clic anormale — run rejeté.'
        : result.error === 'invalid_run'
        ? 'Run invalide.'
        : 'Une erreur est survenue.';
    return { success: false, error: msg };
  }

  revalidatePath('/jeux/clic');
  revalidatePath('/jeux');

  return {
    success: true,
    data: {
      xpAwarded: result.xpAwarded,
      bonusXp: result.bonusXp,
      levelReached: result.levelReached,
      newTotal: result.newTotal,
      runsLeftToday: result.runsLeftToday,
      challengeCompleted: result.challengeCompleted,
    },
  };
}

/**
 * Server Action : achète un upgrade permanent du jeu de clic.
 */
export async function purchaseTapUpgradeAction(
  upgradeId: string
): Promise<
  ActionResult<{
    newTotal: number;
    upgradeId: TapUpgradeId;
    label: string;
  }>
> {
  const { user } = await requireOnboarded();

  if (!(upgradeId in TAP_UPGRADES)) {
    return { success: false, error: 'Amélioration inconnue.' };
  }
  const id = upgradeId as TapUpgradeId;

  const rl = await checkRateLimit({
    key: `tap_upgrade:user:${user.id}`,
    limit: 5,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return { success: false, error: 'Patiente quelques secondes…' };
  }

  const result = await purchaseTapUpgrade(user.id, id);
  if (!result.ok) {
    const msg =
      result.error === 'already_owned'
        ? 'Amélioration déjà débloquée.'
        : result.error === 'not_enough_xp'
        ? "Pas assez d'XP pour cette amélioration."
        : 'Une erreur est survenue.';
    return { success: false, error: msg };
  }

  revalidatePath('/jeux/clic');
  revalidatePath('/jeux');

  return {
    success: true,
    data: {
      newTotal: result.newTotal,
      upgradeId: id,
      label: TAP_UPGRADES[id].label,
    },
  };
}

/**
 * Server Action : soumet l'entrée du journal d'émotion du jour.
 * Upsert : si déjà une entrée aujourd'hui, update mood/note (pas de XP).
 */
export async function submitEmotionEntryAction(input: {
  mood: number;
  note: string | null;
}): Promise<
  ActionResult<{
    created: boolean;
    xpAwarded: number;
    bonusAwarded: number;
    newStreak: number;
    newTotal: number;
  }>
> {
  const { user } = await requireOnboarded();

  const rl = await checkRateLimit({
    key: `emotion:user:${user.id}`,
    limit: 20,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return { success: false, error: 'Trop de soumissions, attends un peu.' };
  }

  const result = await submitEmotionEntry(
    user.id,
    Math.floor(input.mood),
    input.note?.trim() || null
  );
  if (!result.ok) {
    const msg =
      result.error === 'invalid_mood'
        ? 'Note invalide (1-10).'
        : 'Une erreur est survenue.';
    return { success: false, error: msg };
  }

  revalidatePath('/jeux/journal');
  revalidatePath('/jeux');
  return {
    success: true,
    data: {
      created: result.created,
      xpAwarded: result.xpAwarded,
      bonusAwarded: result.bonusAwarded,
      newStreak: result.newStreak,
      newTotal: result.newTotal,
    },
  };
}

/**
 * Server Action : soumet un run complet du test d'aversion à la perte.
 */
export async function submitLossAversionAction(input: {
  choices: Array<'safe' | 'lottery'>;
}): Promise<
  ActionResult<{
    coefficient: number;
    safeCount: number;
    newTotal: number;
  }>
> {
  const { user } = await requireOnboarded();

  const rl = await checkRateLimit({
    key: `loss_aversion:user:${user.id}`,
    limit: 3,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return { success: false, error: 'Trop de tentatives, attends un peu.' };
  }

  if (
    !Array.isArray(input.choices) ||
    input.choices.length !== LOSS_AVERSION_QUESTIONS.length
  ) {
    return { success: false, error: 'Choix incomplets ou invalides.' };
  }

  const result = await submitLossAversionRun(user.id, input.choices);
  if (!result.ok) {
    if (result.error === 'cooldown' && result.nextRunAt) {
      return {
        success: false,
        error: `Tu pourras refaire le test le ${result.nextRunAt.toLocaleDateString('fr-FR')}.`,
      };
    }
    const msg =
      result.error === 'invalid_choices'
        ? 'Choix invalides.'
        : 'Une erreur est survenue.';
    return { success: false, error: msg };
  }

  revalidatePath('/jeux/aversion');
  revalidatePath('/jeux');
  return {
    success: true,
    data: {
      coefficient: result.coefficient,
      safeCount: result.safeCount,
      newTotal: result.newTotal,
    },
  };
}

/**
 * Server Action : soumet un run du Patience Trainer.
 */
export async function submitPatienceRunAction(input: {
  score: number;
  durationHeldMs: number;
}): Promise<
  ActionResult<{
    score: number;
    xpAwarded: number;
    newTotal: number;
    runsLeftToday: number;
  }>
> {
  const { user } = await requireOnboarded();

  const rl = await checkRateLimit({
    key: `patience:user:${user.id}`,
    limit: 6,
    windowSec: 300,
  });
  if (!rl.allowed) {
    return { success: false, error: 'Trop de tentatives, attends un peu.' };
  }

  const result = await submitPatienceRun(user.id, {
    score: input.score,
    durationHeldMs: input.durationHeldMs,
  });
  if (!result.ok) {
    const msg =
      result.error === 'daily_limit'
        ? 'Tu as utilisé tes 3 essais du jour. Reviens demain.'
        : result.error === 'invalid_run'
        ? 'Run invalide.'
        : 'Une erreur est survenue.';
    return { success: false, error: msg };
  }

  revalidatePath('/jeux/patience');
  revalidatePath('/jeux');

  return {
    success: true,
    data: {
      score: result.score,
      xpAwarded: result.xpAwarded,
      newTotal: result.newTotal,
      runsLeftToday: result.runsLeftToday,
    },
  };
}

/**
 * Server Action : soumet un run complet du FOMO Test.
 */
export async function submitFomoRunAction(input: {
  decisions: Array<{
    scenarioId: number;
    choice: 'buy' | 'hold' | 'sell';
    latencyMs: number;
  }>;
}): Promise<
  ActionResult<{
    score: number;
    xpAwarded: number;
    newTotal: number;
  }>
> {
  const { user } = await requireOnboarded();

  const rl = await checkRateLimit({
    key: `fomo:user:${user.id}`,
    limit: 3,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return { success: false, error: 'Trop de tentatives, attends un peu.' };
  }

  if (
    !Array.isArray(input.decisions) ||
    input.decisions.length !== FOMO_SCENARIOS.length
  ) {
    return { success: false, error: 'Décisions incomplètes ou invalides.' };
  }

  const result = await submitFomoRun(user.id, input.decisions);
  if (!result.ok) {
    if (result.error === 'cooldown' && result.nextRunAt) {
      return {
        success: false,
        error: `Tu pourras refaire le test le ${result.nextRunAt.toLocaleString('fr-FR')}.`,
      };
    }
    const msg =
      result.error === 'invalid_decisions'
        ? 'Décisions invalides.'
        : 'Une erreur est survenue.';
    return { success: false, error: msg };
  }

  revalidatePath('/jeux/fomo');
  revalidatePath('/jeux');
  return {
    success: true,
    data: {
      score: result.score,
      xpAwarded: result.xpAwarded,
      newTotal: result.newTotal,
    },
  };
}

/**
 * Server Action : soumet un run du test d'ancrage.
 */
export async function submitAnchoringAction(input: {
  predictions: Array<{
    questionId: number;
    anchorVariant: 'high' | 'low';
    userValue: number;
  }>;
}): Promise<
  ActionResult<{
    anchoringIndex: number;
    xpAwarded: number;
    newTotal: number;
  }>
> {
  const { user } = await requireOnboarded();

  const rl = await checkRateLimit({
    key: `anchoring:user:${user.id}`,
    limit: 3,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return { success: false, error: 'Trop de tentatives, attends un peu.' };
  }

  if (
    !Array.isArray(input.predictions) ||
    input.predictions.length !== ANCHORING_QUESTIONS.length
  ) {
    return { success: false, error: 'Prédictions incomplètes.' };
  }

  const result = await submitAnchoringRun(user.id, input.predictions);
  if (!result.ok) {
    if (result.error === 'cooldown' && result.nextRunAt) {
      return {
        success: false,
        error: `Tu pourras refaire le test le ${result.nextRunAt.toLocaleDateString('fr-FR')}.`,
      };
    }
    const msg =
      result.error === 'invalid_predictions'
        ? 'Prédictions invalides.'
        : 'Une erreur est survenue.';
    return { success: false, error: msg };
  }

  revalidatePath('/jeux/anchoring');
  revalidatePath('/jeux');
  return {
    success: true,
    data: {
      anchoringIndex: result.anchoringIndex,
      xpAwarded: result.xpAwarded,
      newTotal: result.newTotal,
    },
  };
}

/**
 * Server Action : soumet un run du Pattern Memory.
 */
export async function submitPatternMemoryAction(input: {
  patternsShown: number[];
  answers: number[];
}): Promise<
  ActionResult<{
    score: number;
    xpAwarded: number;
    newTotal: number;
    correctIds: number[];
  }>
> {
  const { user } = await requireOnboarded();

  const rl = await checkRateLimit({
    key: `pattern_memory:user:${user.id}`,
    limit: 5,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return { success: false, error: 'Trop de tentatives, attends un peu.' };
  }

  if (
    !Array.isArray(input.patternsShown) ||
    input.patternsShown.length !== PATTERNS_PER_RUN ||
    !Array.isArray(input.answers) ||
    input.answers.length !== PATTERNS_PER_RUN
  ) {
    return { success: false, error: 'Run invalide.' };
  }

  const result = await submitPatternMemoryRun(
    user.id,
    input.patternsShown,
    input.answers
  );
  if (!result.ok) {
    const msg =
      result.error === 'daily_limit'
        ? 'Tu as déjà fait ton run aujourd\'hui. Reviens demain.'
        : result.error === 'invalid_run'
          ? 'Run invalide.'
          : 'Une erreur est survenue.';
    return { success: false, error: msg };
  }

  revalidatePath('/jeux/pattern');
  revalidatePath('/jeux');
  return {
    success: true,
    data: {
      score: result.score,
      xpAwarded: result.xpAwarded,
      newTotal: result.newTotal,
      correctIds: result.correctIds,
    },
  };
}

/**
 * Server Action : soumet un run de Candle Hop.
 */
export async function submitCandleHopAction(input: {
  score: number;
  durationMs: number;
  taps: number;
}): Promise<
  ActionResult<{
    score: number;
    xpAwarded: number;
    bonusXp: number;
    newTotal: number;
    isPersonalBest: boolean;
    runsLeftToday: number;
  }>
> {
  const { user } = await requireOnboarded();

  const rl = await checkRateLimit({
    key: `candle_hop:user:${user.id}`,
    limit: 10,
    windowSec: 600,
  });
  if (!rl.allowed) {
    return { success: false, error: 'Trop de tentatives, attends un peu.' };
  }

  if (
    typeof input.score !== 'number' ||
    typeof input.durationMs !== 'number' ||
    typeof input.taps !== 'number'
  ) {
    return { success: false, error: 'Run invalide.' };
  }

  const result = await submitCandleHopRun(user.id, {
    score: input.score,
    durationMs: input.durationMs,
    taps: input.taps,
  });
  if (!result.ok) {
    const msg =
      result.error === 'daily_limit'
        ? 'Tu as utilisé tes 5 runs du jour. Reviens demain.'
        : result.error === 'invalid_run'
          ? 'Run invalide.'
          : 'Une erreur est survenue.';
    return { success: false, error: msg };
  }

  revalidatePath('/jeux/hop');
  revalidatePath('/jeux');
  return {
    success: true,
    data: {
      score: result.score,
      xpAwarded: result.xpAwarded,
      bonusXp: result.bonusXp,
      newTotal: result.newTotal,
      isPersonalBest: result.isPersonalBest,
      runsLeftToday: result.runsLeftToday,
    },
  };
}
