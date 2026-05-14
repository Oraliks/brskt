/**
 * Rate limiting via Postgres (table `rate_limits`).
 *
 * Sliding window simple : pour une clé donnée, on stocke un compteur et
 * la date de début de fenêtre. À chaque appel :
 *  - Si la fenêtre est expirée → reset à 1, redémarre la fenêtre.
 *  - Sinon → incrémente le compteur.
 * Le tout en un seul INSERT ... ON CONFLICT atomique côté SQL.
 *
 * Trade-off vs Redis :
 *  - + Aucune dépendance externe, persistent entre cold starts
 *  - − Latence ~5-20ms par check (vs ~1ms Redis) — non bloquant ici car
 *    on protège des endpoints à faible vélocité (auth, Server Actions).
 *
 * Cleanup : les vieilles entrées sont supprimées par cleanupRateLimits().
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export interface RateLimitResult {
  /** True si la requête peut passer, false si bloquée. */
  allowed: boolean;
  /** Nombre d'appels effectués dans la fenêtre courante (incluant celui-ci). */
  count: number;
  /** Limite configurée. */
  limit: number;
  /** Secondes restantes avant que la fenêtre ne soit reset. */
  resetIn: number;
}

interface CheckOpts {
  /**
   * Clé unique identifiant le bucket (ex. `auth_tg:ip:1.2.3.4`).
   * Garder court — c'est une PK Postgres.
   */
  key: string;
  /** Nombre max d'appels autorisés dans la fenêtre. */
  limit: number;
  /** Durée de la fenêtre en secondes. */
  windowSec: number;
}

/**
 * Vérifie et incrémente le compteur pour la clé donnée.
 * Atomique (un seul INSERT ... ON CONFLICT côté Postgres).
 *
 * Retourne `{ allowed: false }` si la limite est dépassée. Si l'appel à la
 * DB échoue (réseau, etc.), on fail-OPEN : on autorise plutôt que de bloquer
 * les users légitimes. Logger l'erreur côté caller si besoin.
 */
export async function checkRateLimit(opts: CheckOpts): Promise<RateLimitResult> {
  const { key, limit, windowSec } = opts;

  try {
    // Upsert atomique :
    // - si la fenêtre est expirée (window_started_at < NOW - windowSec), reset à 1
    // - sinon, incrémente count
    // postgres-js driver renvoie le résultat comme un array-like (pas {rows}).
    const rows = (await db.execute<{
      count: number;
      window_started_at: Date;
    }>(sql`
      INSERT INTO rate_limits (key, count, window_started_at, updated_at)
      VALUES (${key}, 1, NOW(), NOW())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_started_at < NOW() - (${windowSec}::int * INTERVAL '1 second')
          THEN 1
          ELSE rate_limits.count + 1
        END,
        window_started_at = CASE
          WHEN rate_limits.window_started_at < NOW() - (${windowSec}::int * INTERVAL '1 second')
          THEN NOW()
          ELSE rate_limits.window_started_at
        END,
        updated_at = NOW()
      RETURNING count, window_started_at
    `)) as unknown as Array<{ count: number; window_started_at: Date | string }>;

    const row = rows[0];
    if (!row) {
      // Pas possible en théorie (INSERT ou UPDATE renvoie toujours 1 row)
      return { allowed: true, count: 1, limit, resetIn: windowSec };
    }

    const count = Number(row.count);
    const startedAt =
      row.window_started_at instanceof Date
        ? row.window_started_at
        : new Date(row.window_started_at);
    const elapsed = (Date.now() - startedAt.getTime()) / 1000;
    const resetIn = Math.max(0, Math.ceil(windowSec - elapsed));

    return {
      allowed: count <= limit,
      count,
      limit,
      resetIn,
    };
  } catch (err) {
    // Fail-open : on log mais on autorise (mieux que de bloquer tout le monde
    // si Supabase est down).
    console.error('[rate-limit] check failed, failing OPEN', { key, err });
    return { allowed: true, count: 0, limit, resetIn: windowSec };
  }
}

/**
 * Extrait l'IP du client depuis une Request (Vercel/Next.js).
 * Fallback sur '0.0.0.0' si rien trouvé — ne devrait pas arriver en prod.
 */
export function getClientIp(request: Request): string {
  // Vercel : x-forwarded-for est mis automatiquement, premier IP = client réel
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return '0.0.0.0';
}

/**
 * Cleanup des entrées expirées (à appeler depuis un CRON).
 * Supprime tout ce qui est plus vieux que 1 jour — largement plus que les
 * fenêtres typiques (10 min - 1 h).
 */
export async function cleanupRateLimits(): Promise<number> {
  const rows = (await db.execute<{ count: string }>(sql`
    WITH deleted AS (
      DELETE FROM rate_limits
      WHERE window_started_at < NOW() - INTERVAL '1 day'
      RETURNING 1
    )
    SELECT COUNT(*)::text as count FROM deleted
  `)) as unknown as Array<{ count: string }>;
  return Number(rows[0]?.count ?? 0);
}
