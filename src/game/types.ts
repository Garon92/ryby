import type { LocationId } from '../data/species';
import type { BaitId } from '../data/shop';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'timed' | 'free';
export type Rng = () => number;

export const MODE_LABEL: Record<GameMode, { name: string; icon: string; hint: string }> = {
  timed: { name: 'Výprava', icon: '⏱️', hint: '3 minuty, sbírej body a hvězdy.' },
  free: { name: 'Volné chytání', icon: '♾️', hint: 'Bez času, v klidu a pohodě.' },
};

export const TIMED_SECONDS = 180;

/** jeden úlovek (pro výsledky, mise, album) */
export interface CatchEvent {
  speciesId: string;
  sizeCm: number;
  rarity: number;
  location: LocationId;
  bait: BaitId;
  night: boolean;
  perfect: boolean;
  rainbow: boolean;
  trophy: boolean;
  newSpecies: boolean;
  record: boolean;
  points: number;
  coins: number;
}
