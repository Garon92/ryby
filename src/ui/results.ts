import { h, LABEL_ICONS, LABELS, showResults } from '../kit';
import { getSpecies } from '../data/species';
import type { Mission } from '../game/logic/missions';
import type { Achievement } from '../game/logic/achievements';
import { starsFor } from '../game/logic/scoring';
import { fishThumbUrl } from '../game/sprites';
import type { CatchEvent, Difficulty, GameMode } from '../game/types';
import { fmtNum, plural } from './common';
import { missionText } from './dialogs';
import { COIN_SVG } from './icons';

export interface SessionSummary {
  mode: GameMode;
  difficulty: Difficulty;
  score: number;
  best: number;
  isNewBest: boolean;
  catches: CatchEvent[];
  coins: number;
  completed: Mission[];
  levelUps: { level: number; title: string }[];
  unlocked: string[];
  trophies: Achievement[];
  seconds: number;
  scoring: boolean;
  /** výprava ukončená dřív (bez rekordu a hvězd) */
  aborted?: boolean;
}

const STAR_TITLES = ['Zkus to znovu!', 'Dobrá práce!', 'Výborně!', 'Úžasné!'];

export function openResults(sum: SessionSummary): Promise<string> {
  const timed = sum.mode === 'timed';
  const n = sum.catches.length;
  const newSpecies = sum.catches.filter((c) => c.newSpecies).length;
  const biggest = sum.catches.reduce<CatchEvent | null>((a, c) => (!a || c.sizeCm > a.sizeCm ? c : a), null);
  const stats = [
    { label: 'Ryb', value: n, icon: '🐟' },
    { label: 'Nové', value: newSpecies, icon: '📖' },
    { label: 'Největší', value: biggest ? `${biggest.sizeCm} cm` : '–', icon: '📏' },
    { label: 'Mince', value: `+${fmtNum(sum.coins)}`, icon: COIN_SVG },
  ];
  const withStars = timed && sum.scoring && !sum.aborted;
  const stars = withStars ? starsFor(sum.score, sum.difficulty) : undefined;
  const minutes = Math.max(1, Math.round(sum.seconds / 60));
  // titulek vždy sami (kit by při rekordu dal titulek i odznak „Nový rekord“ zároveň)
  const title = sum.aborted
    ? 'Výprava ukončena'
    : n === 0
      ? 'Dnes to nebralo…'
      : stars !== undefined
        ? (STAR_TITLES[stars] ?? 'Hotovo!')
        : 'Hotovo!';
  const subtitle =
    n === 0 && !sum.aborted
      ? 'Zkus jiné místo nebo jinou návnadu.'
      : `${n} ${plural(n, 'ryba', 'ryby', 'ryb')} za ${minutes} min`;
  // úlovky a novinky nad tlačítky; kit tlačítka přišpendlí dole, takže hlavní zůstává vidět (QA RYBY-02)
  const extra = h('div', { class: 'results-extra' });
  if (n) {
    const strip = h('div', { class: 'results-catches', 'aria-label': 'Úlovky' });
    for (const c of sum.catches.slice(-24)) {
      const s = getSpecies(c.speciesId);
      strip.append(
        h(
          'figure',
          { title: `${s.name}, ${c.sizeCm} cm` },
          h('img', { src: fishThumbUrl(s.id), alt: s.name, loading: 'lazy' }),
          h('figcaption', null, `${c.sizeCm} cm`),
          c.newSpecies ? h('span', { class: 'new', 'aria-label': 'nový druh' }, '✨') : null,
        ),
      );
    }
    extra.append(strip);
  }
  const chips = h('div', { class: 'results-chips' });
  const chip = (icon: string, text: string, title: string) =>
    chips.append(h('span', { class: 'g92-chip', title, 'aria-label': title }, h('span', { 'aria-hidden': 'true' }, icon), text));
  if (sum.completed.length) {
    const coins = sum.completed.reduce((a, m) => a + m.reward, 0);
    chip('🎯', `${sum.completed.length} ${plural(sum.completed.length, 'mise', 'mise', 'misí')}`, `Splněné mise: ${sum.completed.map((m) => missionText(m).text).join(', ')} (+${coins} mincí)`);
  }
  if (sum.levelUps.length) {
    const top = sum.levelUps[sum.levelUps.length - 1]!;
    chip('⬆️', `úroveň ${top.level}`, `Nová úroveň ${top.level}: ${top.title}`);
  }
  for (const u of sum.unlocked) chip('🔓', u, `Odemčeno nové místo: ${u}`);
  if (sum.trophies.length) chip('🏆', `${sum.trophies.length} ${plural(sum.trophies.length, 'trofej', 'trofeje', 'trofejí')}`, `Nové trofeje: ${sum.trophies.map((t) => t.name).join(', ')}`);
  if (!sum.scoring) chip('🤖', 'autopilot', 'Autopilot: ryby jsou v albu, body a mince se nepočítají');
  if (chips.childElementCount) extra.append(chips);
  const p = showResults({
    title,
    subtitle,
    score: sum.scoring ? sum.score : undefined,
    scoreLabel: ['bod', 'body', 'bodů'],
    best: withStars ? sum.best : null,
    isNewBest: withStars && sum.isNewBest && sum.score > 0,
    stars,
    stats,
    actions: [
      { label: LABELS.home, value: 'home', variant: 'secondary', icon: LABEL_ICONS.home },
      { label: 'Album', value: 'album', variant: 'secondary', icon: '<span aria-hidden="true">📖</span>' },
    ],
    lost: n === 0 && !sum.aborted,
    extra: extra.childElementCount ? extra : undefined,
  });
  return p;
}
