import type { LocationDef } from '../../data/locations';
import type { World } from '../world';
import { mulberry32 } from '../logic/rng';
import type { Rng } from '../types';
import { TAU } from '../util';

/**
 * Vzdálená krajina nad hladinou (kreslí se jednou do offscreen canvasu v denních barvách,
 * noc/večer řeší násobení barvou v enginu).
 */
export function paintLandscape(x: CanvasRenderingContext2D, world: World, loc: LocationDef): void {
  const rng = mulberry32(loc.id.length * 977 + 13);
  switch (loc.id) {
    case 'rybnik':
      return pond(x, world, rng);
    case 'reka':
      return river(x, world, rng);
    case 'potok':
      return brook(x, world, rng);
    case 'prehrada':
      return reservoir(x, world, rng);
  }
}

function ridge(
  x: CanvasRenderingContext2D,
  w: number,
  baseY: number,
  amp: number,
  freq: number,
  seed: number,
  fill: string | CanvasGradient,
  bottom: number,
  sharp = false,
): void {
  x.beginPath();
  x.moveTo(0, bottom);
  const steps = Math.ceil(w / 12);
  for (let i = 0; i <= steps; i++) {
    const px = (i / steps) * w;
    const u = px / w;
    let y =
      Math.sin(u * freq * TAU + seed) * 0.5 +
      Math.sin(u * freq * 2.3 * TAU + seed * 1.7) * 0.28 +
      Math.sin(u * freq * 5.1 * TAU + seed * 2.9) * 0.12;
    if (sharp) y = 1 - Math.abs(Math.sin(u * freq * 1.6 * TAU + seed)) * 1.4 + y * 0.4;
    x.lineTo(px, baseY - amp * (0.5 + 0.5 * y));
  }
  x.lineTo(w, bottom);
  x.closePath();
  x.fillStyle = fill;
  x.fill();
}

function vgrad(x: CanvasRenderingContext2D, y0: number, y1: number, a: string, b: string): CanvasGradient {
  const g = x.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

function blobTree(x: CanvasRenderingContext2D, cx: number, by: number, r: number, dark: string, light: string, trunk = true): void {
  if (trunk) {
    x.fillStyle = '#5b4632';
    x.fillRect(cx - r * 0.12, by - r * 0.9, r * 0.24, r * 0.9);
  }
  x.fillStyle = dark;
  x.beginPath();
  x.arc(cx, by - r * 1.3, r, 0, TAU);
  x.arc(cx - r * 0.65, by - r * 0.95, r * 0.7, 0, TAU);
  x.arc(cx + r * 0.65, by - r * 0.95, r * 0.72, 0, TAU);
  x.fill();
  x.fillStyle = light;
  x.beginPath();
  x.arc(cx - r * 0.25, by - r * 1.55, r * 0.5, 0, TAU);
  x.fill();
}

function spruce(x: CanvasRenderingContext2D, cx: number, by: number, hgt: number, col: string, shade: string): void {
  const w = hgt * 0.42;
  x.fillStyle = '#4a3a2a';
  x.fillRect(cx - hgt * 0.03, by - hgt * 0.12, hgt * 0.06, hgt * 0.12);
  for (let i = 0; i < 3; i++) {
    const t = i / 3;
    const top = by - hgt * (1 - t * 0.28);
    const bot = by - hgt * (0.1 + t * 0.02) - i * hgt * 0.17;
    const ww = w * (1 - t * 0.28);
    x.fillStyle = i % 2 ? shade : col;
    x.beginPath();
    x.moveTo(cx, top - i * hgt * 0.02);
    x.lineTo(cx + ww / 2, bot + hgt * 0.1 - i * hgt * 0.1);
    x.lineTo(cx - ww / 2, bot + hgt * 0.1 - i * hgt * 0.1);
    x.closePath();
    x.fill();
  }
}

function poplar(x: CanvasRenderingContext2D, cx: number, by: number, hgt: number, col: string, light: string): void {
  x.fillStyle = '#5b4632';
  x.fillRect(cx - hgt * 0.02, by - hgt * 0.2, hgt * 0.04, hgt * 0.2);
  x.fillStyle = col;
  x.beginPath();
  x.ellipse(cx, by - hgt * 0.58, hgt * 0.13, hgt * 0.44, 0, 0, TAU);
  x.fill();
  x.fillStyle = light;
  x.beginPath();
  x.ellipse(cx - hgt * 0.04, by - hgt * 0.66, hgt * 0.06, hgt * 0.28, 0, 0, TAU);
  x.fill();
}

function house(x: CanvasRenderingContext2D, cx: number, by: number, s: number, rng: Rng): void {
  const w = s * (1 + rng() * 0.6);
  const h = s * 0.7;
  x.fillStyle = ['#f3ead8', '#efe2c4', '#f6f1e6'][Math.floor(rng() * 3)] ?? '#f3ead8';
  x.fillRect(cx - w / 2, by - h, w, h);
  x.fillStyle = ['#c0392b', '#b5543a', '#a8412f'][Math.floor(rng() * 3)] ?? '#c0392b';
  x.beginPath();
  x.moveTo(cx - w / 2 - s * 0.1, by - h);
  x.lineTo(cx, by - h - s * 0.55);
  x.lineTo(cx + w / 2 + s * 0.1, by - h);
  x.closePath();
  x.fill();
  x.fillStyle = '#6b8fb3';
  x.fillRect(cx - s * 0.12, by - h * 0.62, s * 0.2, s * 0.2);
}

function church(x: CanvasRenderingContext2D, cx: number, by: number, s: number): void {
  x.fillStyle = '#f4efe4';
  x.fillRect(cx - s * 0.9, by - s * 0.8, s * 1.4, s * 0.8);
  x.fillStyle = '#b5543a';
  x.beginPath();
  x.moveTo(cx - s, by - s * 0.8);
  x.lineTo(cx - s * 0.2, by - s * 1.3);
  x.lineTo(cx + s * 0.6, by - s * 0.8);
  x.fill();
  x.fillStyle = '#f4efe4';
  x.fillRect(cx + s * 0.45, by - s * 1.7, s * 0.45, s * 1.7);
  x.fillStyle = '#4c7a5a';
  x.beginPath();
  x.moveTo(cx + s * 0.4, by - s * 1.7);
  x.lineTo(cx + s * 0.675, by - s * 2.5);
  x.lineTo(cx + s * 0.95, by - s * 1.7);
  x.fill();
  x.fillStyle = '#e8c35a';
  x.fillRect(cx + s * 0.66, by - s * 2.75, s * 0.03, s * 0.28);
}

function reedClump(x: CanvasRenderingContext2D, cx: number, by: number, hgt: number, rng: Rng, col = '#6f8f3a'): void {
  const n = 5 + Math.floor(rng() * 5);
  x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const dx = (rng() - 0.5) * hgt * 0.5;
    const hh = hgt * (0.6 + rng() * 0.5);
    const bend = (rng() - 0.5) * hgt * 0.3;
    x.strokeStyle = i % 3 === 0 ? '#86a64a' : col;
    x.lineWidth = Math.max(1, hgt * 0.035);
    x.beginPath();
    x.moveTo(cx + dx, by);
    x.quadraticCurveTo(cx + dx + bend * 0.3, by - hh * 0.6, cx + dx + bend, by - hh);
    x.stroke();
    if (rng() < 0.35) {
      x.fillStyle = '#6d4a2b';
      x.beginPath();
      x.ellipse(cx + dx + bend * 0.85, by - hh * 0.9, hgt * 0.03, hgt * 0.09, 0, 0, TAU);
      x.fill();
    }
  }
}

function pond(x: CanvasRenderingContext2D, world: World, rng: Rng): void {
  const { w, surfaceY: sy, scale: s } = world;
  const hz = sy - Math.max(26, sy * 0.2);
  ridge(x, w, hz - sy * 0.12, sy * 0.28, 1.1, 1.3, vgrad(x, hz - sy * 0.4, hz, '#9cc7b6', '#86b7a0'), sy);
  ridge(x, w, hz - sy * 0.02, sy * 0.2, 1.7, 4.1, vgrad(x, hz - sy * 0.25, hz, '#7fb07a', '#6a9d62'), sy);
  // pole a lesík
  x.fillStyle = '#8fbf5a';
  x.fillRect(0, hz, w, sy - hz);
  for (let i = 0; i < w / (26 * s); i++) {
    const cx = rng() * w;
    if (cx > w * 0.35 && cx < w * 0.55) continue;
    blobTree(x, cx, hz + 4 * s, (8 + rng() * 9) * s, '#4f8a3c', '#6aa84f', false);
  }
  // vesnička s kostelem
  const vx = w * (world.portrait ? 0.62 : 0.46);
  for (let i = 0; i < 5; i++) house(x, vx + (i - 2) * 24 * s + rng() * 6 * s, hz + 6 * s, 14 * s, rng);
  church(x, vx + 62 * s, hz + 6 * s, 16 * s);
  // protější břeh s trávou a rákosím
  x.fillStyle = vgrad(x, hz, sy, '#7cb356', '#5f9442');
  x.beginPath();
  x.moveTo(0, sy);
  for (let px = 0; px <= w; px += 20) x.lineTo(px, sy - 8 * s - Math.sin(px * 0.013 + 1) * 4 * s - 5 * s);
  x.lineTo(w, sy);
  x.fill();
  for (let i = 0; i < w / (40 * s); i++) reedClump(x, rng() * w, sy - 2 * s, (22 + rng() * 18) * s, rng);
  // vrba vpravo
  const wx = w * 0.86;
  x.fillStyle = '#5b4632';
  x.fillRect(wx - 5 * s, sy - 70 * s, 10 * s, 64 * s);
  x.fillStyle = '#6fa34f';
  x.beginPath();
  x.ellipse(wx, sy - 82 * s, 48 * s, 34 * s, 0, 0, TAU);
  x.fill();
  x.strokeStyle = '#78ad57';
  x.lineWidth = 2 * s;
  for (let i = 0; i < 26; i++) {
    const a = wx - 44 * s + i * 3.4 * s;
    x.beginPath();
    x.moveTo(a, sy - 90 * s + rng() * 10 * s);
    x.quadraticCurveTo(a + 4 * s, sy - 50 * s, a + 2 * s, sy - (18 + rng() * 22) * s);
    x.stroke();
  }
}

function river(x: CanvasRenderingContext2D, world: World, rng: Rng): void {
  const { w, surfaceY: sy, scale: s } = world;
  const hz = sy - Math.max(30, sy * 0.24);
  ridge(x, w, hz - sy * 0.08, sy * 0.3, 0.8, 2.2, vgrad(x, hz - sy * 0.4, hz, '#a7c7c9', '#8db6aa'), sy);
  ridge(x, w, hz, sy * 0.16, 1.4, 0.7, vgrad(x, hz - sy * 0.2, hz, '#86b27c', '#76a36b'), sy);
  x.fillStyle = '#93c064';
  x.fillRect(0, hz, w, sy - hz);
  // kamenný most v dálce
  const bx = w * (world.portrait ? 0.5 : 0.58);
  const bw = Math.min(w * 0.42, 420 * s);
  const by = hz + 2 * s;
  x.fillStyle = '#b9a88e';
  x.fillRect(bx - bw / 2, by - 22 * s, bw, 9 * s);
  x.fillStyle = '#a8977d';
  const arches = 4;
  for (let i = 0; i < arches; i++) {
    const ax = bx - bw / 2 + (i + 0.5) * (bw / arches);
    x.beginPath();
    x.moveTo(ax - bw / arches / 2, by - 13 * s);
    x.lineTo(ax + bw / arches / 2, by - 13 * s);
    x.lineTo(ax + bw / arches / 2, by + 6 * s);
    x.arc(ax, by + 6 * s, bw / arches / 2 - 5 * s, 0, Math.PI, true);
    x.closePath();
    x.fill();
  }
  x.fillStyle = '#8e7e66';
  for (let i = 0; i < 12; i++) x.fillRect(bx - bw / 2 + (i / 11) * bw - s, by - 29 * s, 2 * s, 7 * s);
  x.fillRect(bx - bw / 2, by - 29 * s, bw, 2 * s);
  // topoly a stromy na protějším břehu
  for (let i = 0; i < w / (34 * s); i++) {
    const cx = rng() * w;
    if (Math.abs(cx - bx) < bw * 0.55) continue;
    if (rng() < 0.5) poplar(x, cx, sy - 6 * s, (48 + rng() * 34) * s, '#4f8a3c', '#6aa84f');
    else blobTree(x, cx, sy - 6 * s, (10 + rng() * 10) * s, '#558f40', '#72ad55');
  }
  // břeh s kameny
  x.fillStyle = vgrad(x, sy - 16 * s, sy, '#a89572', '#8a7a5c');
  x.beginPath();
  x.moveTo(0, sy);
  for (let px = 0; px <= w; px += 18) x.lineTo(px, sy - 7 * s - Math.sin(px * 0.021) * 3 * s);
  x.lineTo(w, sy);
  x.fill();
  for (let i = 0; i < w / (22 * s); i++) {
    x.fillStyle = ['#8f8a82', '#a39d93', '#7c776f'][Math.floor(rng() * 3)] ?? '#8f8a82';
    x.beginPath();
    x.ellipse(rng() * w, sy - 3 * s, (4 + rng() * 6) * s, (2.5 + rng() * 3) * s, 0, 0, TAU);
    x.fill();
  }
}

function brook(x: CanvasRenderingContext2D, world: World, rng: Rng): void {
  const { w, surfaceY: sy, scale: s } = world;
  // strmé lesnaté svahy
  ridge(x, w, sy * 0.62, sy * 0.5, 0.7, 3.3, vgrad(x, sy * 0.1, sy, '#6f9a86', '#4f7a63'), sy, true);
  for (let layer = 0; layer < 3; layer++) {
    const baseY = sy * (0.55 + layer * 0.16);
    const col = ['#3f6f52', '#35624a', '#2b5540'][layer] ?? '#3f6f52';
    const shade = ['#4c7f5f', '#3f7055', '#33614b'][layer] ?? '#4c7f5f';
    for (let i = 0; i < w / ((16 - layer * 3) * s); i++) {
      const cx = rng() * w;
      const yy = baseY + Math.sin(cx * 0.01 + layer) * sy * 0.06;
      spruce(x, cx, yy, (26 + layer * 12 + rng() * 14) * s, col, shade);
    }
  }
  // kamenitý břeh a balvany
  x.fillStyle = vgrad(x, sy - 22 * s, sy, '#6f7e70', '#58665a');
  x.beginPath();
  x.moveTo(0, sy);
  for (let px = 0; px <= w; px += 14) x.lineTo(px, sy - 10 * s - Math.abs(Math.sin(px * 0.03)) * 8 * s);
  x.lineTo(w, sy);
  x.fill();
  for (let i = 0; i < w / (30 * s); i++) {
    const cx = rng() * w;
    const r = (6 + rng() * 12) * s;
    x.fillStyle = ['#8d948c', '#7b8279', '#a2a89f'][Math.floor(rng() * 3)] ?? '#8d948c';
    x.beginPath();
    x.ellipse(cx, sy - r * 0.35, r, r * 0.62, 0, Math.PI, 0);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.18)';
    x.beginPath();
    x.ellipse(cx - r * 0.3, sy - r * 0.6, r * 0.4, r * 0.2, -0.3, 0, TAU);
    x.fill();
    if (rng() < 0.4) {
      x.fillStyle = '#5d8a3e';
      x.beginPath();
      x.ellipse(cx + r * 0.2, sy - r * 0.8, r * 0.5, r * 0.18, 0, 0, TAU);
      x.fill();
    }
  }
  // malý vodopád mezi skalami v dálce
  const cx = w * 0.72;
  const top = sy - 64 * s;
  const rock = (px: number, py: number, rw: number, rh: number, col: string) => {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(px - rw, py + rh);
    x.lineTo(px - rw * 0.9, py - rh * 0.4);
    x.lineTo(px - rw * 0.4, py - rh);
    x.lineTo(px + rw * 0.5, py - rh * 0.85);
    x.lineTo(px + rw, py - rh * 0.1);
    x.lineTo(px + rw * 0.95, py + rh);
    x.closePath();
    x.fill();
  };
  rock(cx - 34 * s, sy - 30 * s, 30 * s, 36 * s, '#6f766d');
  rock(cx + 36 * s, sy - 28 * s, 32 * s, 38 * s, '#7b8279');
  const wg = x.createLinearGradient(0, top, 0, sy);
  wg.addColorStop(0, '#cfeefa');
  wg.addColorStop(1, '#f4fbff');
  x.fillStyle = wg;
  x.beginPath();
  x.moveTo(cx - 12 * s, top);
  x.lineTo(cx + 12 * s, top);
  x.lineTo(cx + 16 * s, sy - 8 * s);
  x.lineTo(cx - 15 * s, sy - 8 * s);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(120,180,210,0.55)';
  x.lineWidth = 1.2 * s;
  for (let i = -2; i <= 2; i++) {
    x.beginPath();
    x.moveTo(cx + i * 4.5 * s, top + 4 * s);
    x.lineTo(cx + i * 5.5 * s, sy - 12 * s);
    x.stroke();
  }
  x.fillStyle = 'rgba(255,255,255,0.95)';
  for (let i = 0; i < 7; i++) {
    x.beginPath();
    x.arc(cx + (i - 3) * 7 * s, sy - 7 * s - (i % 2) * 3 * s, (6 + (i % 3) * 2) * s, 0, TAU);
    x.fill();
  }
  x.fillStyle = '#5d8a3e';
  x.beginPath();
  x.ellipse(cx - 44 * s, top + 6 * s, 16 * s, 5 * s, -0.2, 0, TAU);
  x.ellipse(cx + 48 * s, top + 10 * s, 14 * s, 5 * s, 0.2, 0, TAU);
  x.fill();
}

function reservoir(x: CanvasRenderingContext2D, world: World, rng: Rng): void {
  const { w, surfaceY: sy, scale: s } = world;
  ridge(x, w, sy * 0.58, sy * 0.5, 0.9, 0.4, vgrad(x, sy * 0.05, sy, '#a9bcd6', '#8ea6c4'), sy, true);
  ridge(x, w, sy * 0.78, sy * 0.4, 1.2, 2.6, vgrad(x, sy * 0.3, sy, '#6f9a8d', '#5a8577'), sy);
  for (let i = 0; i < w / (12 * s); i++) {
    const cx = rng() * w;
    const yy = sy * 0.86 + Math.sin(cx * 0.008 + 2) * sy * 0.05;
    spruce(x, cx, yy, (18 + rng() * 12) * s, '#3d6b55', '#487a61');
  }
  ridge(x, w, sy * 0.96, sy * 0.1, 2, 5.2, '#4f7d64', sy);
  // přehradní hráz vpravo
  const dx = w * (world.portrait ? 0.7 : 0.78);
  const dw = Math.min(w * 0.34, 330 * s);
  const top = sy - 46 * s;
  x.fillStyle = vgrad(x, top, sy, '#d9d5cc', '#b8b2a6');
  x.beginPath();
  x.moveTo(dx, top);
  x.lineTo(dx + dw, top);
  x.lineTo(dx + dw + 10 * s, sy);
  x.lineTo(dx - 10 * s, sy);
  x.closePath();
  x.fill();
  x.fillStyle = '#9d978b';
  x.fillRect(dx - 2 * s, top - 5 * s, dw + 4 * s, 5 * s);
  for (let i = 0; i < 7; i++) {
    const px = dx + ((i + 0.5) / 7) * dw;
    x.fillStyle = '#c7c1b6';
    x.fillRect(px - 3 * s, top, 6 * s, sy - top);
    x.fillStyle = 'rgba(0,0,0,0.06)';
    x.fillRect(px + 3 * s, top, 2 * s, sy - top);
  }
  // plachetnice v dálce
  const px = w * 0.34;
  x.fillStyle = '#ffffff';
  x.beginPath();
  x.moveTo(px, sy - 34 * s);
  x.lineTo(px, sy - 8 * s);
  x.lineTo(px + 16 * s, sy - 8 * s);
  x.closePath();
  x.fill();
  x.fillStyle = '#f2c14e';
  x.beginPath();
  x.moveTo(px - 2 * s, sy - 30 * s);
  x.lineTo(px - 2 * s, sy - 8 * s);
  x.lineTo(px - 12 * s, sy - 8 * s);
  x.closePath();
  x.fill();
  x.fillStyle = '#7a4b2a';
  x.fillRect(px - 12 * s, sy - 7 * s, 30 * s, 4 * s);
}
