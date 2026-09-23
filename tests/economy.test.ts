import { describe, expect, it } from 'vitest';
import { catchCoins, catchPoints, comboBonus, starsFor } from '../src/game/logic/scoring';
import { levelInfo, xpForLevel } from '../src/game/logic/progress';
import { canClaim, claimDaily, dateKey, nextStreakDay, normalizeLegacyDate } from '../src/game/logic/daily';

describe('scoring', () => {
  const base = { rarity: 1, sizeCm: 20, perfect: false, combo: 1, rainbow: false, trophy: false, newSpecies: false };
  it('rarer and bigger fish give more points', () => {
    expect(catchPoints({ ...base, rarity: 5 }).points).toBeGreaterThan(catchPoints(base).points);
    expect(catchPoints({ ...base, sizeCm: 80 }).points).toBeGreaterThan(catchPoints(base).points);
  });
  it('bonuses add up, rainbow doubles', () => {
    const p = catchPoints({ ...base, perfect: true, combo: 3, newSpecies: true, trophy: true });
    expect(p.points).toBe(14 + 15 + 10 + 10 + 20);
    const r = catchPoints({ ...base, rainbow: true });
    expect(r.points).toBe(28);
    expect(r.parts.at(-1)?.label).toContain('Duhová');
  });
  it('combo bonus is capped', () => {
    expect(comboBonus(1)).toBe(0);
    expect(comboBonus(2)).toBe(5);
    expect(comboBonus(50)).toBe(40);
  });
  it('coins follow the original formula', () => {
    expect(catchCoins(1, false, false)).toBe(1);
    expect(catchCoins(5, false, false)).toBe(5);
    expect(catchCoins(3, true, true)).toBe(3 + 3 + 2);
  });
  it('stars by thresholds', () => {
    expect(starsFor(0, 'normal')).toBe(0);
    expect(starsFor(100, 'normal')).toBe(1);
    expect(starsFor(300, 'normal')).toBe(2);
    expect(starsFor(9999, 'hard')).toBe(3);
  });
});

describe('levels', () => {
  it('starts at level 1 and grows', () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(149).level).toBe(1);
    expect(levelInfo(150).level).toBe(2);
    expect(levelInfo(150).into).toBe(0);
    expect(levelInfo(9000).level).toBe(10);
    expect(levelInfo(12000).level).toBe(11);
    expect(xpForLevel(12)).toBe(15000);
  });
  it('progress is between 0 and 1', () => {
    for (const xp of [0, 10, 399, 5000, 99999]) {
      const l = levelInfo(xp);
      expect(l.progress).toBeGreaterThanOrEqual(0);
      expect(l.progress).toBeLessThan(1);
      expect(l.title.length).toBeGreaterThan(0);
    }
  });
});

describe('daily reward', () => {
  const d = (s: string) => new Date(`${s}T10:00:00`);
  it('can be claimed once a day', () => {
    const r = claimDaily({ last: null, streak: 0 }, d('2026-09-23'))!;
    expect(r.reward).toBe(10);
    expect(r.day).toBe(1);
    expect(canClaim(r.state, d('2026-09-23'))).toBe(false);
    expect(claimDaily(r.state, d('2026-09-23'))).toBeNull();
  });
  it('streak grows on consecutive days and resets after a gap', () => {
    let st = { last: '2026-09-22', streak: 3 };
    expect(nextStreakDay(st, d('2026-09-23'))).toBe(4);
    expect(nextStreakDay(st, d('2026-09-25'))).toBe(1);
    st = { last: '2026-09-22', streak: 7 };
    expect(nextStreakDay(st, d('2026-09-23'))).toBe(1);
    expect(claimDaily({ last: '2026-09-22', streak: 6 }, d('2026-09-23'))?.reward).toBe(60);
  });
  it('works across month boundaries', () => {
    expect(nextStreakDay({ last: '2026-09-30', streak: 2 }, d('2026-10-01'))).toBe(3);
  });
  it('normalizes the legacy date format', () => {
    expect(normalizeLegacyDate('2025-8-9')).toBe('2025-08-09');
    expect(normalizeLegacyDate('nonsense')).toBeNull();
    expect(dateKey(d('2026-01-05'))).toBe('2026-01-05');
  });
});
