import type { LocationId } from '../data/species';
import type { BaitId } from '../data/shop';
import { LEGACY_ROD_IDS } from '../data/shop';
import type { Difficulty, GameMode } from '../game/types';
import type { Mission } from '../game/logic/missions';
import type { DailyState } from '../game/logic/daily';
import { normalizeLegacyDate } from '../game/logic/daily';

export const SAVE_KEY = 'g92:ryby:save';
export const SAVE_VERSION = 1;
/** klíče původní hry (sdílený origin → po migraci mažeme) */
export const LEGACY_KEYS = ['bestScore', 'coins', 'rodSkinIdx', 'ownedSkins', 'dailyRewardDate', 'prefs'] as const;

export type ClockMode = 'flow' | 'day' | 'night';

export interface AlbumEntry {
  count: number;
  /** největší kus v cm */
  best: number;
  /** ISO datum prvního úlovku */
  first: string;
  rainbow?: boolean;
  trophy?: boolean;
}

export interface Prefs {
  location: LocationId;
  mode: GameMode;
  difficulty: Difficulty;
  clock: ClockMode;
  music: boolean;
  voice: boolean;
  hints: boolean;
  effects: 'full' | 'lite';
  autopilot: boolean;
  showUncaught: boolean;
  unlockAll: boolean;
  seenHelp: boolean;
}

export interface Stats {
  catches: number;
  sessions: number;
  perfect: number;
  snapped: number;
  escaped: number;
  released: number;
  playSeconds: number;
  biggest: { id: string; cm: number } | null;
  /** rekord z původní verze hry (jiné bodování, bez časového limitu) */
  legacyBestScore: number;
}

export interface Save {
  v: 1;
  coins: number;
  xp: number;
  album: Record<string, AlbumEntry>;
  /** nejlepší skóre výpravy: klíč `${lokalita}:${obtížnost}` */
  records: Record<string, number>;
  missions: Mission[];
  missionsDone: number;
  owned: { rod: string[]; bobber: string[]; bait: BaitId[]; hat: string[] };
  equipped: { rod: string; bobber: string; bait: BaitId; hat: string };
  daily: DailyState;
  stats: Stats;
  prefs: Prefs;
}

export function defaultSave(): Save {
  return {
    v: 1,
    coins: 0,
    xp: 0,
    album: {},
    records: {},
    missions: [],
    missionsDone: 0,
    owned: { rod: ['wood'], bobber: ['classic'], bait: ['worm'], hat: ['fisher'] },
    equipped: { rod: 'wood', bobber: 'classic', bait: 'worm', hat: 'fisher' },
    daily: { last: null, streak: 0 },
    stats: {
      catches: 0,
      sessions: 0,
      perfect: 0,
      snapped: 0,
      escaped: 0,
      released: 0,
      playSeconds: 0,
      biggest: null,
      legacyBestScore: 0,
    },
    prefs: {
      location: 'rybnik',
      mode: 'timed',
      difficulty: 'easy',
      clock: 'flow',
      music: true,
      voice: true,
      hints: true,
      effects: 'full',
      autopilot: false,
      showUncaught: false,
      unlockAll: false,
      seenHelp: false,
    },
  };
}

const LOCS: readonly LocationId[] = ['rybnik', 'reka', 'potok', 'prehrada'];
const BAITS: readonly BaitId[] = ['worm', 'corn', 'spinner', 'fly'];
const DIFFS: readonly Difficulty[] = ['easy', 'normal', 'hard'];

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
function oneOf<T extends string>(v: unknown, list: readonly T[], d: T): T {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d;
}
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Sanitizace libovolného (i poškozeného) JSONu na platný Save. */
export function normalizeSave(raw: unknown): Save {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  const s = d;
  s.coins = Math.max(0, Math.floor(num(raw.coins)));
  s.xp = Math.max(0, Math.floor(num(raw.xp)));
  if (isObj(raw.album)) {
    for (const [id, e] of Object.entries(raw.album)) {
      if (!isObj(e)) continue;
      const count = Math.max(0, Math.floor(num(e.count)));
      if (!count) continue;
      s.album[id] = {
        count,
        best: Math.max(0, num(e.best)),
        first: typeof e.first === 'string' ? e.first : new Date().toISOString(),
        ...(e.rainbow === true ? { rainbow: true } : {}),
        ...(e.trophy === true ? { trophy: true } : {}),
      };
    }
  }
  if (isObj(raw.records)) {
    for (const [k, v] of Object.entries(raw.records)) if (num(v) > 0) s.records[k] = num(v);
  }
  if (Array.isArray(raw.missions)) {
    s.missions = raw.missions
      .filter((m): m is Mission => isObj(m) && typeof m.id === 'string' && typeof m.kind === 'string' && num(m.target) > 0)
      .slice(0, 3);
  }
  s.missionsDone = Math.max(0, Math.floor(num(raw.missionsDone)));
  if (isObj(raw.owned)) {
    const o = raw.owned;
    s.owned.rod = uniq(['wood', ...strArr(o.rod)]);
    s.owned.bobber = uniq(['classic', ...strArr(o.bobber)]);
    s.owned.bait = uniq(['worm', ...strArr(o.bait)]).filter((b): b is BaitId => (BAITS as readonly string[]).includes(b));
    s.owned.hat = uniq(['fisher', ...strArr(o.hat)]);
  }
  if (isObj(raw.equipped)) {
    const e = raw.equipped;
    s.equipped.rod = typeof e.rod === 'string' && s.owned.rod.includes(e.rod) ? e.rod : 'wood';
    s.equipped.bobber = typeof e.bobber === 'string' && s.owned.bobber.includes(e.bobber) ? e.bobber : 'classic';
    s.equipped.hat = typeof e.hat === 'string' && s.owned.hat.includes(e.hat) ? e.hat : 'fisher';
    const bait = oneOf(e.bait, BAITS, 'worm');
    s.equipped.bait = s.owned.bait.includes(bait) ? bait : 'worm';
  }
  if (isObj(raw.daily)) {
    s.daily = {
      last: typeof raw.daily.last === 'string' ? raw.daily.last : null,
      streak: Math.max(0, Math.min(7, Math.floor(num(raw.daily.streak)))),
    };
  }
  if (isObj(raw.stats)) {
    const st = raw.stats;
    s.stats.catches = num(st.catches);
    s.stats.sessions = num(st.sessions);
    s.stats.perfect = num(st.perfect);
    s.stats.snapped = num(st.snapped);
    s.stats.escaped = num(st.escaped);
    s.stats.released = num(st.released);
    s.stats.playSeconds = num(st.playSeconds);
    s.stats.legacyBestScore = num(st.legacyBestScore);
    if (isObj(st.biggest) && typeof st.biggest.id === 'string') s.stats.biggest = { id: st.biggest.id, cm: num(st.biggest.cm) };
  }
  if (isObj(raw.prefs)) {
    const p = raw.prefs;
    s.prefs.location = oneOf(p.location, LOCS, 'rybnik');
    s.prefs.mode = oneOf(p.mode, ['timed', 'free'] as const, 'timed');
    s.prefs.difficulty = oneOf(p.difficulty, DIFFS, 'easy');
    s.prefs.clock = oneOf(p.clock, ['flow', 'day', 'night'] as const, 'flow');
    s.prefs.music = bool(p.music, true);
    s.prefs.voice = bool(p.voice, true);
    s.prefs.hints = bool(p.hints, true);
    s.prefs.effects = oneOf(p.effects, ['full', 'lite'] as const, 'full');
    s.prefs.autopilot = bool(p.autopilot, false);
    s.prefs.showUncaught = bool(p.showUncaught, false);
    s.prefs.unlockAll = bool(p.unlockAll, false);
    s.prefs.seenHelp = bool(p.seenHelp, false);
  }
  return s;
}

function uniq<T>(a: T[]): T[] {
  return [...new Set(a)];
}

type Getter = (key: string) => string | null;

function parseJSON(v: string | null): unknown {
  if (v == null) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** Je v úložišti něco z původní hry? */
export function hasLegacy(get: Getter): boolean {
  return LEGACY_KEYS.some((k) => get(k) != null);
}

/** Převede klíče původní hry do nového formátu (vrací nový Save odvozený z `base`). */
export function migrateLegacy(get: Getter, base: Save = defaultSave()): Save {
  const s: Save = structuredClone(base);
  const coins = Number(get('coins'));
  if (Number.isFinite(coins) && coins > 0) s.coins += Math.floor(coins);

  const best = Number(get('bestScore'));
  if (Number.isFinite(best) && best > 0) s.stats.legacyBestScore = Math.max(s.stats.legacyBestScore, Math.floor(best));

  const owned = parseJSON(get('ownedSkins'));
  if (Array.isArray(owned)) {
    for (const idx of owned) {
      const id = typeof idx === 'number' ? LEGACY_ROD_IDS[((idx % 4) + 4) % 4] : undefined;
      if (id && !s.owned.rod.includes(id)) s.owned.rod.push(id);
    }
  }
  const skinIdx = Number(get('rodSkinIdx'));
  if (get('rodSkinIdx') != null && Number.isFinite(skinIdx)) {
    const id = LEGACY_ROD_IDS[((Math.floor(skinIdx) % 4) + 4) % 4];
    // v původní hře šel skin nastavit jen když byl vlastněný (nebo zdarma)
    if (id) {
      if (!s.owned.rod.includes(id)) s.owned.rod.push(id);
      s.equipped.rod = id;
    }
  }

  const daily = normalizeLegacyDate(get('dailyRewardDate'));
  if (daily) s.daily = { last: daily, streak: Math.max(1, s.daily.streak) };

  const prefs = parseJSON(get('prefs'));
  if (isObj(prefs)) {
    if (typeof prefs.music === 'boolean') s.prefs.music = prefs.music;
    if (typeof prefs.hints === 'boolean') s.prefs.hints = prefs.hints;
    if (typeof prefs.autopilot === 'boolean') s.prefs.autopilot = prefs.autopilot;
    if (prefs.sandbox === true) s.prefs.mode = 'free';
    const visual = ['vignette', 'sparkles', 'silhouettes', 'rays', 'particles'];
    const off = visual.filter((k) => prefs[k] === false).length;
    if (off >= 3) s.prefs.effects = 'lite';
  }
  return s;
}

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Načte uložený postup; při prvním spuštění převezme data z původní hry a staré klíče smaže. */
export function loadSave(kv: KV): { save: Save; migrated: boolean } {
  let save: Save;
  const raw = parseJSON(kv.getItem(SAVE_KEY));
  save = raw ? normalizeSave(raw) : defaultSave();
  let migrated = false;
  const get: Getter = (k) => kv.getItem(k);
  if (hasLegacy(get)) {
    save = migrateLegacy(get, save);
    migrated = true;
    try {
      kv.setItem(SAVE_KEY, JSON.stringify(save));
      for (const k of LEGACY_KEYS) kv.removeItem(k);
    } catch {
      /* úložiště plné / zakázané – nevadí */
    }
  }
  return { save, migrated };
}

export function writeSave(kv: KV, save: Save): void {
  try {
    kv.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
}
