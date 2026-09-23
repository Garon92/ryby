import { h, setHelp, sfx, showStart, UI_ICONS } from '../kit';
import { LOCATIONS, LOCATION_BY_ID, type LocationDef } from '../data/locations';
import type { LocationId } from '../data/species';
import { canClaim } from '../game/logic/daily';
import { isDone } from '../game/logic/missions';
import { levelInfo } from '../game/logic/progress';
import { albumProgress, unlockedLocations } from '../game/rewards';
import { Scene } from '../game/scene/scene';
import { DIFFICULTY_LABEL, MODE_LABEL, type Difficulty, type GameMode } from '../game/types';
import { computeWorld } from '../game/world';
import type { ClockMode, Save } from '../store/save';
import { fmtNum } from './common';
import { COIN_SVG, coinHTML } from './icons';
import { fishOfDayCard } from './fishOfDay';

export const HOW_TO = [
  { icon: '👆', text: 'Ťukni do vody tam, kde plave ryba – rybář nahodí.' },
  { icon: '🔴', text: 'Počkej, až se splávek potopí, a hned ťukni.' },
  { icon: '✋', text: 'Drž prst a navíjej. Když ručička zčervená, pusť!' },
  { icon: '📖', text: 'Každá nová ryba se uloží do alba.' },
];

export const HOW_TO_FULL = [
  ...HOW_TO,
  { icon: '🪱', text: 'Návnada rozhoduje: dravci berou na třpytku, kapři a amuři na kukuřici, pstruzi na mušku.' },
  { icon: '🎯', text: 'Nahoď těsně před rybu – perfektní hod dá body navíc a ryba bere hned.' },
  { icon: '🌙', text: 'V noci loví sumci, úhoři a candáti. Zkus denní dobu „Noc“.' },
  { icon: COIN_SVG, text: 'Za úlovky, mise a zlaté bubliny dostaneš mince na pruty, splávky, návnady a klobouky.' },
  { icon: '⬆️', text: 'Body přidávají zkušenosti – s vyšší úrovní se odemkne řeka, potok a přehrada.' },
  { icon: '💚', text: 'Chráněné ryby vyfotíme do alba a pustíme zpátky do vody.' },
];

export const KEYS = [
  { keys: ['Mezerník', 'Enter'], text: 'nahodit · zaseknout · držet = navíjet' },
  { keys: ['←', '→', '↑', '↓'], text: 'mířit, kam nahodit' },
  { keys: ['B'], text: 'změnit návnadu' },
  { keys: ['Esc', 'P'], text: 'pauza' },
];

export type StartChoice =
  | { kind: 'play'; location: LocationId; mode: GameMode; clock: ClockMode; difficulty: Difficulty }
  | { kind: 'album'; focus?: string }
  | { kind: 'shop' | 'missions' | 'daily' };

const thumbCache = new Map<string, string>();

/** Malý obrázek lokality (vykreslený stejným kódem jako hra). */
export function locationThumb(loc: LocationDef): string {
  const hit = thumbCache.get(loc.id);
  if (hit) return hit;
  const w = 240;
  const hgt = 110;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hgt;
  const x = c.getContext('2d');
  if (!x) return '';
  const world = computeWorld(w, hgt, 1, loc);
  world.scale = 0.42;
  world.fs = 0.42;
  const scene = new Scene(loc);
  scene.lite = true;
  scene.resize(world);
  scene.drawSky(x, 3, 11);
  scene.drawLandscape(x);
  scene.drawWaterBack(x, 3, 11);
  scene.drawVeil(x);
  scene.drawDepthFog(x);
  scene.drawWaterFront(x, 3, 11);
  const url = c.toDataURL('image/png');
  thumbCache.set(loc.id, url);
  return url;
}

export interface StartState {
  location: LocationId;
  mode: GameMode;
  clock: ClockMode;
  difficulty: Difficulty;
}

export function recordKey(loc: LocationId, d: Difficulty): string {
  return `${loc}:${d}`;
}

export function openStart(save: Save, onChoice: (c: StartChoice) => void): { refresh: () => void } {
  const st: StartState = {
    location: unlockedLocations(save).includes(save.prefs.location) ? save.prefs.location : 'rybnik',
    mode: save.prefs.mode,
    clock: save.prefs.clock,
    difficulty: save.prefs.difficulty,
  };
  const p = showStart({
    appId: 'ryby',
    className: 'ryby-start',
    backdrop: 'blur',
    compact: true,
    difficulties: (Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => ({
      id: d,
      label: DIFFICULTY_LABEL[d].name,
      icon: DIFFICULTY_LABEL[d].icon,
      hint: DIFFICULTY_LABEL[d].hint,
    })),
    difficulty: st.difficulty,
    best: null,
    playLabel: 'Rybařit!',
    howTo: HOW_TO,
    keys: KEYS,
    showHowTo: !save.prefs.seenHelp,
  });
  setHelp({ title: 'Jak hrát', howTo: HOW_TO_FULL, keys: KEYS });
  const root = p.el;
  const main = root.querySelector('.g92-overlay__view') as HTMLElement;
  const diffSection = main.querySelector('.g92-overlay__section') as HTMLElement | null;
  const actions = main.querySelector('.g92-overlay__actions') as HTMLElement;
  const subtitle = main.querySelector('.g92-overlay__subtitle');

  // hráč: úroveň, XP, mince
  const strip = h('div', { class: 'player-strip' });
  // lokality
  const locGrid = h('div', { class: 'loc-grid', role: 'radiogroup', 'aria-label': 'Kam na ryby' });
  const blurb = h('p', { class: 'loc-blurb' });
  const best = h('div', { class: 'g92-overlay__best' });
  const locSection = h('div', { class: 'g92-overlay__section' }, h('span', { class: 'g92-eyebrow' }, 'Kam na ryby?'), locGrid, blurb, best);
  // režim + denní doba
  const modeSeg = h('div', { class: 'g92-segmented g92-segmented--block', role: 'radiogroup', 'aria-label': 'Režim' });
  const clockSeg = h('div', { class: 'g92-segmented g92-segmented--block', role: 'radiogroup', 'aria-label': 'Denní doba' });
  const opts = h(
    'div',
    { class: 'opt-row' },
    h('div', { class: 'g92-overlay__section' }, h('span', { class: 'g92-eyebrow' }, 'Režim'), modeSeg),
    h('div', { class: 'g92-overlay__section' }, h('span', { class: 'g92-eyebrow' }, 'Denní doba'), clockSeg),
  );
  const links = h('div', { class: 'start-links' });

  // hrdina (vlevo na širokých obrazovkách): hráč + lokality; ovládání (vpravo): obtížnost, režim, Hrát
  const hero = main.querySelector<HTMLElement>(':scope > .g92-overlay__hero');
  const openFod = (id: string) => onChoice({ kind: 'album', focus: id });
  let fod = fishOfDayCard(save, openFod);
  if (hero) hero.append(strip, locSection, fod);
  else {
    (subtitle ?? main.firstChild)?.after(strip);
    (diffSection ?? actions).before(locSection);
  }
  if (diffSection) diffSection.after(opts);
  else actions.before(opts);
  actions.after(links);

  // obtížnost ze skupiny kitu
  root.querySelectorAll<HTMLInputElement>('.g92-difficulty input').forEach((inp) =>
    inp.addEventListener('change', () => {
      if (inp.checked) {
        st.difficulty = inp.value as Difficulty;
        renderBest();
      }
    }),
  );

  const playBtn = actions.querySelector('.g92-overlay__play') as HTMLButtonElement;
  void p.then((r) => {
    if (r.difficulty) st.difficulty = r.difficulty as Difficulty;
    onChoice({ kind: 'play', ...st });
  });

  function seg<T extends string>(host: HTMLElement, name: string, value: T, items: { v: T; icon: string; label: string }[], set: (v: T) => void): void {
    host.textContent = '';
    for (const it of items) {
      const input = h('input', { type: 'radio', name, value: it.v, 'aria-label': it.label }) as HTMLInputElement;
      input.checked = it.v === value;
      input.addEventListener('change', () => {
        if (!input.checked) return;
        sfx.click();
        set(it.v);
      });
      host.append(h('label', { title: it.label }, input, h('span', null, h('span', { class: 'ico', 'aria-hidden': 'true' }, it.icon), h('span', { class: 'lbl' }, it.label))));
    }
  }

  function renderStrip(): void {
    const lvl = levelInfo(save.xp);
    const alb = albumProgress(save);
    strip.textContent = '';
    strip.append(
      h('div', { class: 'lvl', html: `<span>${lvl.level}<small>úroveň</small></span>` }),
      h(
        'div',
        null,
        h('div', { class: 'title' }, lvl.title),
        h('div', { class: 'g92-progress g92-progress--sm', style: `--value:${lvl.progress}`, 'aria-label': 'Postup na další úroveň' }),
        h('div', { class: 'xp' }, `${fmtNum(lvl.into)} / ${fmtNum(lvl.span)} XP · album ${alb.caught}/${alb.total}`),
      ),
      h('span', { class: 'coins-badge', title: 'Mince', 'aria-label': `${fmtNum(save.coins)} mincí`, html: `${coinHTML} ${fmtNum(save.coins)}` }),
    );
  }

  function renderLocations(): void {
    const unlocked = unlockedLocations(save);
    locGrid.textContent = '';
    for (const l of LOCATIONS) {
      const open = unlocked.includes(l.id);
      const prog = albumProgress(save, l.id);
      const btn = h('button', {
        type: 'button',
        class: 'loc-card',
        role: 'radio',
        'aria-checked': String(l.id === st.location),
        'aria-pressed': String(l.id === st.location),
        'aria-label': open ? `${l.name}, chyceno ${prog.caught} z ${prog.total}` : `${l.name} – odemkne se na úrovni ${l.unlockLevel}`,
        disabled: !open,
      }) as HTMLButtonElement;
      btn.append(
        h('img', { class: 'thumb', src: locationThumb(l), alt: '', style: 'object-fit:cover' }),
        h('b', null, `${l.icon} ${l.name}`),
        h('small', null, open ? `${prog.caught}/${prog.total} druhů` : `od úrovně ${l.unlockLevel}`),
      );
      if (!open) btn.append(h('span', { class: 'lock', html: `<span>🔒 úroveň ${l.unlockLevel}</span>` }));
      btn.addEventListener('click', () => {
        if (!open) return;
        sfx.click();
        st.location = l.id;
        renderLocations();
        renderBest();
        onLocationPreview(l.id);
      });
      locGrid.append(btn);
    }
    blurb.textContent = LOCATION_BY_ID[st.location].blurb;
  }

  function renderBest(): void {
    const v = save.records[recordKey(st.location, st.difficulty)] ?? 0;
    best.hidden = st.mode !== 'timed' || v <= 0;
    best.innerHTML = `${UI_ICONS.trophy}<span>Rekord výpravy: <b>${fmtNum(v)}</b></span>`;
  }

  function renderOpts(): void {
    seg<GameMode>(
      modeSeg,
      'ry-mode',
      st.mode,
      (Object.keys(MODE_LABEL) as GameMode[]).map((m) => ({ v: m, icon: MODE_LABEL[m].icon, label: m === 'timed' ? '3 minuty' : 'Volně' })),
      (v) => {
        st.mode = v;
        renderBest();
      },
    );
    seg<ClockMode>(
      clockSeg,
      'ry-clock',
      st.clock,
      [
        { v: 'flow', icon: '🌅', label: 'Plyne' },
        { v: 'day', icon: '☀️', label: 'Den' },
        { v: 'night', icon: '🌙', label: 'Noc' },
      ],
      (v) => {
        st.clock = v;
      },
    );
  }

  function renderLinks(): void {
    links.textContent = '';
    const alb = albumProgress(save);
    const done = save.missions.filter(isDone).length;
    const add = (icon: string, label: string, kind: 'album' | 'shop' | 'missions' | 'daily', badge?: string) => {
      const b = h('button', { type: 'button', class: 'g92-btn g92-btn--secondary', 'aria-label': badge ? `${label} (${badge})` : label }, h('span', { class: 'emo', 'aria-hidden': 'true' }, icon), h('span', null, label));
      if (badge) b.append(h('span', { class: 'dot-badge', 'aria-hidden': 'true' }, badge));
      b.addEventListener('click', () => {
        sfx.tap();
        onChoice({ kind });
      });
      links.append(b);
    };
    add('📖', `Album ${alb.caught}/${alb.total}`, 'album');
    add('🛒', 'Obchod', 'shop');
    add('🎯', 'Mise', 'missions', done ? String(done) : undefined);
    add('🎁', 'Odměna', 'daily', canClaim(save.daily, new Date()) ? '!' : undefined);
  }

  function refresh(): void {
    const next = fishOfDayCard(save, openFod);
    fod.replaceWith(next);
    fod = next;
    renderStrip();
    renderLocations();
    renderBest();
    renderLinks();
  }

  renderOpts();
  refresh();
  if (save.prefs.seenHelp) requestAnimationFrame(() => playBtn?.focus({ preventScroll: true }));
  return { refresh };
}

/** posluchač pro náhled lokality na pozadí (nastavuje main.ts) */
let onLocationPreview: (id: LocationId) => void = () => {};
export function setLocationPreview(fn: (id: LocationId) => void): void {
  onLocationPreview = fn;
}
