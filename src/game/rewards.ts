import { LOCATIONS } from '../data/locations';
import { SPECIES, type LocationId, type Species } from '../data/species';
import { findItem, type BaitId, type ShopCategory } from '../data/shop';
import type { Save } from '../store/save';
import { newlyUnlocked, type Achievement } from './logic/achievements';
import { claimDaily } from './logic/daily';
import { applyMissionEvent, fillMissions, isDone, type Mission, type MissionEvent } from './logic/missions';
import { levelInfo } from './logic/progress';
import { catchCoins, catchPoints, type PointsResult } from './logic/scoring';
import type { CatchEvent, Rng } from './types';

export interface CatchInput {
  species: Species;
  sizeCm: number;
  trophy: boolean;
  rainbow: boolean;
  perfect: boolean;
  night: boolean;
  location: LocationId;
  bait: BaitId;
  /** kolikátý úlovek v sérii */
  combo: number;
}

export interface CatchOutcome {
  event: CatchEvent;
  points: PointsResult;
  coins: number;
  newSpecies: boolean;
  /** osobní rekord v délce u tohoto druhu */
  record: boolean;
  levelBefore: number;
  levelAfter: number;
  completed: Mission[];
  /** chráněný druh → po vyfocení zpět do vody */
  released: boolean;
  /** nově získané trofeje */
  achievements: Achievement[];
}

/** Zkontroluje trofeje, nové zapíše a vyplatí. */
export function checkAchievements(save: Save): Achievement[] {
  const got = newlyUnlocked(save, SPECIES);
  for (const a of got) {
    save.achievements.push(a.id);
    save.coins += a.reward;
  }
  return got;
}

export function unlockedLocations(save: Save): LocationId[] {
  const lvl = levelInfo(save.xp).level;
  return LOCATIONS.filter((l) => save.prefs.unlockAll || l.unlockLevel <= lvl).map((l) => l.id);
}

function missionCtx(save: Save) {
  return {
    species: SPECIES,
    unlocked: unlockedLocations(save),
    ownedBaits: save.owned.bait,
    caught: new Set(Object.keys(save.album)),
    level: levelInfo(save.xp).level,
  };
}

/** Doplní rozdané mise na 3 (např. po prvním spuštění). */
export function ensureMissions(save: Save, rng: Rng): void {
  if (save.missions.length < 3) save.missions = fillMissions(missionCtx(save), save.missions, rng);
}

/** Aplikuje událost na mise; splněné vyplatí a nahradí novými. */
function progressMissions(save: Save, e: MissionEvent, rng: Rng): Mission[] {
  const completed: Mission[] = [];
  const next: Mission[] = [];
  for (const m of save.missions) {
    const was = isDone(m);
    const u = applyMissionEvent(m, e);
    if (!was && isDone(u)) {
      completed.push(u);
      save.coins += u.reward;
      save.xp += u.reward;
      save.missionsDone += 1;
    } else next.push(u);
  }
  save.missions = next;
  if (completed.length) save.missions = fillMissions(missionCtx(save), save.missions, rng);
  return completed;
}

export function applyCatch(save: Save, input: CatchInput, now: Date, rng: Rng, scoring = true): CatchOutcome {
  const s = input.species;
  const entry = save.album[s.id];
  const newSpecies = !entry;
  const record = !!entry && input.sizeCm > entry.best;
  const levelBefore = levelInfo(save.xp).level;
  const points = catchPoints({
    rarity: s.rarity,
    sizeCm: input.sizeCm,
    perfect: input.perfect,
    combo: input.combo,
    rainbow: input.rainbow,
    trophy: input.trophy,
    newSpecies,
  });
  const coins = catchCoins(s.rarity, input.rainbow, newSpecies);
  if (scoring) {
    save.coins += coins;
    save.xp += points.points;
  }
  save.album[s.id] = {
    count: (entry?.count ?? 0) + 1,
    best: Math.max(entry?.best ?? 0, input.sizeCm),
    first: entry?.first ?? now.toISOString(),
    ...(entry?.rainbow || input.rainbow ? { rainbow: true } : {}),
    ...(entry?.trophy || input.trophy ? { trophy: true } : {}),
  };
  save.stats.catches += 1;
  if (input.night) save.stats.nightCatches += 1;
  if (s.protected) save.stats.released += 1;
  if (!save.stats.biggest || input.sizeCm > save.stats.biggest.cm) save.stats.biggest = { id: s.id, cm: input.sizeCm };
  const event: CatchEvent = {
    speciesId: s.id,
    sizeCm: input.sizeCm,
    rarity: s.rarity,
    location: input.location,
    bait: input.bait,
    night: input.night,
    perfect: input.perfect,
    rainbow: input.rainbow,
    trophy: input.trophy,
    newSpecies,
    record,
    points: points.points,
    coins,
  };
  const completed = scoring ? progressMissions(save, { type: 'catch', ev: event, combo: input.combo }, rng) : [];
  const achievements = scoring ? checkAchievements(save) : [];
  return {
    achievements,
    event,
    points,
    coins,
    newSpecies,
    record,
    levelBefore,
    levelAfter: levelInfo(save.xp).level,
    completed,
    released: !!s.protected,
  };
}

export function applyPerfect(save: Save, rng: Rng): Mission[] {
  save.stats.perfect += 1;
  return progressMissions(save, { type: 'perfect' }, rng);
}

export function claimDailyReward(save: Save, now: Date): { reward: number; day: number } | null {
  const r = claimDaily(save.daily, now);
  if (!r) return null;
  save.daily = r.state;
  save.coins += r.reward;
  return { reward: r.reward, day: r.day };
}

export type BuyResult = 'bought' | 'owned' | 'poor' | 'unknown';

export function buyItem(save: Save, cat: ShopCategory, id: string): BuyResult {
  const item = findItem(cat, id);
  if (!item) return 'unknown';
  const owned = save.owned[cat] as string[];
  if (owned.includes(id)) return 'owned';
  if (save.coins < item.price) return 'poor';
  save.coins -= item.price;
  owned.push(id);
  equipItem(save, cat, id);
  return 'bought';
}

export function equipItem(save: Save, cat: ShopCategory, id: string): boolean {
  const owned = save.owned[cat] as string[];
  if (!owned.includes(id)) return false;
  if (cat === 'bait') save.equipped.bait = id as BaitId;
  else save.equipped[cat] = id;
  return true;
}

/** Kolik druhů z lokality je v albu. */
export function albumProgress(save: Save, loc?: LocationId): { caught: number; total: number } {
  const pool = loc ? SPECIES.filter((s) => s.locations.includes(loc)) : SPECIES;
  return { caught: pool.filter((s) => save.album[s.id]).length, total: pool.length };
}
