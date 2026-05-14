/**
 * Logger structuré minimaliste, sans dépendance externe.
 *
 * En prod (Vercel) : sort en JSON sur stderr — facilement parsable par les
 * Vercel Logs et exploitable par Datadog/Logflare/etc.
 * En dev : format pretty colorisé pour la lecture humaine.
 *
 * Les erreurs (`logger.error`) sont automatiquement envoyées à Sentry si
 * configuré, avec préservation du context.
 *
 * Utilisation :
 *   import { logger } from '@/lib/logger';
 *
 *   logger.info('booking created', { bookingId, userId });
 *   logger.warn('rate limit hit', { ip });
 *   logger.error('payment webhook failed', err, { provider: 'paddle' });
 *
 * Ne JAMAIS logger : passwords, tokens, hashes Telegram, signatures HMAC,
 * card numbers. Pour les emails et IPs, masquer si possible.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const isProd = process.env.NODE_ENV === 'production';

function emit(level: Level, msg: string, context?: LogContext): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    msg,
    ...(context ?? {}),
  };

  if (isProd) {
    // JSON sur stderr pour warn/error, stdout sinon
    const out = level === 'error' || level === 'warn' ? console.error : console.log;
    out(JSON.stringify(entry));
  } else {
    const colors: Record<Level, string> = {
      debug: '\x1b[90m', // gray
      info: '\x1b[36m',  // cyan
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
    };
    const reset = '\x1b[0m';
    const tag = `${colors[level]}[${level.toUpperCase()}]${reset}`;
    const ctx = context ? ' ' + JSON.stringify(context) : '';
    const out = level === 'error' || level === 'warn' ? console.error : console.log;
    out(`${tag} ${msg}${ctx}`);
  }
}

/**
 * Capture une erreur vers Sentry (no-op si non configuré).
 * Chargement dynamique pour éviter de couler les pages sans Sentry.
 */
function captureToSentry(err: unknown, context?: LogContext): void {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  // Import dynamique pour ne pas peser sur les routes qui n'erreurent pas
  import('@sentry/nextjs')
    .then((Sentry) => {
      if (err instanceof Error) {
        Sentry.captureException(err, { extra: context });
      } else {
        Sentry.captureMessage(String(err), {
          level: 'error',
          extra: context,
        });
      }
    })
    .catch(() => {
      // Sentry indisponible — silencieux pour ne pas créer une cascade
    });
}

export const logger = {
  debug(msg: string, context?: LogContext): void {
    if (!isProd) emit('debug', msg, context);
  },

  info(msg: string, context?: LogContext): void {
    emit('info', msg, context);
  },

  warn(msg: string, context?: LogContext): void {
    emit('warn', msg, context);
  },

  /**
   * Log + capture Sentry. Si `err` est un Error, son message et stack sont
   * inclus automatiquement.
   */
  error(msg: string, err?: unknown, context?: LogContext): void {
    const fullContext: LogContext = { ...(context ?? {}) };
    if (err instanceof Error) {
      fullContext.error_name = err.name;
      fullContext.error_message = err.message;
      if (!isProd) fullContext.error_stack = err.stack;
    } else if (err !== undefined) {
      fullContext.error = String(err);
    }
    emit('error', msg, fullContext);
    captureToSentry(err ?? new Error(msg), context);
  },

  /**
   * Crée un logger enfant avec un context bindé. Utile pour les routes :
   *   const log = logger.child({ route: '/api/webhooks/paddle' });
   *   log.info('received');  // → { route, msg: 'received', ... }
   */
  child(bindContext: LogContext) {
    return {
      debug: (msg: string, c?: LogContext) =>
        logger.debug(msg, { ...bindContext, ...(c ?? {}) }),
      info: (msg: string, c?: LogContext) =>
        logger.info(msg, { ...bindContext, ...(c ?? {}) }),
      warn: (msg: string, c?: LogContext) =>
        logger.warn(msg, { ...bindContext, ...(c ?? {}) }),
      error: (msg: string, err?: unknown, c?: LogContext) =>
        logger.error(msg, err, { ...bindContext, ...(c ?? {}) }),
    };
  },
};
