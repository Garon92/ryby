import { h, UI_ICONS } from '../kit';
import { sfx } from '../kit';

export interface Sheet {
  el: HTMLElement;
  panel: HTMLElement;
  head: HTMLElement;
  tabs: HTMLElement;
  body: HTMLElement;
  close: () => void;
  closed: Promise<void>;
}

/** Celoobrazovkový panel (album, obchod) ve stylu kitu. Esc / tlačítko zavře. */
export function openSheet(opts: { title: string; icon: string; sub?: string; right?: Node; onKey?: (e: KeyboardEvent) => boolean | void; label?: string }): Sheet {
  const titleEl = h('div', null, h('div', { class: 'sheet__title', html: `<span class="emo" aria-hidden="true">${opts.icon}</span><span></span>` }));
  (titleEl.querySelector('.sheet__title span:last-child') as HTMLElement).textContent = opts.title;
  if (opts.sub) titleEl.append(h('div', { class: 'sheet__sub' }, opts.sub));
  const closeBtn = h('button', { type: 'button', class: 'g92-btn g92-btn--ghost g92-btn--icon', 'aria-label': 'Zavřít', html: UI_ICONS.close });
  const head = h('div', { class: 'sheet__head' }, titleEl, h('div', { class: 'g92-spacer' }), opts.right ?? null, closeBtn);
  const tabs = h('div', { class: 'sheet__tabs', role: 'tablist' });
  const body = h('div', { class: 'sheet__body' });
  const panel = h('div', { class: 'sheet__panel' }, head, tabs, body);
  const el = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label ?? opts.title }, panel);
  let resolve!: () => void;
  const closed = new Promise<void>((r) => (resolve = r));
  let done = false;
  const onKey = (e: KeyboardEvent) => {
    if (document.querySelector('dialog[open]')) return;
    if (opts.onKey?.(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  function close(): void {
    if (done) return;
    done = true;
    sfx.tap();
    window.removeEventListener('keydown', onKey, true);
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 200);
    resolve();
  }
  closeBtn.addEventListener('click', close);
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });
  window.addEventListener('keydown', onKey, true);
  document.body.append(el);
  requestAnimationFrame(() => closeBtn.focus({ preventScroll: true }));
  return { el, panel, head, tabs, body, close, closed };
}

export function tabButton(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const b = h('button', { type: 'button', class: 'g92-chip', role: 'tab', 'aria-selected': String(active), 'aria-pressed': String(active) }, label) as HTMLButtonElement;
  b.addEventListener('click', () => {
    sfx.tap();
    onClick();
  });
  return b;
}
