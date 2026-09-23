import dims from '../data/fish-images.json';
import { createCanvas, ctx2d } from './util';

const BASE = import.meta.env.BASE_URL;
const DIMS = dims as unknown as Record<string, [number, number]>;

export function fishImageUrl(id: string): string {
  return `${BASE}fish/${id}.webp`;
}
export function fishThumbUrl(id: string): string {
  return `${BASE}fish/thumb/${id}.webp`;
}
export function fishAspect(id: string): number {
  const d = DIMS[id];
  return d ? d[0] / d[1] : 2;
}

interface Entry {
  img: HTMLImageElement;
  ready: boolean;
  failed?: boolean;
  scaled: Map<number, HTMLCanvasElement>;
  rainbow: Map<number, HTMLCanvasElement>;
}

const cache = new Map<string, Entry>();

export function loadSprite(id: string): Entry {
  let e = cache.get(id);
  if (e) return e;
  const img = new Image();
  img.decoding = 'async';
  const entry: Entry = { img, ready: false, scaled: new Map(), rainbow: new Map() };
  img.onload = () => {
    entry.ready = true;
  };
  // obrázek se nenačetl (offline bez cache) – rybu přesto ukázat jako siluetu, ať rybník není prázdný
  img.onerror = () => {
    entry.failed = true;
  };
  img.src = fishImageUrl(id);
  cache.set(id, entry);
  return entry;
}

/** Obrázek je načtený (nebo se načíst nedá) – ryba se může ukázat. */
export function spriteSettled(id: string): boolean {
  const e = loadSprite(id);
  return e.ready || !!e.failed;
}

export function preloadSprites(ids: Iterable<string>): Promise<void> {
  const list = [...ids].map((id) => {
    const e = loadSprite(id);
    if (e.ready) return Promise.resolve();
    return e.img.decode().then(
      () => {
        e.ready = true;
      },
      () => undefined,
    );
  });
  return Promise.all(list).then(() => undefined);
}

const BUCKETS = [48, 72, 96, 128, 176, 240, 320, 420, 520];

/** Předzmenšený sprite (kvalitní zmenšení po polovinách) pro šířku `px` v pixelech zařízení. */
export function spriteFor(id: string, px: number, rainbow = false): HTMLCanvasElement | HTMLImageElement | null {
  const e = loadSprite(id);
  if (!e.ready) return null;
  const nat = e.img.naturalWidth;
  const bucket = BUCKETS.find((b) => b >= px) ?? nat;
  const w = Math.min(nat, bucket);
  const map = rainbow ? e.rainbow : e.scaled;
  const hit = map.get(w);
  if (hit) return hit;
  let src: HTMLCanvasElement | HTMLImageElement = e.img;
  let sw = nat;
  let sh = e.img.naturalHeight;
  // zmenšování po polovinách kvůli kvalitě
  while (sw / 2 >= w) {
    const c = createCanvas(sw / 2, sh / 2);
    ctx2d(c).drawImage(src, 0, 0, c.width, c.height);
    src = c;
    sw = c.width;
    sh = c.height;
  }
  const out = createCanvas(w, (w * e.img.naturalHeight) / nat);
  const x = ctx2d(out);
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, out.width, out.height);
  if (rainbow) {
    x.globalCompositeOperation = 'source-atop';
    const g = x.createLinearGradient(0, 0, out.width, out.height);
    const cols = ['#ff4d6d', '#ffb703', '#8ac926', '#00b4d8', '#9b5de5', '#ff4d6d'];
    cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
    x.globalAlpha = 0.42;
    x.fillStyle = g;
    x.fillRect(0, 0, out.width, out.height);
  }
  map.set(w, out);
  return out;
}
