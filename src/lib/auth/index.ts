/**
 * Auth Boursikotons : Telegram-only via login widget signé HMAC.
 *
 * - /api/auth/telegram : route POST appelée par le widget, crée user+session
 * - /lib/auth/server.ts : helpers Server Components (getSession, requireAuth…)
 * - /lib/actions/auth.ts : logoutAction
 * - /lib/auth/telegram-plugin.ts : utilitaire verifyTelegramHash (HMAC-SHA256)
 *
 * On n'utilise pas better-auth runtime — sa configuration est trop opinionnée
 * autour du flow email/password. On a juste réutilisé ses noms de tables
 * (`users`, `sessions`, `accounts`) pour conserver une compatibilité future.
 */

export {
  getSession,
  requireAuth,
  requireAdmin,
  requireOnboarded,
  type AppSession,
} from './server';

export { verifyTelegramHash } from './telegram-plugin';
