/**
 * Helpers pour le mode inline du bot : récupérer un quote FX ou crypto
 * et le formater pour partage dans n'importe quel chat Telegram.
 *
 * APIs utilisées :
 *  - Frankfurter (FX, ECB rates, gratuit sans clé)
 *  - CoinGecko (crypto, gratuit sans clé pour usage léger)
 */

interface QuoteFX {
  type: 'fx';
  pair: string; // ex. EURUSD
  rate: number;
  date: string; // YYYY-MM-DD
}

interface QuoteCrypto {
  type: 'crypto';
  symbol: string; // ex. BTC
  name: string;
  priceUsd: number;
  change24h: number; // en %
}

export type Quote = QuoteFX | QuoteCrypto;

/**
 * Cherche un quote pour une query. Heuristique :
 *  - 6 chars [A-Z]{6} → tente FX (EURUSD, GBPJPY...)
 *  - Sinon → tente crypto (BTC, ETH, SOL...) par symbol
 */
export async function lookupQuote(query: string): Promise<Quote | null> {
  const upper = query.trim().toUpperCase().replace(/[/\s]/g, '');
  if (!upper) return null;

  // Format FX 6 chars
  if (/^[A-Z]{6}$/.test(upper)) {
    const fx = await fetchFxRate(upper.slice(0, 3), upper.slice(3));
    if (fx) return fx;
  }

  // Tente crypto (3-5 chars usuellement)
  if (/^[A-Z]{2,8}$/.test(upper)) {
    const crypto = await fetchCryptoQuote(upper);
    if (crypto) return crypto;
  }

  return null;
}

async function fetchFxRate(
  from: string,
  to: string
): Promise<QuoteFX | null> {
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`,
      { cache: 'no-store', signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      rates?: Record<string, number>;
      date?: string;
    };
    const rate = json.rates?.[to];
    if (rate === undefined) return null;
    return {
      type: 'fx',
      pair: `${from}${to}`,
      rate,
      date: json.date ?? new Date().toISOString().slice(0, 10),
    };
  } catch {
    return null;
  }
}

// CoinGecko : on cherche d'abord l'ID via la liste cachée (ou pré-mappée pour
// les top symbols). Pour MVP, on hardcode les ~30 cryptos majeures.
const CRYPTO_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  TRX: 'tron',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  ATOM: 'cosmos',
  XLM: 'stellar',
  ETC: 'ethereum-classic',
  XMR: 'monero',
  ALGO: 'algorand',
  USDT: 'tether',
  USDC: 'usd-coin',
  DAI: 'dai',
  TON: 'the-open-network',
  SHIB: 'shiba-inu',
  PEPE: 'pepe',
  ARB: 'arbitrum',
  OP: 'optimism',
  NEAR: 'near',
  APT: 'aptos',
  SUI: 'sui',
};

async function fetchCryptoQuote(symbol: string): Promise<QuoteCrypto | null> {
  const id = CRYPTO_MAP[symbol];
  if (!id) return null;

  try {
    const url =
      `https://api.coingecko.com/api/v3/simple/price` +
      `?ids=${id}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<
      string,
      { usd: number; usd_24h_change?: number }
    >;
    const data = json[id];
    if (!data) return null;
    return {
      type: 'crypto',
      symbol,
      name: capitalize(id.replace(/-/g, ' ')),
      priceUsd: data.usd,
      change24h: data.usd_24h_change ?? 0,
    };
  } catch {
    return null;
  }
}

function capitalize(s: string): string {
  return s
    .split(' ')
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

/**
 * Formate un quote en message HTML partageable.
 * Retourne { title, description, message } prêts à mettre dans un
 * inline_query_result_article.
 */
export function formatQuote(q: Quote): {
  title: string;
  description: string;
  message: string;
} {
  if (q.type === 'fx') {
    const formatted = q.rate < 10 ? q.rate.toFixed(5) : q.rate.toFixed(2);
    return {
      title: `💱 ${q.pair} : ${formatted}`,
      description: `Taux ECB live · ${q.date}`,
      message:
        `💱 <b>${q.pair}</b>\n` +
        `Taux : <b>${formatted}</b>\n` +
        `Source : ECB · ${q.date}\n\n` +
        `<i>via @boursikotonsbot</i>`,
    };
  }

  const arrow = q.change24h >= 0 ? '📈' : '📉';
  const sign = q.change24h >= 0 ? '+' : '';
  const priceFormatted = q.priceUsd < 1
    ? q.priceUsd.toFixed(6)
    : q.priceUsd < 1000
    ? q.priceUsd.toFixed(2)
    : q.priceUsd.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  return {
    title: `${arrow} ${q.symbol} : $${priceFormatted}`,
    description: `${q.name} · ${sign}${q.change24h.toFixed(2)}% (24h)`,
    message:
      `${arrow} <b>${q.symbol}</b> (${q.name})\n` +
      `Prix : <b>$${priceFormatted}</b>\n` +
      `24h : <b>${sign}${q.change24h.toFixed(2)}%</b>\n\n` +
      `<i>via @boursikotonsbot</i>`,
  };
}
