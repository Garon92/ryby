/** Body a mince za úlovek. */

export const RARITY_POINTS: Record<number, number> = { 1: 10, 2: 18, 3: 30, 4: 50, 5: 80 };

export interface PointsInput {
  rarity: number;
  sizeCm: number;
  perfect: boolean;
  /** kolikátý úlovek v řadě (1 = první) */
  combo: number;
  rainbow: boolean;
  trophy: boolean;
  newSpecies: boolean;
}

export interface PointsResult {
  points: number;
  parts: { label: string; value: number }[];
}

export function comboBonus(combo: number): number {
  return combo >= 2 ? Math.min(40, (combo - 1) * 5) : 0;
}

export function catchPoints(i: PointsInput): PointsResult {
  const parts: { label: string; value: number }[] = [];
  const base = (RARITY_POINTS[i.rarity] ?? 10) + Math.ceil(i.sizeCm / 5);
  parts.push({ label: 'Úlovek', value: base });
  if (i.trophy) parts.push({ label: 'Trofej', value: 15 });
  if (i.perfect) parts.push({ label: 'Perfektní hod', value: 10 });
  const cb = comboBonus(i.combo);
  if (cb) parts.push({ label: `Série ×${i.combo}`, value: cb });
  if (i.newSpecies) parts.push({ label: 'Nový druh', value: 20 });
  let points = parts.reduce((a, p) => a + p.value, 0);
  if (i.rainbow) {
    parts.push({ label: 'Duhová ryba ×2', value: points });
    points *= 2;
  }
  return { points, parts };
}

/** ⭐ mince – stejný vzorec jako v původní hře (podle rarity 1–10) */
export function catchCoins(rarity: number, rainbow: boolean, newSpecies: boolean): number {
  const legacyRarity = rarity * 2; // 1–5 → 2–10
  return Math.max(1, Math.round(legacyRarity / 2)) + (rainbow ? 3 : 0) + (newSpecies ? 2 : 0);
}

/** Hvězdy za výpravu (3 minuty) podle bodů. */
export const STAR_THRESHOLDS: Record<'easy' | 'normal' | 'hard', [number, number, number]> = {
  easy: [60, 300, 600],
  normal: [60, 260, 520],
  hard: [50, 220, 440],
};

export function starsFor(points: number, difficulty: 'easy' | 'normal' | 'hard'): 0 | 1 | 2 | 3 {
  const [a, b, c] = STAR_THRESHOLDS[difficulty];
  if (points >= c) return 3;
  if (points >= b) return 2;
  if (points >= a) return 1;
  return 0;
}
