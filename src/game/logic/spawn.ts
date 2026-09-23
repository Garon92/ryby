import type { LocationId, Species, Zone } from '../../data/species';
import type { BaitId } from '../../data/shop';
import type { Difficulty, Rng } from '../types';
import { clamp, pickWeighted } from './rng';

/** relativní četnost výskytu podle rarity 1–5 */
export const RARITY_WEIGHT: Record<number, number> = { 1: 10, 2: 6, 3: 3, 4: 1.4, 5: 0.55 };

const PREDATORISH = new Set(['jelec_tloust', 'jelec_jesen', 'okoun_ricni']);
const SALMONIDS = new Set([
  'pstruh_obecny_potocni',
  'pstruh_duhovy_americky',
  'siven_americky',
  'lipan_podhorni',
  'hlavatka_obecna_podunajska',
  'losos_obecny',
]);

/**
 * Jak moc druh láká daná návnada (0 = vůbec, 1 = normálně, >1 = miluje ji).
 * Vychází z potravy druhu: kukuřice pro kaprovité „všežravce“, třpytka pro dravce, muška pro lososovité a ryby u hladiny.
 */
export function baitAffinity(s: Species, bait: BaitId): number {
  const cyprinid = s.family === 'kaprovití';
  switch (bait) {
    case 'worm':
      switch (s.diet) {
        case 'vsezravec':
        case 'drobotina':
          return 1;
        case 'dravec':
          return 0.55;
        case 'bahno':
          return 0.45;
        case 'rasy':
          return 0.4;
        case 'plankton':
          return 0.3;
        case 'rostliny':
          return 0.25;
      }
      return 0.5;
    case 'corn':
      if (s.diet === 'rostliny') return 1.4;
      if (cyprinid && s.diet === 'vsezravec') return s.sizeMax >= 25 ? 1.3 : 0.9;
      if (cyprinid && (s.diet === 'plankton' || s.diet === 'rasy')) return 0.45;
      if (cyprinid) return 0.35;
      return s.diet === 'vsezravec' ? 0.3 : 0.05;
    case 'spinner':
      if (s.diet === 'dravec') return 1.5;
      if (PREDATORISH.has(s.id)) return 0.8;
      return 0.04;
    case 'fly':
      if (SALMONIDS.has(s.id)) return 1.45;
      if (s.zone === 'hladina' && s.diet !== 'plankton') return 1.15;
      if (s.diet === 'drobotina' && s.zone !== 'dno') return 0.6;
      return 0.08;
  }
}

/** Na obtížnosti Mrňous bere každá ryba na cokoli (jen s různou chutí). */
export function effectiveAffinity(s: Species, bait: BaitId, difficulty: Difficulty): number {
  const a = baitAffinity(s, bait);
  return difficulty === 'easy' ? Math.max(0.45, a) : a;
}

export interface SpawnContext {
  location: LocationId;
  night: boolean;
  bait: BaitId;
  difficulty: Difficulty;
}

export function spawnWeight(s: Species, ctx: SpawnContext): number {
  if (!s.locations.includes(ctx.location)) return 0;
  let w = RARITY_WEIGHT[s.rarity] ?? 1;
  // hlavní lokalita druhu (první v seznamu) má víc ryb
  if (s.locations[0] === ctx.location) w *= 1.25;
  if (ctx.night) w *= s.night ? 2.2 : 0.75;
  else if (s.night) w *= 0.7;
  // návnada přitahuje „své“ ryby
  w *= 0.55 + 0.45 * Math.min(1.5, effectiveAffinity(s, ctx.bait, ctx.difficulty));
  return w;
}

export function locationPool(all: readonly Species[], location: LocationId): Species[] {
  return all.filter((s) => s.locations.includes(location));
}

export function pickSpecies(pool: readonly Species[], ctx: SpawnContext, rng: Rng): Species | undefined {
  return pickWeighted(pool, (s) => spawnWeight(s, ctx), rng);
}

/**
 * Velikost úlovku v cm: většinou v běžném rozmezí (trojúhelníkové rozdělení),
 * vzácně (5 %) trofejní kus mezi běžným maximem a rekordem.
 */
export function rollSize(s: Species, rng: Rng): { cm: number; trophy: boolean } {
  if (rng() < 0.05) {
    const span = s.sizeRecord - s.sizeMax;
    const cm = s.sizeMax + span * (0.15 + 0.55 * rng());
    return { cm: Math.round(cm), trophy: true };
  }
  const t = (rng() + rng()) / 2;
  const cm = s.sizeMin + (s.sizeMax - s.sizeMin) * t;
  return { cm: Math.max(1, Math.round(cm)), trophy: false };
}

export const RAINBOW_CHANCE = 0.03;

/** preferované rozmezí hloubky (0 = hladina, 1 = dno) */
export function zoneRange(zone: Zone): [number, number] {
  switch (zone) {
    case 'hladina':
      return [0.04, 0.38];
    case 'stred':
      return [0.22, 0.75];
    case 'dno':
      return [0.62, 0.96];
  }
}

/** jak dobře sedí hloubka návnady (0 = hladina … 1 = dno) k zóně ryby */
export function depthMatch(zone: Zone, depth01: number): number {
  const [a, b] = zoneRange(zone);
  if (depth01 >= a - 0.08 && depth01 <= b + 0.08) return 1;
  const dist = depth01 < a ? a - depth01 : depth01 - b;
  return clamp(1 - dist * 1.6, 0.3, 1);
}
