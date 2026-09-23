import { describe, expect, it } from 'vitest';
import { SPECIES } from '../src/data/species';
import { LOCATIONS } from '../src/data/locations';
import images from '../src/data/fish-images.json';

describe('species data', () => {
  it('has 59 unique species, each with an image', () => {
    expect(SPECIES).toHaveLength(59);
    const ids = new Set(SPECIES.map((s) => s.id));
    expect(ids.size).toBe(59);
    for (const s of SPECIES) expect(images).toHaveProperty(s.id);
  });

  it('uses Czech capitalisation (only the first word capitalised, except proper names)', () => {
    for (const s of SPECIES) {
      const words = s.name.split(' ');
      expect(words[0]?.[0]).toBe(words[0]?.[0]?.toUpperCase());
      for (const w of words.slice(1)) {
        if (w === 'Kesslerův') continue;
        expect(w[0], s.name).toBe(w[0]?.toLowerCase());
      }
      expect(s.name).not.toMatch(/\(|\s{2}/);
    }
  });

  it('has sane sizes, latin names and facts', () => {
    for (const s of SPECIES) {
      expect(s.sizeMin).toBeGreaterThan(0);
      expect(s.sizeMax).toBeGreaterThan(s.sizeMin);
      expect(s.sizeRecord).toBeGreaterThanOrEqual(s.sizeMax);
      expect(s.latin).toMatch(/^[A-Z][a-z]+ [a-z]+$/);
      expect(s.facts.length).toBeGreaterThanOrEqual(2);
      expect(s.locations.length).toBeGreaterThan(0);
      for (const f of s.facts) expect(f).toMatch(/[.!]$/);
    }
    // oprava chyby v původních datech (vranka měla max. 150 cm)
    expect(SPECIES.find((s) => s.id === 'vranka_obecna')?.sizeRecord).toBeLessThan(25);
  });

  it('gives every location enough species of several rarities', () => {
    for (const loc of LOCATIONS) {
      const pool = SPECIES.filter((s) => s.locations.includes(loc.id));
      expect(pool.length, loc.id).toBeGreaterThanOrEqual(14);
      const rarities = new Set(pool.map((s) => s.rarity));
      expect(rarities.size, loc.id).toBeGreaterThanOrEqual(4);
      expect(pool.some((s) => s.rarity === 1), loc.id).toBe(true);
    }
  });
});
