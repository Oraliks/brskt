import { eq, sql, and, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, xpEvents, type User } from '@/lib/db/schema';

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
 *
 * Pour ajouter un niveau, insérer dans l'ordre et garder `minXp` strictement
 * croissant. Les paliers ont été choisis pour qu'un user actif atteigne
 * "Trader" en ~1 mois (10 pronostics/jour × ~30 jours × avg ~17 XP).
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
 *
 *  - `level` : niveau atteint (toujours défini, fallback Oraliks à 0 XP)
 *  - `next` : prochain niveau ou null si déjà au max
 *  - `progress` : ratio 0→1 entre `level.minXp` et `next.minXp`
 *  - `xpToNext` : XP restant pour passer le palier suivant (0 si max)
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

/**
 * Barème XP — toutes les valeurs au même endroit pour pouvoir ajuster
 * sans avoir à fouiller le code.
 *
 * Les bonus de streak sont des paliers (pas du linéaire) pour créer
 * des "moments de fierté" plutôt qu'un drip continu.
 */
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
 * Ajoute de l'XP au user de façon atomique : incrémente `users.xpTotal`
 * et log un row dans `xp_events` (pour leaderboard temporel + audit).
 *
 * Volontairement pas de transaction explicite — l'UPDATE et l'INSERT sont
 * indépendants, et un decouple temporaire (le total est augmenté mais
 * l'event pas encore inséré) est tolérable. Si on voulait du strict, on
 * passerait par db.transaction().
 *
 * Retourne le nouveau total après update.
 */
export async function addXp(input: AddXpInput): Promise<number> {
  if (input.amount === 0) {
    const [u] = await db
      .select({ xp: users.xpTotal })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    return u?.xp ?? 0;
  }

  const [updated] = await db
    .update(users)
    .set({
      xpTotal: sql`${users.xpTotal} + ${input.amount}`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, input.userId))
    .returning({ xp: users.xpTotal });

  await db.insert(xpEvents).values({
    userId: input.userId,
    amount: input.amount,
    reason: input.reason,
    metadata: input.metadata ?? null,
  });

  return updated?.xp ?? 0;
}

/**
 * Récupère le user avec ses champs XP. Helper pour les UI/server actions
 * qui ont besoin du total + dernier niveau.
 *
 * Renvoie un fallback à 0 si la migration 0019 n'est pas encore appliquée
 * (colonnes inexistantes) — évite de planter les pages /jeux pendant que
 * l'admin n'a pas encore lancé `pnpm db:migrate`.
 */
export async function getUserXpState(userId: string): Promise<Pick<
  User,
  | 'xpTotal'
  | 'predictionStreakCount'
  | 'predictionStreakLongest'
  | 'predictionLastDate'
  | 'lastWheelSpunAt'
> | null> {
  try {
    const [u] = await db
      .select({
        xpTotal: users.xpTotal,
        predictionStreakCount: users.predictionStreakCount,
        predictionStreakLongest: users.predictionStreakLongest,
        predictionLastDate: users.predictionLastDate,
        lastWheelSpunAt: users.lastWheelSpunAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return u ?? null;
  } catch (err) {
    // Migration pas appliquée → renvoie un état vide plutôt que de
    // planter la page. À retirer une fois 0019 stable en prod.
    console.warn('[xp] getUserXpState fallback (migration?)', err);
    return {
      xpTotal: 0,
      predictionStreakCount: 0,
      predictionStreakLongest: 0,
      predictionLastDate: null,
      lastWheelSpunAt: null,
    };
  }
}

/**
 * Somme l'XP gagné depuis `since`. Utilisé pour les leaderboards
 * fenêtrés (semaine / mois).
 */
export async function getXpSince(
  userId: string,
  since: Date
): Promise<number> {
  const [row] = await db
    .select({
      sum: sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int`,
    })
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, userId), gte(xpEvents.createdAt, since)));
  return row?.sum ?? 0;
}
