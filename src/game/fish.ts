import type { Species } from '../data/species';
import { fishAspect, spriteFor } from './sprites';
import { fishWidthPx, wallX, zoneY, type World } from './world';
import type { Rng } from './types';
import { TAU } from './util';

export type FishState = 'wander' | 'interested' | 'nibble' | 'bite' | 'hooked' | 'landing' | 'flee' | 'leave';

let nextId = 1;

export class Fish {
  readonly id = nextId++;
  readonly species: Species;
  readonly sizeCm: number;
  readonly trophy: boolean;
  readonly rainbow: boolean;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** -1 = hlava vlevo (jak je obrázek), +1 = hlava vpravo */
  dir: -1 | 1;
  /** plynulé otáčení: -1..1 */
  facing: number;
  /** 0 = u nás, 1 = daleko (menší a kalnější) */
  z: number;
  phase: number;
  state: FishState = 'wander';
  stateT = 0;
  targetX: number;
  targetY: number;
  /** ryba je chvíli vyplašená a návnady si nevšímá */
  spooked = 0;
  life: number;
  /** průhlednost při připlutí / odplutí */
  alpha = 0;
  nibblesLeft = 0;
  /** tah při zdolávání (vizuální cukání) */
  thrash = 0;
  /** úhel těla (při zdolávání) */
  angle = 0;
  private cruise: number;

  constructor(species: Species, sizeCm: number, trophy: boolean, rainbow: boolean, world: World, rng: Rng, fromEdge: boolean) {
    this.species = species;
    this.sizeCm = sizeCm;
    this.trophy = trophy;
    this.rainbow = rainbow;
    const [y0, y1] = zoneY(world, species.zone);
    this.y = y0 + (y1 - y0) * rng();
    this.dir = rng() < 0.5 ? -1 : 1;
    // u břehu/skály vlevo připlouvají ryby jen zprava
    if (fromEdge && world.wallTop > 0) this.dir = -1;
    // z must be set before widthPx() (it scales the width) — otherwise fish entering from the edge get x = NaN
    this.z = rng() * 0.8;
    const wPx = this.widthPx(world);
    if (fromEdge) {
      this.x = this.dir === 1 ? -wPx * 0.6 : world.w + wPx * 0.6;
    } else {
      this.x = world.w * (0.08 + rng() * 0.84);
      this.alpha = 1;
    }
    this.facing = this.dir;
    this.phase = rng() * TAU;
    this.targetX = this.x + this.dir * world.w * 0.4;
    this.targetY = this.y;
    // malé ryby jsou hbitější
    this.cruise = (22 + 30 * Math.min(1, 12 / Math.sqrt(sizeCm + 4))) * world.scale * (species.zone === 'dno' ? 0.75 : 1);
    this.life = 22 + rng() * 26;
  }

  widthPx(world: World): number {
    return fishWidthPx(this.sizeCm, world) * (1 - this.z * 0.2);
  }

  heightPx(world: World): number {
    return this.widthPx(world) / fishAspect(this.species.id);
  }

  /** pozice tlamy (obrázek má hlavu vlevo) */
  mouth(world: World): { x: number; y: number } {
    const w = this.widthPx(world);
    const h = this.heightPx(world);
    const f = this.facing >= 0 ? 1 : -1;
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    const lx = f * w * 0.46;
    const ly = h * 0.05;
    return { x: this.x + lx * c - ly * s, y: this.y + lx * s + ly * c };
  }

  pickWanderTarget(world: World, rng: Rng): void {
    const [y0, y1] = zoneY(world, this.species.zone);
    const range = world.w * (0.2 + rng() * 0.45);
    let tx = this.x + (rng() < 0.75 ? this.dir : -this.dir) * range;
    const margin = this.widthPx(world) * 0.5;
    const left = wallX(world, this.targetY) + margin;
    if (tx < Math.max(margin, left)) tx = Math.max(margin, left) + rng() * world.w * 0.3;
    if (tx > world.w - margin) tx = world.w - margin - rng() * world.w * 0.3;
    this.targetX = tx;
    this.targetY = y0 + (y1 - y0) * rng();
  }

  /** Pohyb ke zvolenému cíli (steering), rychlost `speedMul` × cestovní. */
  steer(dt: number, speedMul: number, current: number, world: World): void {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = this.cruise * speedMul;
    const ax = (dx / d) * sp;
    const ay = (dy / d) * sp * 0.6;
    const k = 1 - Math.exp(-dt * 1.8);
    this.vx += (ax - this.vx) * k;
    this.vy += (ay - this.vy) * k;
    this.x += (this.vx + current * 0.25 * world.scale) * dt;
    this.y += this.vy * dt;
    if (Math.abs(this.vx) > 3) {
      const want: -1 | 1 = this.vx > 0 ? 1 : -1;
      if (want !== this.dir) this.dir = want;
    }
    const turn = 1 - Math.exp(-dt * 7);
    this.facing += (this.dir - this.facing) * turn;
    const speed = Math.hypot(this.vx, this.vy);
    this.phase += dt * (2.5 + speed / (6 * world.scale));
  }

  clampToWater(world: World): void {
    const h = this.heightPx(world);
    const top = world.surfaceY + h * 0.5 + 4 * world.scale;
    const bottom = world.bottomY - h * 0.35;
    if (this.y < top) this.y = top;
    if (this.y > bottom) this.y = bottom;
    if (world.wallTop > 0 && this.state !== 'leave') {
      const minX = wallX(world, this.y) + this.widthPx(world) * 0.45;
      if (this.x < minX) {
        this.x = minX;
        if (this.targetX < minX) this.targetX = minX + world.w * 0.3;
      }
    }
  }

  draw(x: CanvasRenderingContext2D, world: World, t: number, fx: boolean): void {
    const w = this.widthPx(world);
    const h = w / fishAspect(this.species.id);
    const sprite = spriteFor(this.species.id, w * world.dpr, this.rainbow);
    x.save();
    x.globalAlpha = this.alpha * (1 - this.z * 0.28);
    x.translate(this.x, this.y);
    x.rotate(this.angle);
    // otáčení: obrázek má hlavu vlevo → pro směr doprava zrcadlit
    const flip = -this.facing;
    x.scale(Math.sign(flip) * Math.max(0.12, Math.abs(flip)), 1);
    if (this.rainbow && fx) {
      const g = x.createRadialGradient(0, 0, h * 0.2, 0, 0, w * 0.7);
      const hue = (t * 90) % 360;
      g.addColorStop(0, `hsla(${hue},90%,70%,0.35)`);
      g.addColorStop(1, `hsla(${hue},90%,70%,0)`);
      x.fillStyle = g;
      x.fillRect(-w * 0.7, -w * 0.7, w * 1.4, w * 1.4);
    }
    if (!sprite) {
      // zástupný tvar, než se načte obrázek
      x.fillStyle = 'rgba(40,60,70,0.5)';
      x.beginPath();
      x.ellipse(0, 0, w * 0.45, h * 0.35, 0, 0, TAU);
      x.fill();
      x.restore();
      return;
    }
    const slices = fx ? 8 : 1;
    const amp = h * (0.035 + this.thrash * 0.09) * (this.state === 'hooked' ? 1.6 : 1);
    const sw = sprite.width / slices;
    const dw = w / slices;
    for (let i = 0; i < slices; i++) {
      const u = i / Math.max(1, slices - 1);
      // hlava (vlevo) se skoro nehýbe, ocas (vpravo) nejvíc
      const off = slices > 1 ? Math.sin(this.phase * 2.2 - u * 2.4) * amp * u * u : 0;
      x.drawImage(sprite, i * sw, 0, sw + (i < slices - 1 ? 1 : 0), sprite.height, -w / 2 + i * dw, -h / 2 + off, dw + 0.6, h);
    }
    if (this.species.rarity >= 4 && fx && Math.sin(t * 3 + this.id) > 0.6) {
      x.fillStyle = 'rgba(255,255,220,0.8)';
      const sx = Math.sin(t * 7 + this.id) * w * 0.3;
      const sy = Math.cos(t * 5 + this.id) * h * 0.25;
      star(x, sx, sy, 3.5 * world.scale);
    }
    x.restore();
  }
}

function star(x: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  x.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const rr = i % 2 ? r * 0.35 : r;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
  x.fill();
}
