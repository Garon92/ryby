import { describe, expect, it } from 'vitest';
import { getSpecies } from '../src/data/species';
import { autoReel, fightStrength, newFight, stepFight, type FightParams, type FightState } from '../src/game/logic/fight';
import { mulberry32 } from '../src/game/logic/rng';
import type { Difficulty } from '../src/game/types';

function simulate(p: FightParams, policy: (s: FightState, prev: boolean) => boolean, seed = 1, maxT = 90) {
  const rng = mulberry32(seed);
  let s = newFight(rng);
  let reeling = true;
  const dt = 1 / 60;
  while (!s.result && s.elapsed < maxT) {
    reeling = policy(s, reeling);
    s = stepFight(s, p, reeling, dt, rng);
  }
  return s;
}

const params = (id: string, cm: number, difficulty: Difficulty): FightParams => ({
  strength: fightStrength(getSpecies(id), cm, difficulty),
  difficulty,
});

describe('fight', () => {
  it('a small roach comes in quickly when you just hold', () => {
    const s = simulate(params('plotice_obecna', 20, 'normal'), () => true);
    expect(s.result).toBe('caught');
    expect(s.elapsed).toBeLessThan(5);
  });

  it('holding all the time on a big catfish snaps the line (normal)', () => {
    let snapped = 0;
    for (let seed = 1; seed <= 10; seed++) {
      if (simulate(params('sumec_velky', 130, 'normal'), () => true, seed).result === 'snapped') snapped++;
    }
    expect(snapped).toBeGreaterThanOrEqual(8);
  });

  it('a sensible player lands the big catfish', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = simulate(params('sumec_velky', 130, 'normal'), (st, prev) => autoReel(st, prev), seed);
      expect(s.result, `seed ${seed}`).toBe('caught');
      expect(s.elapsed).toBeLessThan(40);
    }
  });

  it('never snaps or escapes on the easiest difficulty', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(simulate(params('sumec_velky', 160, 'easy'), () => true, seed).result).toBe('caught');
    }
    // i když dítě nic nedělá, ryba neuteče (jen čeká)
    const idle = simulate(params('kapr_obecny', 60, 'easy'), () => false, 1, 20);
    expect(idle.result).toBeNull();
  });

  it('letting go for too long lets the fish escape (normal)', () => {
    const s = simulate(params('stika_obecna', 70, 'normal'), () => false, 2, 120);
    expect(s.result).toBe('escaped');
  });

  it('strength scales with size', () => {
    expect(fightStrength(getSpecies('kapr_obecny'), 60, 'normal')).toBeGreaterThan(fightStrength(getSpecies('kapr_obecny'), 30, 'normal'));
    expect(fightStrength(getSpecies('slunka_obecna_stribrita'), 5, 'normal')).toBeLessThan(0.3);
  });
});
