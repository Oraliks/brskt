import { and, eq, gte, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { gamePredictions, gameTapRuns, xpEvents } from '@/lib/db/schema';
import { getLevel, getUserXpState } from '@/lib/games/xp';
import { getWheelStatus } from '@/lib/games/wheel';
import { getTapMeta } from '@/lib/games/tap';
import { getTodayChallenge } from '@/lib/games/tap';
import { getUserRank } from '@/lib/games/leaderboard';
import { JeuxHub } from '@/components/games/jeux-hub';

export const dynamic = 'force-dynamic';

/**
 * Hub des mini-jeux — design inspiré des maquettes user.
 *
 * Layout : XP bandeau + onglets filtres + grille de cards visuelles
 * (1 grande "Jeu du jour" + 4-8 cards secondaires) + section "Défis
 * en cours" avec progress bars.
 */
export default async function JeuxPage() {
  const { user } = await requireAuth();

  // Toutes les données en parallèle pour la page hub
  const [xpState, wheelStatus, tapMeta, weekRank] = await Promise.all([
    getUserXpState(user.id),
    getWheelStatus(user.id),
    getTapMeta(user.id),
    getUserRank(user.id, 'week'),
  ]);

  const xp = xpState?.xpTotal ?? 0;
  const streak = xpState?.predictionStreakCount ?? 0;
  const longest = xpState?.predictionStreakLongest ?? 0;
  const levelInfo = getLevel(xp);

  // Stats pour les "Défis en cours"
  const [predictionsToday, predictionsAccuracy, xpThisWeek] = await Promise.all([
    countPredictionsToday(user.id),
    computePredictionAccuracy(user.id),
    computeXpThisWeek(user.id),
  ]);

  // Stats compteur des participations (KPI affichées sur les cards)
  const counts = await getGameCounts();

  const dailyChallenge = getTodayChallenge();

  return (
    <JeuxHub
      level={levelInfo}
      xp={xp}
      streak={streak}
      longest={longest}
      wheelAvailable={wheelStatus.canSpin}
      tapRunsLeft={tapMeta.runsLeftToday}
      challengeLabel={dailyChallenge.label}
      challengeDone={tapMeta.challengeDoneToday}
      counts={counts}
      challenges={{
        precision: predictionsAccuracy,
        streak: { current: streak, target: nextStreakMilestone(streak) },
        rushXp: { current: xpThisWeek, target: 1000 },
        topRank: weekRank?.rank ?? null,
      }}
      hasPredictionsToday={predictionsToday > 0}
    />
  );
}

// ============================================================
// Helpers de calcul
// ============================================================

async function countPredictionsToday(userId: string): Promise<number> {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(gamePredictions)
      .where(
        and(
          eq(gamePredictions.userId, userId),
          gte(gamePredictions.createdAt, today)
        )
      );
    return rows[0]?.c ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Calcule la précision des 10 derniers pronostics résolus.
 * Renvoie {correct, total} pour afficher "7/10".
 */
async function computePredictionAccuracy(
  userId: string
): Promise<{ correct: number; total: number }> {
  try {
    const rows = await db
      .select()
      .from(gamePredictions)
      .where(
        and(
          eq(gamePredictions.userId, userId),
          eq(gamePredictions.resolved, true)
        )
      )
      .orderBy(sql`${gamePredictions.resolvedAt} desc`)
      .limit(10);
    const correct = rows.filter((r) => r.correct === true).length;
    return { correct, total: rows.length };
  } catch {
    return { correct: 0, total: 0 };
  }
}

async function computeXpThisWeek(userId: string): Promise<number> {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        sum: sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int`,
      })
      .from(xpEvents)
      .where(
        and(eq(xpEvents.userId, userId), gte(xpEvents.createdAt, weekAgo))
      );
    return rows[0]?.sum ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Compteurs de participation par jeu (pour afficher "X 245" sous chaque card).
 * Best-effort, fallback 0 si table absente.
 */
async function getGameCounts(): Promise<{
  wheel: number;
  tap: number;
  predict: number;
  classement: number;
}> {
  try {
    const [wheelRow, tapRow, predRow, classRow] = await Promise.all([
      db.execute(
        sql`SELECT count(*)::int as c FROM game_wheel_spins`
      ).catch(() => ({ rows: [{ c: 0 }] })),
      db
        .select({ c: sql<number>`count(distinct user_id)::int` })
        .from(gameTapRuns)
        .catch(() => [{ c: 0 }]),
      db
        .select({ c: sql<number>`count(distinct user_id)::int` })
        .from(gamePredictions)
        .catch(() => [{ c: 0 }]),
      db
        .select({ c: sql<number>`count(distinct user_id)::int` })
        .from(xpEvents)
        .catch(() => [{ c: 0 }]),
    ]);
    type Row = { c?: number; rows?: { c?: number }[] };
    const get = (r: Row | Array<{ c?: number }>): number => {
      if (Array.isArray(r)) return r[0]?.c ?? 0;
      if (r.rows && r.rows[0]) return r.rows[0].c ?? 0;
      return 0;
    };
    return {
      wheel: get(wheelRow as Row),
      tap: get(tapRow as unknown as Array<{ c?: number }>),
      predict: get(predRow as unknown as Array<{ c?: number }>),
      classement: get(classRow as unknown as Array<{ c?: number }>),
    };
  } catch {
    return { wheel: 0, tap: 0, predict: 0, classement: 0 };
  }
}

function nextStreakMilestone(current: number): number {
  const milestones = [7, 14, 30, 90, 180, 365];
  return milestones.find((m) => m > current) ?? 365;
}
