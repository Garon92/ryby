import type { LocationDef } from '../../data/locations';
import type { World } from '../world';
import { mulberry32 } from '../logic/rng';
import { daylight, moonPosition, skyColors, sunPosition, tint } from '../sky';
import { createCanvas, ctx2d, hexToRgb, mixRgb, rgbToCss, TAU, type RGB } from '../util';
import { paintLandscape } from './landscape';
import { drawLilyPad, drawPlant, makePlants, paintBed, type Plant } from './underwater';

interface Cloud {
  sprite: HTMLCanvasElement;
  y: number;
  x0: number;
  speed: number;
  w: number;
  h: number;
}
interface Streak {
  x: number;
  y: number;
  len: number;
  speed: number;
  surface: boolean;
}
interface Mote {
  x: number;
  y: number;
  r: number;
  ph: number;
}
interface Star {
  x: number;
  y: number;
  r: number;
  ph: number;
}

/** Vykreslení prostředí jedné lokality (obloha, krajina, voda, dno, rostliny, hladina, světla). */
export class Scene {
  readonly loc: LocationDef;
  private world!: World;
  private landscape!: HTMLCanvasElement;
  private bed!: HTMLCanvasElement;
  private plants: Plant[] = [];
  private clouds: Cloud[] = [];
  private streaks: Streak[] = [];
  private motes: Mote[] = [];
  private stars: Star[] = [];
  lite = false;

  constructor(loc: LocationDef) {
    this.loc = loc;
  }

  resize(world: World): void {
    this.world = world;
    const { w, h, dpr, surfaceY, scale: s } = world;
    // krajina nad hladinou
    this.landscape = createCanvas(w * dpr, (surfaceY + 8) * dpr);
    const lx = ctx2d(this.landscape);
    lx.scale(dpr, dpr);
    paintLandscape(lx, world, this.loc);
    // dno
    this.bed = createCanvas(w * dpr, h * dpr);
    const bx = ctx2d(this.bed);
    bx.scale(dpr, dpr);
    paintBed(bx, world, this.loc);

    this.plants = makePlants(world, this.loc);
    const rng = mulberry32(99);
    this.clouds = [];
    const nClouds = Math.max(3, Math.round(w / 320));
    for (let i = 0; i < nClouds; i++) {
      const cw = (110 + rng() * 120) * s;
      const ch = cw * 0.42;
      this.clouds.push({
        sprite: cloudSprite(cw * dpr, ch * dpr, rng),
        y: surfaceY * (0.08 + rng() * 0.32),
        x0: rng() * (w + cw),
        speed: (4 + rng() * 6) * s,
        w: cw,
        h: ch,
      });
    }
    this.streaks = [];
    if (this.loc.current > 0) {
      const n = Math.round(w / 40);
      for (let i = 0; i < n; i++) {
        const surface = i % 3 !== 0;
        this.streaks.push({
          x: rng() * w,
          y: surface ? surfaceY + (2 + rng() * 10) * s : surfaceY + world.depth * (0.1 + rng() * 0.8),
          len: (18 + rng() * 40) * s,
          speed: this.loc.current * s * (surface ? 1 + rng() * 0.6 : 0.5 + rng() * 0.4),
          surface,
        });
      }
    }
    this.motes = [];
    for (let i = 0; i < Math.round((w * world.depth) / 9000); i++) {
      this.motes.push({ x: rng() * w, y: surfaceY + rng() * world.depth, r: (0.6 + rng() * 1.4) * s, ph: rng() * TAU });
    }
    this.stars = [];
    for (let i = 0; i < Math.round(w / 9); i++) {
      this.stars.push({ x: rng() * w, y: rng() * surfaceY * 0.8, r: 0.5 + rng() * 1.2, ph: rng() * TAU });
    }
  }

  /** vlnka hladiny v bodě x */
  waveY(x: number, t: number): number {
    const s = this.world.scale;
    const amp = this.loc.current > 30 ? 2.2 : 1.5;
    return this.world.surfaceY - 2.5 * s + (Math.sin(x * 0.021 + t * 1.6) * 0.6 + Math.sin(x * 0.053 - t * 2.4) * 0.4) * amp * s;
  }

  drawSky(x: CanvasRenderingContext2D, t: number, hour: number): void {
    const { w, surfaceY } = this.world;
    const [top, mid, hor] = skyColors(hour);
    const g = x.createLinearGradient(0, 0, 0, surfaceY);
    g.addColorStop(0, rgbToCss(top));
    g.addColorStop(0.55, rgbToCss(mid));
    g.addColorStop(1, rgbToCss(hor));
    x.fillStyle = g;
    x.fillRect(0, 0, w, surfaceY + 2);

    const sun = sunPosition(hour);
    if (sun) {
      const sx = sun.x * w;
      const sy = surfaceY * (0.95 - sun.alt * 0.8);
      const r = 26 * this.world.scale;
      const glow = x.createRadialGradient(sx, sy, r * 0.5, sx, sy, r * 4);
      glow.addColorStop(0, 'rgba(255,244,200,0.75)');
      glow.addColorStop(1, 'rgba(255,244,200,0)');
      x.fillStyle = glow;
      x.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8);
      x.fillStyle = '#fff6cf';
      x.beginPath();
      x.arc(sx, sy, r, 0, TAU);
      x.fill();
    }
    // mraky
    for (const c of this.clouds) {
      const span = w + c.w * 2;
      const cx = ((c.x0 + t * c.speed) % span) - c.w;
      x.drawImage(c.sprite, cx, c.y, c.w, c.h);
    }
  }

  drawLandscape(x: CanvasRenderingContext2D): void {
    const { w, surfaceY } = this.world;
    x.drawImage(this.landscape, 0, 0, w, surfaceY + 8);
  }

  /** Voda za rybami: těleso vody, paprsky, dno, rostliny vzadu, plovoucí částečky. */
  drawWaterBack(x: CanvasRenderingContext2D, t: number, hour: number): void {
    const { w, h, surfaceY, bottomY, depth, scale: s } = this.world;
    const [c0, c1, c2] = this.loc.water;
    const g = x.createLinearGradient(0, surfaceY, 0, h);
    g.addColorStop(0, c0);
    g.addColorStop(0.55, c1);
    g.addColorStop(1, c2);
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, h);
    for (let px = 0; px <= w + 12; px += 12) x.lineTo(px, this.waveY(px, t));
    x.lineTo(w, h);
    x.closePath();
    x.fill();

    const day = daylight(hour);
    // světelné paprsky
    if (!this.lite && day > 0.55) {
      x.save();
      x.globalCompositeOperation = 'lighter';
      const n = Math.max(4, Math.round(w / 260));
      for (let i = 0; i < n; i++) {
        const bx = ((i + 0.5) / n) * w + Math.sin(t * 0.25 + i * 1.7) * 40 * s;
        const len = depth * (0.55 + 0.3 * Math.sin(i * 2.1));
        const top = surfaceY;
        const w0 = (18 + (i % 3) * 10) * s;
        const rg = x.createLinearGradient(0, top, 0, top + len);
        const a = 0.09 * (day - 0.5) * 2 * (0.7 + 0.3 * Math.sin(t * 0.7 + i));
        rg.addColorStop(0, `rgba(255,255,230,${a})`);
        rg.addColorStop(1, 'rgba(255,255,230,0)');
        x.fillStyle = rg;
        x.beginPath();
        x.moveTo(bx - w0, top);
        x.lineTo(bx + w0, top);
        x.lineTo(bx + w0 * 2.2 + 50 * s, top + len);
        x.lineTo(bx - w0 * 0.4 + 50 * s, top + len);
        x.closePath();
        x.fill();
      }
      x.restore();
    }
    x.drawImage(this.bed, 0, 0, w, h);
    for (const p of this.plants) if (!p.front) drawPlant(x, p, this.world, t, this.loc.current);
    // vznášející se částečky
    x.fillStyle = 'rgba(255,255,255,0.22)';
    for (const m of this.motes) {
      const mx = (m.x + t * (this.loc.current * 0.4 + 3) * s + Math.sin(t * 0.3 + m.ph) * 6 * s) % w;
      const my = m.y + Math.sin(t * 0.5 + m.ph) * 5 * s;
      if (my > bottomY) continue;
      x.beginPath();
      x.arc(mx < 0 ? mx + w : mx, my, m.r, 0, TAU);
      x.fill();
    }
  }

  /** Závoj vody přes dno a ponořené části stanoviště (kreslí se před rybami). */
  drawVeil(x: CanvasRenderingContext2D): void {
    const { w, h, surfaceY } = this.world;
    const c = hexToRgb(this.loc.water[1]);
    const g = x.createLinearGradient(0, surfaceY, 0, h);
    const a = 0.18 + (1 - this.loc.clarity) * 0.3;
    g.addColorStop(0, rgbToCss(c, a * 0.6));
    g.addColorStop(1, rgbToCss(c, a));
    x.fillStyle = g;
    x.fillRect(0, surfaceY + 1, w, h - surfaceY);
  }

  /** Kalnost vody s hloubkou – přes ryby. */
  drawDepthFog(x: CanvasRenderingContext2D): void {
    const { w, h, surfaceY } = this.world;
    const deep = hexToRgb(this.loc.water[2]);
    const g = x.createLinearGradient(0, surfaceY, 0, h);
    const murk = (1 - this.loc.clarity) * 0.55;
    g.addColorStop(0, rgbToCss(deep, 0));
    g.addColorStop(0.35, rgbToCss(deep, murk * 0.25));
    g.addColorStop(1, rgbToCss(deep, murk));
    x.fillStyle = g;
    x.fillRect(0, surfaceY, w, h - surfaceY);
  }

  /** Popředí: rostliny vpředu, hladina, lekníny, proud. */
  drawWaterFront(x: CanvasRenderingContext2D, t: number, hour: number): void {
    const { w, surfaceY, scale: s } = this.world;
    for (const p of this.plants) if (p.front) drawPlant(x, p, this.world, t, this.loc.current);
    // odraz oblohy těsně pod hladinou
    const hor = skyColors(hour)[2];
    const rg = x.createLinearGradient(0, surfaceY - 3 * s, 0, surfaceY + 16 * s);
    rg.addColorStop(0, rgbToCss(mixRgb(hor, [255, 255, 255], 0.3), 0.55));
    rg.addColorStop(1, rgbToCss(hor, 0));
    x.fillStyle = rg;
    x.beginPath();
    x.moveTo(0, surfaceY + 16 * s);
    for (let px = 0; px <= w + 12; px += 12) x.lineTo(px, this.waveY(px, t));
    x.lineTo(w, surfaceY + 16 * s);
    x.closePath();
    x.fill();
    // linka hladiny
    x.strokeStyle = 'rgba(255,255,255,0.65)';
    x.lineWidth = 1.6 * s;
    x.beginPath();
    for (let px = 0; px <= w + 12; px += 12) {
      const y = this.waveY(px, t);
      if (px === 0) x.moveTo(px, y);
      else x.lineTo(px, y);
    }
    x.stroke();
    // třpyt slunce na hladině
    const sun = sunPosition(hour);
    if (sun && !this.lite) {
      const sx = sun.x * w;
      for (let i = 0; i < 14; i++) {
        const gx = sx + Math.sin(i * 12.9) * 120 * s * (0.4 + (i % 4) * 0.2);
        const a = Math.max(0, Math.sin(t * 3 + i * 1.3)) * 0.8 * sun.alt;
        if (a < 0.05) continue;
        x.fillStyle = `rgba(255,255,240,${a})`;
        x.fillRect(gx, this.waveY(gx, t) + (2 + (i % 3) * 3) * s, (6 + (i % 3) * 4) * s, 1.4 * s);
      }
    }
    // proud
    if (this.streaks.length) {
      x.lineCap = 'round';
      for (const st of this.streaks) {
        const sx = (st.x + t * st.speed) % (w + st.len);
        const px = sx - st.len;
        x.strokeStyle = st.surface ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)';
        x.lineWidth = (st.surface ? 1.4 : 1.1) * s;
        const y = st.surface ? this.waveY(px, t) + (st.y - surfaceY) : st.y + Math.sin(t + st.x) * 3 * s;
        x.beginPath();
        x.moveTo(px, y);
        x.lineTo(px + st.len, y);
        x.stroke();
      }
    }
    for (const p of this.plants) if (p.kind === 'lily') drawLilyPad(x, p, this.world, t);
  }

  /** Násobení barvou podle denní doby (večer oranžová, noc modrá). Vrací barvu nebo null (den). */
  applyTint(x: CanvasRenderingContext2D, hour: number): RGB | null {
    const c = tint(hour);
    if (c[0] > 250 && c[1] > 250 && c[2] > 250) return null;
    const { w, h } = this.world;
    x.save();
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = rgbToCss(c);
    x.fillRect(0, 0, w, h);
    x.restore();
    return c;
  }

  /** Světla po setmění: hvězdy, měsíc, jeho odraz, světlušky. */
  drawLights(x: CanvasRenderingContext2D, t: number, hour: number): void {
    const { w, surfaceY, scale: s } = this.world;
    const night = 1 - daylight(hour);
    if (night < 0.15) return;
    const a = Math.min(1, (night - 0.15) * 2);
    for (const st of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(t * 2 + st.ph);
      x.fillStyle = `rgba(255,255,240,${a * tw * 0.9})`;
      x.beginPath();
      x.arc(st.x, st.y, st.r, 0, TAU);
      x.fill();
    }
    const moon = moonPosition(hour);
    if (moon) {
      const mx = moon.x * w;
      const my = surfaceY * (0.9 - moon.alt * 0.75);
      const r = 18 * s;
      const glow = x.createRadialGradient(mx, my, r, mx, my, r * 5);
      glow.addColorStop(0, `rgba(220,230,255,${0.35 * a})`);
      glow.addColorStop(1, 'rgba(220,230,255,0)');
      x.fillStyle = glow;
      x.fillRect(mx - r * 5, my - r * 5, r * 10, r * 10);
      x.fillStyle = `rgba(250,250,235,${a})`;
      x.beginPath();
      x.arc(mx, my, r, 0, TAU);
      x.fill();
      x.fillStyle = `rgba(200,200,190,${a * 0.6})`;
      x.beginPath();
      x.arc(mx - r * 0.3, my - r * 0.2, r * 0.22, 0, TAU);
      x.arc(mx + r * 0.35, my + r * 0.3, r * 0.15, 0, TAU);
      x.fill();
      // odraz měsíce na vodě
      x.save();
      x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const yy = surfaceY + (3 + i * 7) * s;
        const ww = (26 - i * 2) * s * (0.7 + 0.3 * Math.sin(t * 2 + i));
        x.fillStyle = `rgba(200,210,255,${0.22 * a * (1 - i / 10)})`;
        x.fillRect(mx - ww / 2 + Math.sin(t * 1.5 + i) * 4 * s, yy, ww, 2 * s);
      }
      x.restore();
    }
    // světlušky u rybníka a potoka
    if (!this.lite && (this.loc.id === 'rybnik' || this.loc.id === 'potok')) {
      x.save();
      x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const fx = ((i * 97.3 + t * (6 + (i % 4) * 3) * s) % (w + 40)) - 20;
        const fy = surfaceY - (20 + ((i * 53) % 90)) * s + Math.sin(t * 1.3 + i) * 12 * s;
        const blink = Math.max(0, Math.sin(t * 2.2 + i * 2.4));
        if (blink < 0.05) continue;
        const gr = x.createRadialGradient(fx, fy, 0, fx, fy, 9 * s);
        gr.addColorStop(0, `rgba(230,255,140,${0.9 * blink * a})`);
        gr.addColorStop(1, 'rgba(230,255,140,0)');
        x.fillStyle = gr;
        x.fillRect(fx - 9 * s, fy - 9 * s, 18 * s, 18 * s);
      }
      x.restore();
    }
  }
}

function cloudSprite(w: number, h: number, rng: () => number): HTMLCanvasElement {
  const c = createCanvas(w, h);
  const x = ctx2d(c);
  const puffs = 6;
  for (let i = 0; i < puffs; i++) {
    const px = w * (0.2 + (i / (puffs - 1)) * 0.6);
    const r = Math.min(h * 0.44, h * (0.24 + rng() * 0.12) * (i === 2 || i === 3 ? 1.35 : 1));
    const py = h * 0.56;
    const g = x.createRadialGradient(px, py - r * 0.3, r * 0.2, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.7, 'rgba(250,252,255,0.85)');
    g.addColorStop(1, 'rgba(235,242,250,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(px, py, r, 0, TAU);
    x.fill();
  }
  return c;
}
