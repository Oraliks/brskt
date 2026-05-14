import type { Context } from 'grammy';
import { getBotFeatures, type BotFeatures } from '@/lib/settings/bot-features';

/**
 * Garde qui vérifie qu'une feature bot est activée. Si désactivée,
 * répond à l'user "feature temporairement désactivée" et retourne false.
 *
 * Pattern d'usage dans une bot.command :
 *   bot.command('quiz', async (ctx) => {
 *     if (!(await requireFeature(ctx, 'quiz'))) return;
 *     // ... logique normale
 *   });
 *
 * Le check est cheap (un seul SELECT app_settings cached par Postgres),
 * mais on peut éventuellement ajouter un cache mémoire si ça devient
 * un bottleneck.
 */
export async function requireFeature(
  ctx: Context,
  feature: keyof BotFeatures
): Promise<boolean> {
  const features = await getBotFeatures();
  if (features[feature]) return true;

  await ctx.reply(
    `⚠️ Cette fonctionnalité est temporairement désactivée par l'admin.\n\n` +
      `Réessaye plus tard ou contacte @boursi_support si urgent.`
  );
  return false;
}
