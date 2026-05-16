import { describe, expect, it } from 'vitest';
import {
  getParisDate,
  getYesterdayParisDate,
  getParisHour,
  isPredictionWindowOpen,
  MARKETS,
  MARKET_IDS,
} from './markets';

describe('Paris time helpers', () => {
  it('getParisDate renvoie YYYY-MM-DD', () => {
    const d = new Date('2026-05-16T10:00:00Z');
    expect(getParisDate(d)).toBe('2026-05-16');
  });

  it('getYesterdayParisDate recule d\'1 jour', () => {
    const d = new Date('2026-05-16T10:00:00Z');
    expect(getYesterdayParisDate(d)).toBe('2026-05-15');
  });

  it('getParisHour est 0-23', () => {
    const d = new Date('2026-05-16T10:00:00Z');
    const h = getParisHour(d);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(23);
  });

  describe('isPredictionWindowOpen', () => {
    // Note : ces tests sont sensibles à l'heure d'été. On force des dates
    // UTC qu'on sait correspondre à des heures Paris bien définies.
    it('ouverte à 10h Paris', () => {
      // 10h Paris CEST (été) = 08h UTC
      const d = new Date('2026-05-16T08:00:00Z');
      expect(isPredictionWindowOpen(d)).toBe(true);
    });

    it('fermée à 22h Paris', () => {
      // 22h Paris CEST = 20h UTC
      const d = new Date('2026-05-16T20:00:00Z');
      expect(isPredictionWindowOpen(d)).toBe(false);
    });
  });
});

describe('MARKETS metadata', () => {
  it('contient les 5 marchés demandés', () => {
    expect(MARKET_IDS).toEqual([
      'nasdaq',
      'dowjones',
      'gold',
      'wti',
      'ger40',
    ]);
  });

  it('chaque marché a son symbole Yahoo', () => {
    for (const m of MARKET_IDS) {
      expect(MARKETS[m].yahooSymbol).toMatch(/.+/);
      expect(MARKETS[m].label).toMatch(/.+/);
      expect(MARKETS[m].icon).toMatch(/.+/);
    }
  });
});
