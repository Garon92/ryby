import { describe, expect, it } from 'vitest';
import { defaultSave, LEGACY_KEYS, loadSave, migrateLegacy, normalizeSave, SAVE_KEY, type KV } from '../src/store/save';

function memKV(init: Record<string, string> = {}): KV & { data: Map<string, string> } {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('save', () => {
  it('normalizes garbage into a valid default save', () => {
    for (const junk of [null, 42, 'x', [], { coins: 'lots', album: 5, prefs: { difficulty: 'godmode' } }]) {
      const s = normalizeSave(junk);
      expect(s.v).toBe(1);
      expect(s.coins).toBe(0);
      expect(s.prefs.difficulty).toBe('easy');
      expect(s.owned.rod).toContain('wood');
    }
  });

  it('keeps valid data and drops invalid equipment', () => {
    const s = normalizeSave({
      coins: 12.7,
      album: { kapr_obecny: { count: 2, best: 55, first: '2026-01-01' }, bad: { count: 0 } },
      owned: { rod: ['gold'], bait: ['corn', 'dynamite'] },
      equipped: { rod: 'rainbow', bait: 'corn' },
    });
    expect(s.coins).toBe(12);
    expect(Object.keys(s.album)).toEqual(['kapr_obecny']);
    expect(s.owned.rod).toEqual(['wood', 'gold']);
    expect(s.owned.bait).toEqual(['worm', 'corn']);
    expect(s.equipped.rod).toBe('wood');
    expect(s.equipped.bait).toBe('corn');
  });

  it('migrates the original game keys', () => {
    const kv = memKV({
      coins: '37',
      bestScore: '812',
      ownedSkins: '[1,2]',
      rodSkinIdx: '2',
      dailyRewardDate: '2025-8-9',
      prefs: JSON.stringify({ music: false, hints: false, autopilot: true, sandbox: true, vignette: false, rays: false, particles: false }),
    });
    const { save, migrated } = loadSave(kv);
    expect(migrated).toBe(true);
    expect(save.coins).toBe(37);
    expect(save.stats.legacyBestScore).toBe(812);
    expect(save.owned.rod).toEqual(expect.arrayContaining(['wood', 'blue', 'gold']));
    expect(save.equipped.rod).toBe('gold');
    expect(save.daily.last).toBe('2025-08-09');
    expect(save.prefs.music).toBe(false);
    expect(save.prefs.hints).toBe(false);
    expect(save.prefs.autopilot).toBe(true);
    expect(save.prefs.mode).toBe('free');
    expect(save.prefs.effects).toBe('lite');
    // staré klíče jsou pryč, nový uložený
    for (const k of LEGACY_KEYS) expect(kv.data.has(k)).toBe(false);
    expect(JSON.parse(kv.data.get(SAVE_KEY)!).coins).toBe(37);
    // druhé načtení už nic nemigruje a nic neztratí
    const again = loadSave(kv);
    expect(again.migrated).toBe(false);
    expect(again.save.coins).toBe(37);
    expect(again.save.equipped.rod).toBe('gold');
  });

  it('merges legacy coins into an existing new save', () => {
    const base = defaultSave();
    base.coins = 5;
    const s = migrateLegacy((k) => (k === 'coins' ? '10' : null), base);
    expect(s.coins).toBe(15);
  });

  it('survives corrupted legacy JSON', () => {
    const kv = memKV({ ownedSkins: '{oops', prefs: 'nope', coins: 'NaN' });
    const { save } = loadSave(kv);
    expect(save.coins).toBe(0);
    expect(save.owned.rod).toEqual(['wood']);
  });
});
