import { describe, expect, it } from 'vitest';
import {
  CANDLE_HOP_ACHIEVEMENTS,
  CANDLE_HOP_CHALLENGES,
  CANDLE_HOP_MODES,
  CANDLE_HOP_POWER_UPS,
  CANDLE_HOP_SKINS,
  candleHopXpFor,
  getTodayCandleHopChallenge,
  getUnlockedSkins,
} from './candle-hop';

describe('candleHopXpFor', () => {
  it('renvoie 5 XP pour score < 5', () => {
    expect(candleHopXpFor(0)).toBe(5);
    expect(candleHopXpFor(4)).toBe(5);
  });

  it('palier 5-14 → 15 XP', () => {
    expect(candleHopXpFor(5)).toBe(15);
    expect(candleHopXpFor(14)).toBe(15);
  });

  it('palier 15-29 → 40 XP', () => {
    expect(candleHopXpFor(15)).toBe(40);
    expect(candleHopXpFor(29)).toBe(40);
  });

  it('palier 30-59 → 75 XP', () => {
    expect(candleHopXpFor(30)).toBe(75);
    expect(candleHopXpFor(59)).toBe(75);
  });

  it('palier 60-99 → 150 XP', () => {
    expect(candleHopXpFor(60)).toBe(150);
    expect(candleHopXpFor(99)).toBe(150);
  });

  it('palier 100+ → 200 XP', () => {
    expect(candleHopXpFor(100)).toBe(200);
    expect(candleHopXpFor(500)).toBe(200);
  });

  it('paliers sont strictement croissants', () => {
    let prev = candleHopXpFor(0);
    for (let s = 0; s <= 100; s += 5) {
      const cur = candleHopXpFor(s);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  it('gère les scores négatifs en clamp à 0', () => {
    expect(candleHopXpFor(-5)).toBe(5);
  });
});

describe('Skins', () => {
  it('Classic est unlock à 0 XP', () => {
    expect(CANDLE_HOP_SKINS[0]!.id).toBe('classic');
    expect(CANDLE_HOP_SKINS[0]!.unlockXp).toBe(0);
  });

  it('unlockXp est strictement croissant', () => {
    let prev = -1;
    for (const s of CANDLE_HOP_SKINS) {
      expect(s.unlockXp).toBeGreaterThan(prev);
      prev = s.unlockXp;
    }
  });

  it('getUnlockedSkins filtre par xpTotal', () => {
    expect(getUnlockedSkins(0)).toHaveLength(1);
    expect(getUnlockedSkins(500)).toHaveLength(2);
    expect(getUnlockedSkins(99999)).toHaveLength(CANDLE_HOP_SKINS.length);
  });

  it('un user à 499 XP ne débloque pas Bull (500)', () => {
    expect(getUnlockedSkins(499).map((s) => s.id)).toEqual(['classic']);
  });
});

describe('Power-ups', () => {
  it('expose 3 power-ups distincts', () => {
    expect(CANDLE_HOP_POWER_UPS).toHaveLength(3);
    const ids = CANDLE_HOP_POWER_UPS.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('chaque power-up a une durée positive', () => {
    for (const p of CANDLE_HOP_POWER_UPS) {
      expect(p.durationMs).toBeGreaterThan(0);
    }
  });
});

describe('Daily challenges', () => {
  it('renvoie un challenge déterministe pour une date donnée', () => {
    const date = new Date('2026-05-17T12:00:00Z');
    const a = getTodayCandleHopChallenge(date);
    const b = getTodayCandleHopChallenge(date);
    expect(a.id).toBe(b.id);
  });

  it('challenges sont tous valides (id + check function)', () => {
    for (const c of CANDLE_HOP_CHALLENGES) {
      expect(c.id).toBeTruthy();
      expect(c.bonusXp).toBeGreaterThan(0);
      expect(typeof c.check).toBe('function');
    }
  });

  it("challenge 'score_25' valide un run score 25", () => {
    const c = CANDLE_HOP_CHALLENGES.find((c) => c.id === 'score_25')!;
    expect(c.check({ score: 25, bonusesCollected: 0, powerUpsUsed: 0, durationMs: 10000 }))
      .toBe(true);
    expect(c.check({ score: 24, bonusesCollected: 0, powerUpsUsed: 0, durationMs: 10000 }))
      .toBe(false);
  });

  it("challenge 'score_40_no_pu' refuse si power-ups utilisés", () => {
    const c = CANDLE_HOP_CHALLENGES.find((c) => c.id === 'score_40_no_pu')!;
    expect(c.check({ score: 50, bonusesCollected: 0, powerUpsUsed: 0, durationMs: 30000 }))
      .toBe(true);
    expect(c.check({ score: 50, bonusesCollected: 0, powerUpsUsed: 1, durationMs: 30000 }))
      .toBe(false);
  });
});

describe('Achievements', () => {
  it('expose au moins 5 achievements', () => {
    expect(CANDLE_HOP_ACHIEVEMENTS.length).toBeGreaterThanOrEqual(5);
  });

  it('IDs sont uniques', () => {
    const ids = CANDLE_HOP_ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("'first_steps' valide à bestScore >= 5", () => {
    const a = CANDLE_HOP_ACHIEVEMENTS.find((a) => a.id === 'first_steps')!;
    expect(a.check({ bestScore: 5, totalRuns: 1, score: 5 })).toBe(true);
    expect(a.check({ bestScore: 4, totalRuns: 100, score: 4 })).toBe(false);
  });
});

describe('Modes V3', () => {
  it('expose 3 modes', () => {
    expect(CANDLE_HOP_MODES).toEqual(['endless', 'time_attack', 'survival']);
  });
});
