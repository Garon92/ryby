import { SPECIES, type Species } from '../../data/species';
import type { Save } from '../../store/save';
import { unlockedLocations } from '../rewards';
import { dateKey } from './daily';
import { levelInfo } from './progress';

/**
 * Ryba dne – každý den jiná (stejná pro celý den), ale jen taková, kterou hráč opravdu může chytit:
 * žije v odemčeném místě a začátečníkům se neukazují legendární druhy (QA RYBY-09).
 */
export function fishOfDay(save: Save, d = new Date()): Species {
  const key = dateKey(d);
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  const open = unlockedLocations(save);
  const level = levelInfo(save.xp).level;
  const maxRarity = level < 3 ? 3 : level < 5 ? 4 : 5;
  const all = [...SPECIES].sort((a, b) => a.id.localeCompare(b.id));
  const list = all.filter((s) => s.rarity <= maxRarity && s.locations.some((l) => open.includes(l)));
  const pool = list.length ? list : all;
  return pool[(hash >>> 0) % pool.length] ?? all[0]!;
}

