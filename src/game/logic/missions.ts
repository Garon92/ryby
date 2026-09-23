import type { LocationId, Species } from '../../data/species';
import type { BaitId } from '../../data/shop';
import type { CatchEvent, Rng } from '../types';
import { pickWeighted } from './rng';

export type MissionKind =
  | 'count'
  | 'species'
  | 'rarity'
  | 'location'
  | 'size'
  | 'perfect'
  | 'newSpecies'
  | 'night'
  | 'bait'
  | 'combo';

export interface Mission {
  id: string;
  kind: MissionKind;
  target: number;
  progress: number;
  reward: number;
  species?: string;
  minRarity?: number;
  location?: LocationId;
  minSize?: number;
  bait?: BaitId;
}

export interface MissionContext {
  species: readonly Species[];
  unlocked: readonly LocationId[];
  ownedBaits: readonly BaitId[];
  caught: ReadonlySet<string>;
  level: number;
}

const LOCATION_NAME: Record<LocationId, string> = {
  rybnik: 'v rybníce',
  reka: 'v řece',
  potok: 'v potoce',
  prehrada: 'na přehradě',
};
const BAIT_NAME: Record<BaitId, string> = { worm: 'na žížalu', corn: 'na kukuřici', spinner: 'na třpytku', fly: 'na mušku' };
const BAIT_ICON: Record<BaitId, string> = { worm: '🪱', corn: '🌽', spinner: '✨', fly: '🪰' };
const LOCATION_ICON: Record<LocationId, string> = { rybnik: '🪷', reka: '🌉', potok: '🌲', prehrada: '⛵' };

/** „1 rybu / 2 ryby / 5 ryb“ (4. pád) */
const ryb = (n: number) => (n === 1 ? 'rybu' : n >= 2 && n <= 4 ? 'ryby' : 'ryb');

export function isDone(m: Mission): boolean {
  return m.progress >= m.target;
}

export function describeMission(m: Mission, speciesName?: (id: string) => string): { icon: string; text: string } {
  const n = m.target;
  switch (m.kind) {
    case 'count':
      return { icon: '🐟', text: `Chyť ${n} ${ryb(n)}` };
    case 'species':
      return { icon: '🔍', text: `Ulov druh ${speciesName?.(m.species ?? '') ?? m.species}` };
    case 'rarity':
      return {
        icon: '💎',
        text:
          (m.minRarity ?? 3) >= 4
            ? 'Chyť vzácnou rybu'
            : n > 1
              ? `Chyť ${n} vzácnější ryby`
              : 'Chyť vzácnější rybu',
      };
    case 'location':
      return {
        icon: LOCATION_ICON[m.location ?? 'rybnik'],
        text: `Chyť ${n} ${ryb(n)} ${LOCATION_NAME[m.location ?? 'rybnik']}`,
      };
    case 'size':
      return { icon: '📏', text: `Chyť rybu delší než ${m.minSize} cm` };
    case 'perfect':
      return { icon: '🎯', text: n > 1 ? `Perfektní hod ${n}×` : 'Udělej perfektní hod' };
    case 'newSpecies':
      return { icon: '📖', text: n > 1 ? `Objev ${n} nové druhy` : 'Objev nový druh do alba' };
    case 'night':
      return { icon: '🌙', text: `Chyť ${n} ${ryb(n)} v noci` };
    case 'bait':
      return { icon: BAIT_ICON[m.bait ?? 'worm'], text: `Chyť ${n} ${ryb(n)} ${BAIT_NAME[m.bait ?? 'worm']}` };
    case 'combo':
      return { icon: '🔥', text: `Udělej sérii ${n} úlovků` };
  }
}

let seq = 0;
function uid(rng: Rng): string {
  seq = (seq + 1) % 1e6;
  return `m${Math.floor(rng() * 1e9).toString(36)}${seq.toString(36)}`;
}

/** Vytvoří novou misi, která se nekryje druhem s těmi, co už běží. */
export function generateMission(ctx: MissionContext, existing: readonly Mission[], rng: Rng): Mission {
  const taken = new Set(existing.map((m) => m.kind));
  const lvl = Math.max(1, ctx.level);
  const pool = ctx.species.filter((s) => s.locations.some((l) => ctx.unlocked.includes(l)));
  const candidates: { kind: MissionKind; w: number }[] = [
    { kind: 'count', w: 3 },
    { kind: 'species', w: 3 },
    { kind: 'rarity', w: 2 },
    { kind: 'size', w: 2 },
    { kind: 'perfect', w: 2 },
    { kind: 'newSpecies', w: ctx.caught.size < pool.length ? 2 : 0 },
    { kind: 'night', w: 1.2 },
    { kind: 'combo', w: 1.5 },
    { kind: 'location', w: ctx.unlocked.length > 1 ? 1.5 : 0 },
    { kind: 'bait', w: ctx.ownedBaits.some((b) => b !== 'worm') ? 1.5 : 0 },
  ];
  const pick = pickWeighted(
    candidates.filter((c) => !taken.has(c.kind)),
    (c) => c.w,
    rng,
  );
  const kind: MissionKind = pick?.kind ?? 'count';
  const base = { id: uid(rng), kind, progress: 0 };
  switch (kind) {
    case 'count': {
      const target = Math.min(12, 3 + Math.floor(rng() * 3) + Math.floor(lvl / 2));
      return { ...base, target, reward: 5 + target * 2 };
    }
    case 'species': {
      const easy = pool.filter((s) => s.rarity <= Math.min(3, 1 + Math.ceil(lvl / 2)));
      const fresh = easy.filter((s) => !ctx.caught.has(s.id));
      const from = fresh.length && rng() < 0.7 ? fresh : easy.length ? easy : pool;
      const s = from[Math.floor(rng() * from.length)] ?? pool[0];
      return { ...base, target: 1, species: s?.id ?? 'plotice_obecna', reward: 10 + (s?.rarity ?? 1) * 5 };
    }
    case 'rarity': {
      const minRarity = lvl >= 4 && rng() < 0.4 ? 4 : 3;
      const target = minRarity === 4 ? 1 : 1 + Math.floor(rng() * 2);
      return { ...base, target, minRarity, reward: minRarity === 4 ? 30 : 12 + target * 6 };
    }
    case 'size': {
      const maxAvail = Math.max(...pool.map((s) => s.sizeMax), 20);
      const options = [20, 30, 40, 50, 60].filter((v) => v <= maxAvail - 5);
      const minSize = options[Math.floor(rng() * options.length)] ?? 20;
      return { ...base, target: 1, minSize, reward: 8 + Math.round(minSize / 4) };
    }
    case 'perfect': {
      const target = 1 + Math.floor(rng() * 3);
      return { ...base, target, reward: 8 + target * 5 };
    }
    case 'newSpecies':
      return { ...base, target: 1, reward: 20 };
    case 'night': {
      const target = 1 + Math.floor(rng() * 2);
      return { ...base, target, reward: 12 + target * 5 };
    }
    case 'combo': {
      const target = 3 + Math.floor(rng() * 2);
      return { ...base, target, reward: 10 + target * 3 };
    }
    case 'location': {
      const others = ctx.unlocked.filter((l) => l !== 'rybnik');
      const location = (others.length ? others : ctx.unlocked)[Math.floor(rng() * (others.length || ctx.unlocked.length))] ?? 'rybnik';
      const target = 3 + Math.floor(rng() * 3);
      return { ...base, target, location, reward: 8 + target * 3 };
    }
    case 'bait': {
      const baits = ctx.ownedBaits.filter((b) => b !== 'worm');
      const bait = baits[Math.floor(rng() * baits.length)] ?? 'worm';
      const target = 1 + Math.floor(rng() * 2);
      return { ...base, target, bait, reward: 10 + target * 5 };
    }
  }
}

export function fillMissions(ctx: MissionContext, current: readonly Mission[], rng: Rng, count = 3): Mission[] {
  const out = [...current];
  while (out.length < count) out.push(generateMission(ctx, out, rng));
  return out;
}

export type MissionEvent = { type: 'catch'; ev: CatchEvent; combo: number } | { type: 'perfect' };

/** Vrátí aktualizovanou misi (nová instance jen při změně). */
export function applyMissionEvent(m: Mission, e: MissionEvent): Mission {
  if (isDone(m)) return m;
  let inc = 0;
  if (e.type === 'perfect') {
    if (m.kind === 'perfect') inc = 1;
  } else {
    const ev = e.ev;
    switch (m.kind) {
      case 'count':
        inc = 1;
        break;
      case 'species':
        inc = ev.speciesId === m.species ? 1 : 0;
        break;
      case 'rarity':
        inc = ev.rarity >= (m.minRarity ?? 3) ? 1 : 0;
        break;
      case 'location':
        inc = ev.location === m.location ? 1 : 0;
        break;
      case 'size':
        inc = ev.sizeCm > (m.minSize ?? 0) ? 1 : 0;
        break;
      case 'newSpecies':
        inc = ev.newSpecies ? 1 : 0;
        break;
      case 'night':
        inc = ev.night ? 1 : 0;
        break;
      case 'bait':
        inc = ev.bait === m.bait ? 1 : 0;
        break;
      case 'combo':
        // série: progress = nejvyšší dosažená série
        if (e.combo > m.progress) return { ...m, progress: Math.min(m.target, e.combo) };
        return m;
      case 'perfect':
        inc = 0;
        break;
    }
  }
  if (!inc) return m;
  return { ...m, progress: Math.min(m.target, m.progress + inc) };
}
