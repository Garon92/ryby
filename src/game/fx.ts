import { TAU } from './util';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
  kind: 'drop' | 'spark' | 'confetti' | 'bubble';
  rot: number;
  vr: number;
}
interface Ripple {
  x: number;
  y: number;
  life: number;
  max: number;
  r: number;
}
interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  color: string;
  size: number;
}

const CONFETTI = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#ff9f1c', '#c77dff'];

/** Částicové efekty v canvasu (šplouchnutí, kroužky, jiskry, konfety, plovoucí texty). */
export class Effects {
  private parts: Particle[] = [];
  private ripples: Ripple[] = [];
  private texts: FloatText[] = [];
  gravity = 520;
  surfaceY = 0;
  lite = false;

  clear(): void {
    this.parts = [];
    this.ripples = [];
    this.texts = [];
  }

  splash(x: number, y: number, s: number, power = 1): void {
    const n = Math.round((this.lite ? 6 : 14) * power);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = (90 + Math.random() * 140) * s * Math.sqrt(power);
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: 0.5 + Math.random() * 0.4,
        r: (1.5 + Math.random() * 2.5) * s,
        color: 'rgba(230,248,255,0.9)',
        kind: 'drop',
        rot: 0,
        vr: 0,
      });
    }
    this.ripple(x, y, s * 1.2);
    if (power > 1.2) this.ripple(x, y, s * 2);
  }

  ripple(x: number, y: number, s: number): void {
    this.ripples.push({ x, y, life: 0, max: 1.1, r: 34 * s });
  }

  sparkle(x: number, y: number, s: number, n = 10, color = '#fff6b0'): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = (40 + Math.random() * 120) * s;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: 0.5 + Math.random() * 0.5,
        r: (2 + Math.random() * 3) * s,
        color,
        kind: 'spark',
        rot: 0,
        vr: 0,
      });
    }
  }

  confetti(x: number, y: number, s: number, n = 40): void {
    if (this.lite) n = Math.round(n / 2);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = (160 + Math.random() * 260) * s;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: 1.4 + Math.random() * 0.8,
        r: (3 + Math.random() * 3) * s,
        color: CONFETTI[i % CONFETTI.length] ?? '#fff',
        kind: 'confetti',
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 12,
      });
    }
  }

  bubbles(x: number, y: number, s: number, n = 4): void {
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * 10 * s,
        y,
        vx: (Math.random() - 0.5) * 10 * s,
        vy: -(30 + Math.random() * 40) * s,
        life: 0,
        max: 1.2 + Math.random(),
        r: (1.5 + Math.random() * 2.5) * s,
        color: 'rgba(255,255,255,0.55)',
        kind: 'bubble',
        rot: Math.random() * TAU,
        vr: 0,
      });
    }
  }

  text(x: number, y: number, text: string, color = '#ffe066', size = 22): void {
    this.texts.push({ x, y, text, life: 0, max: 1.3, color, size });
  }

  update(dt: number): void {
    for (const p of this.parts) {
      p.life += dt;
      if (p.kind === 'bubble') {
        p.x += (p.vx + Math.sin(p.life * 6 + p.rot) * 12) * dt;
        p.y += p.vy * dt;
        if (p.y < this.surfaceY) p.life = p.max;
        continue;
      }
      if (p.kind === 'spark') {
        p.vx *= 1 - dt * 3;
        p.vy *= 1 - dt * 3;
      } else if (p.kind === 'confetti') {
        p.vx *= 1 - dt * 1.4;
        p.vy += this.gravity * 0.35 * dt;
        p.vy *= 1 - dt * 1.2;
        p.rot += p.vr * dt;
      } else {
        p.vy += this.gravity * dt;
        if (p.y > this.surfaceY + 2 && p.vy > 0) p.life = p.max;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const r of this.ripples) r.life += dt;
    this.ripples = this.ripples.filter((r) => r.life < r.max);
    for (const t of this.texts) t.life += dt;
    this.texts = this.texts.filter((t) => t.life < t.max);
  }

  drawRipples(x: CanvasRenderingContext2D): void {
    for (const r of this.ripples) {
      const u = r.life / r.max;
      x.strokeStyle = `rgba(255,255,255,${0.7 * (1 - u)})`;
      x.lineWidth = 1.6;
      x.beginPath();
      x.ellipse(r.x, r.y, r.r * (0.2 + u), r.r * (0.2 + u) * 0.28, 0, 0, TAU);
      x.stroke();
    }
  }

  draw(x: CanvasRenderingContext2D, s: number): void {
    for (const p of this.parts) {
      const a = 1 - p.life / p.max;
      if (p.kind === 'confetti') {
        x.save();
        x.translate(p.x, p.y);
        x.rotate(p.rot);
        x.globalAlpha = Math.min(1, a * 1.6);
        x.fillStyle = p.color;
        x.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9);
        x.restore();
      } else if (p.kind === 'bubble') {
        x.strokeStyle = `rgba(255,255,255,${0.6 * Math.min(1, a * 2)})`;
        x.lineWidth = 1;
        x.beginPath();
        x.arc(p.x, p.y, p.r, 0, TAU);
        x.stroke();
      } else {
        x.globalAlpha = a;
        x.fillStyle = p.color;
        x.beginPath();
        x.arc(p.x, p.y, p.r * (p.kind === 'spark' ? a : 1), 0, TAU);
        x.fill();
        x.globalAlpha = 1;
      }
    }
    x.globalAlpha = 1;
    for (const t of this.texts) {
      const u = t.life / t.max;
      const pop = u < 0.15 ? 0.6 + (u / 0.15) * 0.5 : 1.1 - Math.min(0.1, (u - 0.15) * 0.3);
      x.save();
      x.translate(t.x, t.y - u * 46 * s);
      x.scale(pop, pop);
      x.globalAlpha = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      x.font = `900 ${Math.round(t.size * s)}px Nunito, system-ui, sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.lineWidth = 5 * s;
      x.strokeStyle = 'rgba(20,30,40,0.55)';
      x.strokeText(t.text, 0, 0);
      x.fillStyle = t.color;
      x.fillText(t.text, 0, 0);
      x.restore();
    }
  }
}
