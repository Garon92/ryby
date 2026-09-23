import { LOCATION_BY_ID, type LocationDef } from '../data/locations';
import { SPECIES, type LocationId } from '../data/species';
import type { BaitId } from '../data/shop';
import { GameAudio } from './audio';
import { Fish } from './fish';
import {
  drawBait,
  drawBobber,
  drawFisher,
  drawGroundLantern,
  drawLine,
  drawPlatform,
  lanternPos,
  REST_ANGLE,
  rodTip,
  type FisherPose,
  type Gear,
} from './fisher';
import { Effects } from './fx';
import { BITE, interestChance } from './logic/bite';
import { autoReel, fightStrength, newFight, stepFight, type FightState } from './logic/fight';
import { clamp, randomRng } from './logic/rng';
import { depthMatch, effectiveAffinity, locationPool, pickSpecies, RAINBOW_CHANCE, rollSize } from './logic/spawn';
import { Scene } from './scene/scene';
import { daylight, isNight } from './sky';
import { preloadSprites } from './sprites';
import type { Difficulty } from './types';
import { easeInOutSine, easeOutCubic, lerp, TAU } from './util';
import { computeWorld, depth01, wallX, type World } from './world';

export type Phase = 'idle' | 'casting' | 'sinking' | 'waiting' | 'bite' | 'fight' | 'landing' | 'retrieve';
export type LostReason = 'snapped' | 'escaped' | 'late' | 'early';
export type ClockMode = 'flow' | 'day' | 'night';

export interface CatchMeta {
  perfect: boolean;
  night: boolean;
}

export interface EngineEvents {
  onPhase(phase: Phase): void;
  /** ryba je vylovená (po animaci vytažení) */
  onCatch(fish: Fish, meta: CatchMeta): void;
  onLost(reason: LostReason, fish: Fish | null): void;
  onPerfect(): void;
  onTreasure(coins: number): void;
  onHidden(): void;
  /** každý snímek hry (ne v ukázkovém režimu, ne v pauze) */
  onTick?(dt: number): void;
  /** připlula vzácná ryba (rarita 4–5) */
  onRare?(fish: Fish): void;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  coins: number;
  wob: number;
}
interface Duck {
  x: number;
  dir: 1 | -1;
  speed: number;
  bob: number;
  quack: number;
}

const HOUR_RATE_TIMED = 16.8 / 180; // 5:40 → 22:28 za 3 minuty
const HOUR_RATE_FREE = 24 / 600; // den za 10 minut

export class Engine {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly audio: GameAudio;
  readonly fx = new Effects();
  events: EngineEvents;

  world!: World;
  loc: LocationDef = LOCATION_BY_ID.rybnik;
  private scene: Scene = new Scene(this.loc);
  fishes: Fish[] = [];

  // nastavení
  difficulty: Difficulty = 'easy';
  gear: Gear = { rod: 'wood', bobber: 'classic', bait: 'worm', hat: 'fisher' };
  autopilot = false;
  /** ukázkový režim za úvodní obrazovkou */
  attract = true;
  hints = true;
  lite = false;
  clockMode: ClockMode = 'flow';
  timed = true;
  hour = 7;

  // stav
  phase: Phase = 'idle';
  private phaseT = 0;
  private time = 0;
  private running = false;
  private paused = false;
  private raf = 0;
  private last = 0;

  private pose: FisherPose = { rodAngle: REST_ANGLE, bend: 0, bendDir: 0, cheer: 0, blink: false, bob: 0 };
  private blinkT = 2;
  private castFrom = { x: 0, y: 0 };
  private castTo = { x: 0, y: 0 };
  private castFlight = 0.5;
  private bob = { x: 0, y: 0, dip: 0, tilt: 0 };
  private hookY = 0;
  private hookX = 0;
  private waitT = 0;
  private biteFish: Fish | null = null;
  private hooked: Fish | null = null;
  private hookPoint = { x: 0, y: 0 };
  private fight: FightState | null = null;
  private fightStrengthV = 1;
  reelHeld = false;
  private autoReeling = true;
  private perfect = false;
  private queuedCast: { x: number; y: number } | null = null;
  private landing = { from: { x: 0, y: 0 }, t: 0 };
  aim: { x: number; y: number } | null = null;
  /** druhy, které už hráč zná (jmenovka při najetí myší); ostatní jsou „???“ */
  known: ReadonlySet<string> = new Set();
  /** klávesnicové míření (když není myš) */
  keyAim = { x: 0.55, y: 0.5 };
  private idleT = 0;
  private autoT = 1;
  private bubbles: Bubble[] = [];
  private bubbleT = 20;
  private ducks: Duck[] = [];
  private ambientBubbleT = 0;

  constructor(canvas: HTMLCanvasElement, events: EngineEvents, audio = new GameAudio()) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D není k dispozici');
    this.ctx = ctx;
    this.events = events;
    this.audio = audio;
    this.resize();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.audio.suspend();
        this.events.onHidden();
      } else {
        this.audio.resume();
        this.last = performance.now();
      }
    });
  }

  // ————————————————————————————————— nastavení —————————————————————————————————

  setLocation(id: LocationId): void {
    this.loc = LOCATION_BY_ID[id];
    this.scene = new Scene(this.loc);
    this.scene.lite = this.lite;
    this.resize(true);
    this.resetRound();
    void preloadSprites(locationPool(SPECIES, id).map((s) => s.id));
    this.updateAmbience();
  }

  setLite(lite: boolean): void {
    this.lite = lite;
    this.scene.lite = lite;
    this.fx.lite = lite;
  }

  setBait(b: BaitId): void {
    this.gear = { ...this.gear, bait: b };
  }

  /** 0 = jasno … 1 = déšť */
  rain = 0;
  private rainTarget = 0;

  setRain(on: boolean, instant = false): void {
    this.rainTarget = on ? 1 : 0;
    if (instant) this.rain = this.rainTarget;
    this.audio.setRain(this.rainTarget);
  }

  get raining(): boolean {
    return this.rainTarget > 0;
  }

  setClock(mode: ClockMode, timed: boolean): void {
    this.clockMode = mode;
    this.timed = timed;
    this.hour = mode === 'day' ? 11.5 : mode === 'night' ? 22.5 : timed ? 5.7 : 7;
    this.updateAmbience();
  }

  get night(): boolean {
    return isNight(this.hour);
  }

  /** Nové kolo: ryby na místě, nic na háčku. */
  resetRound(): void {
    this.fishes = [];
    this.fx.clear();
    this.bubbles = [];
    this.hooked = null;
    this.biteFish = null;
    this.fight = null;
    this.setPhase('idle');
    this.pose.rodAngle = REST_ANGLE;
    this.pose.bend = 0;
    const n = this.population();
    for (let i = 0; i < n; i++) this.spawnFish(false);
    this.ducks = [];
    if (this.loc.id === 'rybnik' || this.loc.id === 'prehrada') {
      this.ducks.push({ x: this.world.w * 0.62, dir: -1, speed: 14, bob: 0, quack: 0 });
      if (this.world.w > 700) this.ducks.push({ x: this.world.w * 0.82, dir: -1, speed: 12, bob: 1, quack: 0 });
    }
  }

  private population(): number {
    return Math.round(this.loc.population * clamp(this.world.w / 1000, 0.65, 1.45));
  }

  private spawnFish(fromEdge: boolean): void {
    const pool = locationPool(SPECIES, this.loc.id);
    const s = pickSpecies(pool, { location: this.loc.id, night: this.night, bait: this.gear.bait, difficulty: this.difficulty }, randomRng);
    if (!s) return;
    const { cm, trophy } = rollSize(s, randomRng);
    const f = new Fish(s, cm, trophy, Math.random() < RAINBOW_CHANCE, this.world, randomRng, fromEdge);
    f.pickWanderTarget(this.world, randomRng);
    this.fishes.push(f);
    if (fromEdge && !this.attract && (s.rarity >= 4 || f.rainbow)) this.events.onRare?.(f);
  }

  // ————————————————————————————————— smyčka —————————————————————————————————

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (document.hidden) {
        this.last = now;
        return;
      }
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) this.update(dt);
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (p) {
      this.reelHeld = false;
      this.audio.setReel(false);
    }
    this.last = performance.now();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  resize(keepFish = false): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, rect.width || window.innerWidth);
    const h = Math.max(320, rect.height || window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const old = this.world;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.world = computeWorld(w, h, dpr, this.loc);
    this.scene.resize(this.world);
    this.fx.surfaceY = this.world.surfaceY;
    if (old && keepFish !== true) {
      const kx = this.world.w / old.w;
      for (const f of this.fishes) {
        f.x *= kx;
        f.y = this.world.surfaceY + ((f.y - old.surfaceY) / old.depth) * this.world.depth;
        f.pickWanderTarget(this.world, randomRng);
      }
      if (this.phase !== 'idle') this.cancelLine();
    }
  }

  // ————————————————————————————————— vstup —————————————————————————————————

  isWater(x: number, y: number): boolean {
    return y > this.world.surfaceY + 6 * this.world.scale && y < this.world.bottomY && x > 0 && x < this.world.w;
  }

  /** Klik/ťuk/mezerník. Vrací true, pokud se něco stalo. */
  action(px?: number, py?: number): boolean {
    this.idleT = 0;
    if (px !== undefined && py !== undefined && this.tapExtras(px, py)) return true;
    switch (this.phase) {
      case 'idle': {
        const t = px !== undefined && py !== undefined ? { x: px, y: py } : this.keyAimPoint();
        if (!this.isWater(t.x, t.y)) {
          if (py !== undefined && py <= this.world.surfaceY + 6 * this.world.scale && px !== undefined) {
            // ťuk nad vodu: nahodit kousek pod hladinu na tom místě
            this.cast(px, this.world.surfaceY + this.world.depth * 0.3);
            return true;
          }
          return false;
        }
        this.cast(t.x, t.y);
        return true;
      }
      case 'waiting': {
        const f = this.biteFish;
        if (f && f.state === 'nibble') {
          if (BITE[this.difficulty].autoHook) {
            this.hook(f);
          } else {
            // moc brzy – ryba se lekne
            this.scare(f);
            this.events.onLost('early', f);
          }
          return true;
        }
        if (px !== undefined && py !== undefined && this.isWater(px, py)) this.queuedCast = { x: px, y: py };
        this.retrieve();
        return true;
      }
      case 'sinking':
        if (px !== undefined && py !== undefined && this.isWater(px, py)) {
          this.queuedCast = { x: px, y: py };
          this.retrieve();
          return true;
        }
        return false;
      case 'bite':
        if (this.biteFish) this.hook(this.biteFish);
        // prst/tlačítko zůstává dole → rovnou navíjí
        this.reelHeld = true;
        return true;
      case 'fight':
        this.reelHeld = true;
        return true;
      default:
        return false;
    }
  }

  private keyAimPoint(): { x: number; y: number } {
    return {
      x: this.world.w * this.keyAim.x,
      y: this.world.surfaceY + this.world.depth * this.keyAim.y,
    };
  }

  moveKeyAim(dx: number, dy: number): void {
    this.aim = null;
    this.keyAim.x = clamp(this.keyAim.x + dx, 0.05, 0.97);
    this.keyAim.y = clamp(this.keyAim.y + dy, 0.06, 0.94);
    this.idleT = 0;
  }

  /** Bublina s mincemi / kachna (ťuk mimo rybaření). */
  private tapExtras(px: number, py: number): boolean {
    const s = this.world.scale;
    for (const b of this.bubbles) {
      if (Math.hypot(px - b.x, py - b.y) < b.r + 16 * s) {
        this.bubbles = this.bubbles.filter((o) => o !== b);
        this.fx.sparkle(b.x, b.y, s, 14, '#ffe066');
        this.fx.text(b.x, b.y - 10 * s, `+${b.coins}`, '#ffd54a', 26);
        this.audio.play('bubble');
        this.audio.play('coin');
        this.events.onTreasure(b.coins);
        return true;
      }
    }
    for (const d of this.ducks) {
      const dy = this.scene.waveY(d.x, this.time) - 8 * s;
      if (Math.hypot(px - d.x, py - dy) < 26 * s) {
        d.quack = 1.2;
        this.audio.play('quack');
        this.fx.text(d.x, dy - 26 * s, 'Kvák!', '#ffffff', 18);
        return true;
      }
    }
    return false;
  }

  // ————————————————————————————————— rybaření —————————————————————————————————

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
    this.events.onPhase(p);
  }

  cast(tx: number, ty: number): void {
    const w = this.world;
    ty = clamp(ty, w.surfaceY + 16 * w.scale, w.bottomY - 12 * w.scale);
    tx = clamp(tx, Math.max(20 * w.scale, wallX(w, ty) + 14 * w.scale), w.w - 20 * w.scale);
    this.castTo = { x: tx, y: ty };
    this.hookX = tx;
    this.hookY = ty;
    this.perfect = false;
    const dist = Math.abs(tx - w.fisherX);
    this.castFlight = 0.32 + Math.min(0.45, dist / (1800 * w.scale));
    this.setPhase('casting');
    this.audio.play('cast');
  }

  private retrieve(): void {
    if (this.biteFish && (this.biteFish.state === 'interested' || this.biteFish.state === 'nibble')) {
      this.biteFish.state = 'wander';
      this.biteFish.pickWanderTarget(this.world, randomRng);
    }
    this.biteFish = null;
    this.setPhase('retrieve');
  }

  /** zrušit vlasec (resize apod.) */
  cancelLine(): void {
    if (this.hooked) {
      this.hooked.state = 'flee';
      this.hooked.angle = 0;
    }
    this.hooked = null;
    this.fight = null;
    this.biteFish = null;
    this.audio.setReel(false);
    this.setPhase('idle');
  }

  private scare(f: Fish): void {
    f.state = 'flee';
    f.spooked = 5;
    f.targetX = f.x + (f.x < this.hookX ? -1 : 1) * this.world.w * 0.5;
    f.targetY = f.y + (Math.random() - 0.5) * 60 * this.world.scale;
    f.stateT = 0;
    if (this.biteFish === f) this.biteFish = null;
    this.bob.dip = 0;
    this.fx.ripple(this.bob.x, this.world.surfaceY, this.world.scale);
    this.audio.play('miss');
  }

  private hook(f: Fish): void {
    this.hooked = f;
    this.biteFish = null;
    f.state = 'hooked';
    f.stateT = 0;
    this.hookPoint = { x: f.x, y: f.y };
    this.fight = newFight(randomRng);
    this.fightStrengthV = fightStrength(f.species, f.sizeCm, this.difficulty);
    this.autoReeling = true;
    this.audio.play('hook');
    this.fx.splash(this.bob.x, this.world.surfaceY, this.world.scale, 0.6);
    if ('vibrate' in navigator && !this.attract) navigator.vibrate?.(40);
    this.setPhase('fight');
  }

  // ————————————————————————————————— update —————————————————————————————————

  update(dt: number): void {
    this.time += dt;
    this.phaseT += dt;
    const w = this.world;
    // čas dne
    if (this.clockMode === 'flow' && !this.attract) {
      const prevNight = this.night;
      this.hour = (this.hour + dt * (this.timed ? HOUR_RATE_TIMED : HOUR_RATE_FREE)) % 24;
      if (prevNight !== this.night) this.updateAmbience();
    }
    // rybář
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.pose.blink = this.blinkT > -0.12;
      if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;
    }
    this.pose.cheer = Math.max(0, this.pose.cheer - dt * 1.2);
    this.pose.bob = this.loc.spot === 'boat' ? Math.sin(this.time * 1.6) * 2.5 * w.scale : 0;

    this.updatePhase(dt);
    this.updateFish(dt);
    this.updateExtras(dt);
    this.fx.update(dt);
    this.rain += (this.rainTarget - this.rain) * Math.min(1, dt * 0.6);
    if (this.rain > 0.2 && Math.random() < dt * 14 * this.rain) {
      const rx = Math.random() * w.w;
      this.fx.ripple(rx, this.scene.waveY(rx, this.time), w.scale * 0.35);
    }
    this.audio.tick(dt);
    if (this.autopilot || this.attract) this.updateAutopilot(dt);
    else if (this.phase === 'idle') this.idleT += dt;
    if (!this.attract) this.events.onTick?.(dt);
  }

  private updatePhase(dt: number): void {
    const w = this.world;
    const s = w.scale;
    const t = this.phaseT;
    switch (this.phase) {
      case 'idle':
        this.pose.rodAngle += (REST_ANGLE + Math.sin(this.time * 0.8) * 0.03 - this.pose.rodAngle) * Math.min(1, dt * 6);
        this.pose.bend = Math.max(0, this.pose.bend - dt * 3);
        break;
      case 'casting': {
        // nápřah a švih
        if (t < 0.22) this.pose.rodAngle = lerp(REST_ANGLE, -2.2, easeOutCubic(t / 0.22));
        else if (t < 0.36) this.pose.rodAngle = lerp(-2.2, -0.35, easeInOutSine((t - 0.22) / 0.14));
        else this.pose.rodAngle = lerp(this.pose.rodAngle, -0.7, Math.min(1, dt * 5));
        if (t >= 0.3 && this.castFrom.x === 0) this.castFrom = rodTip(w, this.pose);
        if (t >= 0.3 + this.castFlight) {
          this.castFrom = { x: 0, y: 0 };
          this.bob = { x: this.castTo.x, y: w.surfaceY, dip: 0.6, tilt: 0 };
          this.fx.splash(this.castTo.x, w.surfaceY, s, 0.7);
          this.audio.play('splash');
          this.checkPerfect();
          this.setPhase('sinking');
        }
        break;
      }
      case 'sinking': {
        const speed = (this.difficulty === 'easy' ? 300 : 220) * s;
        const depth = Math.min(this.hookY - w.surfaceY, t * speed);
        this.bob.dip = Math.max(0, this.bob.dip - dt * 2);
        this.pose.rodAngle += (-0.75 - this.pose.rodAngle) * Math.min(1, dt * 4);
        if (depth >= this.hookY - w.surfaceY) {
          this.waitT = 0;
          this.setPhase('waiting');
        }
        break;
      }
      case 'waiting': {
        this.waitT += dt;
        this.pose.rodAngle += (-0.75 + Math.sin(this.time) * 0.02 - this.pose.rodAngle) * Math.min(1, dt * 4);
        this.bob.dip = Math.max(0, this.bob.dip - dt * 3);
        this.bob.tilt *= 1 - dt * 4;
        this.driftBobber(dt);
        if (!this.biteFish && this.waitT > BITE[this.difficulty].guaranteeAfter) this.summonFish();
        break;
      }
      case 'bite': {
        const f = this.biteFish;
        this.bob.dip = Math.min(1, this.bob.dip + dt * 8);
        this.bob.tilt = Math.sin(this.time * 30) * 0.3;
        this.pose.rodAngle += (-0.62 - this.pose.rodAngle) * Math.min(1, dt * 8);
        this.pose.bend = 0.25 + Math.sin(this.time * 25) * 0.05;
        this.pose.bendDir = Math.PI / 2;
        if (!f) {
          this.setPhase('waiting');
          break;
        }
        const tune = BITE[this.difficulty];
        if (tune.autoHook && t > 0.3) this.hook(f);
        else if (t * 1000 > tune.biteWindowMs) {
          // pozdě – ryba pustila návnadu
          this.scare(f);
          this.events.onLost('late', f);
          this.waitT = 0;
          this.setPhase('waiting');
        }
        break;
      }
      case 'fight':
        this.updateFight(dt);
        break;
      case 'landing': {
        const d = 0.85;
        this.landing.t = t / d;
        this.pose.rodAngle += (-1.6 - this.pose.rodAngle) * Math.min(1, dt * 6);
        this.pose.bend = Math.max(0, this.pose.bend - dt * 2);
        if (t >= d) {
          const f = this.hooked;
          this.hooked = null;
          this.fight = null;
          this.pose.cheer = 1;
          this.setPhase('idle');
          if (f) {
            this.fishes = this.fishes.filter((o) => o !== f);
            this.events.onCatch(f, { perfect: this.perfect, night: this.night });
          }
        }
        break;
      }
      case 'retrieve': {
        const d = 0.3;
        if (t >= d) {
          this.setPhase('idle');
          if (this.queuedCast) {
            const q = this.queuedCast;
            this.queuedCast = null;
            this.cast(q.x, q.y);
          }
        }
        break;
      }
    }
  }

  private driftBobber(dt: number): void {
    const w = this.world;
    if (this.loc.current <= 0) return;
    const drift = this.loc.current * 0.18 * w.scale * dt;
    this.bob.x += drift;
    this.hookX = this.bob.x;
    if (this.bob.x > w.w - 30 * w.scale) this.retrieve();
  }

  private checkPerfect(): void {
    const w = this.world;
    const R = BITE[this.difficulty].perfectRadius * w.scale;
    let best: Fish | null = null;
    let bd = Infinity;
    for (const f of this.fishes) {
      if (f.state !== 'wander' || f.spooked > 0) continue;
      if (effectiveAffinity(f.species, this.gear.bait, this.difficulty) < 0.3) continue;
      const m = f.mouth(w);
      const d = Math.hypot(m.x - this.castTo.x, m.y - this.castTo.y);
      if (d < R && d < bd) {
        bd = d;
        best = f;
      }
    }
    if (best) {
      this.perfect = true;
      if (!this.attract) {
        this.fx.sparkle(this.castTo.x, w.surfaceY, w.scale, 16);
        this.fx.text(this.castTo.x, w.surfaceY - 30 * w.scale, 'Perfektní hod!', '#ffe066', 22);
        this.audio.play('perfect');
        this.events.onPerfect();
      }
      this.makeInterested(best, true);
    }
  }

  private makeInterested(f: Fish, eager: boolean): void {
    const tune = BITE[this.difficulty];
    f.state = 'interested';
    f.stateT = 0;
    const [a, b] = tune.nibbles;
    f.nibblesLeft = eager ? Math.max(0, a - 1) : a + Math.floor(Math.random() * (b - a + 1));
    this.biteFish = f;
  }

  /** Když se dlouho nic neděje, pošli k návnadě nejbližší rybu, která ji má ráda. */
  private summonFish(): void {
    const w = this.world;
    let best: Fish | null = null;
    let bd = Infinity;
    for (const f of this.fishes) {
      if (f.state !== 'wander' || f.spooked > 0 || f.alpha < 0.5) continue;
      const aff = effectiveAffinity(f.species, this.gear.bait, this.difficulty);
      if (aff < 0.3) continue;
      const d = Math.hypot(f.x - this.hookX, f.y - this.hookY) / (0.5 + aff);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    if (best) this.makeInterested(best, false);
    else if (this.waitT > BITE[this.difficulty].guaranteeAfter + 4) {
      // nikdo nechce – pošli novou rybu z okraje
      this.spawnFish(true);
      this.waitT = BITE[this.difficulty].guaranteeAfter - 2;
    }
    void w;
  }

  private updateFight(dt: number): void {
    const f = this.hooked;
    const st = this.fight;
    const w = this.world;
    if (!f || !st) {
      this.setPhase('idle');
      return;
    }
    let reeling = this.reelHeld;
    if (this.autopilot || this.attract) {
      this.autoReeling = autoReel(st, this.autoReeling);
      reeling = this.autoReeling;
    }
    const next = stepFight(st, { strength: this.fightStrengthV, difficulty: this.difficulty }, reeling, dt, randomRng);
    this.fight = next;
    this.audio.setReel(reeling && !next.result, 1 - next.tension * 0.5);
    // pozice ryby mezi místem záběru a špičkou prutu
    const tip = rodTip(w, this.pose);
    const land = { x: tip.x + 30 * w.scale, y: w.surfaceY + 14 * w.scale };
    const d = next.distance;
    let fx = land.x + (this.hookPoint.x - land.x) * d;
    let fy = land.y + (this.hookPoint.y - land.y) * Math.min(1, d);
    const wig = next.running ? 1 : 0.35;
    f.thrash += ((next.running ? 1 : 0.3) - f.thrash) * Math.min(1, dt * 6);
    fx += Math.sin(this.time * 9) * 14 * w.scale * wig;
    fy += Math.cos(this.time * 7) * 8 * w.scale * wig;
    fx = clamp(fx, 10, w.w - 10);
    fy = clamp(fy, w.surfaceY + 10 * w.scale, w.bottomY - 10 * w.scale);
    f.x += (fx - f.x) * Math.min(1, dt * 8);
    f.y += (fy - f.y) * Math.min(1, dt * 8);
    f.dir = tip.x < f.x ? -1 : 1;
    f.facing += (f.dir - f.facing) * Math.min(1, dt * 8);
    f.phase += dt * (8 + f.thrash * 12);
    const ang = Math.atan2(tip.y - f.y, Math.abs(tip.x - f.x) + 1);
    f.angle = clamp(ang * 0.5, -0.7, 0.7) * (f.dir === 1 ? 1 : -1) + Math.sin(this.time * 14) * 0.08 * f.thrash;
    // prut
    this.pose.bend = clamp(next.tension * 1.05, 0, 1);
    this.pose.bendDir = Math.atan2(f.y - tip.y, f.x - tip.x);
    this.pose.rodAngle += (-1.05 + next.tension * 0.35 - this.pose.rodAngle) * Math.min(1, dt * 5);
    if (Math.random() < dt * 3) this.fx.bubbles(f.x, f.y, w.scale, 2);
    if (next.running && Math.random() < dt * 6) this.fx.ripple(f.x, w.surfaceY, w.scale * 0.6);

    if (next.result === 'caught') {
      this.audio.setReel(false);
      this.landing = { from: { x: f.x, y: f.y }, t: 0 };
      f.state = 'landing';
      this.fx.splash(f.x, w.surfaceY, w.scale, f.sizeCm > 50 ? 1.6 : 1);
      this.audio.play(f.sizeCm > 50 ? 'bigSplash' : 'splash');
      this.setPhase('landing');
    } else if (next.result) {
      this.audio.setReel(false);
      if (next.result === 'snapped') {
        this.audio.play('snap');
        this.fx.text(tip.x + 40 * w.scale, tip.y, 'Prásk!', '#ff8a80', 22);
      } else this.audio.play('miss');
      f.state = 'flee';
      f.spooked = 8;
      f.angle = 0;
      f.thrash = 0;
      f.targetX = f.x + (f.x > w.fisherX ? 1 : -1) * w.w;
      this.hooked = null;
      this.fight = null;
      this.pose.bend = 0;
      this.setPhase('idle');
      this.events.onLost(next.result, f);
    }
  }

  private updateFish(dt: number): void {
    const w = this.world;
    const tune = BITE[this.difficulty];
    const baitInWater = this.phase === 'waiting' || this.phase === 'sinking';
    const baitDepth = depth01(w, this.hookY);
    const night = this.night;
    for (const f of this.fishes) {
      f.stateT += dt;
      if (f.spooked > 0) f.spooked -= dt;
      if (f.state !== 'leave' && f.state !== 'hooked' && f.state !== 'landing') f.alpha = Math.min(1, f.alpha + dt * 1.5);
      switch (f.state) {
        case 'wander': {
          f.life -= dt;
          f.steer(dt, 1, this.loc.current, w);
          if (Math.hypot(f.targetX - f.x, f.targetY - f.y) < 24 * w.scale) f.pickWanderTarget(w, randomRng);
          if (f.life <= 0) {
            f.state = 'leave';
            f.targetX = f.dir === 1 ? w.w + 300 * w.scale : -300 * w.scale;
          }
          if (baitInWater && !this.biteFish && f.spooked <= 0 && this.phase === 'waiting') {
            const aff = effectiveAffinity(f.species, this.gear.bait, this.difficulty);
            const m = f.mouth(w);
            const dist01 = Math.hypot(m.x - this.hookX, m.y - this.hookY) / (tune.attractRadius * w.scale);
            // v noci berou noční druhy, za deště berou ryby lépe
            const nightBonus = (night && f.species.night ? 1.5 : 1) * (1 + 0.35 * this.rain);
            const p = interestChance(tune, aff, depthMatch(f.species.zone, baitDepth), dist01, nightBonus, dt);
            if (p > 0 && Math.random() < p) this.makeInterested(f, false);
          }
          break;
        }
        case 'interested': {
          if (!baitInWater) {
            f.state = 'wander';
            break;
          }
          const fw = f.widthPx(w);
          const side = f.x < this.hookX ? -1 : 1;
          f.targetX = this.hookX + side * fw * 0.46;
          f.targetY = this.hookY - f.heightPx(w) * 0.05;
          f.steer(dt, 0.9, 0, w);
          f.dir = side === -1 ? 1 : -1;
          const m = f.mouth(w);
          if (Math.hypot(m.x - this.hookX, m.y - this.hookY) < 12 * w.scale || f.stateT > 9) {
            f.state = 'nibble';
            f.stateT = 0;
          }
          break;
        }
        case 'nibble': {
          const side = f.x < this.hookX ? -1 : 1;
          const fw = f.widthPx(w);
          f.targetX = this.hookX + side * fw * (0.47 + Math.sin(f.stateT * 5) * 0.03);
          f.targetY = this.hookY - f.heightPx(w) * 0.05;
          f.steer(dt, 0.6, 0, w);
          f.dir = side === -1 ? 1 : -1;
          if (f.stateT > 0.55 + Math.random() * 0.4) {
            f.stateT = 0;
            if (f.nibblesLeft > 0) {
              f.nibblesLeft--;
              this.bob.dip = 0.45;
              this.bob.tilt = (Math.random() - 0.5) * 0.6;
              this.fx.ripple(this.bob.x, w.surfaceY, w.scale * 0.7);
              this.audio.play('nibble');
            } else if (this.phase === 'waiting') {
              this.audio.play('bite');
              this.fx.splash(this.bob.x, w.surfaceY, w.scale, 0.5);
              if ('vibrate' in navigator && !this.attract && !this.autopilot) navigator.vibrate?.([60, 40, 60]);
              f.state = 'bite';
              this.setPhase('bite');
            }
          }
          break;
        }
        case 'bite': {
          f.targetX = this.hookX + (f.x < this.hookX ? -1 : 1) * f.widthPx(w) * 0.46;
          f.targetY = this.hookY + 10 * w.scale;
          f.steer(dt, 1.2, 0, w);
          if (this.phase !== 'bite' && f.state === 'bite') f.state = 'wander';
          break;
        }
        case 'flee':
          f.steer(dt, 2.6, this.loc.current, w);
          if (f.stateT > 2.2) {
            f.state = 'wander';
            f.pickWanderTarget(w, randomRng);
          }
          break;
        case 'leave':
          f.steer(dt, 1.4, this.loc.current, w);
          f.alpha = Math.max(0, f.alpha - dt * 0.4);
          break;
        case 'hooked':
        case 'landing':
          break;
      }
      if (f.state !== 'hooked' && f.state !== 'landing') {
        f.angle *= 1 - Math.min(1, dt * 4);
        f.clampToWater(w);
      }
    }
    // odplavané ryby pryč, doplnit populaci z okrajů
    const margin = 260 * w.scale;
    this.fishes = this.fishes.filter((f) => !(f.state === 'leave' && (f.x < -margin || f.x > w.w + margin || f.alpha <= 0)));
    const target = this.population();
    if (this.fishes.length < target && Math.random() < dt * 1.2) this.spawnFish(true);
  }

  private updateExtras(dt: number): void {
    const w = this.world;
    const s = w.scale;
    // bubliny s mincemi
    if (!this.attract) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) {
        this.bubbleT = 24 + Math.random() * 26;
        this.bubbles.push({
          x: w.w * (0.3 + Math.random() * 0.62),
          y: w.bottomY - 10 * s,
          r: 15 * s,
          coins: 1 + Math.floor(Math.random() * 3),
          wob: Math.random() * TAU,
        });
      }
    }
    for (const b of this.bubbles) {
      b.y -= 22 * s * dt;
      b.wob += dt * 2;
      b.x += Math.sin(b.wob) * 12 * s * dt;
    }
    this.bubbles = this.bubbles.filter((b) => b.y > w.surfaceY + b.r);
    // obyčejné bublinky od dna
    this.ambientBubbleT -= dt;
    if (this.ambientBubbleT <= 0) {
      this.ambientBubbleT = 0.6 + Math.random() * 1.4;
      this.fx.bubbles(Math.random() * w.w, w.bottomY - 4 * s, s, 1 + Math.floor(Math.random() * 3));
    }
    for (const d of this.ducks) {
      d.x += d.dir * d.speed * s * dt;
      d.quack = Math.max(0, d.quack - dt);
      if (d.x < w.fisherX + 120 * s) d.dir = 1;
      if (d.x > w.w - 40 * s) d.dir = -1;
    }
  }

  private updateAutopilot(dt: number): void {
    const w = this.world;
    this.autoT -= dt;
    if (this.phase === 'idle' && this.autoT <= 0) {
      this.autoT = 0.8 + Math.random() * 0.8;
      // cíl: ryba, která má návnadu ráda, trochu před její tlamu
      let best: Fish | null = null;
      let bs = -Infinity;
      for (const f of this.fishes) {
        if (f.state !== 'wander' || f.alpha < 0.8 || f.x < w.fisherX + 40 * w.scale || f.x > w.w - 30) continue;
        const aff = effectiveAffinity(f.species, this.gear.bait, this.difficulty);
        const score = aff * 2 + f.species.rarity * 0.3 - Math.abs(f.x - w.w * 0.55) / w.w;
        if (score > bs) {
          bs = score;
          best = f;
        }
      }
      if (best) {
        const m = best.mouth(w);
        this.cast(m.x + best.vx * 0.9, m.y + best.vy * 0.5);
      } else this.cast(w.w * (0.45 + Math.random() * 0.4), w.surfaceY + w.depth * (0.3 + Math.random() * 0.5));
    } else if (this.phase === 'waiting' && this.waitT > 9 && !this.biteFish) {
      this.retrieve();
    } else if (this.phase === 'bite' && this.phaseT > 0.25) {
      if (this.biteFish) this.hook(this.biteFish);
    }
  }

  private updateAmbience(): void {
    const night = this.night;
    this.audio.setAmbience({
      water: this.loc.current / 45,
      birds: !night,
      night,
      frogs: this.loc.id === 'rybnik',
    });
  }

  // ————————————————————————————————— kreslení —————————————————————————————————

  render(): void {
    const x = this.ctx;
    const w = this.world;
    const s = w.scale;
    const t = this.time;
    x.setTransform(w.dpr, 0, 0, w.dpr, 0, 0);
    x.imageSmoothingEnabled = true;
    this.scene.drawSky(x, t, this.hour);
    this.scene.drawLandscape(x);
    this.scene.drawWaterBack(x, t, this.hour);
    drawPlatform(x, w, this.loc, t, this.pose.bob);
    this.scene.drawVeil(x);

    const fullFx = !this.lite;
    const sorted = [...this.fishes].sort((a, b) => b.z - a.z);
    for (const f of sorted) if (f.state !== 'hooked' && f.state !== 'landing') f.draw(x, w, t, fullFx);

    // vlasec pod vodou + návnada
    const tip = rodTip(w, this.pose);
    const bobY = this.scene.waveY(this.bob.x, t) + 2 * s + this.bob.dip * 12 * s;
    const baitOut = this.phase === 'sinking' || this.phase === 'waiting' || this.phase === 'bite';
    if (baitOut) {
      const depth = this.phase === 'sinking' ? Math.min(this.hookY, w.surfaceY + this.phaseT * (this.difficulty === 'easy' ? 300 : 220) * s) : this.hookY;
      const bx = this.bob.x + (this.loc.current > 0 ? -8 * s : 0);
      x.strokeStyle = 'rgba(240,240,240,0.55)';
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(this.bob.x, bobY);
      x.quadraticCurveTo(this.bob.x, (bobY + depth) / 2, bx, depth);
      x.stroke();
      drawBait(x, this.gear.bait, bx, depth, w.fs, t);
    }
    const hooked = this.hooked;
    if (hooked && this.phase === 'fight') hooked.draw(x, w, t, fullFx);

    this.scene.drawDepthFog(x);
    this.fx.drawRipples(x);
    this.scene.drawWaterFront(x, t, this.hour);
    this.drawDucks(x);
    this.drawBubbles(x);

    drawPlatform(x, w, this.loc, t, this.pose.bob, true);
    drawGroundLantern(x, w, this.loc, this.pose.bob);
    drawFisher(x, w, this.pose, this.gear, t);

    // vlasec nad vodou
    const lineCol = this.fight ? tensionColor(this.fight.tension) : 'rgba(250,250,250,0.85)';
    if (this.phase === 'casting' && this.castFrom.x !== 0) {
      const u = clamp((this.phaseT - 0.3) / this.castFlight, 0, 1);
      const px = lerp(this.castFrom.x, this.castTo.x, u);
      const arc = (60 * s + Math.abs(this.castTo.x - this.castFrom.x) * 0.22) * 4 * u * (1 - u);
      const py = lerp(this.castFrom.y, w.surfaceY, u * u) - arc;
      drawLine(x, tip, { x: px, y: py }, 10 * s, 'rgba(250,250,250,0.85)', 1.2);
      drawBobber(x, this.gear.bobber, px, py, w.fs, u * 6);
      drawBait(x, this.gear.bait, px, py + 12 * w.fs, w.fs * 0.8, t);
    } else if (baitOut) {
      const sag = (this.phase === 'bite' ? 4 : 22) * s;
      drawLine(x, tip, { x: this.bob.x, y: bobY - 8 * s }, sag, lineCol, 1.2);
      if (this.bob.dip < 0.95) drawBobber(x, this.gear.bobber, this.bob.x, bobY, w.fs, this.bob.tilt);
    } else if (this.phase === 'fight' && hooked) {
      const m = hooked.mouth(w);
      drawLine(x, tip, m, 0, lineCol, 1.6);
    } else if (this.phase === 'retrieve') {
      const u = clamp(this.phaseT / 0.3, 0, 1);
      const px = lerp(this.bob.x, tip.x, u);
      const py = lerp(w.surfaceY, tip.y + 20 * s, u);
      drawLine(x, tip, { x: px, y: py }, 4 * s, 'rgba(250,250,250,0.85)', 1.2);
      drawBobber(x, this.gear.bobber, px, py, w.fs, 0);
    } else if (this.phase === 'idle' || this.phase === 'landing') {
      const hang = { x: tip.x + 2 * w.fs, y: tip.y + 26 * w.fs };
      if (this.phase === 'idle') {
        drawLine(x, tip, hang, 0, 'rgba(250,250,250,0.85)', 1.2);
        drawBobber(x, this.gear.bobber, hang.x, hang.y, w.fs * 0.9, Math.sin(t * 2) * 0.1);
      }
    }
    // vytahovaná ryba ve vzduchu
    if (this.phase === 'landing' && hooked) {
      const u = easeOutCubic(clamp(this.landing.t, 0, 1));
      const to = { x: w.fisherX + 26 * s, y: w.fisherY - 60 * s };
      hooked.x = lerp(this.landing.from.x, to.x, u);
      hooked.y = lerp(this.landing.from.y, to.y, u) - Math.sin(u * Math.PI) * 60 * s;
      hooked.angle = Math.sin(t * 16) * 0.25 * (1 - u) + (hooked.dir === 1 ? -0.4 : 0.4) * u;
      hooked.phase += 0.3;
      drawLine(x, tip, hooked.mouth(w), 0, 'rgba(250,250,250,0.85)', 1.2);
      hooked.draw(x, w, t, fullFx);
      if (Math.random() < 0.5) this.fx.bubbles(hooked.x, hooked.y, s, 0);
    }

    // déšť: šedivější svět a kapky nad hladinou
    if (this.rain > 0.02) this.drawRain(x);
    // noc/večer
    const tinted = this.scene.applyTint(x, this.hour);
    if (tinted) {
      this.scene.drawLights(x, t, this.hour);
      this.drawNightLights(x);
    }
    this.fx.draw(x, s);
    if (!this.attract) this.drawOverlays(x);
  }

  private drawDucks(x: CanvasRenderingContext2D): void {
    const s = this.world.scale;
    for (const d of this.ducks) {
      const y = this.scene.waveY(d.x, this.time) - 2 * s;
      x.save();
      x.translate(d.x, y);
      x.scale(d.dir, 1);
      const q = d.quack > 0 ? Math.sin(d.quack * 20) * 0.1 : 0;
      x.fillStyle = '#8d6e63';
      x.beginPath();
      x.ellipse(0, -6 * s, 15 * s, 8 * s, 0, 0, TAU);
      x.fill();
      x.fillStyle = '#6d4c41';
      x.beginPath();
      x.ellipse(-6 * s, -8 * s, 8 * s, 4 * s, 0.2, 0, TAU);
      x.fill();
      x.save();
      x.translate(11 * s, -14 * s);
      x.rotate(q);
      x.fillStyle = '#2e7d32';
      x.beginPath();
      x.arc(0, 0, 6 * s, 0, TAU);
      x.fill();
      x.fillStyle = '#ffb300';
      x.beginPath();
      x.ellipse(7 * s, 1 * s, 4 * s, 2 * s, 0, 0, TAU);
      x.fill();
      x.fillStyle = '#111';
      x.beginPath();
      x.arc(2 * s, -1.5 * s, 1.2 * s, 0, TAU);
      x.fill();
      x.restore();
      x.fillStyle = '#fafafa';
      x.fillRect(5 * s, -9 * s, 4 * s, 2 * s);
      x.restore();
    }
  }

  private drawBubbles(x: CanvasRenderingContext2D): void {
    const s = this.world.scale;
    for (const b of this.bubbles) {
      const g = x.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.6, 'rgba(255,236,150,0.35)');
      g.addColorStop(1, 'rgba(255,215,64,0.55)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(b.x, b.y, b.r, 0, TAU);
      x.fill();
      x.strokeStyle = 'rgba(255,215,64,0.9)';
      x.lineWidth = 2 * s;
      x.stroke();
      // zlatá mince uvnitř
      const r = b.r * 0.5;
      x.fillStyle = '#f2b705';
      x.beginPath();
      x.arc(b.x, b.y, r, 0, TAU);
      x.fill();
      x.fillStyle = '#ffd54a';
      x.beginPath();
      x.arc(b.x, b.y, r * 0.72, 0, TAU);
      x.fill();
      x.fillStyle = '#c98a04';
      x.beginPath();
      x.ellipse(b.x + r * 0.05, b.y, r * 0.42, r * 0.24, 0, 0, TAU);
      x.fill();
    }
  }

  private drawNightLights(x: CanvasRenderingContext2D): void {
    const w = this.world;
    const s = w.scale;
    const dark = 1 - daylight(this.hour);
    if (dark < 0.2) return;
    const a = Math.min(1, (dark - 0.2) * 2);
    x.save();
    x.globalCompositeOperation = 'lighter';
    const lp = lanternPos(w, this.loc);
    const ly = lp.y + (this.loc.spot === 'boat' ? this.pose.bob : 0);
    const flick = 0.9 + Math.sin(this.time * 13) * 0.05 + Math.sin(this.time * 7.3) * 0.05;
    const g = x.createRadialGradient(lp.x, ly, 2 * s, lp.x, ly, 120 * s);
    g.addColorStop(0, `rgba(255,210,120,${0.55 * a * flick})`);
    g.addColorStop(1, 'rgba(255,210,120,0)');
    x.fillStyle = g;
    x.fillRect(lp.x - 120 * s, ly - 120 * s, 240 * s, 240 * s);
    // svítící splávek (chemické světlo)
    if (this.phase === 'waiting' || this.phase === 'sinking' || this.phase === 'bite') {
      const by = this.scene.waveY(this.bob.x, this.time) - 6 * s + this.bob.dip * 12 * s;
      const gg = x.createRadialGradient(this.bob.x, by, 1, this.bob.x, by, 18 * s);
      gg.addColorStop(0, `rgba(160,255,120,${0.9 * a})`);
      gg.addColorStop(1, 'rgba(160,255,120,0)');
      x.fillStyle = gg;
      x.fillRect(this.bob.x - 18 * s, by - 18 * s, 36 * s, 36 * s);
    }
    x.restore();
  }

  /** Míření, nápověda, „!“ při záběru, ukazatel napětí. */
  private drawOverlays(x: CanvasRenderingContext2D): void {
    const w = this.world;
    const s = w.scale;
    const t = this.time;
    if (this.phase === 'idle' && !this.autopilot) {
      const aim = this.aim ?? (this.idleT > 0.2 ? this.keyAimPoint() : null);
      if (aim && this.isWater(aim.x, aim.y)) {
        const R = BITE[this.difficulty].perfectRadius * s;
        const good = this.fishes.some((f) => {
          if (f.state !== 'wander') return false;
          if (effectiveAffinity(f.species, this.gear.bait, this.difficulty) < 0.3) return false;
          const m = f.mouth(w);
          return Math.hypot(m.x - aim.x, m.y - aim.y) < R;
        });
        x.save();
        x.strokeStyle = good ? 'rgba(255,224,102,0.95)' : 'rgba(255,255,255,0.75)';
        x.lineWidth = 2.5 * s;
        x.setLineDash([6 * s, 6 * s]);
        x.lineDashOffset = -t * 20;
        x.beginPath();
        x.arc(aim.x, aim.y, (good ? 20 : 16) * s, 0, TAU);
        x.stroke();
        x.setLineDash([]);
        x.fillStyle = good ? 'rgba(255,224,102,0.95)' : 'rgba(255,255,255,0.8)';
        x.beginPath();
        x.arc(aim.x, aim.y, 3 * s, 0, TAU);
        x.fill();
        x.restore();
      }
      // jmenovka ryby pod myší
      if (this.aim) {
        const hit = this.fishes.find((f) => {
          if (f.state === 'hooked' || f.state === 'landing' || f.alpha < 0.6) return false;
          const fw = f.widthPx(w) * 0.5;
          const fh = f.heightPx(w) * 0.5;
          const dx = (this.aim!.x - f.x) / fw;
          const dy = (this.aim!.y - f.y) / fh;
          return dx * dx + dy * dy < 1;
        });
        if (hit) this.drawNameTag(x, hit);
      }
      // nápověda: šipka nad vhodnou rybou
      if (this.hints && this.idleT > 4) {
        const f = this.hintFish();
        if (f) {
          const m = f.mouth(w);
          const by = m.y - f.heightPx(w) * 0.6 - 20 * s - Math.abs(Math.sin(t * 4)) * 10 * s;
          x.save();
          x.fillStyle = 'rgba(255,255,255,0.95)';
          x.strokeStyle = 'rgba(0,60,90,0.5)';
          x.lineWidth = 2 * s;
          x.beginPath();
          x.moveTo(m.x, by + 16 * s);
          x.lineTo(m.x - 12 * s, by);
          x.lineTo(m.x - 5 * s, by);
          x.lineTo(m.x - 5 * s, by - 14 * s);
          x.lineTo(m.x + 5 * s, by - 14 * s);
          x.lineTo(m.x + 5 * s, by);
          x.lineTo(m.x + 12 * s, by);
          x.closePath();
          x.fill();
          x.stroke();
          x.restore();
        }
      }
    }
    if (this.phase === 'bite' && !BITE[this.difficulty].autoHook) {
      const pulse = 1 + Math.sin(t * 18) * 0.12;
      const bx = this.bob.x;
      const by = w.surfaceY - 44 * s;
      x.save();
      x.translate(bx, by);
      x.scale(pulse, pulse);
      x.fillStyle = '#ff5252';
      x.beginPath();
      x.arc(0, 0, 18 * s, 0, TAU);
      x.fill();
      x.strokeStyle = '#fff';
      x.lineWidth = 3 * s;
      x.stroke();
      x.fillStyle = '#fff';
      x.font = `900 ${Math.round(24 * s)}px Nunito, system-ui, sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('!', 0, 1 * s);
      x.restore();
    }
    if (this.phase === 'fight' && this.fight) this.drawGauge(x, this.fight);
  }

  private drawRain(x: CanvasRenderingContext2D): void {
    const w = this.world;
    const s = w.scale;
    const a = this.rain;
    x.save();
    const sky = x.createLinearGradient(0, 0, 0, w.surfaceY);
    sky.addColorStop(0, `rgba(88,98,112,${0.62 * a})`);
    sky.addColorStop(1, `rgba(110,120,132,${0.32 * a})`);
    x.fillStyle = sky;
    x.fillRect(0, 0, w.w, w.surfaceY);
    x.fillStyle = `rgba(40,55,70,${0.18 * a})`;
    x.fillRect(0, w.surfaceY, w.w, w.h - w.surfaceY);
    x.beginPath();
    x.rect(0, 0, w.w, w.surfaceY + 2);
    x.clip();
    x.strokeStyle = `rgba(210,225,240,${0.45 * a})`;
    x.lineWidth = 1.2 * s;
    x.lineCap = 'round';
    const n = Math.round((w.w / 7) * a * (this.lite ? 0.5 : 1));
    const t = this.time;
    const fall = w.surfaceY + 40;
    x.beginPath();
    for (let i = 0; i < n; i++) {
      const speed = 520 + (i % 7) * 40;
      const px = ((i * 97.13 + t * 90) % (w.w + 60)) - 30;
      const py = ((i * 53.7 + t * speed) % fall) - 20;
      const len = (12 + (i % 5) * 3) * s;
      x.moveTo(px, py);
      x.lineTo(px - len * 0.18, py + len);
    }
    x.stroke();
    x.restore();
  }

  private drawNameTag(x: CanvasRenderingContext2D, f: Fish): void {
    const w = this.world;
    const s = Math.max(0.85, w.scale);
    const known = this.known.has(f.species.id);
    const label = known ? `${f.species.name} · ${f.sizeCm} cm` : '??? – ještě ji nemáš v albu';
    x.save();
    x.font = `800 ${Math.round(14 * s)}px Nunito, system-ui, sans-serif`;
    const tw = x.measureText(label).width + 20 * s;
    const th = 26 * s;
    const tx = clamp(f.x - tw / 2, 6, w.w - tw - 6);
    const ty = Math.max(w.surfaceY + 4, f.y - f.heightPx(w) * 0.55 - th - 6 * s);
    x.fillStyle = known ? 'rgba(10,40,60,0.82)' : 'rgba(80,40,110,0.82)';
    roundRect(x, tx, ty, tw, th, th / 2);
    x.fill();
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(label, tx + tw / 2, ty + th / 2 + 1);
    x.restore();
  }

  private hintFish(): Fish | null {
    const w = this.world;
    let best: Fish | null = null;
    let bd = Infinity;
    for (const f of this.fishes) {
      if (f.state !== 'wander' || f.alpha < 0.9) continue;
      if (f.x < w.fisherX + 60 * w.scale || f.x > w.w - 40 * w.scale) continue;
      if (effectiveAffinity(f.species, this.gear.bait, this.difficulty) < 0.5) continue;
      const d = Math.abs(f.x - w.w * 0.5) + Math.abs(f.y - (w.surfaceY + w.depth * 0.4));
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  /** Ukazatel napětí vlasce + vzdálenosti ryby. */
  private drawGauge(x: CanvasRenderingContext2D, st: FightState): void {
    const w = this.world;
    const s = Math.max(0.8, w.scale);
    const cx = w.w / 2;
    const cy = Math.max(96, w.surfaceY * 0.55) * 1;
    const R = 58 * s;
    x.save();
    // podklad
    x.fillStyle = 'rgba(10,30,45,0.55)';
    roundRect(x, cx - R - 22 * s, cy - R - 14 * s, (R + 22 * s) * 2, R + 58 * s, 22 * s);
    x.fill();
    const a0 = Math.PI;
    const zones: [number, number, string][] = [
      [0, 0.68, '#4ade80'],
      [0.68, 0.86, '#facc15'],
      [0.86, 1, '#f43f5e'],
    ];
    x.lineWidth = 14 * s;
    x.lineCap = 'butt';
    for (const [z0, z1, c] of zones) {
      x.strokeStyle = c;
      x.beginPath();
      x.arc(cx, cy, R, a0 + z0 * Math.PI, a0 + z1 * Math.PI);
      x.stroke();
    }
    // ručička
    const v = clamp(st.tension, 0, 1.05);
    const ang = a0 + v * Math.PI + (st.tension >= 1 ? Math.sin(this.time * 50) * 0.04 : 0);
    x.strokeStyle = '#fff';
    x.lineWidth = 4 * s;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(cx, cy);
    x.lineTo(cx + Math.cos(ang) * (R - 4 * s), cy + Math.sin(ang) * (R - 4 * s));
    x.stroke();
    x.fillStyle = '#fff';
    x.beginPath();
    x.arc(cx, cy, 6 * s, 0, TAU);
    x.fill();
    // ikona stavu
    x.font = `${Math.round(22 * s)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(st.tension > 0.86 ? '✋' : this.reelHeld || this.autopilot ? '🎣' : '👇', cx, cy - R * 0.45);
    // vzdálenost ryby
    const bw = R * 2 + 10 * s;
    const by = cy + 26 * s;
    x.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(x, cx - bw / 2, by - 5 * s, bw, 10 * s, 5 * s);
    x.fill();
    const prog = clamp(1 - st.distance / 1.9, 0, 1);
    const startProg = clamp(1 - 1 / 1.9, 0, 1);
    x.fillStyle = prog >= startProg ? '#38bdf8' : '#fb923c';
    roundRect(x, cx - bw / 2, by - 5 * s, Math.max(10 * s, bw * prog), 10 * s, 5 * s);
    x.fill();
    x.font = `${Math.round(16 * s)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    x.fillText('🐟', cx - bw / 2 + bw * prog, by - 1 * s);
    x.fillText('🧑', cx + bw / 2 + 12 * s, by);
    x.restore();
  }

  /** Obrázek scény (foto režim). */
  snapshot(): Promise<Blob | null> {
    return new Promise((res) => this.canvas.toBlob((b) => res(b), 'image/png'));
  }

  /** Stav pro HUD. */
  get fightState(): FightState | null {
    return this.fight;
  }
}

function tensionColor(t: number): string {
  if (t > 0.86) return 'rgba(255,90,110,0.95)';
  if (t > 0.68) return 'rgba(255,220,90,0.95)';
  return 'rgba(250,250,250,0.9)';
}

function roundRect(x: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, r: number): void {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}
