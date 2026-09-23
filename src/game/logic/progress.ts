/** Rybářské úrovně z XP (= body nasbírané za celou dobu). */

const THRESHOLDS = [0, 150, 400, 800, 1400, 2200, 3300, 4700, 6500, 9000];
const TITLES = [
  'Rybářský učeň',
  'Začínající rybář',
  'Rybář',
  'Zkušený rybář',
  'Mistr udice',
  'Pán rybníka',
  'Král řeky',
  'Strážce potoka',
  'Velmistr',
  'Rybářská legenda',
];

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= THRESHOLDS.length) return THRESHOLDS[level - 1] ?? 0;
  return (THRESHOLDS[THRESHOLDS.length - 1] ?? 0) + (level - THRESHOLDS.length) * 3000;
}

export interface LevelInfo {
  level: number;
  title: string;
  /** XP od začátku úrovně */
  into: number;
  /** XP potřebné na další úroveň */
  span: number;
  progress: number;
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - start;
  const into = xp - start;
  const title = TITLES[Math.min(level, TITLES.length) - 1] ?? TITLES[TITLES.length - 1] ?? '';
  return { level, title, into, span, progress: span > 0 ? into / span : 1 };
}
