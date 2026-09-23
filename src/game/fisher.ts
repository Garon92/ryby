import type { LocationDef } from '../data/locations';
import type { BaitId } from '../data/shop';
import { findItem } from '../data/shop';
import type { World } from './world';
import { TAU } from './util';

export interface Gear {
  rod: string;
  bobber: string;
  bait: BaitId;
  hat: string;
}

export interface FisherPose {
  /** úhel prutu (rad), 0 = vodorovně doprava, záporný = nahoru */
  rodAngle: number;
  /** ohyb prutu 0..1 */
  bend: number;
  /** směr, kam je prut ohnutý (úhel vlasce) */
  bendDir: number;
  /** 0..1 radost po úlovku */
  cheer: number;
  /** mrknutí */
  blink: boolean;
  /** houpání loďky */
  bob: number;
}

export const REST_ANGLE = -0.95;

/** kde má rybář ruce */
export function handPos(world: World, pose: FisherPose): { x: number; y: number } {
  const s = world.fs;
  return { x: world.fisherX + 12 * s, y: world.fisherY - 38 * s + pose.bob - pose.cheer * 12 * s };
}

export function rodLength(world: World): number {
  return 118 * world.fs;
}

/** špička prutu (s ohybem) */
export function rodTip(world: World, pose: FisherPose): { x: number; y: number } {
  const hnd = handPos(world, pose);
  const L = rodLength(world);
  const a = pose.rodAngle;
  let tx = hnd.x + Math.cos(a) * L;
  let ty = hnd.y + Math.sin(a) * L;
  // ohyb: špička se stáčí směrem k vlasci
  const b = pose.bend * L * 0.35;
  tx += Math.cos(pose.bendDir) * b;
  ty += Math.sin(pose.bendDir) * b;
  return { x: tx, y: ty };
}

/** Stanoviště rybáře. Kreslí se dvakrát: celé za rybami (pod vodou se pak zakalí) a znovu jen nad hladinou. */
export function drawPlatform(
  x: CanvasRenderingContext2D,
  world: World,
  loc: LocationDef,
  t: number,
  bob: number,
  aboveOnly = false,
): void {
  if (!aboveOnly) return platformShape(x, world, loc, t, bob);
  x.save();
  x.beginPath();
  x.rect(0, 0, world.w, world.surfaceY - 1);
  x.clip();
  platformShape(x, world, loc, t, bob);
  x.restore();
}

function platformShape(x: CanvasRenderingContext2D, world: World, loc: LocationDef, t: number, bob: number): void {
  const { fisherX: fx, fisherY: fy, surfaceY: sy, bottomY, fs: s } = world;
  switch (loc.spot) {
    case 'pier': {
      // kůly
      x.fillStyle = '#5a3f28';
      for (const px of [fx - 70 * s, fx - 6 * s, fx + 30 * s]) {
        if (px < -10) continue;
        x.fillRect(px - 5 * s, fy, 10 * s, bottomY - fy + 4 * s);
        x.fillStyle = 'rgba(0,0,0,0.18)';
        x.fillRect(px + 2 * s, sy, 3 * s, bottomY - sy);
        x.fillStyle = '#5a3f28';
      }
      // prkna
      const left = -10;
      const right = fx + 40 * s;
      x.fillStyle = '#9b6b43';
      x.fillRect(left, fy, right - left, 9 * s);
      x.fillStyle = '#b07b4f';
      x.fillRect(left, fy, right - left, 3 * s);
      x.strokeStyle = 'rgba(60,35,20,0.5)';
      x.lineWidth = 1;
      for (let px = left + 18 * s; px < right; px += 18 * s) {
        x.beginPath();
        x.moveTo(px, fy);
        x.lineTo(px, fy + 9 * s);
        x.stroke();
      }
      // sloupek s lucernou
      const lx = fx - 46 * s;
      x.fillStyle = '#6b4a2f';
      x.fillRect(lx - 3 * s, fy - 58 * s, 6 * s, 58 * s);
      x.fillStyle = '#3b3b3b';
      x.fillRect(lx - 8 * s, fy - 66 * s, 16 * s, 10 * s);
      x.fillStyle = '#ffe9a8';
      x.fillRect(lx - 6 * s, fy - 64 * s, 12 * s, 6 * s);
      break;
    }
    case 'bank': {
      const g = x.createLinearGradient(0, fy, 0, bottomY);
      g.addColorStop(0, '#7a5b3a');
      g.addColorStop(1, '#4e3a26');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(-10, fy - 8 * s);
      x.lineTo(fx + 26 * s, fy);
      x.quadraticCurveTo(fx + 60 * s, sy + 10 * s, fx + 70 * s, sy + (bottomY - sy) * 0.45);
      x.quadraticCurveTo(fx + 90 * s, bottomY - 10 * s, fx + 150 * s, bottomY + 4 * s);
      x.lineTo(-10, bottomY + 10 * s);
      x.closePath();
      x.fill();
      x.fillStyle = '#6fa447';
      x.beginPath();
      x.moveTo(-10, fy - 12 * s);
      x.lineTo(fx + 28 * s, fy - 3 * s);
      x.lineTo(fx + 30 * s, fy + 3 * s);
      x.lineTo(-10, fy - 3 * s);
      x.closePath();
      x.fill();
      x.strokeStyle = '#5d9039';
      x.lineWidth = 2 * s;
      for (let i = 0; i < 12; i++) {
        const gx = (i / 12) * (fx + 24 * s);
        const gy = fy - 10 * s + (gx / (fx + 28 * s)) * 8 * s;
        x.beginPath();
        x.moveTo(gx, gy + 2 * s);
        x.lineTo(gx + 2 * s + Math.sin(t * 2 + i) * 1.5 * s, gy - 8 * s);
        x.stroke();
      }
      // vrstvy hlíny, kořeny a kameny ve svahu
      x.strokeStyle = 'rgba(40,25,12,0.25)';
      x.lineWidth = 2 * s;
      for (let i = 1; i < 6; i++) {
        const yy = fy + (bottomY - fy) * (i / 6);
        x.beginPath();
        x.moveTo(-10, yy);
        x.quadraticCurveTo(fx * 0.5, yy + 6 * s * Math.sin(i), fx + (20 + i * 14) * s, yy + 4 * s);
        x.stroke();
      }
      x.strokeStyle = '#5b4028';
      x.lineWidth = 2.2 * s;
      for (let i = 0; i < 4; i++) {
        const rx = fx + (8 + i * 9) * s;
        const ry = fy + (6 + i * 7) * s;
        x.beginPath();
        x.moveTo(rx, ry);
        x.quadraticCurveTo(rx + 10 * s, ry + 14 * s, rx + 4 * s, ry + 26 * s);
        x.stroke();
      }
      const stones: [number, number, number][] = [
        [0.25, 0.3, 9],
        [0.55, 0.52, 12],
        [0.15, 0.72, 10],
        [0.7, 0.8, 14],
        [0.4, 0.9, 11],
      ];
      for (const [u, v, r] of stones) {
        x.fillStyle = '#8a8378';
        x.beginPath();
        x.ellipse(u * (fx + 40 * s), fy + v * (bottomY - fy), r * s, r * 0.65 * s, 0.2, 0, TAU);
        x.fill();
        x.fillStyle = 'rgba(255,255,255,0.15)';
        x.beginPath();
        x.ellipse(u * (fx + 40 * s) - r * 0.3 * s, fy + v * (bottomY - fy) - r * 0.25 * s, r * 0.4 * s, r * 0.2 * s, 0, 0, TAU);
        x.fill();
      }
      x.fillStyle = '#6e6a62';
      x.beginPath();
      x.ellipse(fx + 60 * s, sy + 26 * s, 12 * s, 8 * s, 0.3, 0, TAU);
      x.ellipse(fx + 84 * s, bottomY - 20 * s, 16 * s, 10 * s, 0, 0, TAU);
      x.fill();
      break;
    }
    case 'rock': {
      const cx = fx - 4 * s;
      const g = x.createRadialGradient(cx - 20 * s, fy - 10 * s, 5 * s, cx, fy + 40 * s, 110 * s);
      g.addColorStop(0, '#a3a8a0');
      g.addColorStop(1, '#5d625c');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(-10, bottomY + 5 * s);
      x.lineTo(-10, fy + 20 * s);
      x.quadraticCurveTo(cx - 40 * s, fy - 6 * s, cx, fy);
      x.quadraticCurveTo(cx + 46 * s, fy + 2 * s, cx + 62 * s, sy + 20 * s);
      x.quadraticCurveTo(cx + 80 * s, bottomY - 30 * s, cx + 120 * s, bottomY + 5 * s);
      x.closePath();
      x.fill();
      x.fillStyle = '#5c8a3f';
      x.beginPath();
      x.ellipse(cx - 30 * s, fy + 4 * s, 28 * s, 7 * s, -0.15, 0, TAU);
      x.fill();
      break;
    }
    case 'boat': {
      const by = sy + bob;
      const left = fx - 62 * s;
      const right = fx + 58 * s;
      x.fillStyle = '#b9542f';
      x.beginPath();
      x.moveTo(left - 10 * s, by - 10 * s);
      x.lineTo(right + 14 * s, by - 12 * s);
      x.quadraticCurveTo(right, by + 14 * s, right - 24 * s, by + 16 * s);
      x.lineTo(left + 14 * s, by + 16 * s);
      x.quadraticCurveTo(left - 2 * s, by + 12 * s, left - 10 * s, by - 10 * s);
      x.closePath();
      x.fill();
      x.fillStyle = '#e9e1cf';
      x.fillRect(left - 8 * s, by - 12 * s, right - left + 20 * s, 4 * s);
      x.fillStyle = '#8f3d22';
      x.fillRect(left + 4 * s, by - 2 * s, right - left - 10 * s, 3 * s);
      // veslo
      x.strokeStyle = '#8b6a45';
      x.lineWidth = 3 * s;
      x.beginPath();
      x.moveTo(left + 10 * s, by - 10 * s);
      x.lineTo(left - 26 * s, by + 22 * s);
      x.stroke();
      x.fillStyle = '#8b6a45';
      x.beginPath();
      x.ellipse(left - 28 * s, by + 25 * s, 5 * s, 11 * s, 0.8, 0, TAU);
      x.fill();
      break;
    }
  }
}

export function lanternPos(world: World, loc: LocationDef): { x: number; y: number } {
  const s = world.fs;
  if (loc.spot === 'pier') return { x: world.fisherX - 46 * s, y: world.fisherY - 61 * s };
  return { x: world.fisherX - 22 * s, y: world.fisherY - 8 * s };
}

export function drawGroundLantern(x: CanvasRenderingContext2D, world: World, loc: LocationDef, bob: number): void {
  if (loc.spot === 'pier') return;
  const s = world.fs;
  const p = lanternPos(world, loc);
  const y = p.y + (loc.spot === 'boat' ? bob : 0);
  x.fillStyle = '#3b3b3b';
  x.fillRect(p.x - 6 * s, y - 6 * s, 12 * s, 14 * s);
  x.fillStyle = '#ffe9a8';
  x.fillRect(p.x - 4 * s, y - 3 * s, 8 * s, 8 * s);
  x.strokeStyle = '#3b3b3b';
  x.lineWidth = 1.5 * s;
  x.beginPath();
  x.arc(p.x, y - 6 * s, 5 * s, Math.PI, 0);
  x.stroke();
}

function rodColors(id: string): [string, string] {
  return findItem('rod', id)?.colors ?? ['#7a4a22', '#d69a5c'];
}

/** Barevný přechod prutu (sdílí hra i obchod). */
export function rodGradient(x: CanvasRenderingContext2D, id: string, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const [c0, c1] = rodColors(id);
  const grad = x.createLinearGradient(x0, y0, x1, y1);
  if (id === 'rainbow') {
    ['#ff5252', '#ffb300', '#66bb6a', '#29b6f6', '#ab47bc'].forEach((c, i) => grad.addColorStop(i / 4, c));
  } else if (id === 'candy') {
    for (let i = 0; i <= 10; i++) grad.addColorStop(i / 10, i % 2 ? c1 : c0);
  } else {
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
  }
  return grad;
}

/** Náhled prutu do obchodu: šikmý prut s navijákem a vlascem. */
export function drawRodPreview(x: CanvasRenderingContext2D, id: string, w: number, h: number): void {
  const x0 = w * 0.12;
  const y0 = h * 0.88;
  const x1 = w * 0.9;
  const y1 = h * 0.1;
  x.lineCap = 'round';
  x.strokeStyle = '#333';
  x.lineWidth = 7;
  x.beginPath();
  x.moveTo(x0, y0);
  x.lineTo(x0 + (x1 - x0) * 0.18, y0 + (y1 - y0) * 0.18);
  x.stroke();
  x.strokeStyle = rodGradient(x, id, x0, y0, x1, y1);
  x.lineWidth = 5;
  x.beginPath();
  x.moveTo(x0, y0);
  x.quadraticCurveTo((x0 + x1) / 2 + 6, (y0 + y1) / 2 + 6, x1, y1);
  x.stroke();
  if (id === 'glow') {
    x.save();
    x.globalCompositeOperation = 'lighter';
    x.strokeStyle = 'rgba(0,229,255,0.35)';
    x.lineWidth = 11;
    x.beginPath();
    x.moveTo(x0, y0);
    x.quadraticCurveTo((x0 + x1) / 2 + 6, (y0 + y1) / 2 + 6, x1, y1);
    x.stroke();
    x.restore();
  }
  x.fillStyle = '#555';
  x.beginPath();
  x.arc(x0 + (x1 - x0) * 0.22 + 4, y0 + (y1 - y0) * 0.22 + 6, 7, 0, TAU);
  x.fill();
  x.fillStyle = '#999';
  x.beginPath();
  x.arc(x0 + (x1 - x0) * 0.22 + 4, y0 + (y1 - y0) * 0.22 + 6, 3, 0, TAU);
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.9)';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(x1, y1);
  x.lineTo(x1, h * 0.72);
  x.stroke();
  drawBobber(x, 'classic', x1, h * 0.76, 1.1, 0);
}

export function drawFisher(x: CanvasRenderingContext2D, world: World, pose: FisherPose, gear: Gear, t: number): void {
  const s = world.fs;
  const fx = world.fisherX;
  const fy = world.fisherY + pose.bob;
  const jump = pose.cheer * 6 * s;
  const breathe = Math.sin(t * 2) * 0.8 * s;
  x.save();
  x.lineCap = 'round';
  x.lineJoin = 'round';
  // nohy
  x.strokeStyle = '#2f4858';
  x.lineWidth = 7 * s;
  x.beginPath();
  x.moveTo(fx - 5 * s, fy - 24 * s - jump);
  x.lineTo(fx - 7 * s, fy - 3 * s - jump * 0.3);
  x.moveTo(fx + 5 * s, fy - 24 * s - jump);
  x.lineTo(fx + 7 * s, fy - 3 * s - jump * 0.3);
  x.stroke();
  // holínky
  x.fillStyle = '#2e7d32';
  x.beginPath();
  x.ellipse(fx - 6 * s, fy - 3 * s - jump * 0.3, 6 * s, 3.5 * s, 0, 0, TAU);
  x.ellipse(fx + 9 * s, fy - 3 * s - jump * 0.3, 6 * s, 3.5 * s, 0, 0, TAU);
  x.fill();
  // tělo (vesta)
  const by = fy - 24 * s - jump + breathe * 0.2;
  x.fillStyle = '#3a7bd5';
  x.beginPath();
  x.moveTo(fx - 11 * s, by);
  x.lineTo(fx + 11 * s, by);
  x.lineTo(fx + 12 * s, by - 26 * s);
  x.quadraticCurveTo(fx, by - 32 * s, fx - 12 * s, by - 26 * s);
  x.closePath();
  x.fill();
  x.fillStyle = '#f39c12';
  x.beginPath();
  x.moveTo(fx - 12 * s, by - 2 * s);
  x.lineTo(fx - 4 * s, by - 2 * s);
  x.lineTo(fx - 3 * s, by - 28 * s);
  x.lineTo(fx - 12 * s, by - 25 * s);
  x.closePath();
  x.moveTo(fx + 4 * s, by - 2 * s);
  x.lineTo(fx + 12 * s, by - 2 * s);
  x.lineTo(fx + 12 * s, by - 25 * s);
  x.lineTo(fx + 3 * s, by - 28 * s);
  x.closePath();
  x.fill();
  x.fillStyle = '#d68910';
  x.fillRect(fx - 10 * s, by - 16 * s, 5 * s, 5 * s);
  x.fillRect(fx + 6 * s, by - 16 * s, 5 * s, 5 * s);
  // hlava
  const hx = fx + 1 * s;
  const hy = by - 38 * s + breathe * 0.3;
  x.fillStyle = '#ffd7b5';
  x.beginPath();
  x.arc(hx, hy, 11 * s, 0, TAU);
  x.fill();
  // tváře, oči, úsměv
  x.fillStyle = 'rgba(255,120,120,0.35)';
  x.beginPath();
  x.arc(hx + 6.5 * s, hy + 3 * s, 2.6 * s, 0, TAU);
  x.fill();
  x.fillStyle = '#2d2d2d';
  if (pose.blink) {
    x.fillRect(hx + 3 * s, hy - 1.5 * s, 4 * s, 1.2 * s);
  } else {
    x.beginPath();
    x.arc(hx + 5 * s, hy - 1.5 * s, 1.6 * s, 0, TAU);
    x.fill();
  }
  x.strokeStyle = '#8a4b3c';
  x.lineWidth = 1.4 * s;
  x.beginPath();
  x.arc(hx + 5 * s, hy + 3 * s, (3 + pose.cheer * 1.5) * s, 0.15 * Math.PI, 0.75 * Math.PI);
  x.stroke();
  drawHat(x, gear.hat, hx, hy, s, t);
  // prut
  const hand = handPos(world, pose);
  const L = rodLength(world);
  const a = pose.rodAngle;
  const tip = rodTip(world, pose);
  const mid = { x: hand.x + Math.cos(a) * L * 0.55, y: hand.y + Math.sin(a) * L * 0.55 };
  x.strokeStyle = rodGradient(x, gear.rod, hand.x, hand.y, tip.x, tip.y);
  x.lineWidth = 3.4 * s;
  x.beginPath();
  x.moveTo(hand.x - Math.cos(a) * 16 * s, hand.y - Math.sin(a) * 16 * s);
  x.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
  x.stroke();
  x.lineWidth = 1.6 * s;
  x.beginPath();
  x.moveTo((mid.x + tip.x) / 2, (mid.y + tip.y) / 2);
  x.lineTo(tip.x, tip.y);
  x.stroke();
  // naviják
  x.fillStyle = '#555';
  x.beginPath();
  x.arc(hand.x + Math.cos(a) * 4 * s + 3 * s, hand.y + Math.sin(a) * 4 * s + 4 * s, 4 * s, 0, TAU);
  x.fill();
  // ruce
  x.strokeStyle = '#3a7bd5';
  x.lineWidth = 5 * s;
  x.beginPath();
  x.moveTo(fx + 6 * s, by - 24 * s);
  x.lineTo(hand.x, hand.y);
  x.moveTo(fx - 6 * s, by - 22 * s);
  x.lineTo(hand.x - Math.cos(a) * 12 * s, hand.y - Math.sin(a) * 12 * s);
  x.stroke();
  x.fillStyle = '#ffd7b5';
  x.beginPath();
  x.arc(hand.x, hand.y, 3.2 * s, 0, TAU);
  x.arc(hand.x - Math.cos(a) * 12 * s, hand.y - Math.sin(a) * 12 * s, 3.2 * s, 0, TAU);
  x.fill();
  x.restore();
}

function drawHat(x: CanvasRenderingContext2D, hat: string, hx: number, hy: number, s: number, t: number): void {
  switch (hat) {
    case 'cap':
      x.fillStyle = '#e53935';
      x.beginPath();
      x.arc(hx, hy - 3 * s, 11 * s, Math.PI, 0);
      x.fill();
      x.fillRect(hx, hy - 4 * s, 16 * s, 3.5 * s);
      x.fillStyle = '#fff';
      x.beginPath();
      x.arc(hx - 1 * s, hy - 9 * s, 3 * s, 0, TAU);
      x.fill();
      break;
    case 'beanie':
      x.fillStyle = '#8e44ad';
      x.beginPath();
      x.arc(hx, hy - 3 * s, 11.5 * s, Math.PI, 0);
      x.fill();
      x.fillStyle = '#b36bd4';
      x.fillRect(hx - 12 * s, hy - 5 * s, 24 * s, 4 * s);
      x.fillStyle = '#f1c40f';
      x.beginPath();
      x.arc(hx, hy - 16 * s, 4 * s, 0, TAU);
      x.fill();
      break;
    case 'pirate':
      x.fillStyle = '#222';
      x.beginPath();
      x.moveTo(hx - 17 * s, hy - 5 * s);
      x.quadraticCurveTo(hx, hy - 26 * s, hx + 17 * s, hy - 5 * s);
      x.quadraticCurveTo(hx, hy - 10 * s, hx - 17 * s, hy - 5 * s);
      x.fill();
      x.fillStyle = '#fff';
      x.beginPath();
      x.arc(hx, hy - 12 * s, 2.6 * s, 0, TAU);
      x.fill();
      break;
    case 'crown': {
      x.fillStyle = '#f7c948';
      x.beginPath();
      x.moveTo(hx - 10 * s, hy - 6 * s);
      x.lineTo(hx - 10 * s, hy - 17 * s);
      x.lineTo(hx - 5 * s, hy - 11 * s);
      x.lineTo(hx, hy - 19 * s);
      x.lineTo(hx + 5 * s, hy - 11 * s);
      x.lineTo(hx + 10 * s, hy - 17 * s);
      x.lineTo(hx + 10 * s, hy - 6 * s);
      x.closePath();
      x.fill();
      const tw = 0.5 + 0.5 * Math.sin(t * 4);
      x.fillStyle = `rgba(255,80,120,${0.7 + tw * 0.3})`;
      x.beginPath();
      x.arc(hx, hy - 10 * s, 2 * s, 0, TAU);
      x.fill();
      break;
    }
    default:
      // rybářský klobouk
      x.fillStyle = '#6d8b3a';
      x.beginPath();
      x.ellipse(hx, hy - 7 * s, 17 * s, 4 * s, 0, 0, TAU);
      x.fill();
      x.fillStyle = '#7fa046';
      x.beginPath();
      x.moveTo(hx - 10 * s, hy - 7 * s);
      x.quadraticCurveTo(hx - 9 * s, hy - 19 * s, hx, hy - 19 * s);
      x.quadraticCurveTo(hx + 9 * s, hy - 19 * s, hx + 10 * s, hy - 7 * s);
      x.closePath();
      x.fill();
      x.fillStyle = '#e67e22';
      x.fillRect(hx - 10 * s, hy - 11 * s, 20 * s, 2.5 * s);
  }
}

/** Vlasec od špičky prutu k bodu (průvěs podle napětí). */
export function drawLine(
  x: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  sag: number,
  color: string,
  width: number,
): void {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2 + sag;
  x.strokeStyle = color;
  x.lineWidth = width;
  x.beginPath();
  x.moveTo(from.x, from.y);
  x.quadraticCurveTo(mx, my, to.x, to.y);
  x.stroke();
}

export function drawBobber(x: CanvasRenderingContext2D, id: string, cx: number, cy: number, s: number, tilt: number): void {
  x.save();
  x.translate(cx, cy);
  x.rotate(tilt);
  const item = findItem('bobber', id);
  if (id === 'classic' || id === 'green' || !item) {
    const [top, bot] = item?.colors ?? ['#e53935', '#fafafa'];
    x.strokeStyle = '#333';
    x.lineWidth = 1.4 * s;
    x.beginPath();
    x.moveTo(0, -7 * s);
    x.lineTo(0, -16 * s);
    x.stroke();
    x.fillStyle = bot;
    x.beginPath();
    x.ellipse(0, 1 * s, 5.5 * s, 7 * s, 0, 0, TAU);
    x.fill();
    x.fillStyle = top;
    x.beginPath();
    x.ellipse(0, 1 * s, 5.5 * s, 7 * s, 0, Math.PI, TAU);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.6)';
    x.beginPath();
    x.ellipse(-2 * s, -2 * s, 1.5 * s, 2.5 * s, 0, 0, TAU);
    x.fill();
  } else {
    x.font = `${Math.round(17 * s)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(item.icon, 0, 0);
  }
  x.restore();
}

export function drawBait(x: CanvasRenderingContext2D, bait: BaitId, cx: number, cy: number, s: number, t: number): void {
  x.save();
  x.translate(cx, cy);
  // háček
  x.strokeStyle = '#9aa3ab';
  x.lineWidth = 1.5 * s;
  x.beginPath();
  x.moveTo(0, -6 * s);
  x.lineTo(0, 3 * s);
  x.arc(-3 * s, 3 * s, 3 * s, 0, Math.PI * 0.9);
  x.stroke();
  switch (bait) {
    case 'worm': {
      x.strokeStyle = '#e57373';
      x.lineWidth = 3 * s;
      x.lineCap = 'round';
      x.beginPath();
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const px = -3 * s + Math.sin(u * 6 + t * 5) * 3 * s;
        const py = u * 12 * s;
        if (i === 0) x.moveTo(px, py);
        else x.lineTo(px, py);
      }
      x.stroke();
      break;
    }
    case 'corn':
      x.fillStyle = '#ffd54f';
      for (let i = 0; i < 3; i++) {
        x.beginPath();
        x.ellipse(-3 * s, (1 + i * 4) * s, 3 * s, 2.4 * s, 0, 0, TAU);
        x.fill();
      }
      break;
    case 'spinner': {
      const sp = Math.sin(t * 12);
      x.fillStyle = '#e0e6ea';
      x.beginPath();
      x.ellipse(0, 6 * s, 5 * s * Math.abs(sp) + 1 * s, 7 * s, 0, 0, TAU);
      x.fill();
      x.fillStyle = '#ef5350';
      x.fillRect(-1.5 * s, 12 * s, 3 * s, 3 * s);
      break;
    }
    case 'fly':
      x.fillStyle = '#6d4c41';
      x.beginPath();
      x.ellipse(-2 * s, 3 * s, 2.6 * s, 4.5 * s, 0, 0, TAU);
      x.fill();
      x.fillStyle = 'rgba(200,230,255,0.85)';
      x.beginPath();
      x.ellipse(-6 * s, 0, 4 * s, 2 * s, -0.5, 0, TAU);
      x.ellipse(2 * s, 0, 4 * s, 2 * s, 0.5, 0, TAU);
      x.fill();
      break;
  }
  x.restore();
}
