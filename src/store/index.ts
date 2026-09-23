import { createStore, setSettings } from '../kit';
import { defaultSave, hasLegacy, LEGACY_KEYS, legacyVoiceOff, migrateLegacy, normalizeSave, type Save } from './save';

/**
 * Postup hráče v `g92:ryby:save` (kit store). Při prvním spuštění se převezmou klíče z původní hry
 * (mince, rekord, skiny prutu, denní odměna, předvolby) a staré klíče se smažou.
 */
const store = createStore<{ save: Save }>('ryby', {
  version: 2,
  defaults: { save: defaultSave() },
  migrate(from, m) {
    if (from < 1) {
      const get = (k: string) => m.legacy(k);
      if (hasLegacy(get)) {
        m.set('save', migrateLegacy(get, normalizeSave(m.get('save'))));
        for (const k of LEGACY_KEYS) m.removeLegacy(k);
      }
    }
    if (from < 2) {
      // vlastní „Hlas“ → rodinné „Předčítání“ kitu (v2)
      if (legacyVoiceOff(m.get('save'))) setSettings({ voice: false });
      m.set('save', normalizeSave(m.get('save')));
    }
  },
});

export const save: Save = normalizeSave(store.get('save'));

let timer = 0;
let wiped = false;
/** Uloží postup (s krátkým odkladem, ať se neukládá každý snímek). */
export function persist(now = false): void {
  clearTimeout(timer);
  if (wiped) return;
  if (now) store.set('save', save);
  else timer = window.setTimeout(() => store.set('save', save), 150);
}

/** Před `resetApp('ryby')` + reloadem: už nic neukládat (jinak by pagehide postup zase zapsal). */
export function wipeSave(): void {
  wiped = true;
  clearTimeout(timer);
}

window.addEventListener('pagehide', () => persist(true));
