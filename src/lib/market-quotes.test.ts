import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('fetchMarketQuotes', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns the same number of quotes as instruments, even on errors', async () => {
    // Mock fetch pour qu'il échoue systématiquement
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const { fetchMarketQuotes } = await import('./market-quotes');
    const quotes = await fetchMarketQuotes();

    // 11 instruments configurés
    expect(quotes).toHaveLength(11);
    // Tous en fallback (—)
    expect(quotes.every((q) => q.price === '—')).toBe(true);
    // Mais on a les bons symboles
    expect(quotes.map((q) => q.symbol)).toEqual([
      'DOW',
      'NASDAQ',
      'S&P500',
      'VIX',
      'GER40',
      'FRA40',
      'UK100',
      'JP225',
      'GOLD',
      'WTI',
      'BTC',
    ]);
  });

  it('parses a Yahoo response correctly and computes delta', async () => {
    const mockYahoo = {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 5842.5,
              previousClose: 5820.0,
              regularMarketTime: 1700000000,
            },
          },
        ],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockYahoo,
      })
    );

    const { fetchMarketQuotes } = await import('./market-quotes');
    const quotes = await fetchMarketQuotes();

    const sp500 = quotes.find((q) => q.symbol === 'S&P500');
    expect(sp500).toBeDefined();
    expect(sp500?.up).toBe(true);
    expect(sp500?.deltaPct).toMatch(/^\+0\.39%$/);
  });

  it('marks down when price below previous close', async () => {
    const mockYahoo = {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 100,
              previousClose: 110,
              regularMarketTime: 1700000000,
            },
          },
        ],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockYahoo,
      })
    );

    const { fetchMarketQuotes } = await import('./market-quotes');
    const quotes = await fetchMarketQuotes();
    expect(quotes[0]?.up).toBe(false);
    expect(quotes[0]?.deltaPct).toMatch(/^-9\.09%$/);
  });

  it('falls back gracefully when meta is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ chart: { result: [{}] } }),
      })
    );

    const { fetchMarketQuotes } = await import('./market-quotes');
    const quotes = await fetchMarketQuotes();
    expect(quotes[0]?.price).toBe('—');
  });
});
