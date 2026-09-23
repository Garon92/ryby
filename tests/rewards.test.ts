import { describe, expect, it } from 'vitest';
import { getSpecies } from '../src/data/species';
import { defaultSave } from '../src/store/save';
import { albumProgress, applyCatch, applyPerfect, buyItem, claimDailyReward, ensureMissions, equipItem, unlockedLocations, type CatchInput } from '../src/game/rewards';
import { mulberry32 } from '../src/game/logic/rng';

const input = (id: string, o: Partial<CatchInput> = {}): CatchInput => ({
  species: getSpecies(id), sizeCm: 20, trophy: false, rainbow: false, perfect: false, night: false,
  location: 'rybnik', bait: 'worm', combo: 1, ...o,
});
const now = new Date('2026-09-23T10:00:00');

describe('rewards', () => {
  it('first catch adds a new species, coins and xp', () => {
    const s = defaultSave();
    const r = applyCatch(s, input('plotice_obecna'), now, mulberry32(1));
    expect(r.newSpecies).toBe(true);
    expect(r.record).toBe(false);
    expect(s.album.plotice_obecna?.count).toBe(1);
    expect(s.coins).toBeGreaterThanOrEqual(r.coins);
    expect(s.xp).toBeGreaterThanOrEqual(r.points.points);
    expect(s.stats.catches).toBe(1);
    expect(s.stats.biggest).toEqual({ id: 'plotice_obecna', cm: 20 });
  });

  it('tracks personal records per species', () => {
    const s = defaultSave();
    applyCatch(s, input('kapr_obecny', { sizeCm: 45 }), now, mulberry32(1));
    expect(applyCatch(s, input('kapr_obecny', { sizeCm: 40 }), now, mulberry32(1)).record).toBe(false);
    const r = applyCatch(s, input('kapr_obecny', { sizeCm: 60 }), now, mulberry32(1));
    expect(r.record).toBe(true);
    expect(s.album.kapr_obecny?.best).toBe(60);
    expect(s.album.kapr_obecny?.count).toBe(3);
  });

  it('protected species are released and counted', () => {
    const s = defaultSave();
    const r = applyCatch(s, input('piskor_pruhovany'), now, mulberry32(1));
    expect(r.released).toBe(true);
    expect(s.stats.released).toBe(1);
  });

  it('autopilot/no-scoring still fills the album but gives nothing', () => {
    const s = defaultSave();
    applyCatch(s, input('plotice_obecna'), now, mulberry32(1), false);
    expect(s.album.plotice_obecna?.count).toBe(1);
    expect(s.coins).toBe(0);
    expect(s.xp).toBe(0);
  });

  it('completes missions, pays them and deals new ones', () => {
    const s = defaultSave();
    s.missions = [
      { id: 'a', kind: 'count', target: 1, progress: 0, reward: 7 },
      { id: 'b', kind: 'perfect', target: 1, progress: 0, reward: 9 },
      { id: 'c', kind: 'night', target: 1, progress: 0, reward: 11 },
    ];
    const r = applyCatch(s, input('plotice_obecna'), now, mulberry32(2));
    expect(r.completed.map((m) => m.id)).toEqual(['a']);
    expect(s.missions).toHaveLength(3);
    expect(s.missions.some((m) => m.id === 'a')).toBe(false);
    expect(s.missionsDone).toBe(1);
    const coinsBefore = s.coins;
    const done = applyPerfect(s, mulberry32(3));
    expect(done.map((m) => m.id)).toEqual(['b']);
    expect(s.coins).toBe(coinsBefore + 9);
    expect(s.stats.perfect).toBe(1);
  });

  it('ensureMissions deals three', () => {
    const s = defaultSave();
    ensureMissions(s, mulberry32(5));
    expect(s.missions).toHaveLength(3);
  });

  it('levels unlock locations; parents can unlock all', () => {
    const s = defaultSave();
    expect(unlockedLocations(s)).toEqual(['rybnik']);
    s.xp = 400;
    expect(unlockedLocations(s)).toEqual(['rybnik', 'reka', 'potok']);
    s.xp = 0;
    s.prefs.unlockAll = true;
    expect(unlockedLocations(s)).toHaveLength(4);
  });

  it('daily reward once a day', () => {
    const s = defaultSave();
    expect(claimDailyReward(s, now)?.reward).toBe(10);
    expect(s.coins).toBe(10);
    expect(claimDailyReward(s, now)).toBeNull();
    expect(claimDailyReward(s, new Date('2026-09-24T09:00:00'))?.reward).toBe(15);
  });

  it('shop: buying, poverty, equipping', () => {
    const s = defaultSave();
    expect(buyItem(s, 'rod', 'gold')).toBe('poor');
    s.coins = 20;
    expect(buyItem(s, 'rod', 'gold')).toBe('bought');
    expect(s.coins).toBe(5);
    expect(s.equipped.rod).toBe('gold');
    expect(buyItem(s, 'rod', 'gold')).toBe('owned');
    expect(equipItem(s, 'rod', 'wood')).toBe(true);
    expect(equipItem(s, 'rod', 'rainbow')).toBe(false);
    expect(buyItem(s, 'bait', 'nope')).toBe('unknown');
    s.coins = 100;
    expect(buyItem(s, 'bait', 'spinner')).toBe('bought');
    expect(s.equipped.bait).toBe('spinner');
  });

  it('album progress per location', () => {
    const s = defaultSave();
    applyCatch(s, input('plotice_obecna'), now, mulberry32(1));
    const p = albumProgress(s, 'rybnik');
    expect(p.caught).toBe(1);
    expect(p.total).toBeGreaterThan(20);
    expect(albumProgress(s).total).toBe(59);
  });
});
