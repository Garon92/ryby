import { RARITY_LABEL, type Rarity } from '../data/species';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export function gemsHTML(r: number): string {
  let out = `<span class="gems" data-r="${r}" aria-hidden="true">`;
  for (let i = 1; i <= 5; i++) out += `<i class="${i <= r ? 'on' : ''}"></i>`;
  return out + '</span>';
}

export function rarityHTML(r: Rarity): string {
  return `<span class="rarity-label">${gemsHTML(r)}<span>${RARITY_LABEL[r]}</span></span>`;
}

export function fmtNum(n: number): string {
  return n.toLocaleString('cs-CZ');
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtClock(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

/** „1 ryba / 2 ryby / 5 ryb“ */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

export function emoji(s: string, cls = 'emo'): string {
  return `<span class="${cls}" aria-hidden="true">${s}</span>`;
}
