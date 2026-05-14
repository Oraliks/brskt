/**
 * Fetch les quotes pour le ticker live du dashboard.
 *
 * Source : Yahoo Finance API publique (pas d'API key, gratuit).
 *   https://query1.finance.yahoo.com/v8/finance/chart/<symbol>
 *
 * Yahoo n'a pas d'API officielle documentée mais cet endpoint est utilisé
 * par leur propre frontend → stable de facto. Si ça casse un jour, on
 * peut switcher vers Finnhub (60 req/min gratuit avec API key) ou
 * Twelve Data sans changer l'interface publique.
 *
 * Best-effort : si un symbol échoue, on renvoie le placeholder pour celui-là
 * et on continue avec les autres. Jamais throw vers le caller.
 */

export interface MarketQuote {
  /** Symbole d'affichage (court). */
  symbol: string;
  /** Label long, ex. "S&P 500". */
  name: string;
  /** Prix actuel formaté en string (locale fr). */
  price: string;
  /** Variation en pourcentage formatée, ex. "+0.34%". null si indispo. */
  deltaPct: string | null;
  /** true = hausse, false = baisse. null si pas de delta. */
  up: boolean | null;
  /** ISO timestamp de la dernière màj côté Yahoo. */
  asOf: string;
}

interface Instrument {
  /** Symbole Yahoo Finance, ex. "^GSPC" pour S&P 500. */
  yahoo: string;
  /** Symbole court à afficher dans le ticker. */
  display: string;
  /** Nom long pour aria-label / tooltips. */
  name: string;
  /** Format du prix (nombre de décimales). */
  decimals: number;
}

const INSTRUMENTS: Instrument[] = [
  { yahoo: '^DJI', display: 'DOW', name: 'Dow Jones', decimals: 0 },
  { yahoo: '^IXIC', display: 'NASDAQ', name: 'Nasdaq Composite', decimals: 0 },
  { yahoo: '^GSPC', display: 'S&P500', name: 'S&P 500', decimals: 0 },
  { yahoo: '^VIX', display: 'VIX', name: 'Volatility Index', decimals: 2 },
  { yahoo: '^GDAXI', display: 'GER40', name: 'DAX', decimals: 0 },
  { yahoo: '^FCHI', display: 'FRA40', name: 'CAC 40', decimals: 0 },
  { yahoo: '^FTSE', display: 'UK100', name: 'FTSE 100', decimals: 0 },
  { yahoo: '^N225', display: 'JP225', name: 'Nikkei 225', decimals: 0 },
  { yahoo: 'GC=F', display: 'GOLD', name: 'Gold Futures', decimals: 2 },
  { yahoo: 'CL=F', display: 'WTI', name: 'Crude Oil WTI', decimals: 2 },
  { yahoo: 'BTC-USD', display: 'BTC', name: 'Bitcoin', decimals: 0 },
];

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
        currency?: string;
      };
    }>;
    error?: { description?: string } | null;
  };
}

async function fetchYahooQuote(
  instrument: Instrument
): Promise<MarketQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    instrument.yahoo
  )}?interval=1d&range=1d`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        // Yahoo bloque les user-agents par défaut Node fetch
        'user-agent':
          'Mozilla/5.0 (compatible; Boursikotons-Ticker/1.0; +https://boursikotons.com)',
        accept: 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as YahooChartResponse;
    const result = data.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta?.regularMarketPrice) return null;

    const price = meta.regularMarketPrice;
    const previous = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const deltaPctNum = previous > 0 ? ((price - previous) / previous) * 100 : 0;

    return {
      symbol: instrument.display,
      name: instrument.name,
      price: formatPrice(price, instrument.decimals),
      deltaPct: formatDelta(deltaPctNum),
      up: deltaPctNum >= 0,
      asOf: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch toutes les quotes en parallèle. Si un symbol échoue, on renvoie un
 * fallback "—" pour celui-là — le ticker reste fluide.
 *
 * Renvoie toujours dans le même ordre que INSTRUMENTS.
 */
export async function fetchMarketQuotes(): Promise<MarketQuote[]> {
  const results = await Promise.allSettled(
    INSTRUMENTS.map((inst) => fetchYahooQuote(inst))
  );

  return results.map((r, i) => {
    const inst = INSTRUMENTS[i]!;
    if (r.status === 'fulfilled' && r.value) {
      return r.value;
    }
    // Fallback : on affiche le symbole mais pas de prix
    return {
      symbol: inst.display,
      name: inst.name,
      price: '—',
      deltaPct: null,
      up: null,
      asOf: new Date().toISOString(),
    };
  });
}

function formatPrice(value: number, decimals: number): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDelta(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}
