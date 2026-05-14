/**
 * Compteur de membres du canal Telegram public.
 *
 * Affiché sur le dashboard et la landing pour donner une preuve sociale réelle
 * (pas la table `vip_applications`, qui est interne et incomplète).
 *
 * Caching :
 *  - In-memory 10 min : suffit pour un trafic modéré sur Vercel (chaque
 *    cold start refera l'appel mais ça reste minime côté Telegram API).
 *  - Fallback : si le call échoue OU si la var d'env n'est pas configurée,
 *    on renvoie null — caller doit gérer ce cas (ex: ne pas afficher).
 *
 * Config :
 *  - `TELEGRAM_CHANNEL_ID` (chat_id numérique) OU
 *  - `TELEGRAM_CHANNEL_USERNAME` (@nomcanal, pour les canaux publics)
 */

import { getBot } from './bot';

interface CachedCount {
  value: number;
  cachedAt: number;
}

let cache: CachedCount | null = null;
const TTL_MS = 10 * 60 * 1000;

function getChannelTarget(): number | string | null {
  const id = process.env.TELEGRAM_CHANNEL_ID?.trim();
  if (id) {
    const num = Number(id);
    return Number.isFinite(num) ? num : null;
  }
  const username = process.env.TELEGRAM_CHANNEL_USERNAME?.trim();
  if (username) {
    return username.startsWith('@') ? username : `@${username}`;
  }
  return null;
}

/**
 * Renvoie le nombre de membres du canal. `null` si pas configuré ou API down.
 * Toujours best-effort, jamais throw.
 */
export async function getChannelMemberCount(): Promise<number | null> {
  const now = Date.now();
  if (cache && now - cache.cachedAt < TTL_MS) {
    return cache.value;
  }

  const target = getChannelTarget();
  if (target === null) return null;

  try {
    const bot = getBot();
    const count = await bot.api.getChatMemberCount(target);
    cache = { value: count, cachedAt: now };
    return count;
  } catch (err) {
    console.error('[community-stats] getChatMemberCount failed', err);
    // Garde l'ancien cache même expiré plutôt que de remonter null
    if (cache) return cache.value;
    return null;
  }
}
