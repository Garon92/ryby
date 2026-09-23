import { describe, expect, it } from 'vitest';
import { LOCATIONS, LOCATION_BY_ID } from '../src/data/locations';
import { computeWorld, fishWidthPx, wallX, zoneY } from '../src/game/world';
import { daylight, isNight, moonPosition, sunPosition, timeLabel } from '../src/game/sky';

const SIZES: [number, number][] = [
  [1440, 840],
  [390, 780],
  [844, 342],
  [820, 1110],
  [1024, 700],
];

describe('world geometry', () => {
  it('keeps the fisherman with a raised rod inside the screen', () => {
    for (const loc of LOCATIONS) {
      for (const [w, h] of SIZES) {
        const world = computeWorld(w, h, 2, loc);
        // špička prutu v klidu je ~148·fs nad hladinou
        expect(world.surfaceY - 148 * world.fs, `${loc.id} ${w}x${h}`).toBeGreaterThanOrEqual(0);
        expect(world.fisherX).toBeGreaterThan(0);
        expect(world.fisherX).toBeLessThan(w * 0.4);
        expect(world.bottomY).toBeGreaterThan(world.surfaceY + 100);
      }
    }
  });

  it('depth zones are ordered surface → bottom', () => {
    const world = computeWorld(1000, 600, 1, LOCATION_BY_ID.rybnik);
    const [a0] = zoneY(world, 'hladina');
    const [, b1] = zoneY(world, 'dno');
    expect(a0).toBeGreaterThan(world.surfaceY);
    expect(b1).toBeLessThan(world.bottomY);
  });

  it('has a sloping bank only where the fisherman stands on land', () => {
    const river = computeWorld(1000, 600, 1, LOCATION_BY_ID.reka);
    expect(wallX(river, river.surfaceY)).toBeLessThan(wallX(river, river.bottomY));
    const pond = computeWorld(1000, 600, 1, LOCATION_BY_ID.rybnik);
    expect(wallX(pond, pond.bottomY)).toBe(0);
  });

  it('bigger fish are drawn bigger, but not absurdly', () => {
    const world = computeWorld(1440, 840, 2, LOCATION_BY_ID.rybnik);
    expect(fishWidthPx(60, world)).toBeGreaterThan(fishWidthPx(10, world));
    expect(fishWidthPx(250, world)).toBeLessThan(world.w * 0.4);
    expect(fishWidthPx(4, world)).toBeGreaterThan(20);
  });
});

describe('time of day', () => {
  it('knows night and day', () => {
    expect(isNight(23)).toBe(true);
    expect(isNight(2)).toBe(true);
    expect(isNight(12)).toBe(false);
    expect(daylight(12)).toBeCloseTo(1, 2);
    expect(daylight(0)).toBeLessThan(0.5);
    expect(sunPosition(12)?.alt).toBeGreaterThan(0.9);
    expect(sunPosition(23)).toBeNull();
    expect(moonPosition(0)).not.toBeNull();
    expect(timeLabel(7).name).toBe('Ráno');
    expect(timeLabel(23).icon).toBe('🌙');
  });
});
