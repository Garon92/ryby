import { hexToRgb, keyframes, mixRgb, type RGB } from './util';

/** hodiny 0–24 → čas dne */
export function isNight(h: number): boolean {
  return h < 5.3 || h >= 20.6;
}

export function timeLabel(h: number): { icon: string; name: string } {
  if (isNight(h)) return { icon: '🌙', name: 'Noc' };
  if (h < 8.5) return { icon: '🌅', name: 'Ráno' };
  if (h < 11) return { icon: '🌤️', name: 'Dopoledne' };
  if (h < 13.5) return { icon: '☀️', name: 'Poledne' };
  if (h < 17.5) return { icon: '🌤️', name: 'Odpoledne' };
  return { icon: '🌇', name: 'Večer' };
}

const mixTriple = (a: [RGB, RGB, RGB], b: [RGB, RGB, RGB], t: number): [RGB, RGB, RGB] => [
  mixRgb(a[0], b[0], t),
  mixRgb(a[1], b[1], t),
  mixRgb(a[2], b[2], t),
];
const tri = (a: string, b: string, c: string): [RGB, RGB, RGB] => [hexToRgb(a), hexToRgb(b), hexToRgb(c)];

// Barvy oblohy jsou „před násobením“ nočním tónem (viz tint) – proto jsou v noci světlejší, než výsledek.
const SKY: [number, [RGB, RGB, RGB]][] = [
  [0, tri('#1b2a6b', '#2c3f8f', '#44579c')],
  [4.6, tri('#1f2d70', '#3a4a96', '#6a5b9c')],
  [5.8, tri('#3b4b9a', '#c77d9b', '#ffb37a')],
  [7.2, tri('#5aa7e6', '#9fd0f2', '#ffe2b0')],
  [10, tri('#3d9be9', '#83c6f5', '#d8f0ff')],
  [15.5, tri('#3a94e0', '#7fc0f0', '#d4ecfb')],
  [18.2, tri('#5a87d0', '#f0b27a', '#ffd08a')],
  [19.7, tri('#4a4f9c', '#d9738a', '#ff9f68')],
  [21, tri('#23306f', '#3c4a92', '#5b5b9e')],
];

export function skyColors(h: number): [RGB, RGB, RGB] {
  return keyframes(SKY, h, mixTriple);
}

const WHITE: RGB = [255, 255, 255];
const TINT: [number, RGB][] = [
  [0, hexToRgb('#56648f')],
  [4.8, hexToRgb('#5f6a96')],
  [6.2, hexToRgb('#e7b9b0')],
  [7.6, WHITE],
  [17.4, WHITE],
  [18.9, hexToRgb('#ffd9b0')],
  [20.1, hexToRgb('#b58fa6')],
  [21.2, hexToRgb('#56648f')],
];

/** Barva, kterou se scéna násobí (bílá = den). */
export function tint(h: number): RGB {
  return keyframes(TINT, h, mixRgb);
}

/** 0 = noc … 1 = den */
export function daylight(h: number): number {
  const t = tint(h);
  return (t[0] + t[1] + t[2]) / (3 * 255);
}

/** Pozice slunce/měsíce na obloze: x 0..1 zleva doprava, alt 0..1 (0 = obzor) */
export function sunPosition(h: number): { x: number; alt: number } | null {
  if (h < 5.2 || h > 20.4) return null;
  const t = (h - 5.2) / (20.4 - 5.2);
  return { x: 0.08 + 0.84 * t, alt: Math.sin(Math.PI * t) };
}

export function moonPosition(h: number): { x: number; alt: number } | null {
  const hh = h < 12 ? h + 24 : h;
  if (hh < 19.6 || hh > 30.6) return null;
  const t = (hh - 19.6) / 11;
  return { x: 0.1 + 0.8 * t, alt: Math.sin(Math.PI * t) };
}
