/** Denní odměna se sérií 7 dní. */

export const DAILY_REWARDS = [10, 15, 20, 25, 30, 40, 60] as const;

export interface DailyState {
  /** 'YYYY-MM-DD' posledního vybrání */
  last: string | null;
  /** kolik dní v řadě (1..7, pak znovu od 1) */
  streak: number;
}

export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function dayDiff(a: string, b: string): number {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const ta = Date.UTC(pa[0] ?? 0, (pa[1] ?? 1) - 1, pa[2] ?? 1);
  const tb = Date.UTC(pb[0] ?? 0, (pb[1] ?? 1) - 1, pb[2] ?? 1);
  return Math.round((tb - ta) / 86400000);
}

export function canClaim(state: DailyState, now: Date): boolean {
  return state.last !== dateKey(now);
}

/** Který den série by se teď vybral (1..7). */
export function nextStreakDay(state: DailyState, now: Date): number {
  if (!state.last) return 1;
  const diff = dayDiff(state.last, dateKey(now));
  if (diff === 0) return state.streak;
  if (diff === 1) return (state.streak % DAILY_REWARDS.length) + 1;
  return 1;
}

export function claimDaily(state: DailyState, now: Date): { state: DailyState; reward: number; day: number } | null {
  if (!canClaim(state, now)) return null;
  const day = nextStreakDay(state, now);
  const reward = DAILY_REWARDS[day - 1] ?? DAILY_REWARDS[0];
  return { state: { last: dateKey(now), streak: day }, reward, day };
}

/** Převod starého klíče `dailyRewardDate` („2025-8-9“ bez nul) na nový formát. */
export function normalizeLegacyDate(v: string | null): string | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v.trim());
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
}
