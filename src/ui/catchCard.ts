import { h, sfx, UI_ICONS } from '../kit';
import type { Species } from '../data/species';
import type { CatchOutcome } from '../game/rewards';
import { speech } from '../game/speech';
import { fishImageUrl, fishThumbUrl } from '../game/sprites';
import { rarityHTML } from './common';
import { coinHTML } from './icons';

export interface CatchCardOpts {
  species: Species;
  outcome: CatchOutcome;
  sizeCm: number;
  scoring: boolean;
  autoCloseMs?: number;
  onAlbum?: () => void;
  /** splněné mise, trofeje, nová úroveň… */
  notes?: string[];
}

/** Velká karta úlovku (nový druh, rekord, trofej, duhová, chráněná). */
export function showCatchCard(o: CatchCardOpts): Promise<void> {
  const { species: s, outcome } = o;
  const ev = outcome.event;
  const root = h('div', { class: 'g92-overlay g92-overlay--blur', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Úlovek: ${s.name}` });
  root.style.top = 'var(--g92-appbar-total)';
  const panel = h('div', { class: 'g92-overlay__panel catch-card' });
  root.append(panel);

  const hero = h('div', { class: `catch-hero${ev.rainbow ? ' is-rainbow' : ''}` }, h('img', { src: fishImageUrl(s.id), alt: s.name }));
  const ribbons = h('div', { class: 'catch-ribbons' });
  if (outcome.newSpecies) ribbons.append(h('span', { class: 'ribbon' }, '📖 Nový druh!'));
  if (ev.trophy) ribbons.append(h('span', { class: 'ribbon ribbon--gold' }, '🏆 Trofej!'));
  else if (outcome.record) ribbons.append(h('span', { class: 'ribbon ribbon--gold' }, '📏 Tvůj rekord!'));
  if (ev.rainbow) ribbons.append(h('span', { class: 'ribbon ribbon--rainbow' }, '🌈 Duhová!'));
  if (ev.perfect) ribbons.append(h('span', { class: 'ribbon ribbon--blue' }, '🎯 Perfektní hod'));
  hero.append(ribbons);
  panel.append(hero);

  const name = h('div', { class: 'catch-name' }, s.name);
  panel.append(name, h('div', { html: rarityHTML(s.rarity) }));
  panel.append(
    h('div', { class: 'catch-size' }, h('span', { class: 'cm' }, `${o.sizeCm} cm`), h('span', { class: 'g92-muted' }, `běžně ${s.sizeMin}–${s.sizeMax} cm`)),
  );
  if (o.scoring) {
    panel.append(
      h(
        'div',
        { class: 'catch-rewards' },
        h('span', { class: 'g92-badge g92-badge--solid' }, `+${outcome.points.points} bodů`),
        h('span', { class: 'coins-badge', html: `+${outcome.coins} ${coinHTML}`, 'aria-label': `plus ${outcome.coins} mincí` }),
      ),
    );
  }
  const fact = s.facts[Math.floor(Math.random() * s.facts.length)] ?? '';
  const factRow = h('div', { class: 'catch-fact' }, h('span', { 'aria-hidden': 'true' }, '💡'), h('span', null, fact));
  panel.append(factRow);
  if (outcome.released) {
    panel.append(h('div', { class: 'protected-note' }, '💚 Chráněná ryba – vyfotíme ji do alba a opatrně pustíme zpátky do vody.'));
  }
  if (o.notes?.length) {
    const list = h('div', { class: 'results-note' });
    for (const n of o.notes) list.append(h('div', null, n));
    panel.append(list);
  }

  const cont = h('button', { type: 'button', class: 'g92-btn g92-btn--xl g92-btn--block', 'data-primary': true, html: UI_ICONS.play });
  cont.append(outcome.released ? 'Pustit a chytat dál' : 'Chytat dál');
  const row = h('div', { class: 'g92-overlay__row' });
  const listen = h('button', { type: 'button', class: 'g92-btn g92-btn--secondary g92-btn--lg', html: UI_ICONS.soundOn });
  listen.append('Poslechnout');
  listen.disabled = !speech.available;
  listen.addEventListener('click', () => speech.speak(`${s.name}. ${fact}`));
  row.append(listen);
  if (o.onAlbum) {
    const album = h('button', { type: 'button', class: 'g92-btn g92-btn--ghost g92-btn--lg' }, '📖 V albu');
    album.addEventListener('click', () => {
      close();
      o.onAlbum?.();
    });
    row.append(album);
  }
  panel.append(h('div', { class: 'g92-overlay__actions' }, cont, row));
  document.body.append(root);
  requestAnimationFrame(() => cont.focus({ preventScroll: true }));

  let resolve!: () => void;
  const p = new Promise<void>((r) => (resolve = r));
  let done = false;
  let timer = 0;
  const onKey = (e: KeyboardEvent) => {
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape' || ((e.key === 'Enter' || e.key === ' ') && (document.activeElement === document.body || document.activeElement === cont))) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  function close(): void {
    if (done) return;
    done = true;
    clearTimeout(timer);
    window.removeEventListener('keydown', onKey, true);
    root.classList.add('is-leaving');
    setTimeout(() => root.remove(), 220);
    resolve();
  }
  cont.addEventListener('click', () => {
    sfx.pop();
    close();
  });
  window.addEventListener('keydown', onKey, true);
  if (o.autoCloseMs) timer = window.setTimeout(close, o.autoCloseMs);
  return p;
}

/** Malá karta pro známý druh – nepřeruší hru. */
export function showMiniCatch(host: HTMLElement, s: Species, sizeCm: number, points: number | null): void {
  host.querySelector('.mini-catch')?.remove();
  const el = h(
    'div',
    { class: 'mini-catch', role: 'status' },
    h('img', { src: fishThumbUrl(s.id), alt: '' }),
    h('div', null, h('b', null, s.name), h('small', null, `${sizeCm} cm`)),
    points !== null ? h('span', { class: 'pts' }, `+${points}`) : null,
  );
  host.append(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 320);
  }, 2400);
}
