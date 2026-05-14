import { fetchMarketQuotes } from '@/lib/market-quotes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 60s : suffisant pour ne pas spam Yahoo, mais le user voit du frais.
export const revalidate = 60;

/**
 * Endpoint public utilisé par le LiveTicker du dashboard.
 *
 * Renvoie les quotes pour 11 instruments (indices, FX, commodities, BTC).
 * Cache 60s côté CDN Vercel via header. Pas d'auth — c'est de la donnée
 * publique de marché.
 */
export async function GET() {
  const quotes = await fetchMarketQuotes();

  return Response.json(
    { quotes, fetchedAt: new Date().toISOString() },
    {
      headers: {
        // CDN cache 60s, stale-while-revalidate 5min pour servir vite même
        // si la prochaine fetch est en cours.
        'cache-control':
          'public, s-maxage=60, stale-while-revalidate=300',
      },
    }
  );
}
