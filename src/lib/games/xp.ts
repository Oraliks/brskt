import { eq, sql, and, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userXpStates, xpEvents } from '@/lib/db/schema';

export type LevelId = 'oraliks' | 'trader' | 'pro' | 'maitre' | 'legende';

export interface Level {
  id: LevelId;
  label: string;
  minXp: number;
  icon: string;
}

/**
 * Niveaux Boursikotons. Le premier est "Oraliks" — clin d'œil au créateur
 * du site. Ordre croissant, paliers cumulatifs.
 */
export const LEVELS: Level[] = [
  { id: 'oraliks', label: 'Oraliks', minXp: 0, icon: '🌱' },
  { id: 'trader', label: 'Trader', minXp: 500, icon: '📈' },
  { id: 'pro', label: 'Pro', minXp: 2000, icon: '💼' },
  { id: 'maitre', label: 'Maître', minXp: 5000, icon: '🎯' },
  { id: 'legende', label: 'Légende', minXp: 15000, icon: '👑' },
];

/** Fallback : LEVELS[0] est garanti par construction mais TS ne le sait pas. */
const ROOT_LEVEL: Level = LEVELS[0] ?? {
  id: 'oraliks',
  label: 'Oraliks',
  minXp: 0,
  icon: '🌱',
};

/**
 * Renvoie le niveau actuel et la progression vers le suivant.
 */
export function getLevel(xpTotal: number): {
  level: Level;
  next: Level | null;
  progress: number;
  xpToNext: number;
} {
  let level: Level = ROOT_LEVEL;
  let levelIdx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    const candidate = LEVELS[i];
    if (!candidate) break;
    if (xpTotal >= candidate.minXp) {
      level = candidate;
      levelIdx = i;
    } else break;
  }
  const next = LEVELS[levelIdx + 1] ?? null;
  if (!next) {
    return { level, next: null, progress: 1, xpToNext: 0 };
  }
  const span = next.minXp - level.minXp;
  const done = xpTotal - level.minXp;
  return {
    level,
    next,
    progress: Math.max(0, Math.min(1, done / span)),
    xpToNext: Math.max(0, next.minXp - xpTotal),
  };
}

export const XP_REWARDS = {
  PREDICTION_MADE: 10,
  PREDICTION_CORRECT: 50,
  STREAK_MILESTONES: {
    7: 100,
    14: 250,
    30: 500,
    90: 1000,
    180: 2500,
    365: 5000,
  } as Record<number, number>,
} as const;

export type XpReason =
  | 'prediction_made'
  | 'prediction_correct'
  | 'prediction_streak'
  | 'wheel_spin'
  | 'admin_adjustment';

interface AddXpInput {
  userId: string;
  amount: number;
  reason: XpReason;
  metadata?: Record<string, unknown>;
}

/**
 * Ajoute de l'XP au user. Crée la row `user_xp_states` à la volée si
 * elle n'existe pas encore (upsert atomique côté Postgres).
 *
 * Renvoie le nouveau total après update.
 */
export async function addXp(input: AddXpInput): Promise<number> {
  if (input.amount === 0) {
    const state = await getUserXpState(input.userId);
    return state?.xpTotal ?? 0;
  }

  // Upsert : insère ou incrémente. Atomique via ON CONFLICT.
  const [row] = await db
    .insert(userXpStates)
    .values({
      userId: input.userId,
      xpTotal: input.amount,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userXpStates.userId,
      set: {
        xpTotal: sql`${userXpStates.xpTotal} + ${input.amount}`,
        updatedAt: new Date(),
      },
    })
    .returning({ xp: userXpStates.xpTotal });

  await db.insert(xpEvents).values({
    userId: input.userId,
    amount: input.amount,
    reason: input.reason,
    metadata: input.metadata ?? null,
  });

  return row?.xp ?? 0;
}

/**
 * Récupère l'état XP/jeux d'un user. Renvoie une row "vide" si le user
 * n'a encore aucun XP gagné (pas encore de row dans user_xp_states).
 *
 * Tolérant à l'absence de la table (migration pas appliquée) : renvoie
 * un état vide plutôt que de planter.
 */
export async function getUserXpState(userId: string): Promise<{
  xpTotal: number;
  predictionStreakCount: number;
  predictionStreakLongest: number;
  predictionLastDate: string | null;
  lastWheelSpunAt: Date | null;
}> {
  const empty = {
    xpTotal: 0,
    predictionStreakCount: 0,
    predictionStreakLongest: 0,
    predictionLastDate: null,
    lastWheelSpunAt: null,
  };
  try {
    const [u] = await db
      .select({
        xpTotal: userXpStates.xpTotal,
        predictionStreakCount: userXpStates.predictionStreakCount,
        predictionStreakLongest: userXpStates.predictionStreakLongest,
        predictionLastDate: userXpStates.predictionLastDate,
        lastWheelSpunAt: userXpStates.lastWheelSpunAt,
      })
      .from(userXpStates)
      .where(eq(userXpStates.userId, userId))
      .limit(1);
    return u ?? empty;
  } catch (err) {
    console.warn('[xp] getUserXpState fallback (migration?)', err);
    return empty;
  }
}

/**
 * Somme l'XP gagné depuis `since`. Utilisé pour les leaderboards fenêtrés.
 */
export async function getXpSince(
  userId: string,
  since: Date
): Promise<number> {
  try {
    const [row] = await db
      .select({
        sum: sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int`,
      })
      .from(xpEvents)
      .where(and(eq(xpEvents.userId, userId), gte(xpEvents.createdAt, since)));
    return row?.sum ?? 0;
  } catch {
    return 0;
  }
}
