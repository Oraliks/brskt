import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',

    tracesSampleRate: process.env.VERCEL_ENV === 'production' ? 0.1 : 1.0,

    // Ignore les erreurs qui sont juste du bruit côté serveur
    ignoreErrors: [
      // 404 sur des routes admin (security through obscurity, on les déclenche volontairement)
      /NEXT_NOT_FOUND/,
    ],
  });
}
