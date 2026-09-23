export const TAU = Math.PI * 2;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToCss([r, g, b]: RGB, a = 1): string {
  return a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function mixHex(a: string, b: string, t: number, alpha = 1): string {
  return rgbToCss(mixRgb(hexToRgb(a), hexToRgb(b), t), alpha);
}

/** Interpolace mezi klíčovými snímky [čas, hodnota] (cyklicky přes 24 h). */
export function keyframes<T>(frames: [number, T][], h: number, mix: (a: T, b: T, t: number) => T): T {
  const n = frames.length;
  for (let i = 0; i < n; i++) {
    const [t0, v0] = frames[i]!;
    const [t1raw, v1] = frames[(i + 1) % n]!;
    const t1 = i + 1 < n ? t1raw : t1raw + 24;
    let x = h;
    if (x < t0) x += 24;
    if (x >= t0 && x < t1) return mix(v0, v1, (x - t0) / (t1 - t0));
  }
  return frames[0]![1];
}

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = c.getContext('2d');
  if (!x) throw new Error('2D canvas not supported');
  return x;
}
