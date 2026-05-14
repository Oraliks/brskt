import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Health check public — utilisable par les services de monitoring externes
 * (UptimeRobot, Better Uptime, etc.).
 *
 * Renvoie 200 si :
 *  - L'application répond
 *  - La DB Postgres est joignable (SELECT 1)
 *
 * Renvoie 503 si la DB est down. Le status est calculé en moins de 5s
 * (timeout DB explicite) pour ne pas bloquer les checks externes.
 *
 * Volontairement minimal : pas d'info sensible sur le déploiement (commit sha,
 * version, env name) pour éviter de leak.
 */
export async function GET() {
  const startedAt = Date.now();

  let dbOk = false;
  let dbError: string | null = null;

  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('db timeout')), 5000)
      ),
    ]);
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'unknown';
  }

  const tookMs = Date.now() - startedAt;
  const status = dbOk ? 'ok' : 'degraded';
  const httpStatus = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      checks: {
        db: dbOk ? 'ok' : `down: ${dbError}`,
      },
      tookMs,
      timestamp: new Date().toISOString(),
    },
    { status: httpStatus, headers: { 'cache-control': 'no-store' } }
  );
}
