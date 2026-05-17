import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { patienceRuns } from '@/lib/db/schema';
import { addXp } from './xp';

/** Daily limit (24h glissantes). */
export const PATIENCE_DAILY_LIMIT = 3;

/** Bornes plausibles pour anti-cheat. */
const MIN_DURATION_MS = 1_000;
const MAX_DURATION_MS = 60_000;

export interface PatienceRunInput {
  score: number; // 0-100 calculé côté client à partir du random walk
  durationHeldMs: number;
}

export type PatienceRunResult =
  | {
      ok: true;
      score: number;
      xpAwarded: number;
      newTotal: number;
      runsLeftToday: number;
    }
  | {
      ok: false;
      error: 'daily_limit' | 'invalid_run' | 'unknown';
      runsLeftToday?: number;
    };

/**
 * XP en fonction du score. Linéaire avec un boost pour 80+.
 *  - 0-30 : essai (+5 XP)
 *  - 30-60 : moyen (+25 XP)
 *  - 60-80 : bon (+75 XP)
 *  - 80-100 : excellent (+150 XP)
 */
export function patienceXpFor(score: number): number {
  const s = Math.max(0, Math.min(100, Math.floor(score)));
  if (s >= 80) return 150;
  if (s >= 60) return 75;
  if (s >= 30) return 25;
  return 5;
}

async function runsLast24h(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(patienceRuns)
    .where(and(eq(patienceRuns.userId, userId), gte(patienceRuns.createdAt, since)));
  return rows[0]?.c ?? 0;
}

/**
 * Soumet un run. Valide score 0-100, durée 1-60s, daily limit 3.
 */
export async function submitPatienceRun(
  userId: string,
  input: PatienceRunInput
): Promise<PatienceRunResult> {
  const score = Math.max(0, Math.min(100, Math.floor(input.score)));
  const durationMs = Math.floor(input.durationHeldMs);

  if (
    !Number.isFinite(durationMs) ||
    durationMs < MIN_DURATION_MS ||
    durationMs > MAX_DURATION_MS
  ) {
    return { ok: false, error: 'invalid_run' };
  }

  const done = await runsLast24h(userId);
  if (done >= PATIENCE_DAILY_LIMIT) {
    return { ok: false, error: 'daily_limit', runsLeftToday: 0 };
  }

  const xp = patienceXpFor(score);

  try {
    await db.insert(patienceRuns).values({
      userId,
      durationHeldMs: durationMs,
      score,
      xpAwarded: xp,
    });

    const newTotal = await addXp({
      userId,
      amount: xp,
      reason: 'wheel_spin',
      metadata: { source: 'patience_trainer', score, durationMs },
    });

    return {
      ok: true,
      score,
      xpAwarded: xp,
      newTotal,
      runsLeftToday: Math.max(0, PATIENCE_DAILY_LIMIT - done - 1),
    };
  } catch (err) {
    console.warn('[patience] submit failed', err);
    return { ok: false, error: 'unknown' };
  }
}

/**
 * Stats pour la page : runs restants aujourd'hui + meilleur score all-time.
 */
export async function getPatienceState(userId: string): Promise<{
  runsLeftToday: number;
  bestScore: number;
  recentRuns: Array<{ score: number; durationMs: number; xp: number; createdAt: Date }>;
}> {
  try {
    const [done, [best], recent] = await Promise.all([
      runsLast24h(userId),
      db
        .select({ score: patienceRuns.score })
        .from(patienceRuns)
        .where(eq(patienceRuns.userId, userId))
        .orderBy(desc(patienceRuns.score))
        .limit(1),
      db
        .select()
        .from(patienceRuns)
        .where(eq(patienceRuns.userId, userId))
        .orderBy(desc(patienceRuns.createdAt))
        .limit(10),
    ]);

    return {
      runsLeftToday: Math.max(0, PATIENCE_DAILY_LIMIT - done),
      bestScore: best?.score ?? 0,
      recentRuns: recent.map((r) => ({
        score: r.score,
        durationMs: r.durationHeldMs,
        xp: r.xpAwarded,
        createdAt: r.createdAt,
      })),
    };
  } catch {
    return { runsLeftToday: PATIENCE_DAILY_LIMIT, bestScore: 0, recentRuns: [] };
  }
}
