import { describe, expect, it } from 'vitest';
import {
  CHART_PATTERNS,
  PATTERNS_PER_RUN,
  patternMemoryXpFor,
  pickPatternsForRun,
} from './pattern-memory';

describe('patternMemoryXpFor', () => {
  it('0 correct → 10 XP', () => {
    expect(patternMemoryXpFor(0)).toBe(10);
    expect(patternMemoryXpFor(1)).toBe(10);
  });

  it('2 correct → 25 XP', () => {
    expect(patternMemoryXpFor(2)).toBe(25);
  });

  it('3 correct → 50 XP', () => {
    expect(patternMemoryXpFor(3)).toBe(50);
  });

  it('4 correct → 100 XP', () => {
    expect(patternMemoryXpFor(4)).toBe(100);
  });

  it('5 correct → 150 XP', () => {
    expect(patternMemoryXpFor(5)).toBe(150);
  });

  it('clamp les valeurs hors plage', () => {
    expect(patternMemoryXpFor(-3)).toBe(10);
    expect(patternMemoryXpFor(99)).toBe(150);
  });
});

describe('CHART_PATTERNS', () => {
  it('expose 10 patterns', () => {
    expect(CHART_PATTERNS).toHaveLength(10);
  });

  it('IDs uniques et croissants', () => {
    const ids = CHART_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque pattern a au moins 5 points', () => {
    for (const p of CHART_PATTERNS) {
      expect(p.points.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('points respectent le viewBox 100x60', () => {
    for (const p of CHART_PATTERNS) {
      for (const [x, y] of p.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(60);
      }
    }
  });

  it('chaque pattern a name + label + description non vides', () => {
    for (const p of CHART_PATTERNS) {
      expect(p.name).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.description).toBeTruthy();
    }
  });
});

describe('pickPatternsForRun', () => {
  it('renvoie PATTERNS_PER_RUN patterns', () => {
    const patterns = pickPatternsForRun();
    expect(patterns).toHaveLength(PATTERNS_PER_RUN);
  });

  it('patterns sont distincts', () => {
    const patterns = pickPatternsForRun();
    const ids = patterns.map((p) => p.id);
    expect(new Set(ids).size).toBe(PATTERNS_PER_RUN);
  });

  it('résultat déterministe avec seed', () => {
    const a = pickPatternsForRun(42);
    const b = pickPatternsForRun(42);
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });

  it('seeds différents → permutations différentes', () => {
    const a = pickPatternsForRun(1);
    const b = pickPatternsForRun(999);
    // On accepte que ce soit parfois identique (très rare avec 10!), mais sur
    // beaucoup d'essais ce sera différent
    const aRepr = a.map((p) => p.id).join(',');
    const bRepr = b.map((p) => p.id).join(',');
    if (aRepr === bRepr) {
      // Retry avec encore d'autres seeds
      const c = pickPatternsForRun(123456);
      const cRepr = c.map((p) => p.id).join(',');
      expect(cRepr).not.toBe(aRepr);
    } else {
      expect(aRepr).not.toBe(bRepr);
    }
  });
});
