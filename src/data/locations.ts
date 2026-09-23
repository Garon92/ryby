import type { LocationId } from './species';

export interface LocationDef {
  id: LocationId;
  name: string;
  icon: string;
  /** krátký popis pro děti */
  blurb: string;
  /** rybářská úroveň potřebná k odemčení */
  unlockLevel: number;
  /** rychlost proudu (px/s při měřítku 1), 0 = stojatá voda */
  current: number;
  /** kde začíná hladina (podíl výšky scény) – nižší číslo = víc vody */
  surface: number;
  /** průhlednost vody 0..1 (potok je čirý, rybník kalnější) */
  clarity: number;
  /** barvy vody: hladina → dno */
  water: [string, string, string];
  /** dno */
  bed: 'mud' | 'sand' | 'gravel' | 'rock';
  /** kde stojí rybář */
  spot: 'pier' | 'bank' | 'rock' | 'boat';
  /** kolik ryb současně plave (při šířce 1000 px) */
  population: number;
}

export const LOCATIONS: LocationDef[] = [
  {
    id: 'rybnik',
    name: 'Rybník',
    icon: '🪷',
    blurb: 'Klidná voda, rákosí a kapři. Tady začíná každý rybář.',
    unlockLevel: 1,
    current: 0,
    surface: 0.36,
    clarity: 0.55,
    water: ['#3f9fb0', '#2a7a86', '#1c4f55'],
    bed: 'mud',
    spot: 'pier',
    population: 11,
  },
  {
    id: 'reka',
    name: 'Řeka',
    icon: '🌉',
    blurb: 'Široká řeka s proudem. Žijí tu parmy, candáti i obří sumci.',
    unlockLevel: 2,
    current: 26,
    surface: 0.35,
    clarity: 0.6,
    water: ['#4a93a8', '#2f6f86', '#1d4658'],
    bed: 'sand',
    spot: 'bank',
    population: 12,
  },
  {
    id: 'potok',
    name: 'Potok',
    icon: '🌲',
    blurb: 'Studená čistá voda mezi kameny. Domov pstruhů a vranek.',
    unlockLevel: 3,
    current: 42,
    surface: 0.42,
    clarity: 0.85,
    water: ['#69c3cf', '#3f99a8', '#2a6b73'],
    bed: 'gravel',
    spot: 'rock',
    population: 9,
  },
  {
    id: 'prehrada',
    name: 'Přehrada',
    icon: '⛵',
    blurb: 'Hluboká voda pod horami. Síhové, candáti a velké štiky.',
    unlockLevel: 4,
    current: 0,
    surface: 0.3,
    clarity: 0.5,
    water: ['#357fb5', '#1f5588', '#0f2e52'],
    bed: 'rock',
    spot: 'boat',
    population: 12,
  },
];

export const LOCATION_BY_ID: Record<LocationId, LocationDef> = Object.fromEntries(
  LOCATIONS.map((l) => [l.id, l]),
) as Record<LocationId, LocationDef>;
