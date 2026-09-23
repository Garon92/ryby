import type { Difficulty } from '../types';

export interface BiteTuning {
  /** základní šance za sekundu, že si ryba v dosahu všimne návnady */
  interestRate: number;
  /** dosah, na který ryby návnadu ucítí (px při měřítku 1) */
  attractRadius: number;
  /** po kolika sekundách čekání se „přivolá“ ryba, aby se nečekalo dlouho */
  guaranteeAfter: number;
  /** počet okusů (ťukání do splávku) před záběrem: [min, max] */
  nibbles: [number, number];
  /** jak dlouho je splávek potopený – čas na zaseknutí (ms) */
  biteWindowMs: number;
  /** záběr se zasekne sám */
  autoHook: boolean;
  /** dokonalý hod: vzdálenost od ryby (px při měřítku 1) */
  perfectRadius: number;
}

export const BITE: Record<Difficulty, BiteTuning> = {
  easy: {
    interestRate: 1.1,
    attractRadius: 420,
    guaranteeAfter: 2.5,
    nibbles: [0, 1],
    biteWindowMs: 450,
    autoHook: true,
    perfectRadius: 90,
  },
  normal: {
    interestRate: 0.55,
    attractRadius: 320,
    guaranteeAfter: 6,
    nibbles: [1, 2],
    biteWindowMs: 1250,
    autoHook: false,
    perfectRadius: 70,
  },
  hard: {
    interestRate: 0.35,
    attractRadius: 260,
    guaranteeAfter: 9,
    nibbles: [1, 3],
    biteWindowMs: 750,
    autoHook: false,
    perfectRadius: 55,
  },
};

/**
 * Šance (za dt sekund), že si ryba všimne návnady.
 * affinity = chuť na návnadu, depth = shoda hloubky, dist01 = vzdálenost / dosah (0 = u návnady).
 */
export function interestChance(
  tuning: BiteTuning,
  affinity: number,
  depth: number,
  dist01: number,
  nightBonus: number,
  dt: number,
): number {
  if (dist01 >= 1 || affinity <= 0) return 0;
  const proximity = 1 - dist01 * 0.75;
  const rate = tuning.interestRate * affinity * depth * proximity * nightBonus;
  return 1 - Math.exp(-rate * dt);
}

/** Zasekl hráč včas? (t = ms od potopení splávku) */
export function hookResult(tuning: BiteTuning, msSinceBite: number): 'hooked' | 'late' {
  return msSinceBite <= tuning.biteWindowMs ? 'hooked' : 'late';
}
