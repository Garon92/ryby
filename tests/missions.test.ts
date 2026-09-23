import { describe, expect, it } from 'vitest';
import { SPECIES } from '../src/data/species';
import { applyMissionEvent, describeMission, fillMissions, generateMission, isDone, type Mission, type MissionContext } from '../src/game/logic/missions';
import { mulberry32 } from '../src/game/logic/rng';
import type { CatchEvent } from '../src/game/types';

const ctx: MissionContext = { species: SPECIES, unlocked: ['rybnik'], ownedBaits: ['worm'], caught: new Set(), level: 1 };
const ev = (o: Partial<CatchEvent> = {}): CatchEvent => ({
  speciesId: 'plotice_obecna', sizeCm: 20, rarity: 1, location: 'rybnik', bait: 'worm', night: false, perfect: false,
  rainbow: false, trophy: false, newSpecies: false, record: false, points: 10, coins: 1, ...o,
});

describe('missions', () => {
  it('fills three missions of different kinds', () => {
    for (let seed = 1; seed < 50; seed++) {
      const ms = fillMissions(ctx, [], mulberry32(seed));
      expect(ms).toHaveLength(3);
      expect(new Set(ms.map((m) => m.kind)).size).toBe(3);
      for (const m of ms) {
        expect(m.reward).toBeGreaterThan(0);
        expect(describeMission(m, (id) => id).text.length).toBeGreaterThan(3);
      }
    }
  });

  it('never asks for things that are impossible with the current unlocks', () => {
    for (let seed = 1; seed < 300; seed++) {
      const m = generateMission(ctx, [], mulberry32(seed));
      expect(m.kind).not.toBe('location');
      expect(m.kind).not.toBe('bait');
      if (m.kind === 'species') expect(SPECIES.find((s) => s.id === m.species)?.locations).toContain('rybnik');
      if (m.kind === 'size') {
        const maxInPond = Math.max(...SPECIES.filter((s) => s.locations.includes('rybnik')).map((s) => s.sizeMax));
        expect(m.minSize!).toBeLessThan(maxInPond);
      }
    }
  });

  it('counts catches correctly', () => {
    let m: Mission = { id: 'a', kind: 'count', target: 2, progress: 0, reward: 5 };
    m = applyMissionEvent(m, { type: 'catch', ev: ev(), combo: 1 });
    expect(m.progress).toBe(1);
    m = applyMissionEvent(m, { type: 'catch', ev: ev(), combo: 2 });
    expect(isDone(m)).toBe(true);
    m = applyMissionEvent(m, { type: 'catch', ev: ev(), combo: 3 });
    expect(m.progress).toBe(2);
  });

  it('species / size / rarity / night / perfect / combo missions', () => {
    const sp: Mission = { id: 'b', kind: 'species', target: 1, progress: 0, reward: 5, species: 'kapr_obecny' };
    expect(applyMissionEvent(sp, { type: 'catch', ev: ev(), combo: 1 }).progress).toBe(0);
    expect(applyMissionEvent(sp, { type: 'catch', ev: ev({ speciesId: 'kapr_obecny' }), combo: 1 }).progress).toBe(1);
    const size: Mission = { id: 'c', kind: 'size', target: 1, progress: 0, reward: 5, minSize: 30 };
    expect(applyMissionEvent(size, { type: 'catch', ev: ev({ sizeCm: 30 }), combo: 1 }).progress).toBe(0);
    expect(applyMissionEvent(size, { type: 'catch', ev: ev({ sizeCm: 31 }), combo: 1 }).progress).toBe(1);
    const rar: Mission = { id: 'd', kind: 'rarity', target: 1, progress: 0, reward: 5, minRarity: 3 };
    expect(applyMissionEvent(rar, { type: 'catch', ev: ev({ rarity: 3 }), combo: 1 }).progress).toBe(1);
    const night: Mission = { id: 'e', kind: 'night', target: 1, progress: 0, reward: 5 };
    expect(applyMissionEvent(night, { type: 'catch', ev: ev({ night: true }), combo: 1 }).progress).toBe(1);
    const perf: Mission = { id: 'f', kind: 'perfect', target: 2, progress: 0, reward: 5 };
    expect(applyMissionEvent(perf, { type: 'perfect' }).progress).toBe(1);
    const combo: Mission = { id: 'g', kind: 'combo', target: 3, progress: 0, reward: 5 };
    expect(applyMissionEvent(combo, { type: 'catch', ev: ev(), combo: 2 }).progress).toBe(2);
    expect(applyMissionEvent(combo, { type: 'catch', ev: ev(), combo: 5 }).progress).toBe(3);
  });

  it('unlocks location/bait missions when available', () => {
    const rich: MissionContext = { ...ctx, unlocked: ['rybnik', 'reka'], ownedBaits: ['worm', 'spinner'], level: 3 };
    const kinds = new Set<string>();
    for (let seed = 1; seed < 400; seed++) kinds.add(generateMission(rich, [], mulberry32(seed)).kind);
    expect(kinds.has('location')).toBe(true);
    expect(kinds.has('bait')).toBe(true);
  });
});
