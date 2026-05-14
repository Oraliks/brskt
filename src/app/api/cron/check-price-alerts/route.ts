import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { priceAlerts, users } from '@/lib/db/schema';
import { lookupQuote } from '@/lib/bot/inline-quotes';
import { sendDirectMessage } from '@/lib/telegram/helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON toutes les 5 min : check les alertes actives, ping le user quand
 * le seuil est franchi.
 *
 * Stratégie :
 *  1. Liste toutes les alertes non-déclenchées
 *  2. Groupe par symbol (pour limiter les hits API)
 *  3. Pour chaque symbol unique, fetch le prix actuel
 *  4. Pour chaque alerte du groupe, compare au seuil
 *  5. Si déclenchée → DM user + set triggeredAt
 *
 * À configurer dans vercel.json :
 *   { "path": "/api/cron/check-price-alerts", "schedule": "*\/5 * * * *" }
 *
 * Note Vercel Hobby : limite à 1 cron quotidien max. Pour /5min faut Pro.
 * En dev/Hobby : déclencher manuellement ou via un service externe (UptimeRobot).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { getBotFeatures } = await import('@/lib/settings/bot-features');
  const features = await getBotFeatures();
  if (!features.priceAlerts) {
    return Response.json({
      success: true,
      message: 'Price alerts désactivées par admin (toggle off)',
      checked: 0,
    });
  }

  // 1. Liste alertes actives
  const active = await db
    .select({
      id: priceAlerts.id,
      userId: priceAlerts.userId,
      symbol: priceAlerts.symbol,
      source: priceAlerts.source,
      threshold: priceAlerts.threshold,
      direction: priceAlerts.direction,
      telegramId: users.telegramId,
    })
    .from(priceAlerts)
    .innerJoin(users, eq(users.id, priceAlerts.userId))
    .where(isNull(priceAlerts.triggeredAt));

  if (active.length === 0) {
    return Response.json({ success: true, checked: 0 });
  }

  // 2. Groupe par symbol (le source est déduit par lookupQuote)
  const bySymbol = new Map<string, typeof active>();
  for (const a of active) {
    const existing = bySymbol.get(a.symbol) ?? [];
    existing.push(a);
    bySymbol.set(a.symbol, existing);
  }

  const results = {
    checked: active.length,
    triggered: 0,
    errors: 0,
    apiCalls: bySymbol.size,
  };

  // 3+4. Fetch chaque symbol et compare
  for (const [symbol, alerts] of bySymbol.entries()) {
    try {
      const quote = await lookupQuote(symbol);
      if (!quote) {
        console.warn(`[price-alerts] no quote for ${symbol}`);
        continue;
      }

      const currentPrice =
        quote.type === 'fx' ? quote.rate : quote.priceUsd;

      for (const alert of alerts) {
        const threshold = Number(alert.threshold);
        const triggered =
          (alert.direction === 'above' && currentPrice >= threshold) ||
          (alert.direction === 'below' && currentPrice <= threshold);

        if (!triggered) continue;

        // 5. Marque l'alerte comme triggered + DM user
        await db
          .update(priceAlerts)
          .set({ triggeredAt: new Date() })
          .where(eq(priceAlerts.id, alert.id));

        if (alert.telegramId) {
          const arrow = alert.direction === 'above' ? '🔼' : '🔽';
          const priceFormatted =
            currentPrice < 10
              ? currentPrice.toFixed(5)
              : currentPrice < 1000
              ? currentPrice.toFixed(2)
              : currentPrice.toLocaleString('fr-FR', {
                  maximumFractionDigits: 0,
                });

          await sendDirectMessage(
            Number(alert.telegramId),
            `🔔 <b>Alerte ${symbol} déclenchée</b>\n\n` +
              `Prix actuel : <b>${priceFormatted}</b>\n` +
              `Seuil ${arrow} : <b>${alert.threshold}</b>\n\n` +
              `<i>L'alerte est désactivée — recréée si besoin avec ` +
              `/alert ${symbol} &lt;nouveau seuil&gt; ${alert.direction}</i>`,
            { disableWebPreview: true }
          );
        }

        results.triggered++;
      }
    } catch (err) {
      console.error(`[price-alerts] error for ${symbol}`, err);
      results.errors++;
    }
  }

  return Response.json({
    success: true,
    ...results,
  });
}
