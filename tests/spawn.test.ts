import { describe, expect, it } from 'vitest';
import { SPECIES, getSpecies } from '../src/data/species';
import { baitAffinity, depthMatch, locationPool, pickSpecies, rollSize, spawnWeight, effectiveAffinity } from '../src/game/logic/spawn';
import { mulberry32 } from '../src/game/logic/rng';
import { interestChance, BITE, hookResult } from '../src/game/logic/bite';

describe('bait affinity', () => {
  it('predators love spinners, peaceful fish ignore them', () => {
    expect(baitAffinity(getSpecies('stika_obecna'), 'spinner')).toBeGreaterThan(baitAffinity(getSpecies('stika_obecna'), 'worm'));
    expect(baitAffinity(getSpecies('plotice_obecna'), 'spinner')).toBeLessThan(0.1);
  });
  it('grass carp and carp love corn', () => {
    expect(baitAffinity(getSpecies('amur_bily'), 'corn')).toBeGreaterThan(1);
    expect(baitAffinity(getSpecies('kapr_obecny'), 'corn')).toBeGreaterThan(1);
    expect(baitAffinity(getSpecies('stika_obecna'), 'corn')).toBeLessThan(0.1);
  });
  it('trout take flies', () => {
    expect(baitAffinity(getSpecies('pstruh_obecny_potocni'), 'fly')).toBeGreaterThan(1);
  });
  it('every fish takes something on the easiest difficulty', () => {
    for (const s of SPECIES) for (const b of ['worm', 'corn', 'spinner', 'fly'] as const) {
      expect(effectiveAffinity(s, b, 'easy')).toBeGreaterThanOrEqual(0.45);
    }
  });
});

describe('spawning', () => {
  it('only spawns fish living in the location', () => {
    const rng = mulberry32(1);
    const pool = locationPool(SPECIES, 'potok');
    for (let i = 0; i < 500; i++) {
      const s = pickSpecies(pool, { location: 'potok', night: false, bait: 'worm', difficulty: 'normal' }, rng);
      expect(s?.locations).toContain('potok');
    }
  });

  it('common fish are much more frequent than legendary ones', () => {
    const rng = mulberry32(7);
    const pool = locationPool(SPECIES, 'reka');
    const counts = new Map<number, number>();
    for (let i = 0; i < 20000; i++) {
      const s = pickSpecies(pool, { location: 'reka', night: false, bait: 'worm', difficulty: 'normal' }, rng)!;
      counts.set(s.rarity, (counts.get(s.rarity) ?? 0) + 1);
    }
    const perSpecies = (r: number) => (counts.get(r) ?? 0) / pool.filter((s) => s.rarity === r).length;
    expect(perSpecies(1)).toBeGreaterThan(perSpecies(3) * 2);
    expect(perSpecies(3)).toBeGreaterThan(perSpecies(5) * 2);
    expect(counts.get(5) ?? 0).toBeGreaterThan(0);
  });

  it('night boosts nocturnal species', () => {
    const sumec = getSpecies('sumec_velky');
    const day = spawnWeight(sumec, { location: 'reka', night: false, bait: 'worm', difficulty: 'normal' });
    const night = spawnWeight(sumec, { location: 'reka', night: true, bait: 'worm', difficulty: 'normal' });
    expect(night).toBeGreaterThan(day * 2);
  });

  it('rolls sizes within the normal range, trophies up to the record', () => {
    const rng = mulberry32(3);
    const kapr = getSpecies('kapr_obecny');
    let trophies = 0;
    for (let i = 0; i < 5000; i++) {
      const { cm, trophy } = rollSize(kapr, rng);
      if (trophy) {
        trophies++;
        expect(cm).toBeGreaterThanOrEqual(kapr.sizeMax);
        expect(cm).toBeLessThanOrEqual(kapr.sizeRecord);
      } else {
        expect(cm).toBeGreaterThanOrEqual(kapr.sizeMin);
        expect(cm).toBeLessThanOrEqual(kapr.sizeMax);
      }
    }
    expect(trophies / 5000).toBeGreaterThan(0.03);
    expect(trophies / 5000).toBeLessThan(0.07);
  });

  it('depth match prefers the fish zone', () => {
    expect(depthMatch('dno', 0.9)).toBe(1);
    expect(depthMatch('dno', 0.05)).toBeLessThan(0.5);
    expect(depthMatch('hladina', 0.1)).toBe(1);
  });
});

describe('bite', () => {
  it('interest grows with affinity and proximity and is 0 out of range', () => {
    const t = BITE.normal;
    expect(interestChance(t, 1, 1, 1.2, 1, 0.1)).toBe(0);
    const near = interestChance(t, 1, 1, 0.1, 1, 0.1);
    const far = interestChance(t, 1, 1, 0.9, 1, 0.1);
    const picky = interestChance(t, 0.1, 1, 0.1, 1, 0.1);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeGreaterThan(picky);
    expect(near).toBeLessThan(1);
  });
  it('hook window depends on difficulty', () => {
    expect(hookResult(BITE.normal, 1000)).toBe('hooked');
    expect(hookResult(BITE.hard, 1000)).toBe('late');
  });
});
