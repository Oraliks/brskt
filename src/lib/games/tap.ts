import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { gameTapRuns, userXpStates } from '@/lib/db/schema';
import { addXp } from './xp';
import { getParisDate } from './markets';

/**
 * Paliers du mini-jeu de clic. Atteindre un palier donne un bonus XP au
 * moment où on soumet le run.
 */
export const TAP_LEVELS = [
  { level: 1, minTaps: 10, bonusXp: 5, icon: '🟢' },
  { level: 2, minTaps: 25, bonusXp: 15, icon: '🟡' },
  { level: 3, minTaps: 50, bonusXp: 30, icon: '🟠' },
  { level: 4, minTaps: 100, bonusXp: 60, icon: '🔴' },
  { level: 5, minTaps: 200, bonusXp: 120, icon: '🟣' },
] as const;

/** Max XP par run (anti-farm). Bonus paliers compris, avant multiplier. */
export const TAP_RUN_MAX_XP = 200;
/** Limite de runs / 24h glissantes / user. */
export const TAP_DAILY_LIMIT = 3;

/** Taux max de taps/s plausible humainement. Au-delà → reject. */
const MAX_TAPS_PER_SECOND = 20;
const MIN_DURATION_MS = 500;
const MAX_DURATION_MS = 5 * 60 * 1000;

/**
 * Modes de jeu :
 *  - `combo` : tape sans casser la barre (mode principal)
 *  - `burst` : 10 secondes max, on compte juste les taps
 */
export type TapMode = 'combo' | 'burst';

export interface TapRunInput {
  taps: number;
  durationMs: number;
  mode: TapMode;
}

export type TapRunResult =
  | {
      ok: true;
      xpAwarded: number;
      bonusXp: number;
      levelReached: number;
      newTotal: number;
      runsLeftToday: number;
      challengeCompleted: boolean;
    }
  | {
      ok: false;
      error: 'daily_limit' | 'invalid_run' | 'too_fast' | 'unknown';
      runsLeftToday?: number;
    };

// ============================================================
// Améliorations permanentes (meta-progression)
// ============================================================

/**
 * Upgrades achetables avec XP. Cost = XP qui est SOUSTRAIT au total
 * (achat = consommation). Une fois acheté, l'effet est permanent.
 *
 * Effets :
 *  - `combo` : +20% sur comboMs (utilisé côté client pour étirer la
 *    fenêtre temps entre 2 taps)
 *  - `drain` : -20% sur la vitesse de drain de la barre (client)
 *  - `xp` : ×1.15 sur l'XP gagné en jeu de clic (appliqué serveur)
 */
export const TAP_UPGRADES = {
  combo: {
    id: 'combo' as const,
    label: 'Combo allongé',
    description: '+20% sur la fenêtre temps entre 2 taps',
    cost: 500,
    icon: '⏱️',
  },
  drain: {
    id: 'drain' as const,
    label: 'Drain réduit',
    description: '-20% sur la vitesse de descente de la barre',
    cost: 500,
    icon: '🛡️',
  },
  xp: {
    id: 'xp' as const,
    label: 'XP boosté',
    description: '×1.15 sur l’XP gagné en jeu de clic',
    cost: 1000,
    icon: '✨',
  },
};

export type TapUpgradeId = keyof typeof TAP_UPGRADES;

/** Multiplicateur XP appliqué si l'user a l'upgrade `xp`. */
const XP_UPGRADE_MULTIPLIER = 1.15;

// ============================================================
// Défi quotidien
// ============================================================

/**
 * Pool de défis quotidiens. Un défi est choisi déterministiquement
 * depuis la date Paris du jour (modulo length). Tous les users voient
 * le même défi le même jour.
 *
 * Le défi est validé serveur après un run quand `verify()` retourne true.
 * Bonus accordé une seule fois par jour par user.
 */
export const TAP_CHALLENGES = [
  {
    id: 'reach_level_3',
    label: 'Atteins le niveau 3',
    description: 'Fais 50 taps minimum dans un run',
    bonusXp: 50,
    verify: (run: { taps: number; level: number; durationMs: number }) =>
      run.taps >= 50,
  },
  {
    id: 'burst_100',
    label: 'Burst de 100',
    description: 'Fais 100 taps minimum dans un run',
    bonusXp: 75,
    verify: (run: { taps: number; level: number; durationMs: number }) =>
      run.taps >= 100,
  },
  {
    id: 'fast_level_2',
    label: 'Démarrage rapide',
    description: 'Atteins le niveau 2 en moins de 15s',
    bonusXp: 50,
    verify: (run: { taps: number; level: number; durationMs: number }) =>
      run.taps >= 25 && run.durationMs <= 15000,
  },
  {
    id: 'legend',
    label: 'Mode légende',
    description: 'Atteins le niveau 5 (200 taps)',
    bonusXp: 150,
    verify: (run: { taps: number; level: number; durationMs: number }) =>
      run.taps >= 200,
  },
  {
    id: 'marathon',
    label: 'Marathon',
    description: 'Fais 150 taps dans un seul run',
    bonusXp: 100,
    verify: (run: { taps: number; level: number; durationMs: number }) =>
      run.taps >= 150,
  },
];

/**
 * Renvoie le défi du jour (déterministe depuis la date Paris).
 */
export function getTodayChallenge(now: Date = new Date()) {
  const date = getParisDate(now);
  // Hash très simple : somme des codes de la string YYYY-MM-DD
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    hash = (hash * 31 + date.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % TAP_CHALLENGES.length;
  const challenge = TAP_CHALLENGES[idx];
  if (!challenge) {
    return { ...TAP_CHALLENGES[0]!, date };
  }
  return { ...challenge, date };
}

// ============================================================
// Helpers internes
// ============================================================

export function tapLevelFor(taps: number): number {
  let level = 0;
  for (const tier of TAP_LEVELS) {
    if (taps >= tier.minTaps) level = tier.level;
    else break;
  }
  return level;
}

export function tapBaseXpFor(taps: number, mode: TapMode = 'combo'): {
  xp: number;
  level: number;
  bonus: number;
} {
  const level = tapLevelFor(taps);
  // Mode burst : XP plus généreux par tap (mode court) mais plafonné
  // plus bas pour éviter de cannibaliser le mode combo.
  const divisor = mode === 'burst' ? 3 : 5;
  const linear = Math.floor(taps / divisor);
  const bonus = TAP_LEVELS.find((t) => t.level === level)?.bonusXp ?? 0;
  const cap = mode === 'burst' ? 100 : TAP_RUN_MAX_XP;
  return { xp: Math.min(cap, linear + bonus), level, bonus };
}

async function runsLast24h(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(gameTapRuns)
    .where(and(eq(gameTapRuns.userId, userId), gte(gameTapRuns.createdAt, since)));
  return rows[0]?.c ?? 0;
}

// ============================================================
// API publique
// ============================================================

/**
 * Soumet un run. Applique :
 *  - Validation anti-cheat
 *  - Daily limit
 *  - Multiplicateur XP upgrade
 *  - Bonus défi quotidien si applicable
 */
export async function submitTapRun(
  userId: string,
  input: TapRunInput
): Promise<TapRunResult> {
  const taps = Math.floor(input.taps);
  const durationMs = Math.floor(input.durationMs);
  const mode: TapMode = input.mode === 'burst' ? 'burst' : 'combo';

  if (
    !Number.isFinite(taps) ||
    !Number.isFinite(durationMs) ||
    taps < 1 ||
    durationMs < MIN_DURATION_MS ||
    durationMs > MAX_DURATION_MS
  ) {
    return { ok: false, error: 'invalid_run' };
  }

  const maxPlausibleTaps = Math.ceil((durationMs / 1000) * MAX_TAPS_PER_SECOND);
  if (taps > maxPlausibleTaps) {
    return { ok: false, error: 'too_fast' };
  }

  // Mode burst : durée fixée 10s ± 1s, sinon rejet
  if (mode === 'burst' && (durationMs < 8000 || durationMs > 12000)) {
    return { ok: false, error: 'invalid_run' };
  }

  const done = await runsLast24h(userId);
  if (done >= TAP_DAILY_LIMIT) {
    return { ok: false, error: 'daily_limit', runsLeftToday: 0 };
  }

  const { xp: baseXp, level } = tapBaseXpFor(taps, mode);

  // Récupère les upgrades + état du défi. Tolérant à l'absence des
  // colonnes (migration tap_upgrade_* / tap_challenge_done_date pas
  // encore appliquée) : on assume "pas d'upgrade, défi pas fait".
  let xpUp = false;
  let challengeDate: string | null = null;
  try {
    const [meta] = await db
      .select({
        xpUp: userXpStates.tapUpgradeXp,
        challengeDate: userXpStates.tapChallengeDoneDate,
      })
      .from(userXpStates)
      .where(eq(userXpStates.userId, userId))
      .limit(1);
    xpUp = meta?.xpUp ?? false;
    challengeDate = meta?.challengeDate ?? null;
  } catch (err) {
    console.warn('[tap] upgrades select fallback (migration?)', err);
  }

  let finalXp = baseXp;
  if (xpUp) finalXp = Math.floor(finalXp * XP_UPGRADE_MULTIPLIER);

  // Vérification défi quotidien
  const today = getParisDate();
  const challenge = getTodayChallenge();
  let challengeCompleted = false;
  let challengeBonus = 0;
  if (
    challengeDate !== today &&
    challenge.verify({ taps, level, durationMs })
  ) {
    challengeCompleted = true;
    challengeBonus = challenge.bonusXp;
  }
  const totalXp = finalXp + challengeBonus;

  try {
    await db.insert(gameTapRuns).values({
      userId,
      taps,
      maxLevel: level,
      durationMs,
      xpAwarded: totalXp,
    });

    const newTotal =
      totalXp > 0
        ? await addXp({
            userId,
            amount: totalXp,
            reason: 'wheel_spin', // enum existant — métadonnée détaille
            metadata: {
              source: 'tap_game',
              mode,
              taps,
              level,
              durationMs,
              baseXp,
              xpMultiplied: finalXp,
              challengeBonus,
              challengeId: challengeCompleted ? challenge.id : null,
            },
          })
        : 0;

    // Marque le défi comme fait. Si la colonne n'existe pas encore en
    // prod (migration en retard) on ignore — le défi sera juste re-claim
    // à chaque run jusqu'à ce que la migration soit appliquée.
    if (challengeCompleted) {
      try {
        await db
          .insert(userXpStates)
          .values({ userId, tapChallengeDoneDate: today })
          .onConflictDoUpdate({
            target: userXpStates.userId,
            set: { tapChallengeDoneDate: today, updatedAt: new Date() },
          });
      } catch (err) {
        console.warn('[tap] challenge mark fallback (migration?)', err);
      }
    }

    return {
      ok: true,
      xpAwarded: totalXp,
      bonusXp: challengeBonus,
      levelReached: level,
      newTotal,
      runsLeftToday: Math.max(0, TAP_DAILY_LIMIT - done - 1),
      challengeCompleted,
    };
  } catch (err) {
    console.warn('[tap] submit failed', err);
    return { ok: false, error: 'unknown' };
  }
}

/**
 * Achète un upgrade permanent. Vérifie : pas déjà acheté, XP suffisant.
 * Déduit le coût du xpTotal, set la colonne boolean.
 */
export async function purchaseTapUpgrade(
  userId: string,
  upgradeId: TapUpgradeId
): Promise<
  | { ok: true; newTotal: number }
  | { ok: false; error: 'already_owned' | 'not_enough_xp' | 'unknown' }
> {
  const upgrade = TAP_UPGRADES[upgradeId];
  if (!upgrade) return { ok: false, error: 'unknown' };

  let state:
    | { xp: number; combo: boolean; drain: boolean; xpUp: boolean }
    | undefined;
  try {
    const [row] = await db
      .select({
        xp: userXpStates.xpTotal,
        combo: userXpStates.tapUpgradeCombo,
        drain: userXpStates.tapUpgradeDrain,
        xpUp: userXpStates.tapUpgradeXp,
      })
      .from(userXpStates)
      .where(eq(userXpStates.userId, userId))
      .limit(1);
    state = row;
  } catch (err) {
    console.warn('[tap] purchase select fallback (migration?)', err);
    return { ok: false, error: 'unknown' };
  }

  const xpTotal = state?.xp ?? 0;
  const owned = state
    ? {
        combo: state.combo,
        drain: state.drain,
        xp: state.xpUp,
      }
    : { combo: false, drain: false, xp: false };

  if (owned[upgradeId]) {
    return { ok: false, error: 'already_owned' };
  }
  if (xpTotal < upgrade.cost) {
    return { ok: false, error: 'not_enough_xp' };
  }

  try {
    // Déduit XP + marque l'upgrade en une seule UPDATE atomique
    const setMap: Record<string, unknown> = {
      xpTotal: sql`${userXpStates.xpTotal} - ${upgrade.cost}`,
      updatedAt: new Date(),
    };
    if (upgradeId === 'combo') setMap.tapUpgradeCombo = true;
    if (upgradeId === 'drain') setMap.tapUpgradeDrain = true;
    if (upgradeId === 'xp') setMap.tapUpgradeXp = true;

    const [updated] = await db
      .update(userXpStates)
      .set(setMap)
      .where(eq(userXpStates.userId, userId))
      .returning({ xp: userXpStates.xpTotal });

    return { ok: true, newTotal: updated?.xp ?? xpTotal - upgrade.cost };
  } catch (err) {
    console.warn('[tap] purchase failed', err);
    return { ok: false, error: 'unknown' };
  }
}

/**
 * État pour la page : runs restants, record, upgrades possédés, défi du jour.
 */
export async function getTapMeta(userId: string): Promise<{
  runsLeftToday: number;
  bestTaps: number;
  bestLevel: number;
  xpTotal: number;
  upgrades: { combo: boolean; drain: boolean; xp: boolean };
  challenge: ReturnType<typeof getTodayChallenge>;
  challengeDoneToday: boolean;
}> {
  const challenge = getTodayChallenge();
  const today = getParisDate();

  try {
    const [done, [best], [state]] = await Promise.all([
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
      db
        .select({
          xp: userXpStates.xpTotal,
          combo: userXpStates.tapUpgradeCombo,
          drain: userXpStates.tapUpgradeDrain,
          xpUp: userXpStates.tapUpgradeXp,
          challengeDate: userXpStates.tapChallengeDoneDate,
        })
        .from(userXpStates)
        .where(eq(userXpStates.userId, userId))
        .limit(1),
    ]);
    return {
      runsLeftToday: Math.max(0, TAP_DAILY_LIMIT - done),
      bestTaps: best?.taps ?? 0,
      bestLevel: best?.maxLevel ?? 0,
      xpTotal: state?.xp ?? 0,
      upgrades: {
        combo: state?.combo ?? false,
        drain: state?.drain ?? false,
        xp: state?.xpUp ?? false,
      },
      challenge,
      challengeDoneToday: state?.challengeDate === today,
    };
  } catch {
    return {
      runsLeftToday: TAP_DAILY_LIMIT,
      bestTaps: 0,
      bestLevel: 0,
      xpTotal: 0,
      upgrades: { combo: false, drain: false, xp: false },
      challenge,
      challengeDoneToday: false,
    };
  }
}

/**
 * Historique des runs récents du user.
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
 * État pour le composant client. Retourne uniquement ce qui influence
 * le gameplay (upgrades), pas l'historique.
 */
export type TapGameConfig = {
  hasComboUpgrade: boolean;
  hasDrainUpgrade: boolean;
  hasXpUpgrade: boolean;
};
