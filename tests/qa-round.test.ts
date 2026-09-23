import { describe, expect, it } from 'vitest';
import { describeMission } from '../src/game/logic/missions';
import { fishOfDay } from '../src/game/logic/fishOfDay';
import { defaultSave, legacyVoiceOff, normalizeSave } from '../src/store/save';

describe('QA round', () => {
  it('RYBY-09: fish of the day is always catchable for the player', () => {
    const fresh = defaultSave();
    for (let d = 0; d < 400; d++) {
      const day = new Date(2026, 0, 1 + d);
      const s = fishOfDay(fresh, day);
      expect(s.locations, s.id).toContain('rybnik');
      expect(s.rarity, s.id).toBeLessThanOrEqual(3);
    }
    const pro = defaultSave();
    pro.xp = 99999;
    const seen = new Set<number>();
    for (let d = 0; d < 400; d++) seen.add(fishOfDay(pro, new Date(2026, 0, 1 + d)).rarity);
    expect(seen.has(5)).toBe(true);
  });

  it('RYBY-09: the same fish all day long', () => {
    const s = defaultSave();
    expect(fishOfDay(s, new Date(2026, 8, 23, 7)).id).toBe(fishOfDay(s, new Date(2026, 8, 23, 22)).id);
  });

  it('RYBY-11: species missions read as a sentence (no „Chyť: …“)', () => {
    const t = describeMission({ id: 'x', kind: 'species', target: 1, progress: 0, reward: 10, species: 'lin_obecny' }, () => 'Lín obecný').text;
    expect(t).toBe('Ulov druh Lín obecný');
    expect(t).not.toContain(':');
    const count = (n: number) => describeMission({ id: 'c', kind: 'count', target: n, progress: 0, reward: 5 }).text;
    expect(count(1)).toBe('Chyť 1 rybu');
    expect(count(3)).toBe('Chyť 3 ryby');
    expect(count(6)).toBe('Chyť 6 ryb');
  });

  it('C-13: the old ryby "Hlas" switch migrates to the kit voice setting only when it was turned off', () => {
    expect(legacyVoiceOff({ prefs: { voice: false } })).toBe(true);
    expect(legacyVoiceOff({ prefs: { voice: true } })).toBe(false);
    expect(legacyVoiceOff({ prefs: {} })).toBe(false);
    expect(legacyVoiceOff(null)).toBe(false);
    expect(legacyVoiceOff('junk')).toBe(false);
    // the normalized save no longer carries its own voice flag
    const s = normalizeSave({ prefs: { voice: false, music: false } });
    expect('voice' in s.prefs).toBe(false);
    expect(s.prefs.music).toBe(false);
  });
});
