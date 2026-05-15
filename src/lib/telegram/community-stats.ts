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
 * Renvoie le nombre de membres du canal.
 *
 * Priorité (du plus fort au plus faible) :
 *  1. Override manuel admin (app_settings.community_count_override.enabled)
 *  2. API Telegram getChatMemberCount (si bot membre/admin du canal)
 *  3. null (caller décide de ne rien afficher)
 *
 * Best-effort, jamais throw.
 */
export async function getChannelMemberCount(): Promise<number | null> {
  // 1. Override admin manuel — court-circuit total
  try {
    const { getCommunityCountOverride } = await import(
      '@/lib/settings/community-count'
    );
    const override = await getCommunityCountOverride();
    if (override.enabled && override.value > 0) {
      return override.value;
    }
  } catch (err) {
    console.error('[community-stats] override lookup failed', err);
    // continue vers l'API
  }

  // 2. Cache mémoire pour éviter de spammer Telegram
  const now = Date.now();
  if (cache && now - cache.cachedAt < TTL_MS) {
    return cache.value;
  }

  const target = getChannelTarget();
  if (target === null) return null;

  try {
    const bot = getBot();
    // Hard timeout 4s : si Telegram ne répond pas (channel invalide, bot pas
    // membre, network slow), on bail rapidement plutôt que de bloquer la
    // Vercel function. grammY peut retry indéfiniment en interne, donc on
    // race contre un setTimeout pour garantir un retour rapide.
    const count = await Promise.race<number>([
      bot.api.getChatMemberCount(target),
      new Promise<number>((_, reject) =>
        setTimeout(
          () => reject(new Error('getChatMemberCount timeout (4s)')),
          4000
        )
      ),
    ]);
    cache = { value: count, cachedAt: now };
    return count;
  } catch (err) {
    console.error('[community-stats] getChatMemberCount failed', err);
    if (cache) return cache.value;
    return null;
  }
}
