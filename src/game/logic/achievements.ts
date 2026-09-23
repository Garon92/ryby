import type { LocationId, Species } from '../../data/species';
import type { Save } from '../../store/save';

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  text: string;
  reward: number;
  /** postup 0..1 (pro ukazatel) */
  progress: (s: Save, species: readonly Species[]) => number;
}

const speciesCount = (s: Save) => Object.keys(s.album).length;
const locationDone = (loc: LocationId) => (s: Save, species: readonly Species[]) => {
  const pool = species.filter((x) => x.locations.includes(loc));
  return pool.filter((x) => s.album[x.id]).length / pool.length;
};
const ratio = (v: number, target: number) => Math.min(1, v / target);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', icon: '🎣', name: 'První úlovek', text: 'Chyť svou první rybu.', reward: 10, progress: (s) => ratio(s.stats.catches, 1) },
  { id: 'species5', icon: '📖', name: 'Malý sběratel', text: 'Měj v albu 5 druhů.', reward: 20, progress: (s) => ratio(speciesCount(s), 5) },
  { id: 'species15', icon: '📚', name: 'Sběratel', text: 'Měj v albu 15 druhů.', reward: 40, progress: (s) => ratio(speciesCount(s), 15) },
  { id: 'species30', icon: '🧭', name: 'Znalec ryb', text: 'Měj v albu 30 druhů.', reward: 80, progress: (s) => ratio(speciesCount(s), 30) },
  { id: 'speciesAll', icon: '👑', name: 'Rybí encyklopedie', text: 'Chyť všech 59 druhů.', reward: 300, progress: (s, sp) => ratio(speciesCount(s), sp.length) },
  { id: 'rybnik', icon: '🪷', name: 'Pán rybníka', text: 'Chyť všechny ryby z rybníka.', reward: 100, progress: locationDone('rybnik') },
  { id: 'reka', icon: '🌉', name: 'Král řeky', text: 'Chyť všechny ryby z řeky.', reward: 120, progress: locationDone('reka') },
  { id: 'potok', icon: '🌲', name: 'Strážce potoka', text: 'Chyť všechny ryby z potoka.', reward: 100, progress: locationDone('potok') },
  { id: 'prehrada', icon: '⛵', name: 'Kapitán přehrady', text: 'Chyť všechny ryby z přehrady.', reward: 100, progress: locationDone('prehrada') },
  { id: 'catches25', icon: '🐟', name: 'Pilný rybář', text: 'Chyť 25 ryb.', reward: 20, progress: (s) => ratio(s.stats.catches, 25) },
  { id: 'catches100', icon: '🐠', name: 'Stovka!', text: 'Chyť 100 ryb.', reward: 50, progress: (s) => ratio(s.stats.catches, 100) },
  { id: 'catches300', icon: '🐋', name: 'Neúnavný rybář', text: 'Chyť 300 ryb.', reward: 120, progress: (s) => ratio(s.stats.catches, 300) },
  { id: 'giant', icon: '🦈', name: 'Obr!', text: 'Chyť rybu delší než metr.', reward: 50, progress: (s) => ratio(s.stats.biggest?.cm ?? 0, 101) },
  { id: 'night', icon: '🌙', name: 'Noční rybář', text: 'Chyť 10 ryb v noci.', reward: 40, progress: (s) => ratio(s.stats.nightCatches, 10) },
  { id: 'perfect', icon: '🎯', name: 'Ostrostřelec', text: 'Udělej 10 perfektních hodů.', reward: 30, progress: (s) => ratio(s.stats.perfect, 10) },
  { id: 'rainbow', icon: '🌈', name: 'Duhový zázrak', text: 'Chyť duhovou rybu.', reward: 40, progress: (s) => (Object.values(s.album).some((e) => e.rainbow) ? 1 : 0) },
  { id: 'trophy', icon: '🏆', name: 'Trofej', text: 'Chyť trofejní kus – větší než obvykle.', reward: 30, progress: (s) => (Object.values(s.album).some((e) => e.trophy) ? 1 : 0) },
  { id: 'nature', icon: '💚', name: 'Ochránce přírody', text: 'Pusť zpátky 5 chráněných ryb.', reward: 40, progress: (s) => ratio(s.stats.released, 5) },
  { id: 'missions', icon: '🔥', name: 'Plnič misí', text: 'Splň 10 misí.', reward: 40, progress: (s) => ratio(s.missionsDone, 10) },
  { id: 'streak', icon: '📅', name: 'Věrný rybář', text: 'Přijď 7 dní po sobě pro denní odměnu.', reward: 50, progress: (s) => ratio(s.daily.streak, 7) },
];

/** Trofeje, které jsou nově splněné (ještě nejsou v `save.achievements`). */
export function newlyUnlocked(save: Save, species: readonly Species[]): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !save.achievements.includes(a.id) && a.progress(save, species) >= 1);
}
