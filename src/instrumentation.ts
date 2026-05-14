/**
 * Next.js instrumentation hook — appelé une fois par cold start côté serveur.
 * On y branche Sentry (server + edge runtime).
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

/**
 * Hook Next.js 15+ : capture les erreurs émises par les Server Components,
 * Server Actions, route handlers. Charge Sentry dynamiquement pour ne pas
 * couler les requêtes quand le DSN n'est pas configuré.
 */
export async function onRequestError(
  err: unknown,
  request: Request,
  context: { routerKind: string; routePath: string; routeType: string }
) {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(err, {
      tags: {
        runtime: process.env.NEXT_RUNTIME ?? 'unknown',
        routerKind: context.routerKind,
        routeType: context.routeType,
      },
      extra: {
        routePath: context.routePath,
        url: request.url,
      },
    });
  } catch {
    // Sentry indisponible — best-effort
  }
}
