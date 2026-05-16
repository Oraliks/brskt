import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;
const isProd = process.env.VERCEL_ENV === 'production';

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',

    tracesSampleRate: isProd ? 0.1 : 1.0,

    /**
     * Tagging par défaut pour faciliter le filtrage dans le dashboard
     * Sentry. On peut ensuite créer des alertes sur :
     *  - tag area:webhooks AND level:error → alert paiements cassés
     *  - tag area:cron AND level:error → alert CRON failures
     *  - tag area:auth AND level:error → alert flow login cassé
     */
    initialScope: {
      tags: {
        runtime: 'nodejs',
      },
    },

    /**
     * Filtre les erreurs sans intérêt avant l'envoi.
     * - 404 (NEXT_NOT_FOUND) : volontaire pour security through obscurity
     * - Connections fermées brutalement (client a fermé l'onglet)
     * - Erreurs réseau externes transitoires
     */
    ignoreErrors: [
      /NEXT_NOT_FOUND/,
      /ECONNRESET/,
      /ETIMEDOUT/,
      // Coupures réseau côté client (l'utilisateur ferme l'onglet pendant
      // une requête) — pas notre faute.
      /ResponseAborted/,
      // Erreurs d'imports retry chunk (Vercel deploy en cours)
      /ChunkLoadError/,
    ],

    beforeSend(event, hint) {
      // En dev, on log dans la console mais on n'envoie pas à Sentry
      // (réduit le bruit dans le dashboard prod).
      if (!isProd) {
        console.error('[sentry/dev]', hint.originalException ?? event);
        return null;
      }
      return event;
    },
  });
}

/**
 * Helper : taguer une erreur avec une "area" pour faciliter le routing
 * vers les bonnes alertes Sentry. À utiliser dans les catch blocs des
 * webhooks, CRONs, ou auth flows.
 *
 * Exemple :
 *   captureWithArea(err, 'webhooks', { provider: 'paddle', eventId });
 */
export function captureWithArea(
  err: unknown,
  area: 'webhooks' | 'cron' | 'auth' | 'payments' | 'bot' | 'admin',
  extra?: Record<string, unknown>
): void {
  Sentry.captureException(err, {
    tags: { area },
    extra,
    level: 'error',
  });
}
