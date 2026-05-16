import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { gameTapRuns, userXpStates, users, xpEvents } from '@/lib/db/schema';
import { LEVELS, type Level } from './xp';

export type LeaderboardWindow = 'week' | 'month' | 'all_time';

export interface LeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  username: string | null;
  photoUrl: string | null;
  xp: number;
  level: Level;
}

/**
 * Top N users par XP pour une fenêtre temporelle donnée.
 *
 *  - week : sum xp_events des 7 derniers jours
 *  - month : sum xp_events des 30 derniers jours
 *  - all_time : users.xpTotal directement (pas besoin d'agréger)
 *
 * Les noms anonymisés ("User XXXX") sont filtrés — un utilisateur sans
 * `telegramFirstName` ne sera pas exposé dans le leaderboard (UX
 * discutable mais évite de polluer le top avec des "User 234234").
 */
export async function getLeaderboard(
  window: LeaderboardWindow,
  limit = 20
): Promise<LeaderboardRow[]> {
  try {
    if (window === 'all_time') {
      const rows = await db
        .select({
          userId: users.id,
          name: users.name,
          firstName: users.telegramFirstName,
          username: users.telegramUsername,
          photoUrl: users.telegramPhotoUrl,
          xp: userXpStates.xpTotal,
        })
        .from(userXpStates)
        .innerJoin(users, eq(users.id, userXpStates.userId))
        .where(sql`${userXpStates.xpTotal} > 0`)
        .orderBy(desc(userXpStates.xpTotal))
        .limit(limit);

      return rows.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        name: r.firstName ?? r.name,
        username: r.username,
        photoUrl: r.photoUrl,
        xp: r.xp,
        level: pickLevel(r.xp),
      }));
    }

    const days = window === 'week' ? 7 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        userId: xpEvents.userId,
        name: users.name,
        firstName: users.telegramFirstName,
        username: users.telegramUsername,
        photoUrl: users.telegramPhotoUrl,
        xp: sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int`,
        total: sql<number>`coalesce(max(${userXpStates.xpTotal}), 0)::int`,
      })
      .from(xpEvents)
      .innerJoin(users, eq(users.id, xpEvents.userId))
      .leftJoin(userXpStates, eq(userXpStates.userId, xpEvents.userId))
      .where(gte(xpEvents.createdAt, since))
      .groupBy(
        xpEvents.userId,
        users.name,
        users.telegramFirstName,
        users.telegramUsername,
        users.telegramPhotoUrl
      )
      .orderBy(desc(sql`sum(${xpEvents.amount})`))
      .limit(limit);

    return rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      name: r.firstName ?? r.name,
      username: r.username,
      photoUrl: r.photoUrl,
      xp: r.xp,
      level: pickLevel(r.total),
    }));
  } catch (err) {
    console.warn('[leaderboard] fallback (migration?)', err);
    return [];
  }
}

/**
 * Position d'un user spécifique dans le leaderboard d'une fenêtre.
 * Compte le nombre de users devant lui (XP strictement supérieur sur la
 * fenêtre) + 1.
 *
 * Retourne { rank, xp } ou null si le user n'a aucun XP sur la fenêtre.
 *
 * Robuste à migration non appliquée.
 */
export async function getUserRank(
  userId: string,
  window: LeaderboardWindow
): Promise<{ rank: number; xp: number } | null> {
  try {
    return await getUserRankImpl(userId, window);
  } catch (err) {
    console.warn('[leaderboard] getUserRank fallback (migration?)', err);
    return null;
  }
}

async function getUserRankImpl(
  userId: string,
  window: LeaderboardWindow
): Promise<{ rank: number; xp: number } | null> {
  if (window === 'all_time') {
    const [me] = await db
      .select({ xp: userXpStates.xpTotal })
      .from(userXpStates)
      .where(eq(userXpStates.userId, userId))
      .limit(1);
    const myXp = me?.xp ?? 0;
    if (myXp === 0) return { rank: 0, xp: 0 };

    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(userXpStates)
      .where(sql`${userXpStates.xpTotal} > ${myXp}`);
    const count = rows[0]?.count ?? 0;

    return { rank: count + 1, xp: myXp };
  }

  const days = window === 'week' ? 7 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [myXp] = await db
    .select({
      xp: sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int`,
    })
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, userId), gte(xpEvents.createdAt, since)));

  const myTotal = myXp?.xp ?? 0;
  if (myTotal === 0) return { rank: 0, xp: 0 };

  const sub = db
    .select({
      userId: xpEvents.userId,
      sum: sql<number>`sum(${xpEvents.amount})`.as('sum'),
    })
    .from(xpEvents)
    .where(gte(xpEvents.createdAt, since))
    .groupBy(xpEvents.userId)
    .as('sub');

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sub)
    .where(sql`${sub.sum} > ${myTotal}`);
  const count = rows[0]?.count ?? 0;

  return { rank: count + 1, xp: myTotal };
}

const FALLBACK_LEVEL: Level = LEVELS[0] ?? {
  id: 'oraliks',
  label: 'Oraliks',
  minXp: 0,
  icon: '🌱',
};

function pickLevel(xp: number): Level {
  let level: Level = FALLBACK_LEVEL;
  for (const l of LEVELS) {
    if (xp >= l.minXp) level = l;
    else break;
  }
  return level;
}

/**
 * Leaderboard du mini-jeu de clic : meilleur run par user sur une fenêtre.
 *
 *  - `bestTaps` = max(taps) sur la fenêtre
 *  - `bestLevel` = max(max_level) du même run (approx via ORDER BY taps)
 *
 * On groupe par user, on garde le run avec le plus de taps. Pour
 * simplifier, le level affiché correspond au record (calculé client-side
 * via paliers).
 */
export interface TapLeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  username: string | null;
  photoUrl: string | null;
  bestTaps: number;
  bestLevel: number;
}

export async function getTapLeaderboard(
  window: LeaderboardWindow,
  limit = 20
): Promise<TapLeaderboardRow[]> {
  try {
    const days = window === 'week' ? 7 : window === 'month' ? 30 : 3650;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        userId: gameTapRuns.userId,
        name: users.name,
        firstName: users.telegramFirstName,
        username: users.telegramUsername,
        photoUrl: users.telegramPhotoUrl,
        bestTaps: sql<number>`max(${gameTapRuns.taps})::int`,
        bestLevel: sql<number>`max(${gameTapRuns.maxLevel})::int`,
      })
      .from(gameTapRuns)
      .innerJoin(users, eq(users.id, gameTapRuns.userId))
      .where(gte(gameTapRuns.createdAt, since))
      .groupBy(
        gameTapRuns.userId,
        users.name,
        users.telegramFirstName,
        users.telegramUsername,
        users.telegramPhotoUrl
      )
      .orderBy(desc(sql`max(${gameTapRuns.taps})`))
      .limit(limit);

    return rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      name: r.firstName ?? r.name,
      username: r.username,
      photoUrl: r.photoUrl,
      bestTaps: r.bestTaps,
      bestLevel: r.bestLevel,
    }));
  } catch (err) {
    console.warn('[leaderboard] tap fallback', err);
    return [];
  }
}
