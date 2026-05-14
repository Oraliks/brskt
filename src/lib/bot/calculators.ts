/**
 * Calculatrices trading exposées via les commandes du bot.
 * Toutes pures, sauf /convert qui appelle une API FX gratuite (Frankfurter).
 */

/**
 * Position size = (capital × risk%) / (sl_pips × pip_value)
 * Pour simplifier : on assume pip_value = 10 USD/lot standard pour les
 * paires majeures USD-quote (ex EURUSD). Pour les exotiques, à affiner.
 */
export function calcPositionSize(
  capital: number,
  riskPercent: number,
  slPips: number
): { lots: number; riskMoney: number } | { error: string } {
  if (!Number.isFinite(capital) || capital <= 0)
    return { error: 'Capital invalide' };
  if (!Number.isFinite(riskPercent) || riskPercent <= 0 || riskPercent > 100)
    return { error: 'Risk% doit être entre 0 et 100' };
  if (!Number.isFinite(slPips) || slPips <= 0)
    return { error: 'SL (pips) invalide' };

  const PIP_VALUE_PER_LOT = 10; // USD pour 1 lot standard sur paire USD-quote
  const riskMoney = capital * (riskPercent / 100);
  const lots = riskMoney / (slPips * PIP_VALUE_PER_LOT);

  return {
    lots: Math.round(lots * 100) / 100,
    riskMoney: Math.round(riskMoney * 100) / 100,
  };
}

/**
 * Risk:reward d'un trade. Ratio = reward / risk.
 * Direction inférée du signe (entry > sl = long, sinon short).
 */
export function calcRiskReward(
  entry: number,
  sl: number,
  tp: number
): { ratio: number; risk: number; reward: number; direction: 'long' | 'short' } | { error: string } {
  if (![entry, sl, tp].every(Number.isFinite))
    return { error: 'Valeurs invalides' };
  if (entry === sl) return { error: 'Entry = SL' };
  if (entry === tp) return { error: 'Entry = TP' };

  const direction = entry > sl ? 'long' : 'short';
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);

  // Vérifie que TP est dans le bon sens
  if (direction === 'long' && tp < entry)
    return { error: 'TP doit être au-dessus de l\'entry pour un long' };
  if (direction === 'short' && tp > entry)
    return { error: 'TP doit être en-dessous de l\'entry pour un short' };

  return {
    ratio: Math.round((reward / risk) * 100) / 100,
    risk: Math.round(risk * 100000) / 100000,
    reward: Math.round(reward * 100000) / 100000,
    direction,
  };
}

/**
 * Valeur du pip en USD pour une paire majeure (assume USD quote).
 * @param pair ex. EURUSD, GBPUSD
 * @param lots taille en lots standard (1 lot = 100k unités)
 */
export function calcPipValue(
  pair: string,
  lots: number
): { value: number; currency: string } | { error: string } {
  if (!Number.isFinite(lots) || lots <= 0)
    return { error: 'Lots invalide' };

  const upper = pair.toUpperCase().replace(/[/\s]/g, '');
  if (!/^[A-Z]{6}$/.test(upper))
    return { error: 'Paire invalide (ex: EURUSD)' };

  const quote = upper.slice(3); // 3 derniers chars
  // Pour une paire XXX/USD : pip = 0.0001 (ou 0.01 pour JPY)
  // Valeur du pip = lots × 100k × 0.0001 = lots × 10 USD
  // Pour USD/XXX, plus complexe — on retourne en quote currency
  const isJpyQuote = quote === 'JPY';
  const pipSize = isJpyQuote ? 0.01 : 0.0001;
  const pipValueQuote = lots * 100_000 * pipSize;

  return {
    value: Math.round(pipValueQuote * 100) / 100,
    currency: quote,
  };
}

/**
 * Conversion FX via l'API Frankfurter (free, sans clé, ECB rates).
 * Endpoint : https://api.frankfurter.dev/v1/latest?from=EUR&to=USD&amount=1000
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<
  | { converted: number; rate: number; date: string }
  | { error: string }
> {
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: 'Montant invalide' };
  const fromU = from.toUpperCase();
  const toU = to.toUpperCase();
  if (!/^[A-Z]{3}$/.test(fromU) || !/^[A-Z]{3}$/.test(toU))
    return { error: 'Devises invalides (ex: EUR, USD, GBP)' };

  if (fromU === toU)
    return { converted: amount, rate: 1, date: 'now' };

  try {
    const url = `https://api.frankfurter.dev/v1/latest?base=${fromU}&symbols=${toU}&amount=${amount}`;
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { error: `API FX erreur ${res.status}` };
    const json = (await res.json()) as {
      rates?: Record<string, number>;
      date?: string;
    };
    const converted = json.rates?.[toU];
    if (converted === undefined)
      return { error: `Devise ${toU} non supportée` };
    return {
      converted: Math.round(converted * 100) / 100,
      rate: Math.round((converted / amount) * 100_000) / 100_000,
      date: json.date ?? new Date().toISOString().slice(0, 10),
    };
  } catch (err) {
    return {
      error: `Erreur réseau : ${err instanceof Error ? err.message : 'inconnue'}`,
    };
  }
}
