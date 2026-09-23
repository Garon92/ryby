import type { LocationDef } from '../../data/locations';
import type { World } from '../world';
import { mulberry32 } from '../logic/rng';
import { TAU } from '../util';

/** Statické dno (offscreen) – bahno, písek, štěrk nebo kameny. */
export function paintBed(x: CanvasRenderingContext2D, world: World, loc: LocationDef): void {
  const { w, h, bottomY, scale: s } = world;
  const rng = mulberry32(loc.id.charCodeAt(0) * 131 + 7);
  const top = bottomY - 10 * s;
  const cols: Record<LocationDef['bed'], [string, string, string[]]> = {
    mud: ['#5d4a33', '#3e3122', ['#6d5a40', '#4c3d2b', '#7a6547']],
    sand: ['#b59d6e', '#8a7550', ['#c7b184', '#9c8761', '#a39478']],
    gravel: ['#8c8a7c', '#6b695d', ['#a19e8f', '#7e7b6d', '#b4ab95', '#6f7a6f']],
    rock: ['#4d5660', '#333a42', ['#5f6873', '#444c55', '#6c737c']],
  };
  const [c0, c1, pebbles] = cols[loc.bed];
  const g = x.createLinearGradient(0, top, 0, h);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(0, h);
  for (let px = 0; px <= w; px += 16) {
    x.lineTo(px, top + Math.sin(px * 0.012 + 1.3) * 5 * s + Math.sin(px * 0.037) * 2.5 * s);
  }
  x.lineTo(w, h);
  x.closePath();
  x.fill();

  const count = loc.bed === 'mud' ? w / (9 * s) : w / (5 * s);
  for (let i = 0; i < count; i++) {
    const px = rng() * w;
    const py = top + 4 * s + rng() * (h - top);
    const r = (loc.bed === 'rock' ? 3 + rng() * 9 : loc.bed === 'gravel' ? 1.5 + rng() * 4 : 1 + rng() * 2.2) * s;
    x.fillStyle = pebbles[Math.floor(rng() * pebbles.length)] ?? c0;
    x.beginPath();
    x.ellipse(px, py, r * 1.3, r, rng() * 3, 0, TAU);
    x.fill();
  }
  // velké kameny / kořeny / potopený kmen
  const big = loc.bed === 'mud' ? 3 : loc.bed === 'sand' ? 5 : loc.bed === 'gravel' ? 9 : 7;
  for (let i = 0; i < big; i++) {
    const px = rng() * w;
    const r = (14 + rng() * (loc.bed === 'gravel' ? 22 : 30)) * s;
    const gg = x.createRadialGradient(px - r * 0.3, top - r * 0.2, r * 0.1, px, top, r * 1.2);
    gg.addColorStop(0, loc.bed === 'mud' ? '#6e6a5e' : '#9aa0a4');
    gg.addColorStop(1, loc.bed === 'mud' ? '#3f3b33' : '#555b62');
    x.fillStyle = gg;
    x.beginPath();
    x.ellipse(px, top + r * 0.25, r * 1.2, r * 0.75, 0, Math.PI, TAU);
    x.fill();
    x.fillStyle = 'rgba(80,120,60,0.35)';
    x.beginPath();
    x.ellipse(px - r * 0.2, top - r * 0.35, r * 0.6, r * 0.18, 0, 0, TAU);
    x.fill();
  }
  if (loc.id === 'prehrada' || loc.id === 'rybnik') {
    // potopený kmen
    const lx = w * (loc.id === 'rybnik' ? 0.64 : 0.38);
    const len = 140 * s;
    x.save();
    x.translate(lx, top - 6 * s);
    x.rotate(-0.08);
    x.fillStyle = '#4a3a28';
    x.beginPath();
    x.ellipse(0, 0, len / 2, 9 * s, 0, 0, TAU);
    x.fill();
    x.fillStyle = '#5c4832';
    x.fillRect(-len / 2, -9 * s, len, 4 * s);
    x.strokeStyle = '#4a3a28';
    x.lineWidth = 4 * s;
    x.beginPath();
    x.moveTo(len * 0.2, -4 * s);
    x.lineTo(len * 0.32, -28 * s);
    x.stroke();
    x.restore();
  }
}

export interface Plant {
  x: number;
  kind: 'weed' | 'tape' | 'reed' | 'lily' | 'moss';
  height: number;
  phase: number;
  front: boolean;
}

export function makePlants(world: World, loc: LocationDef): Plant[] {
  const rng = mulberry32(loc.id.charCodeAt(1) * 71 + 3);
  const { w, scale: s, depth } = world;
  const out: Plant[] = [];
  const add = (p: Omit<Plant, 'phase'>) => out.push({ ...p, phase: rng() * TAU });
  switch (loc.id) {
    case 'rybnik': {
      for (let i = 0; i < w / (115 * s); i++) add({ x: rng() * w, kind: 'weed', height: depth * (0.2 + rng() * 0.45), front: rng() < 0.3 });
      // rákos u pravého okraje, lekníny
      for (let i = 0; i < 3; i++) add({ x: w - (20 + i * 26 + rng() * 10) * s, kind: 'reed', height: depth * 0.9 + 60 * s, front: true });
      for (let i = 0; i < Math.max(3, w / (180 * s)); i++) add({ x: w * (0.3 + rng() * 0.6), kind: 'lily', height: depth * (0.55 + rng() * 0.4), front: false });
      break;
    }
    case 'reka':
      for (let i = 0; i < w / (55 * s); i++) add({ x: rng() * w, kind: 'tape', height: depth * (0.2 + rng() * 0.35), front: rng() < 0.3 });
      break;
    case 'potok':
      for (let i = 0; i < w / (90 * s); i++) add({ x: rng() * w, kind: 'moss', height: depth * (0.08 + rng() * 0.1), front: rng() < 0.5 });
      for (let i = 0; i < w / (160 * s); i++) add({ x: rng() * w, kind: 'tape', height: depth * (0.15 + rng() * 0.2), front: false });
      break;
    case 'prehrada':
      for (let i = 0; i < w / (120 * s); i++) add({ x: rng() * w, kind: 'weed', height: depth * (0.15 + rng() * 0.3), front: rng() < 0.3 });
      break;
  }
  return out;
}

/** Rostliny (animované houpání, v řece ohnuté proudem). */
export function drawPlant(x: CanvasRenderingContext2D, p: Plant, world: World, t: number, current: number): void {
  const { bottomY, surfaceY, scale: s } = world;
  const base = bottomY + 2 * s;
  const sway = Math.sin(t * 0.9 + p.phase) * 6 * s;
  const lean = current * 0.35 * s;
  x.lineCap = 'round';
  switch (p.kind) {
    case 'weed': {
      const n = 4;
      for (let k = 0; k < n; k++) {
        const ox = (k - n / 2) * 5 * s;
        const hh = p.height * (0.7 + 0.3 * Math.sin(p.phase + k));
        x.strokeStyle = k % 2 ? '#3f7a3a' : '#4f8c43';
        x.lineWidth = 2.4 * s;
        x.beginPath();
        x.moveTo(p.x + ox, base);
        const tipX = p.x + ox + sway * (1 + k * 0.2) + lean;
        x.bezierCurveTo(p.x + ox + sway * 0.3, base - hh * 0.4, tipX - sway * 0.6, base - hh * 0.7, tipX, base - hh);
        x.stroke();
        x.fillStyle = '#5a9a4b';
        for (let j = 1; j < 6; j++) {
          const u = j / 6;
          const lx = p.x + ox + (tipX - p.x - ox) * u * u;
          const ly = base - hh * u;
          x.beginPath();
          x.ellipse(lx + ((j % 2) * 2 - 1) * 4 * s, ly, 5 * s, 2 * s, ((j % 2) * 2 - 1) * 0.6, 0, TAU);
          x.fill();
        }
      }
      break;
    }
    case 'tape': {
      for (let k = 0; k < 5; k++) {
        const ox = (k - 2) * 4 * s;
        const hh = p.height * (0.75 + 0.25 * Math.sin(p.phase * 3 + k));
        x.strokeStyle = k % 2 ? '#5b8f3e' : '#6ea34a';
        x.lineWidth = 3.2 * s;
        x.beginPath();
        x.moveTo(p.x + ox, base);
        const tipX = p.x + ox + sway * 1.4 + lean * 2.4;
        x.quadraticCurveTo(p.x + ox + lean * 0.4, base - hh * 0.6, tipX, base - hh);
        x.stroke();
      }
      break;
    }
    case 'moss': {
      x.fillStyle = '#4f7f3b';
      for (let k = 0; k < 6; k++) {
        x.beginPath();
        x.ellipse(p.x + (k - 3) * 6 * s, base - 4 * s - Math.abs(Math.sin(k + p.phase)) * p.height * 0.4, 7 * s, 4 * s, 0, 0, TAU);
        x.fill();
      }
      break;
    }
    case 'reed': {
      for (let k = 0; k < 6; k++) {
        const ox = (k - 3) * 5 * s;
        const hh = p.height * (0.85 + 0.15 * Math.sin(p.phase + k * 1.7));
        const wind = Math.sin(t * 1.3 + p.phase + k * 0.3) * 4 * s;
        x.strokeStyle = k % 2 ? '#6d8f3c' : '#80a348';
        x.lineWidth = 3 * s;
        x.beginPath();
        x.moveTo(p.x + ox, base);
        x.quadraticCurveTo(p.x + ox, base - hh * 0.6, p.x + ox + wind, base - hh);
        x.stroke();
        if (k % 2 === 0) {
          x.fillStyle = '#6d4a2b';
          x.beginPath();
          x.ellipse(p.x + ox + wind * 0.95, base - hh + 10 * s, 3 * s, 9 * s, 0, 0, TAU);
          x.fill();
        }
      }
      break;
    }
    case 'lily': {
      // stonek až k hladině, list na hladině
      const leafX = p.x + Math.sin(t * 0.35 + p.phase) * 4 * s;
      x.strokeStyle = 'rgba(80,120,60,0.8)';
      x.lineWidth = 2 * s;
      x.beginPath();
      x.moveTo(p.x, base);
      x.quadraticCurveTo(p.x + 10 * s, (base + surfaceY) / 2, leafX, surfaceY + 2 * s);
      x.stroke();
      break;
    }
  }
}

/** Leknínový list a květ na hladině (kreslí se v přední vrstvě). */
export function drawLilyPad(x: CanvasRenderingContext2D, p: Plant, world: World, t: number): void {
  const s = world.scale;
  const cx = p.x + Math.sin(t * 0.35 + p.phase) * 4 * s;
  const cy = world.surfaceY + 1 * s;
  const r = (16 + (p.phase % 1) * 8) * s;
  x.fillStyle = '#4f9a45';
  x.beginPath();
  x.ellipse(cx, cy, r, r * 0.32, 0, 0.25, TAU - 0.05);
  x.lineTo(cx, cy);
  x.closePath();
  x.fill();
  x.fillStyle = '#6fbf5b';
  x.beginPath();
  x.ellipse(cx - r * 0.15, cy - r * 0.06, r * 0.6, r * 0.16, 0, 0, TAU);
  x.fill();
  if (p.phase > 3) {
    // květ
    const fx = cx + r * 0.3;
    const fy = cy - 4 * s;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI - Math.PI;
      x.fillStyle = k % 2 ? '#ffd1e3' : '#ffb3cf';
      x.beginPath();
      x.ellipse(fx + Math.cos(a) * 5 * s, fy + Math.sin(a) * 4 * s, 5 * s, 2.5 * s, a, 0, TAU);
      x.fill();
    }
    x.fillStyle = '#ffd54f';
    x.beginPath();
    x.arc(fx, fy - 1 * s, 2.5 * s, 0, TAU);
    x.fill();
  }
}
