import { h, sfx, UI_ICONS } from '../kit';
import { LOCATIONS, LOCATION_BY_ID } from '../data/locations';
import { DIET_LABEL, RARITY_LABEL, SPECIES, ZONE_LABEL, type LocationId, type Species } from '../data/species';
import { BAITS, type BaitId } from '../data/shop';
import { baitAffinity } from '../game/logic/spawn';
import { speech } from '../game/speech';
import { fishImageUrl, fishThumbUrl } from '../game/sprites';
import { albumProgress } from '../game/rewards';
import type { Save } from '../store/save';
import { esc, fmtDate, gemsHTML, plural, rarityHTML } from './common';
import { openSheet, tabButton } from './sheet';

type Filter = 'all' | LocationId | 'caught';

const ORDER = [...SPECIES].sort((a, b) => a.name.localeCompare(b.name, 'cs'));

export function bestBait(s: Species): BaitId {
  let best: BaitId = 'worm';
  let v = -1;
  for (const b of BAITS) {
    const a = baitAffinity(s, b.id as BaitId);
    if (a > v + 0.05) {
      v = a;
      best = b.id as BaitId;
    }
  }
  return best;
}

/** Album jako encyklopedie: mřížka + detail každé ryby. */
export function openAlbum(save: Save, opts: { focus?: string; filter?: Filter } = {}): Promise<void> {
  let filter: Filter = opts.filter ?? 'all';
  let detail: Species | null = null;
  const prog = albumProgress(save);
  const sheet = openSheet({
    title: 'Album ryb',
    icon: '📖',
    sub: `Chyceno ${prog.caught} z ${prog.total} druhů`,
    onKey: (e) => {
      if (!detail) return false;
      if (e.key === 'Escape') {
        showGrid();
        return true;
      }
      if (e.key === 'ArrowRight') {
        step(1);
        return true;
      }
      if (e.key === 'ArrowLeft') {
        step(-1);
        return true;
      }
      return false;
    },
  });

  const visible = (): Species[] =>
    ORDER.filter((s) => {
      if (filter === 'all') return true;
      if (filter === 'caught') return !!save.album[s.id];
      return s.locations.includes(filter);
    });

  function renderTabs(): void {
    sheet.tabs.textContent = '';
    const add = (f: Filter, label: string) =>
      sheet.tabs.append(
        tabButton(label, f === filter, () => {
          filter = f;
          showGrid();
        }),
      );
    add('all', 'Všechny');
    for (const l of LOCATIONS) {
      const p = albumProgress(save, l.id);
      add(l.id, `${l.icon} ${l.name} ${p.caught}/${p.total}`);
    }
    add('caught', '✅ Chycené');
  }

  function showGrid(): void {
    detail = null;
    speech.stop();
    renderTabs();
    const list = visible();
    const body = sheet.body;
    body.textContent = '';
    const p = filter === 'all' || filter === 'caught' ? albumProgress(save) : albumProgress(save, filter);
    body.append(
      h(
        'div',
        { class: 'album-summary' },
        h('b', null, `${p.caught} / ${p.total}`),
        h('div', { class: 'g92-progress', style: `--value:${p.total ? p.caught / p.total : 0}`, role: 'progressbar', 'aria-valuenow': p.caught, 'aria-valuemax': p.total, 'aria-label': 'Sbírka' }),
      ),
    );
    if (!list.length) {
      body.append(h('div', { class: 'g92-empty' }, 'Zatím tu nic není – běž chytat! 🎣'));
      return;
    }
    const grid = h('div', { class: 'album-grid' });
    for (const s of list) grid.append(card(s));
    body.append(grid);
    if (opts.focus) {
      const el = grid.querySelector<HTMLElement>(`[data-id="${opts.focus}"]`);
      el?.scrollIntoView({ block: 'center' });
      el?.focus({ preventScroll: true });
      opts.focus = undefined;
    }
  }

  function card(s: Species): HTMLElement {
    const e = save.album[s.id];
    const known = !!e || save.prefs.showUncaught;
    const btn = h('button', {
      type: 'button',
      class: `fish-card${e ? '' : ' is-locked'}`,
      'data-id': s.id,
      'aria-label': e || save.prefs.showUncaught ? s.name : 'Neznámá ryba',
    });
    const img = h('img', { src: fishThumbUrl(s.id), alt: '', loading: 'lazy', decoding: 'async', width: 128, height: 64 });
    btn.append(
      h('span', { class: 'pic' }, img),
      h('span', { class: 'nm' }, known ? s.name : '???'),
      h('span', { class: 'meta', html: `${gemsHTML(s.rarity)}${e ? `<span>${e.best} cm</span>` : ''}` }),
    );
    btn.append(h('span', { class: 'no', 'aria-hidden': 'true' }, `#${String(ORDER.indexOf(s) + 1).padStart(2, '0')}`));
    if (e) btn.append(h('span', { class: 'count' }, `×${e.count}`));
    const flags = `${e?.rainbow ? '🌈' : ''}${e?.trophy ? '🏆' : ''}${s.protected && e ? '💚' : ''}`;
    if (flags) btn.append(h('span', { class: 'flag', 'aria-hidden': 'true' }, flags));
    btn.addEventListener('click', () => {
      sfx.tap();
      showDetail(s);
    });
    return btn;
  }

  function step(d: number): void {
    const list = visible();
    if (!detail) return;
    const i = list.findIndex((s) => s.id === detail?.id);
    const next = list[(i + d + list.length) % list.length];
    if (next) {
      sfx.flip();
      showDetail(next);
    }
  }

  function showDetail(s: Species): void {
    detail = s;
    speech.stop();
    sheet.tabs.textContent = '';
    const back = h('button', { type: 'button', class: 'g92-chip', html: `${UI_ICONS.back}<span>Zpět na album</span>` });
    back.addEventListener('click', () => {
      sfx.tap();
      showGrid();
    });
    sheet.tabs.append(back);
    const e = save.album[s.id];
    const known = !!e || save.prefs.showUncaught;
    const body = sheet.body;
    body.textContent = '';
    body.scrollTop = 0;
    const pic = h('div', { class: `fish-detail__pic${e ? '' : ' is-locked'}` }, h('img', { src: fishImageUrl(s.id), alt: known ? s.name : 'Neznámá ryba', decoding: 'async' }));
    const headEl = h('div', { class: 'fish-detail__head' });
    const bait = BAITS.find((b) => b.id === bestBait(s));
    if (known) {
      headEl.append(h('h2', null, s.name));
      if (s.alias) headEl.append(h('div', { class: 'alias' }, `(${s.alias})`));
      headEl.append(h('div', { class: 'latin', lang: 'la' }, s.latin));
    } else {
      headEl.append(h('h2', null, '??? '), h('div', { class: 'alias' }, 'Tuhle rybu jsi ještě nechytil(a).'));
    }
    headEl.append(h('div', { html: rarityHTML(s.rarity) }));
    const locTags = h('div', { class: 'tag-row' });
    for (const l of s.locations) {
      const L = LOCATION_BY_ID[l];
      locTags.append(h('span', { class: 'g92-chip' }, `${L.icon} ${L.name}`));
    }
    headEl.append(locTags);

    const right = h('div', { class: 'g92-stack', style: 'gap:12px' }, headEl);
    if (known) {
      const listen = h('button', { type: 'button', class: 'g92-btn g92-btn--soft', html: UI_ICONS.soundOn });
      listen.append(speech.available ? 'Poslechnout' : 'Hlas není k dispozici');
      listen.disabled = !speech.available;
      listen.addEventListener('click', () => speech.speak(`${s.name}. ${s.facts.join(' ')}`));
      right.append(h('div', { class: 'g92-row' }, listen));
    }
    if (s.protected && known) right.append(h('div', { class: 'protected-note' }, '💚 V Česku je to chráněný druh – rybáři ji vždy opatrně pustí zpátky do vody.'));

    const wrap = h('div', { class: 'fish-detail' }, pic, right);
    if (known) {
      const facts = h('ul', { class: 'fish-facts' });
      for (const f of s.facts) facts.append(h('li', null, f));
      wrap.append(h('div', { class: 'g92-stack', style: 'gap:8px' }, h('span', { class: 'g92-eyebrow' }, 'Zajímavosti'), facts));
    }
    const info = h('dl', { class: 'fish-info' });
    const row = (label: string, value: string) => info.append(h('div', null, h('dt', null, label), h('dd', { html: value })));
    if (known) {
      row('Velikost', `běžně ${s.sizeMin}–${s.sizeMax} cm<br><small>největší kusy ~${s.sizeRecord >= 100 ? `${(s.sizeRecord / 100).toLocaleString('cs-CZ')} m` : `${s.sizeRecord} cm`}</small>`);
      row('Potrava', `${DIET_LABEL[s.diet].icon} ${esc(DIET_LABEL[s.diet].text)}`);
      row('Kde plave', `${ZONE_LABEL[s.zone].icon} ${ZONE_LABEL[s.zone].text}`);
      row('Kdy loví', s.night ? '🌙 hlavně za šera a v noci' : '☀️ hlavně ve dne');
      row('Čeleď', esc(s.family));
      if (s.origin) row('Původ', `🌍 nepůvodní – k nám se dostal ${esc(s.origin)}`);
    }
    row('Nejlépe bere na', bait ? `${bait.icon} ${esc(bait.name.toLowerCase())}` : '🪱 žížalu');
    if (!known) row('Kdy loví', s.night ? '🌙 hlavně za šera a v noci' : '☀️ hlavně ve dne');
    if (known) row('Vzácnost', `${gemsHTML(s.rarity)} ${RARITY_LABEL[s.rarity]}`);
    if (e) {
      row('Tvoje úlovky', `${e.count}× ${plural(e.count, 'chycena', 'chyceny', 'chyceno')}`);
      row('Největší kus', `📏 ${e.best} cm${e.trophy ? ' 🏆' : ''}`);
      row('Poprvé', `📅 ${fmtDate(e.first)}${e.rainbow ? ' · 🌈 i duhová!' : ''}`);
    }
    wrap.append(h('div', { class: 'g92-stack', style: 'gap:8px' }, h('span', { class: 'g92-eyebrow' }, known ? 'O rybě' : 'Nápověda'), info));

    const prev = h('button', { type: 'button', class: 'g92-btn g92-btn--secondary', html: UI_ICONS.back, 'aria-label': 'Předchozí ryba' });
    prev.append('Předchozí');
    const next = h('button', { type: 'button', class: 'g92-btn g92-btn--secondary', html: '' });
    next.append('Další', h('span', { html: UI_ICONS.arrowRight, 'aria-hidden': 'true' }));
    next.setAttribute('aria-label', 'Další ryba');
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    wrap.append(h('div', { class: 'fish-detail__nav' }, prev, next));
    body.append(wrap);
    back.focus({ preventScroll: true });
  }

  if (opts.focus && save.album[opts.focus]) {
    const s = SPECIES.find((x) => x.id === opts.focus);
    renderTabs();
    if (s) showDetail(s);
  } else showGrid();

  return sheet.closed.then(() => speech.stop());
}
