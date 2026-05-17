import { describe, expect, it } from 'vitest';
import {
  ANCHORING_QUESTIONS,
  assignAnchorsForUser,
  computeAnchoringIndex,
  computeShiftRatio,
  interpretAnchoring,
} from './anchoring';

describe('computeShiftRatio', () => {
  it('renvoie 0 quand prediction = center (pas ancré)', () => {
    expect(computeShiftRatio(10, 43, 10)).toBe(0);
  });

  it('renvoie 1 quand prediction = anchor (totalement ancré)', () => {
    expect(computeShiftRatio(43, 43, 10)).toBe(1);
  });

  it('renvoie 0.5 à mi-chemin entre center et anchor', () => {
    expect(computeShiftRatio(26.5, 43, 10)).toBeCloseTo(0.5, 2);
  });

  it('renvoie négatif si prediction de l\'autre côté du center', () => {
    // anchor=43, center=10, prediction=0 → negative (anti-anchoring)
    expect(computeShiftRatio(0, 43, 10)).toBeLessThan(0);
  });

  it('gère anchor < center (ancre basse)', () => {
    // center=10, anchor=-33, prediction=-33 → shift=1
    expect(computeShiftRatio(-33, -33, 10)).toBe(1);
    expect(computeShiftRatio(10, -33, 10)).toBeCloseTo(0, 5);
  });

  it('safe quand anchor = center (division par 0)', () => {
    expect(computeShiftRatio(50, 10, 10)).toBe(0);
  });
});

describe('computeAnchoringIndex', () => {
  it('renvoie 0 sur tableau vide', () => {
    expect(computeAnchoringIndex([])).toBe(0);
  });

  it('renvoie 0 si toutes shifts à 0', () => {
    expect(computeAnchoringIndex([0, 0, 0])).toBe(0);
  });

  it('renvoie 100 si toutes shifts >= 1', () => {
    expect(computeAnchoringIndex([1, 1, 1])).toBe(100);
  });

  it('clamp les shifts négatifs à 0', () => {
    expect(computeAnchoringIndex([-0.5, -0.5, -0.5])).toBe(0);
  });

  it('clamp les shifts > 1.5 à 1.5', () => {
    // 3 valeurs à 5 → moyenne clipée 1.5 × 100 = 150 → clamped à 100
    expect(computeAnchoringIndex([5, 5, 5])).toBe(100);
  });

  it('moyenne correcte 0.4 → 40', () => {
    expect(computeAnchoringIndex([0.4, 0.4, 0.4])).toBe(40);
  });
});

describe('interpretAnchoring', () => {
  it("attribue 'immune' à index < 15", () => {
    expect(interpretAnchoring(0).level).toBe('immune');
    expect(interpretAnchoring(14).level).toBe('immune');
  });

  it("attribue 'low' entre 15 et 34", () => {
    expect(interpretAnchoring(15).level).toBe('low');
    expect(interpretAnchoring(34).level).toBe('low');
  });

  it("attribue 'moderate' entre 35 et 54", () => {
    expect(interpretAnchoring(35).level).toBe('moderate');
    expect(interpretAnchoring(54).level).toBe('moderate');
  });

  it("attribue 'high' entre 55 et 74", () => {
    expect(interpretAnchoring(55).level).toBe('high');
    expect(interpretAnchoring(74).level).toBe('high');
  });

  it("attribue 'very_high' à index >= 75", () => {
    expect(interpretAnchoring(75).level).toBe('very_high');
    expect(interpretAnchoring(100).level).toBe('very_high');
  });
});

describe('assignAnchorsForUser', () => {
  it('renvoie 6 assignations (autant que de questions)', () => {
    const a = assignAnchorsForUser('user-1', ANCHORING_QUESTIONS);
    expect(a).toHaveLength(ANCHORING_QUESTIONS.length);
  });

  it('chaque variant est high ou low', () => {
    const a = assignAnchorsForUser('user-1', ANCHORING_QUESTIONS);
    for (const x of a) {
      expect(['high', 'low']).toContain(x.variant);
    }
  });

  it('même userId donne même résultat à la même semaine', () => {
    const a = assignAnchorsForUser('user-1', ANCHORING_QUESTIONS);
    const b = assignAnchorsForUser('user-1', ANCHORING_QUESTIONS);
    expect(a.map((x) => x.variant)).toEqual(b.map((x) => x.variant));
  });

  it('userIds différents tendent à donner des patterns différents', () => {
    const patterns = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const a = assignAnchorsForUser(`user-${i}`, ANCHORING_QUESTIONS);
      patterns.add(a.map((x) => x.variant).join(','));
    }
    // Au moins 5 patterns distincts sur 20 users (statistiquement très probable)
    expect(patterns.size).toBeGreaterThanOrEqual(5);
  });
});

describe('ANCHORING_QUESTIONS data', () => {
  it('expose 6 questions', () => {
    expect(ANCHORING_QUESTIONS).toHaveLength(6);
  });

  it('chaque question a anchorHigh > center > anchorLow', () => {
    for (const q of ANCHORING_QUESTIONS) {
      expect(q.anchorHigh.value).toBeGreaterThan(q.center);
      expect(q.anchorLow.value).toBeLessThan(q.center);
    }
  });

  it('bornes min/max englobent center et anchors', () => {
    for (const q of ANCHORING_QUESTIONS) {
      expect(q.maxAnswer).toBeGreaterThanOrEqual(q.anchorHigh.value);
      expect(q.minAnswer).toBeLessThanOrEqual(q.anchorLow.value);
    }
  });

  it('IDs uniques', () => {
    const ids = ANCHORING_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
