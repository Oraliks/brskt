import { describe, expect, it } from 'vitest';
import { getLevel, LEVELS } from './xp';

describe('getLevel', () => {
  it('renvoie Oraliks à 0 XP', () => {
    const r = getLevel(0);
    expect(r.level.id).toBe('oraliks');
    expect(r.next?.id).toBe('trader');
    expect(r.xpToNext).toBe(500);
    expect(r.progress).toBe(0);
  });

  it('reste sur Oraliks juste avant Trader (499 XP)', () => {
    const r = getLevel(499);
    expect(r.level.id).toBe('oraliks');
    expect(r.xpToNext).toBe(1);
  });

  it('passe à Trader à 500 XP', () => {
    const r = getLevel(500);
    expect(r.level.id).toBe('trader');
    expect(r.next?.id).toBe('pro');
    expect(r.progress).toBe(0);
  });

  it('progression à mi-chemin entre 2 paliers', () => {
    const r = getLevel(1250); // mi-chemin entre 500 et 2000
    expect(r.level.id).toBe('trader');
    expect(r.next?.id).toBe('pro');
    expect(r.progress).toBeCloseTo(0.5, 1);
    expect(r.xpToNext).toBe(750);
  });

  it('atteint Légende à 15000 XP', () => {
    const r = getLevel(15000);
    expect(r.level.id).toBe('legende');
    expect(r.next).toBeNull();
    expect(r.progress).toBe(1);
    expect(r.xpToNext).toBe(0);
  });

  it('reste Légende à 99999 XP (cap)', () => {
    const r = getLevel(99999);
    expect(r.level.id).toBe('legende');
    expect(r.next).toBeNull();
  });

  it('progression est clampée entre 0 et 1', () => {
    // Cas pathologique : XP en-dessous de minXp (ne devrait pas arriver
    // mais on veut un fallback safe)
    const r = getLevel(0);
    expect(r.progress).toBeGreaterThanOrEqual(0);
    expect(r.progress).toBeLessThanOrEqual(1);
  });

  it('LEVELS sont triés par minXp croissant', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const prev = LEVELS[i - 1];
      const curr = LEVELS[i];
      if (!prev || !curr) continue;
      expect(curr.minXp).toBeGreaterThan(prev.minXp);
    }
  });

  it('premier niveau est Oraliks (clin d\'œil au créateur)', () => {
    expect(LEVELS[0]?.id).toBe('oraliks');
    expect(LEVELS[0]?.label).toBe('Oraliks');
  });
});
