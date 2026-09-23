import { describe, expect, it } from 'vitest';
import { LOCATION_BY_ID } from '../src/data/locations';
import { SPECIES } from '../src/data/species';
import { Fish } from '../src/game/fish';
import { computeWorld } from '../src/game/world';

function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('Fish spawn', () => {
  it('fish entering from the edge have finite position and target (regression: x = NaN → invisible fish)', () => {
    const world = computeWorld(1440, 840, 2, LOCATION_BY_ID.rybnik);
    const r = rng(7);
    for (const sp of SPECIES) {
      for (const fromEdge of [true, false]) {
        const f = new Fish(sp, 30, false, false, world, r, fromEdge);
        expect(Number.isFinite(f.x), `${sp.id} fromEdge=${fromEdge} x`).toBe(true);
        expect(Number.isFinite(f.targetX), `${sp.id} fromEdge=${fromEdge} targetX`).toBe(true);
        expect(Number.isFinite(f.widthPx(world))).toBe(true);
      }
    }
  });
});
