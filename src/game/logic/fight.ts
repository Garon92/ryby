import type { Species } from '../../data/species';
import type { Difficulty, Rng } from '../types';
import { clamp } from './rng';

/**
 * Zdolávání ryby.
 *  - hráč drží (navíjí) → vzdálenost klesá, ale roste napětí vlasce
 *  - ryba občas „vyrazí“ (výpad) → napětí prudce stoupá, je dobré povolit
 *  - napětí ≥ 1 příliš dlouho → vlasec praskne (ne na Mrňous)
 *  - ryba odplave moc daleko → uteče (ne na Mrňous)
 */
export interface FightParams {
  /** síla ryby (~0.15 malá rybka … ~4 obří sumec) */
  strength: number;
  difficulty: Difficulty;
}

export interface FightState {
  /** 1 = na začátku, 0 = u rybáře */
  distance: number;
  /** 0..1 (1 = mez pevnosti) */
  tension: number;
  /** únava ryby 1 → 0 */
  stamina: number;
  running: boolean;
  runLeft: number;
  runCooldown: number;
  /** jak dlouho je napětí na maximu */
  overload: number;
  elapsed: number;
  result: null | 'caught' | 'snapped' | 'escaped';
}

export const REEL_SPEED = 0.55;
/** ryba si vzala tolik vlasce, že uplavala */
export const ESCAPE_DISTANCE = 1.9;
export const SNAP_TIME: Record<Difficulty, number> = { easy: Infinity, normal: 0.8, hard: 0.38 };
const STRENGTH_MUL: Record<Difficulty, number> = { easy: 0.7, normal: 1, hard: 1.18 };

export function fightStrength(s: Species, sizeCm: number, difficulty: Difficulty): number {
  const sizeFactor = clamp(Math.pow(sizeCm / 40, 0.8), 0.18, 3.2);
  return (s.fight ?? 1) * sizeFactor * STRENGTH_MUL[difficulty];
}

export function newFight(rng: Rng): FightState {
  return {
    distance: 1,
    tension: 0.25,
    stamina: 1,
    running: false,
    runLeft: 0,
    runCooldown: 0.6 + rng() * 1.2,
    overload: 0,
    elapsed: 0,
    result: null,
  };
}

/** aktuální tah ryby */
export function fishPull(p: FightParams, st: FightState): number {
  return p.strength * (0.3 + 0.7 * st.stamina) * (st.running ? 1 : 0.35);
}

export function stepFight(st: FightState, p: FightParams, reeling: boolean, dt: number, rng: Rng): FightState {
  if (st.result) return st;
  const s: FightState = { ...st };
  s.elapsed += dt;

  // výpady ryby
  if (s.running) {
    s.runLeft -= dt;
    if (s.runLeft <= 0) {
      s.running = false;
      s.runCooldown = (1.4 + rng() * 2.2) / Math.max(0.6, Math.sqrt(p.strength));
    }
  } else if (p.strength >= 0.6) {
    s.runCooldown -= dt;
    if (s.runCooldown <= 0 && s.stamina > 0.12) {
      s.running = true;
      s.runLeft = 0.8 + rng() * 0.9 * Math.min(1.6, p.strength / 1.5);
    }
  }

  const pull = fishPull(p, s);
  const target = reeling ? 0.2 + pull * 0.45 : pull * 0.18;
  const rate = target > s.tension ? 3.5 : 5;
  s.tension += (target - s.tension) * (1 - Math.exp(-rate * dt));
  if (p.difficulty === 'easy') s.tension = Math.min(s.tension, 0.94);
  s.tension = clamp(s.tension, 0, 1.25);

  // navíjení přitahuje, ryba táhne pryč (hlavně při výpadu)
  if (reeling) s.distance -= REEL_SPEED * Math.max(0.12, 1 - pull * 0.45) * dt;
  s.distance += Math.pow(pull, 0.7) * (s.running ? 0.2 : 0.035) * dt;

  // únava: čím víc napětí, tím rychleji ryba slábne
  s.stamina = clamp(s.stamina - (dt * (0.07 + s.tension * 0.28 + (s.running ? 0.15 : 0))) / (0.5 + p.strength * 0.3), 0, 1);

  if (s.tension >= 1) s.overload += dt;
  else s.overload = Math.max(0, s.overload - dt * 1.2);

  if (p.difficulty === 'easy') s.distance = Math.min(s.distance, 1.2);

  if (s.distance <= 0) {
    s.distance = 0;
    s.result = 'caught';
  } else if (s.overload >= SNAP_TIME[p.difficulty]) {
    s.result = 'snapped';
  } else if (s.distance >= ESCAPE_DISTANCE) {
    s.result = 'escaped';
  }
  return s;
}

/** Jednoduchá „rozumná“ strategie (autopilot, testy): navíjej, v červeném povol. */
export function autoReel(st: FightState, wasReeling: boolean): boolean {
  if (st.tension > 0.86) return false;
  if (st.tension < 0.72) return true;
  return wasReeling;
}
