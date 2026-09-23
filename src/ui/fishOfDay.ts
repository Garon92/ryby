import { h, sfx } from '../kit';
import { LOCATION_BY_ID } from '../data/locations';
import { SPECIES, type Species } from '../data/species';
import { dateKey } from '../game/logic/daily';
import { fishThumbUrl } from '../game/sprites';
import type { Save } from '../store/save';
import { gemsHTML } from './common';

/** Ryba dne – každý den jiná (stejná pro celý den). */
export function fishOfDay(d = new Date()): Species {
  const key = dateKey(d);
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  const list = [...SPECIES].sort((a, b) => a.id.localeCompare(b.id));
  return list[(hash >>> 0) % list.length] ?? list[0]!;
}

export function fishOfDayCard(save: Save, onOpen: (id: string) => void): HTMLElement {
  const s = fishOfDay();
  const known = !!save.album[s.id] || save.prefs.showUncaught;
  const fact = s.facts[new Date().getDate() % s.facts.length] ?? '';
  const btn = h('button', { type: 'button', class: `fod${save.album[s.id] ? '' : ' is-locked'}`, 'aria-label': `Ryba dne: ${known ? s.name : 'neznámá ryba'}` });
  btn.append(
    h('span', { class: 'fod__eyebrow' }, '🗓️ Ryba dne'),
    h('span', { class: 'fod__pic' }, h('img', { src: fishThumbUrl(s.id), alt: '', loading: 'lazy' })),
    h('span', { class: 'fod__name' }, known ? s.name : '???'),
    h('span', { class: 'fod__meta', html: `${gemsHTML(s.rarity)} ${s.locations.map((l) => LOCATION_BY_ID[l].icon).join(' ')}` }),
    h('span', { class: 'fod__fact' }, known ? fact : 'Poznáš ji? Chyť ji a dozvíš se o ní víc!'),
  );
  btn.addEventListener('click', () => {
    sfx.tap();
    onOpen(s.id);
  });
  return btn;
}
