import { describe, expect, it } from 'vitest';
import { getSpecies, SPECIES } from '../src/data/species';
import { ACHIEVEMENTS, newlyUnlocked } from '../src/game/logic/achievements';
import { applyCatch, checkAchievements } from '../src/game/rewards';
import { mulberry32 } from '../src/game/logic/rng';
import { defaultSave, normalizeSave } from '../src/store/save';

describe('achievements', () => {
  it('have unique ids and positive rewards', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.reward).toBeGreaterThan(0);
  });

  it('nothing is unlocked on a fresh save', () => {
    expect(newlyUnlocked(defaultSave(), SPECIES)).toEqual([]);
  });

  it('first catch unlocks „První úlovek“ exactly once and pays coins', () => {
    const s = defaultSave();
    const out = applyCatch(s, { species: getSpecies('plotice_obecna'), sizeCm: 20, trophy: false, rainbow: false, perfect: false, night: true, location: 'rybnik', bait: 'worm', combo: 1 }, new Date(), mulberry32(1));
    expect(out.achievements.map((a) => a.id)).toContain('first');
    expect(s.achievements).toContain('first');
    expect(s.stats.nightCatches).toBe(1);
    expect(checkAchievements(s)).toEqual([]);
  });

  it('location completion is tracked', () => {
    const s = defaultSave();
    for (const sp of SPECIES.filter((x) => x.locations.includes('potok'))) s.album[sp.id] = { count: 1, best: 10, first: '2026-01-01' };
    const got = checkAchievements(s).map((a) => a.id);
    expect(got).toContain('potok');
    expect(got).not.toContain('rybnik');
  });

  it('survive save normalization', () => {
    const s = normalizeSave({ achievements: ['first', 'first', 7, 'giant'] });
    expect(s.achievements).toEqual(['first', 'giant']);
  });
});
