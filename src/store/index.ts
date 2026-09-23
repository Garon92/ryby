import { createStore } from '../kit';
import { defaultSave, hasLegacy, LEGACY_KEYS, migrateLegacy, normalizeSave, type Save } from './save';

/**
 * Postup hráče v `g92:ryby:save` (kit store). Při prvním spuštění se převezmou klíče z původní hry
 * (mince, rekord, skiny prutu, denní odměna, předvolby) a staré klíče se smažou.
 */
const store = createStore<{ save: Save }>('ryby', {
  version: 1,
  defaults: { save: defaultSave() },
  migrate(from, m) {
    if (from < 1) {
      const get = (k: string) => m.legacy(k);
      if (hasLegacy(get)) {
        m.set('save', migrateLegacy(get, normalizeSave(m.get('save'))));
        for (const k of LEGACY_KEYS) m.removeLegacy(k);
      }
    }
  },
});

export const save: Save = normalizeSave(store.get('save'));

let timer = 0;
/** Uloží postup (s krátkým odkladem, ať se neukládá každý snímek). */
export function persist(now = false): void {
  clearTimeout(timer);
  if (now) store.set('save', save);
  else timer = window.setTimeout(() => store.set('save', save), 150);
}

export function resetSave(): void {
  const fresh = defaultSave();
  fresh.prefs = { ...save.prefs, seenHelp: true };
  Object.assign(save, fresh);
  persist(true);
}

window.addEventListener('pagehide', () => persist(true));
