import { and, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { economicEvents } from '@/lib/db/schema';
import { fetchForexFactoryWeekly } from '@/lib/economic-calendar';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON quotidien : fetch le calendrier ForexFactory et upsert les events
 * de la semaine en cours dans `economic_events`.
 *
 * Idempotent : pour éviter les doublons sans modifier le schema, on
 * vérifie l'existence d'un event ayant le même `name + eventAt` avant
 * d'insérer.
 *
 * Une fois la table peuplée, le CRON existant `check-economic-alerts`
 * (toutes les 30 min) prend le relais et notifie les users opt-in.
 *
 * Vercel cron : "0 1 * * *" (1h UTC, après que ForexFactory ait publié sa
 * mise à jour du jour)
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { getBotFeatures } = await import('@/lib/settings/bot-features');
  const features = await getBotFeatures();
  if (!features.economicAlerts) {
    return Response.json({
      success: true,
      skipped: 'economicAlerts disabled',
    });
  }

  let raw;
  try {
    raw = await fetchForexFactoryWeekly();
  } catch (err) {
    logger.error('[sync-economic-events] fetch failed', err);
    return Response.json(
      { success: false, error: 'fetch_failed' },
      { status: 502 }
    );
  }

  // Filtre : on garde uniquement les events HIGH/MEDIUM impact avec une heure
  // précise (pas "All Day"/"Tentative") et dans le futur.
  // Les low impact sont trop nombreux et polluent les notifs.
  const now = new Date();
  const candidates = raw.filter(
    (e) =>
      e.eventAtUtc !== null &&
      e.eventAtUtc > now &&
      (e.impact === 'high' || e.impact === 'medium')
  );

  if (candidates.length === 0) {
    return Response.json({
      success: true,
      fetched: raw.length,
      kept: 0,
      inserted: 0,
    });
  }

  // Récupère tous les events futurs déjà en DB pour déduplication.
  // Clé de dedup : `${name}__${eventAtUtc.toISOString()}`.
  const futureWindowEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const existing = await db.query.economicEvents.findMany({
    where: and(
      gte(economicEvents.eventAt, now),
      lte(economicEvents.eventAt, futureWindowEnd)
    ),
    columns: { name: true, eventAt: true },
  });

  const existingKeys = new Set(
    existing.map((e) => `${e.name}__${e.eventAt.toISOString()}`)
  );

  const toInsert = candidates
    .filter((c) => {
      if (!c.eventAtUtc) return false;
      const key = `${c.title}__${c.eventAtUtc.toISOString()}`;
      return !existingKeys.has(key);
    })
    .map((c) => ({
      name: c.title,
      currency: c.currency,
      impact: c.impact,
      eventAt: c.eventAtUtc!,
      notes: c.notes,
    }));

  if (toInsert.length === 0) {
    return Response.json({
      success: true,
      fetched: raw.length,
      kept: candidates.length,
      inserted: 0,
      message: 'all events already in DB',
    });
  }

  await db.insert(economicEvents).values(toInsert);

  logger.info('[sync-economic-events] sync OK', {
    fetched: raw.length,
    kept: candidates.length,
    inserted: toInsert.length,
  });

  return Response.json({
    success: true,
    fetched: raw.length,
    kept: candidates.length,
    inserted: toInsert.length,
  });
}
