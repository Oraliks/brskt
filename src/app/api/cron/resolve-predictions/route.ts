import crypto from 'node:crypto';
import { runDailyCron } from '@/lib/games/predictions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON quotidien — résout les pronostics du jour & ouvre le suivant.
 *
 * Pour chaque marché (Nasdaq, Dow, Or, WTI, GER40) :
 *  1. Fetch le close le plus récent via Yahoo Finance
 *  2. Si le close correspond à aujourd'hui Paris time et que la candle
 *     du jour n'est pas résolue → résoudre (calculer correct/incorrect,
 *     attribuer XP, marquer resolved)
 *  3. Sinon, ouvrir la candle du lendemain avec openPrice = ce close
 *
 * Schedule conseillé (`vercel.json`) :
 *   { "path": "/api/cron/resolve-predictions", "schedule": "30 22 * * *" }
 *   22h30 UTC ≈ 23h30 Paris l'hiver, 00h30 Paris l'été — après la
 *   clôture US dans tous les cas.
 *
 * Idempotent : peut être appelé plusieurs fois sans dégrader les données.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;

  // Timing-safe compare : évite l'attaque temporelle qui révèlerait des
  // caractères du secret. Convertir en Buffer de même longueur sinon
  // timingSafeEqual throw.
  const a = Buffer.from(authHeader.padEnd(expected.length, ' ').slice(0, expected.length));
  const b = Buffer.from(expected);
  if (!process.env.CRON_SECRET || !crypto.timingSafeEqual(a, b)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const reports = await runDailyCron();
  const durationMs = Date.now() - startedAt;

  return Response.json({
    success: true,
    durationMs,
    reports,
  });
}
