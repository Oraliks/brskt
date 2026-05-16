/**
 * Catalogue des 5 marchés disponibles pour le mini-jeu pronostic.
 *
 * Choix : trois Américains qui parlent à tout le monde (Nasdaq, Dow, WTI),
 * un européen liquide (DAX/GER40), et l'or qui anime les nuits.
 *
 * `yahooSymbol` est utilisé par `fetchDailyCandle()` pour interroger
 * `query1.finance.yahoo.com`. Symboles index futures (=F) pour avoir des
 * données 24/5 plutôt que cash limité aux heures d'ouverture.
 */
export type MarketId = 'nasdaq' | 'dowjones' | 'gold' | 'wti' | 'ger40';

export interface MarketMeta {
  id: MarketId;
  /** Nom court affiché dans l'UI. */
  label: string;
  /** Description courte (1 ligne) pour le hover/aide. */
  description: string;
  /** Emoji ou pictogramme. */
  icon: string;
  /** Symbole Yahoo Finance (https://finance.yahoo.com/quote/...). */
  yahooSymbol: string;
  /** Couleur thématique (Tailwind utility). */
  accentClass: string;
}

export const MARKETS: Record<MarketId, MarketMeta> = {
  nasdaq: {
    id: 'nasdaq',
    label: 'Nasdaq 100',
    description: 'Indice tech US (NQ=F future)',
    icon: '💻',
    yahooSymbol: 'NQ=F',
    accentClass: 'text-indigo-300',
  },
  dowjones: {
    id: 'dowjones',
    label: 'Dow Jones',
    description: 'Indice industriel US (YM=F future)',
    icon: '🏛️',
    yahooSymbol: 'YM=F',
    accentClass: 'text-amber-200',
  },
  gold: {
    id: 'gold',
    label: 'Or',
    description: 'XAU/USD spot — valeur refuge',
    icon: '🥇',
    yahooSymbol: 'GC=F',
    accentClass: 'text-yellow-300',
  },
  wti: {
    id: 'wti',
    label: 'WTI Pétrole',
    description: 'Pétrole brut US (CL=F future)',
    icon: '🛢️',
    yahooSymbol: 'CL=F',
    accentClass: 'text-rose-300',
  },
  ger40: {
    id: 'ger40',
    label: 'GER40 (DAX)',
    description: 'Indice 40 Allemagne (^GDAXI)',
    icon: '🇩🇪',
    yahooSymbol: '^GDAXI',
    accentClass: 'text-emerald-300',
  },
};

export const MARKET_IDS: MarketId[] = [
  'nasdaq',
  'dowjones',
  'gold',
  'wti',
  'ger40',
];

/**
 * Fenêtre pendant laquelle on accepte des pronostics pour une date donnée.
 * Lock à 21h Paris : ça laisse 1-2h avant la clôture US (22h winter / 21h
 * été), ce qui empêche les pronostics "à la dernière seconde" basés sur
 * la dynamique de fin de séance.
 *
 * On utilise Paris time côté serveur (Vercel runs UTC). Conversion faite
 * dans `isPredictionWindowOpen()` ci-dessous.
 */
export const PREDICTION_LOCK_HOUR_PARIS = 21;

/**
 * Renvoie la date "trading day" courante en YYYY-MM-DD Paris time.
 *
 * Pas de lib externe — Intl.DateTimeFormat avec timeZone est suffisant et
 * exact (gère DST automatiquement).
 */
export function getParisDate(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // 'en-CA' donne YYYY-MM-DD nativement
  return fmt.format(now);
}

/**
 * Renvoie l'heure (0-23) en Paris time. Utilisé pour le lock 21h.
 */
export function getParisHour(now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    hour12: false,
  });
  return parseInt(fmt.format(now), 10);
}

/**
 * Renvoie true si on est encore dans la fenêtre où on accepte des
 * pronostics pour aujourd'hui. Fermée à partir de 21h Paris.
 */
export function isPredictionWindowOpen(now: Date = new Date()): boolean {
  return getParisHour(now) < PREDICTION_LOCK_HOUR_PARIS;
}

/**
 * Renvoie la date de la veille en YYYY-MM-DD Paris time. Utilisé pour la
 * logique de streak (was-yesterday → continue / sinon reset).
 */
export function getYesterdayParisDate(now: Date = new Date()): string {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return getParisDate(yesterday);
}

// ============================================================
// Yahoo Finance fetch — endpoint v8 chart, no key needed
// ============================================================

interface YahooChartResult {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
          open?: (number | null)[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

/**
 * Récupère les N derniers daily closes pour un symbole Yahoo.
 *
 * Format réponse :
 *   timestamps[i] (unix seconds, GMT) → close[i] (USD ou devise du marché).
 *
 * On filtre les closes null (jours fériés/weekends pré-filtrés par Yahoo
 * mais parfois des null subsistent).
 *
 * Throw si l'API échoue ou renvoie une erreur — l'appelant gère.
 */
export async function fetchDailyCloses(
  yahooSymbol: string,
  range: '5d' | '1mo' = '5d'
): Promise<Array<{ date: string; close: number }>> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?interval=1d&range=${range}`;

  const res = await fetch(url, {
    headers: {
      // Yahoo refuse les requêtes sans User-Agent depuis 2023 (anti-scraping).
      'User-Agent':
        'Mozilla/5.0 (compatible; BoursikotonsBot/1.0; +https://brskt.vercel.app)',
      Accept: 'application/json',
    },
    // Important : ne pas cacher de manière agressive — on veut le close du
    // jour fraichement disponible côté Yahoo.
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Yahoo HTTP ${res.status} for ${yahooSymbol}`);
  }

  const data = (await res.json()) as YahooChartResult;
  if (data.chart.error) {
    throw new Error(
      `Yahoo error ${data.chart.error.code}: ${data.chart.error.description}`
    );
  }

  const result = data.chart.result?.[0];
  if (!result) throw new Error(`Yahoo empty result for ${yahooSymbol}`);

  const tsArr = result.timestamp ?? [];
  const closes = result.indicators.quote[0]?.close ?? [];

  const out: Array<{ date: string; close: number }> = [];
  for (let i = 0; i < tsArr.length; i++) {
    const c = closes[i];
    const ts = tsArr[i];
    if (ts === undefined || c === null || c === undefined) continue;
    const d = new Date(ts * 1000);
    out.push({ date: getParisDate(d), close: c });
  }
  return out;
}

/**
 * Helper haut-niveau : retourne le close le plus récent pour un marché.
 */
export async function fetchLatestClose(market: MarketId): Promise<{
  date: string;
  close: number;
} | null> {
  const meta = MARKETS[market];
  const closes = await fetchDailyCloses(meta.yahooSymbol, '5d');
  return closes.at(-1) ?? null;
}
