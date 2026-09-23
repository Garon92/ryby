/**
 * Dlouhá simulace enginu bez prohlížeče: několik minut herního času a kontrola, že rybník zůstává plný
 * viditelných ryb a dá se v něm chytat (regrese QA RYBY-01 – ryby z okraje měly x = NaN a po minutě
 * rybník zůstal prázdný; herní testy tehdy běžely jen první minutu).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { LocationId } from '../src/data/species';
import type { Engine as EngineT } from '../src/game/engine';

const W = 1280;
const H = 720;

/** Canvas 2D kontext, který nic nekreslí (engine v testu kreslí jen do offscreen bufferů). */
function fakeCtx(): unknown {
  const fn: unknown = new Proxy(function () {}, {
    get: (_t, p) => (p === 'then' ? undefined : fn),
    apply: () => fn,
    set: () => true,
  });
  return new Proxy({} as Record<string | symbol, unknown>, {
    get: (t, p) => (p in t ? t[p] : fn),
    set: (t, p, v) => {
      t[p] = v;
      return true;
    },
  });
}

function fakeCanvas(): unknown {
  return {
    width: 0,
    height: 0,
    style: {},
    getContext: () => fakeCtx(),
    getBoundingClientRect: () => ({ width: W, height: H, left: 0, top: 0 }),
    toDataURL: () => '',
    toBlob: () => undefined,
  };
}

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = '';
  naturalWidth = 500;
  naturalHeight = 220;
  set src(_v: string) {
    queueMicrotask(() => this.onload?.());
  }
  decode(): Promise<void> {
    return Promise.resolve();
  }
}

let Engine: typeof EngineT;

beforeAll(async () => {
  const g = globalThis as Record<string, unknown>;
  g.document = {
    hidden: false,
    createElement: () => fakeCanvas(),
    addEventListener: () => undefined,
  };
  g.window = { devicePixelRatio: 1, innerWidth: W, innerHeight: H };
  g.Image = FakeImage;
  ({ Engine } = await import('../src/game/engine'));
});

function makeEngine(loc: LocationId, opts: { attract?: boolean; difficulty?: 'easy' | 'normal' | 'hard' } = {}) {
  let catches = 0;
  const e = new Engine(fakeCanvas() as HTMLCanvasElement, {
    onPhase: () => undefined,
    onCatch: () => {
      catches++;
    },
    onLost: () => undefined,
    onPerfect: () => undefined,
    onTreasure: () => undefined,
    onHidden: () => undefined,
  });
  e.difficulty = opts.difficulty ?? 'normal';
  e.setLocation(loc);
  e.attract = opts.attract ?? false;
  e.autopilot = !e.attract;
  e.setClock('flow', false);
  return { e, catches: () => catches };
}

/** ryby, které hráč opravdu vidí a může chytit */
function visibleFish(e: EngineT) {
  const w = e.world;
  return e.fishes.filter(
    (f) =>
      Number.isFinite(f.x) &&
      Number.isFinite(f.y) &&
      f.alpha > 0.5 &&
      f.x > -20 &&
      f.x < w.w + 20 &&
      f.y > w.surfaceY &&
      f.y < w.bottomY + 5,
  );
}

async function run(e: EngineT, seconds: number, onSecond: (t: number) => void): Promise<void> {
  const dt = 1 / 60;
  for (let s = 1; s <= seconds; s++) {
    for (let i = 0; i < 60; i++) e.update(dt);
    // načítání obrázků (microtasky) mezi „sekundami“
    await Promise.resolve();
    onSecond(s);
  }
}

describe('engine long run', () => {
  it('keeps the pond full of visible fish and keeps catching for 6 minutes (autopilot, Rybář)', async () => {
    const { e, catches } = makeEngine('rybnik');
    const perMinute: number[] = [];
    let last = 0;
    let minVisible = Infinity;
    await run(e, 360, (t) => {
      for (const f of e.fishes) {
        expect(Number.isFinite(f.x), `x at ${t}s`).toBe(true);
        expect(Number.isFinite(f.y), `y at ${t}s`).toBe(true);
      }
      if (t >= 5) minVisible = Math.min(minVisible, visibleFish(e).length);
      if (t % 60 === 0) {
        perMinute.push(catches() - last);
        last = catches();
      }
    });
    expect(minVisible).toBeGreaterThanOrEqual(5);
    // každou minutu se něco chytí (autopilot chytá podobně jako dítě s nápovědou)
    for (const [i, n] of perMinute.entries()) expect(n, `catches in minute ${i + 1}`).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it('the start screen (attract mode) never runs out of fish', async () => {
    const { e } = makeEngine('rybnik', { attract: true });
    let minVisible = Infinity;
    await run(e, 300, (t) => {
      if (t >= 5) minVisible = Math.min(minVisible, visibleFish(e).length);
    });
    expect(minVisible).toBeGreaterThanOrEqual(5);
  }, 60_000);

  for (const loc of ['reka', 'potok', 'prehrada'] as const) {
    it(`${loc}: population stays visible and catchable for 4 minutes`, async () => {
      const { e, catches } = makeEngine(loc, { difficulty: 'easy' });
      let minVisible = Infinity;
      await run(e, 240, (t) => {
        if (t >= 5) minVisible = Math.min(minVisible, visibleFish(e).length);
      });
      expect(minVisible).toBeGreaterThanOrEqual(4);
      expect(catches()).toBeGreaterThanOrEqual(8);
    }, 60_000);
  }
});
