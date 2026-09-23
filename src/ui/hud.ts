import { h, sfx } from '../kit';
import { BAITS, type BaitId } from '../data/shop';
import { isDone, type Mission } from '../game/logic/missions';
import { timeLabel } from '../game/sky';
import { fmtClock, fmtNum, fmtTime } from './common';
import { coinHTML } from './icons';
import { missionIcon, missionText } from './dialogs';

const R = 11;
const C = 2 * Math.PI * R;

export class Hud {
  readonly el: HTMLElement;
  private timerPill: HTMLElement;
  private timerText: HTMLElement;
  private timerFg: SVGCircleElement;
  private scoreText: HTMLElement;
  private scorePill: HTMLElement;
  private starsEl: HTMLElement;
  private coinsText: HTMLElement;
  private coinsPill: HTMLElement;
  private clockText: HTMLElement;
  private clockIcon: HTMLElement;
  private msg: HTMLElement;
  private msgTimer = 0;
  private comboEl: HTMLElement;
  private baitBtn: HTMLButtonElement;
  private baitPop: HTMLElement;
  private missionsEl: HTMLElement;
  private lastMsg = '';
  onBait: (b: BaitId) => void = () => {};
  onMissions: () => void = () => {};
  owned: BaitId[] = ['worm'];

  constructor(host: HTMLElement) {
    this.timerText = h('b', null, '3:00');
    this.timerPill = h('div', { class: 'pill', title: 'Zbývající čas', role: 'timer', 'aria-label': 'Zbývající čas' });
    this.timerPill.innerHTML = `<svg class="timer-ring" viewBox="0 0 26 26" aria-hidden="true"><circle class="bg" cx="13" cy="13" r="${R}"/><circle class="fg" cx="13" cy="13" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>`;
    this.timerPill.append(this.timerText);
    this.timerFg = this.timerPill.querySelector('.fg') as SVGCircleElement;
    this.scoreText = h('b', null, '0');
    this.starsEl = h('span', { class: 'mini-stars', hidden: true });
    this.scorePill = h('div', { class: 'pill', title: 'Body' }, h('span', { class: 'emo', 'aria-hidden': 'true' }, '🏅'), this.scoreText, h('span', { class: 'g92-sr-only' }, 'bodů'), this.starsEl);
    this.clockIcon = h('span', { class: 'emo', 'aria-hidden': 'true' }, '☀️');
    this.clockText = h('b', null, '7:00');
    const clockPill = h('div', { class: 'pill clock', title: 'Denní doba' }, this.clockIcon, this.clockText);
    this.coinsText = h('b', null, '0');
    this.coinsPill = h('div', { class: 'pill', title: 'Mince' }, h('span', { html: coinHTML, style: 'display:contents' }), this.coinsText, h('span', { class: 'g92-sr-only' }, 'mincí'));
    const left = h('div', { class: 'hud-group' }, this.timerPill, this.scorePill);
    const right = h('div', { class: 'hud-group hud-group--right' }, clockPill, this.coinsPill);
    this.msg = h('div', { class: 'hud-msg', role: 'status', 'aria-live': 'polite' });
    this.comboEl = h('div', { class: 'combo', hidden: true });

    this.baitBtn = h('button', { type: 'button', class: 'bait-btn', 'aria-label': 'Návnada', 'aria-haspopup': 'true', 'aria-expanded': 'false' }) as HTMLButtonElement;
    this.baitPop = h('div', { class: 'bait-pop', hidden: true, role: 'menu', 'aria-label': 'Vyber návnadu' });
    this.baitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sfx.tap();
      this.toggleBaitPop();
    });
    this.missionsEl = h('div', { class: 'missions-mini' });
    const baitWrap = h('div', { style: 'position:relative' }, this.baitBtn, this.baitPop);
    const bottom = h('div', { class: 'hud-bottom' }, baitWrap, this.missionsEl);
    this.el = h('div', { class: 'hud', hidden: true }, h('div', { class: 'hud-top' }, left, right), this.msg, this.comboEl, bottom);
    host.append(this.el);
    document.addEventListener('pointerdown', (e) => {
      if (!this.baitPop.hidden && !this.baitPop.contains(e.target as Node) && e.target !== this.baitBtn) this.toggleBaitPop(false);
    });
  }

  show(on: boolean): void {
    this.el.hidden = !on;
    if (!on) this.toggleBaitPop(false);
  }

  setTimed(on: boolean): void {
    this.timerPill.hidden = !on;
  }

  setTimer(left: number, total: number): void {
    this.timerText.textContent = fmtTime(left);
    this.timerFg.setAttribute('stroke-dashoffset', String(C * (1 - left / total)));
    this.timerPill.classList.toggle('is-warn', left <= 15);
  }

  setScore(n: number, bump = false): void {
    this.scoreText.textContent = fmtNum(n);
    if (bump) this.bump(this.scorePill);
  }

  /** hvězdy výpravy (0–3); null = skrýt */
  setStars(n: number | null): void {
    if (n === null) {
      this.starsEl.hidden = true;
      return;
    }
    this.starsEl.hidden = false;
    this.starsEl.innerHTML = [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
    this.starsEl.setAttribute('aria-label', `${n} ze 3 hvězd`);
  }

  setCoins(n: number, bump = false): void {
    this.coinsText.textContent = fmtNum(n);
    if (bump) this.bump(this.coinsPill);
  }

  setClock(hour: number, rain = false): void {
    const t = timeLabel(hour);
    this.clockIcon.textContent = rain ? '🌧️' : t.icon;
    this.clockText.textContent = fmtClock(hour);
    this.clockIcon.parentElement?.setAttribute('title', t.name);
  }

  private bump(el: HTMLElement): void {
    el.classList.remove('is-bump');
    void el.offsetWidth;
    el.classList.add('is-bump');
  }

  setBait(b: BaitId, owned: BaitId[]): void {
    this.owned = owned;
    const item = BAITS.find((x) => x.id === b);
    this.baitBtn.innerHTML = `<span aria-hidden="true">${item?.icon ?? '🪱'}</span><span class="tag">${item?.name ?? ''}</span>`;
    this.baitBtn.setAttribute('aria-label', `Návnada: ${item?.name ?? ''}. Změnit (klávesa B)`);
    this.renderBaitPop(b);
  }

  private renderBaitPop(current: BaitId): void {
    this.baitPop.textContent = '';
    for (const it of BAITS) {
      const has = this.owned.includes(it.id as BaitId);
      const btn = h(
        'button',
        { type: 'button', class: 'bait-opt', role: 'menuitemradio', 'aria-pressed': String(it.id === current), 'aria-checked': String(it.id === current), disabled: !has },
        h('span', { class: 'emo', 'aria-hidden': 'true' }, it.icon),
        h('span', null, h('b', null, it.name), h('small', null, has ? (it.hint ?? '') : `V obchodě za ${it.price} mincí`)),
      );
      btn.addEventListener('click', (e) => {
        if (!has) return;
        sfx.pop();
        this.onBait(it.id as BaitId);
        this.toggleBaitPop(false);
        // po kliknutí myší/prstem vrátit fokus hře (mezerník pak zase nahazuje)
        if (e.detail > 0) (document.activeElement as HTMLElement | null)?.blur();
        else this.baitBtn.focus();
      });
      this.baitPop.append(btn);
    }
  }

  toggleBaitPop(force?: boolean): void {
    const open = force ?? this.baitPop.hidden;
    this.baitPop.hidden = !open;
    this.baitBtn.setAttribute('aria-expanded', String(open));
    if (open) (this.baitPop.querySelector('[aria-pressed="true"]') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  setMissions(ms: Mission[]): void {
    this.missionsEl.textContent = '';
    for (const m of ms) {
      const d = missionText(m);
      const chip = h(
        'button',
        { type: 'button', class: `mission-chip${isDone(m) ? ' is-done' : ''}`, title: `${d.text} (${m.progress}/${m.target})`, 'aria-label': `Mise: ${d.text}, ${m.progress} z ${m.target}` },
        h('span', { class: 'ring', style: `--p:${m.progress / m.target}` }, h('span', null, missionIcon(m))),
        h('span', { class: 'txt' }, `${m.progress}/${m.target} ${d.text}`),
      );
      chip.addEventListener('click', () => {
        sfx.tap();
        this.onMissions();
      });
      this.missionsEl.append(chip);
    }
  }

  message(text: string, icon = '', kind: '' | 'alert' | 'good' = '', ms = 1800): void {
    const key = `${kind}|${icon}|${text}`;
    clearTimeout(this.msgTimer);
    if (key !== this.lastMsg || !this.msg.classList.contains('is-on')) {
      this.msg.innerHTML = '';
      if (icon) this.msg.append(h('span', { class: 'emo', 'aria-hidden': 'true' }, icon));
      this.msg.append(h('span', null, text));
      this.msg.className = `hud-msg is-on${kind ? ` is-${kind}` : ''}`;
      this.lastMsg = key;
    }
    if (ms > 0) this.msgTimer = window.setTimeout(() => this.clearMessage(), ms);
  }

  clearMessage(): void {
    clearTimeout(this.msgTimer);
    this.msg.classList.remove('is-on');
    this.lastMsg = '';
  }

  setCombo(n: number): void {
    if (n >= 2) {
      this.comboEl.hidden = false;
      this.comboEl.textContent = `🔥 Série ×${n}`;
      this.bump(this.comboEl);
    } else this.comboEl.hidden = true;
  }
}
