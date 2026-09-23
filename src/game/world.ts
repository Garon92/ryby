import type { LocationDef } from '../data/locations';
import type { Zone } from '../data/species';
import { zoneRange } from './logic/spawn';

export interface World {
  w: number;
  h: number;
  dpr: number;
  /** měřítko kresby (0.55 malý mobil … 1.15 velký monitor) */
  scale: number;
  /** měřítko rybáře a jeho stanoviště (na mobilu o něco větší, aby byl vidět) */
  fs: number;
  portrait: boolean;
  surfaceY: number;
  bottomY: number;
  depth: number;
  /** kde stojí rybář (střed nohou) */
  fisherX: number;
  fisherY: number;
  /** levý okraj vody (břeh/skála) u hladiny a u dna – ryby tam neplavou */
  wallTop: number;
  wallBottom: number;
}

/** Nejlevější x, kde je v hloubce y ještě voda (kvůli břehu a skále). */
export function wallX(world: World, y: number): number {
  const t = Math.min(1, Math.max(0, (y - world.surfaceY) / world.depth));
  return world.wallTop + (world.wallBottom - world.wallTop) * t;
}

export function computeWorld(w: number, h: number, dpr: number, loc: LocationDef): World {
  const portrait = h > w * 1.1;
  const scale = Math.min(1.15, Math.max(0.55, Math.min(w, h * 1.6) / 1100));
  let surface = loc.surface;
  if (portrait) surface = Math.max(0.24, surface - 0.08);
  const surfaceY = Math.round(h * surface);
  const bed = Math.max(26, h * 0.06);
  const bottomY = h - bed;
  const fs = Math.min(1.35, Math.max(0.82, scale * 1.2));
  const fisherX = Math.round(portrait ? Math.max(58 * fs, w * 0.15) : Math.max(100, w * 0.12));
  const fisherY = surfaceY - (loc.spot === 'boat' ? 6 * fs : loc.spot === 'rock' ? 26 * fs : 14 * fs);
  const wallTop = loc.spot === 'bank' ? fisherX + 50 * fs : loc.spot === 'rock' ? fisherX + 64 * fs : 0;
  const wallBottom = loc.spot === 'bank' ? fisherX + 140 * fs : loc.spot === 'rock' ? fisherX + 112 * fs : 0;
  return { w, h, dpr, scale, fs, portrait, surfaceY, bottomY, depth: bottomY - surfaceY, fisherX, fisherY, wallTop, wallBottom };
}

export function zoneY(world: World, zone: Zone): [number, number] {
  const [a, b] = zoneRange(zone);
  return [world.surfaceY + world.depth * a, world.surfaceY + world.depth * b];
}

export function depth01(world: World, y: number): number {
  return Math.min(1, Math.max(0, (y - world.surfaceY) / world.depth));
}

/** šířka ryby v CSS px podle skutečné délky */
export function fishWidthPx(cm: number, world: World): number {
  return 13 * Math.pow(cm, 0.66) * world.scale;
}
