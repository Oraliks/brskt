import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  gameMarketCandles,
  gamePredictions,
  userXpStates,
} from '@/lib/db/schema';
import { addXp, XP_REWARDS } from './xp';
import {
  fetchLatestClose,
  getParisDate,
  getYesterdayParisDate,
  isPredictionWindowOpen,
  MARKET_IDS,
  type MarketId,
} from './markets';

export type PredictionDirection = 'up' | 'down';

export interface DailyCandleStatus {
  market: MarketId;
  date: string;
  openPrice: number | null;
  closePrice: number | null;
  resolved: boolean;
  /** Pronostic du user pour ce marché aujourd'hui, si déjà fait. */
  userPrediction: PredictionDirection | null;
}

/**
 * État des 5 marchés pour aujourd'hui, du point de vue d'un user. Inclut
 * leur pronostic en cours si déjà fait.
 *
 * Si aucun candle n'existe pour aujourd'hui (cron pas encore passé), on
 * renvoie `openPrice: null` — la page UI affichera un état "en attente
 * d'ouverture".
 *
 * Robuste à l'absence des tables (migration 0019 pas appliquée) : renvoie
 * un état "tous les marchés en attente" plutôt que de planter la page.
 */
export async function getTodayMarkets(
  userId: string
): Promise<DailyCandleStatus[]> {
  const date = getParisDate();

  let candles: Array<{
    market: string;
    openPrice: string;
    closePrice: string | null;
    resolvedAt: Date | null;
  }> = [];
  let userPreds: Array<{ market: string; direction: string }> = [];
  try {
    [candles, userPreds] = await Promise.all([
      db
        .select()
        .from(gameMarketCandles)
        .where(eq(gameMarketCandles.candleDate, date)),
      db
        .select()
        .from(gamePredictions)
        .where(
          and(
            eq(gamePredictions.userId, userId),
            eq(gamePredictions.predictionDate, date)
          )
        ),
    ]);
  } catch (err) {
    console.warn('[predictions] getTodayMarkets fallback (migration?)', err);
  }

  const candleByMarket = new Map(candles.map((c) => [c.market, c]));
  const predByMarket = new Map(userPreds.map((p) => [p.market, p]));

  return MARKET_IDS.map((m) => {
    const c = candleByMarket.get(m);
    const p = predByMarket.get(m);
    return {
      market: m,
      date,
      openPrice: c ? Number(c.openPrice) : null,
      closePrice: c?.closePrice ? Number(c.closePrice) : null,
      resolved: c?.resolvedAt !== null && c?.resolvedAt !== undefined,
      userPrediction: (p?.direction as PredictionDirection | undefined) ?? null,
    };
  });
}

export type SubmitPredictionResult =
  | { ok: true; xpAwarded: number; newTotal: number; streak: number }
  | {
      ok: false;
      error:
        | 'window_closed'
        | 'already_predicted'
        | 'candle_not_open'
        | 'unknown';
    };

/**
 * Soumet un pronostic. Garde-fous :
 *  - Fenêtre temporelle (avant 21h Paris)
 *  - Candle du jour doit exister (cron passe au début de journée)
 *  - 1 pronostic / user / marché / jour (unique index)
 *
 * Effets de bord en cas de succès :
 *  - Insert game_predictions
 *  - +10 XP (PREDICTION_MADE) — participation, gagné quelle que soit l'issue
 *  - Update streak du user (cf. updateStreak)
 */
export async function submitPrediction(input: {
  userId: string;
  market: MarketId;
  direction: PredictionDirection;
}): Promise<SubmitPredictionResult> {
  if (!isPredictionWindowOpen()) {
    return { ok: false, error: 'window_closed' };
  }

  const date = getParisDate();

  const [candle] = await db
    .select()
    .from(gameMarketCandles)
    .where(
      and(
        eq(gameMarketCandles.market, input.market),
        eq(gameMarketCandles.candleDate, date)
      )
    )
    .limit(1);

  if (!candle) {
    return { ok: false, error: 'candle_not_open' };
  }

  try {
    await db.insert(gamePredictions).values({
      userId: input.userId,
      market: input.market,
      predictionDate: date,
      direction: input.direction,
      openPrice: candle.openPrice,
    });
  } catch (err) {
    // Unique violation = déjà prédit pour ce (user, market, date)
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { ok: false, error: 'already_predicted' };
    }
    return { ok: false, error: 'unknown' };
  }

  const newTotal = await addXp({
    userId: input.userId,
    amount: XP_REWARDS.PREDICTION_MADE,
    reason: 'prediction_made',
    metadata: { market: input.market, direction: input.direction },
  });

  const streakInfo = await updateStreak(input.userId);

  return {
    ok: true,
    xpAwarded: XP_REWARDS.PREDICTION_MADE,
    newTotal: newTotal + streakInfo.bonusAwarded,
    streak: streakInfo.streak,
  };
}

/**
 * Met à jour le streak quotidien du user. Appelé après chaque pronostic
 * réussi.
 *
 * Logique :
 *  - last = today → pas de changement (déjà compté)
 *  - last = yesterday → +1 sur le streak
 *  - last < yesterday OU null → reset à 1
 *
 * Si un milestone (7/14/30/90/180/365) est atteint, attribue le bonus XP.
 */
export async function updateStreak(userId: string): Promise<{
  streak: number;
  bonusAwarded: number;
}> {
  const today = getParisDate();
  const yesterday = getYesterdayParisDate();

  const [existing] = await db
    .select({
      currentStreak: userXpStates.predictionStreakCount,
      longest: userXpStates.predictionStreakLongest,
      last: userXpStates.predictionLastDate,
    })
    .from(userXpStates)
    .where(eq(userXpStates.userId, userId))
    .limit(1);

  const current = existing ?? {
    currentStreak: 0,
    longest: 0,
    last: null as string | null,
  };

  let newStreak = current.currentStreak;
  if (current.last === today) {
    // Already counted today
    return { streak: newStreak, bonusAwarded: 0 };
  } else if (current.last === yesterday) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  const newLongest = Math.max(current.longest, newStreak);

  // Upsert : crée la row si premier pronostic du user, sinon update.
  await db
    .insert(userXpStates)
    .values({
      userId,
      predictionStreakCount: newStreak,
      predictionStreakLongest: newLongest,
      predictionLastDate: today,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userXpStates.userId,
      set: {
        predictionStreakCount: newStreak,
        predictionStreakLongest: newLongest,
        predictionLastDate: today,
        updatedAt: new Date(),
      },
    });

  const milestone = XP_REWARDS.STREAK_MILESTONES[newStreak];
  let bonusAwarded = 0;
  if (milestone) {
    bonusAwarded = milestone;
    await addXp({
      userId,
      amount: milestone,
      reason: 'prediction_streak',
      metadata: { milestone: newStreak },
    });
  }

  return { streak: newStreak, bonusAwarded };
}

/**
 * Cron daily : pour chaque marché, fetch close → upsert candle d'aujourd'hui
 * (+ resolve celle d'hier si pas encore résolue).
 *
 * Idempotent : si appelé plusieurs fois dans la même journée, ne dégrade
 * pas les données. La logique de résolution skip les déjà-résolues.
 *
 * Renvoie un résumé par marché pour faire un /admin/diagnostics propre.
 */
export interface DailyCronReport {
  market: MarketId;
  status: 'resolved' | 'opened' | 'skipped' | 'error';
  message?: string;
  predictionsResolved?: number;
  correctCount?: number;
}

export async function runDailyCron(): Promise<DailyCronReport[]> {
  const today = getParisDate();
  const reports: DailyCronReport[] = [];

  for (const market of MARKET_IDS) {
    try {
      const latest = await fetchLatestClose(market);
      if (!latest) {
        reports.push({
          market,
          status: 'error',
          message: 'no_close_from_yahoo',
        });
        continue;
      }

      // 1. Résoudre la candle d'aujourd'hui si elle existe encore et que
      //    le close vient de tomber. La candle d'aujourd'hui a openPrice
      //    = close d'hier ; closePrice est rempli ici si pas encore fait.
      const [todayCandle] = await db
        .select()
        .from(gameMarketCandles)
        .where(
          and(
            eq(gameMarketCandles.market, market),
            eq(gameMarketCandles.candleDate, today)
          )
        )
        .limit(1);

      if (todayCandle && !todayCandle.resolvedAt && latest.date === today) {
        // Le close du jour est dispo → résoudre
        const resolved = await resolveMarketDate(market, today, latest.close);
        reports.push({
          market,
          status: 'resolved',
          predictionsResolved: resolved.count,
          correctCount: resolved.correctCount,
        });
        continue;
      }

      // 2. Sinon, ouvrir la candle de demain (= jour suivant en Paris)
      //    avec openPrice = close du jour qu'on vient de fetcher.
      const nextDay = nextParisDate(today);
      await db
        .insert(gameMarketCandles)
        .values({
          market,
          candleDate: nextDay,
          openPrice: String(latest.close),
        })
        .onConflictDoNothing();

      reports.push({
        market,
        status: 'opened',
        message: `next=${nextDay} ref=${latest.close}`,
      });
    } catch (err) {
      reports.push({
        market,
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return reports;
}

/**
 * Résout toutes les prédictions d'un (marché, date) avec le closePrice fourni.
 * Update game_market_candles.closePrice + resolvedAt + game_predictions.
 * Attribue +50 XP par bonne réponse.
 */
async function resolveMarketDate(
  market: MarketId,
  date: string,
  closePrice: number
): Promise<{ count: number; correctCount: number }> {
  await db
    .update(gameMarketCandles)
    .set({
      closePrice: String(closePrice),
      resolvedAt: new Date(),
    })
    .where(
      and(
        eq(gameMarketCandles.market, market),
        eq(gameMarketCandles.candleDate, date)
      )
    );

  const preds = await db
    .select()
    .from(gamePredictions)
    .where(
      and(
        eq(gamePredictions.market, market),
        eq(gamePredictions.predictionDate, date),
        eq(gamePredictions.resolved, false)
      )
    );

  let correctCount = 0;
  for (const p of preds) {
    const open = Number(p.openPrice ?? 0);
    const close = closePrice;
    const wentUp = close > open;
    const isCorrect =
      (wentUp && p.direction === 'up') || (!wentUp && p.direction === 'down');

    const xp = isCorrect ? XP_REWARDS.PREDICTION_CORRECT : 0;
    await db
      .update(gamePredictions)
      .set({
        closePrice: String(closePrice),
        correct: isCorrect,
        resolved: true,
        resolvedAt: new Date(),
        xpAwarded: xp,
      })
      .where(eq(gamePredictions.id, p.id));

    if (isCorrect) {
      correctCount += 1;
      await addXp({
        userId: p.userId,
        amount: xp,
        reason: 'prediction_correct',
        metadata: {
          market,
          direction: p.direction,
          delta: close - open,
        },
      });
    }
  }

  return { count: preds.length, correctCount };
}

function nextParisDate(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return getParisDate(d);
}

/**
 * Historique des pronostics d'un user (récent en premier). Limité à `limit`.
 *
 * Renvoie [] si la table n'existe pas encore (migration 0019 en attente).
 */
export async function getUserPredictionHistory(
  userId: string,
  limit = 20
): Promise<
  Array<{
    id: string;
    market: MarketId;
    date: string;
    direction: PredictionDirection;
    correct: boolean | null;
    resolved: boolean;
    openPrice: number | null;
    closePrice: number | null;
    xpAwarded: number;
  }>
> {
  try {
    const rows = await db
      .select()
      .from(gamePredictions)
      .where(eq(gamePredictions.userId, userId))
      .orderBy(sql`${gamePredictions.predictionDate} desc, ${gamePredictions.createdAt} desc`)
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      market: r.market as MarketId,
      date: r.predictionDate,
      direction: r.direction as PredictionDirection,
      correct: r.correct,
      resolved: r.resolved,
      openPrice: r.openPrice ? Number(r.openPrice) : null,
      closePrice: r.closePrice ? Number(r.closePrice) : null,
      xpAwarded: r.xpAwarded,
    }));
  } catch (err) {
    console.warn('[predictions] history fallback (migration?)', err);
    return [];
  }
}
