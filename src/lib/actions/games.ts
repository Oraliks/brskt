'use server';

import { revalidatePath } from 'next/cache';
import { requireOnboarded } from '@/lib/auth/server';
import {
  submitPrediction,
  type PredictionDirection,
} from '@/lib/games/predictions';
import { spinWheel } from '@/lib/games/wheel';
import { submitTapRun } from '@/lib/games/tap';
import { MARKET_IDS, type MarketId } from '@/lib/games/markets';
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
 * Server Action : soumet un run du mini-jeu de clic.
 *
 *  - Client envoie {taps, durationMs} après que le combo soit cassé
 *  - Serveur valide (anti-cheat) + calcule XP + persiste
 *  - Rate-limit accessoire : 6 soumissions / 5 min / user
 */
export async function submitTapRunAction(input: {
  taps: number;
  durationMs: number;
}): Promise<
  ActionResult<{
    xpAwarded: number;
    levelReached: number;
    newTotal: number;
    runsLeftToday: number;
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

  const result = await submitTapRun(user.id, input);
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
      levelReached: result.levelReached,
      newTotal: result.newTotal,
      runsLeftToday: result.runsLeftToday,
    },
  };
}
