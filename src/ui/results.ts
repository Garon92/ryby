import { h, showResults } from '../kit';
import { getSpecies } from '../data/species';
import type { Mission } from '../game/logic/missions';
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
  seconds: number;
  scoring: boolean;
}

export function openResults(sum: SessionSummary): Promise<string> {
  const timed = sum.mode === 'timed';
  const newSpecies = sum.catches.filter((c) => c.newSpecies).length;
  const biggest = sum.catches.reduce<CatchEvent | null>((a, c) => (!a || c.sizeCm > a.sizeCm ? c : a), null);
  const n = sum.catches.length;
  const stats = [
    { label: 'Ryb', value: n, icon: '🐟' },
    { label: 'Nové', value: newSpecies, icon: '📖' },
    { label: 'Největší', value: biggest ? `${biggest.sizeCm} cm` : '–', icon: '📏' },
    { label: 'Mince', value: `+${fmtNum(sum.coins)}`, icon: COIN_SVG },
  ];
  const stars = timed && sum.scoring ? starsFor(sum.score, sum.difficulty) : undefined;
  const p = showResults({
    title: n === 0 ? 'Dnes to nebralo…' : undefined,
    subtitle: n === 0 ? 'Zkus jiné místo nebo jinou návnadu.' : `${n} ${plural(n, 'ryba', 'ryby', 'ryb')} za ${Math.max(1, Math.round(sum.seconds / 60))} min`,
    score: sum.scoring ? sum.score : undefined,
    best: timed && sum.scoring ? sum.best : null,
    isNewBest: timed && sum.isNewBest && sum.score > 0,
    stars,
    stats,
    againLabel: 'Chytat znovu',
    menuHref: null,
    menuLabel: 'Jiné místo',
    actions: [{ label: '📖 Album', value: 'album', variant: 'secondary' }],
    lost: n === 0,
  });
  // úlovky + mise + nová úroveň (vloženo před tlačítka)
  const extra = h('div', { class: 'results-note' });
  if (n) {
    const strip = h('div', { class: 'results-catches' });
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
  for (const m of sum.completed) extra.append(h('div', null, `🎯 Mise splněna: ${missionText(m).text} (+${m.reward} mincí)`));
  for (const l of sum.levelUps) extra.append(h('div', null, `⬆️ Nová úroveň ${l.level}: ${l.title}!`));
  for (const u of sum.unlocked) extra.append(h('div', null, `🔓 Odemčeno nové místo: ${u}!`));
  if (!sum.scoring) extra.append(h('div', null, '🤖 Autopilot: ryby jsou v albu, body a mince se nepočítají.'));
  if (extra.childElementCount) p.el.querySelector('.g92-overlay__actions')?.before(extra);
  return p;
}
