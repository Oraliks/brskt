import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',

    // 10% en prod, 100% ailleurs — on n'a pas besoin de traces sur chaque requête
    tracesSampleRate: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ? 0.1 : 1.0,

    // Session replay : utile pour debug les bugs UI critiques
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,

    integrations: [Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false })],

    // Erreurs à ignorer (bruit navigateur)
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      // Extensions Chrome
      /chrome-extension/i,
      /moz-extension/i,
    ],

    beforeSend(event) {
      // Pas de PII dans les breadcrumbs/contexts par défaut
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}
