import { confetti, h, openDialog, sfx, UI_ICONS } from '../kit';
import { getSpecies } from '../data/species';
import { canClaim, DAILY_REWARDS, nextStreakDay } from '../game/logic/daily';
import { describeMission, isDone, type Mission } from '../game/logic/missions';
import { claimDailyReward } from '../game/rewards';
import { fishThumbUrl } from '../game/sprites';
import type { Save } from '../store/save';
import { COIN_SVG, coinHTML } from './icons';

const LOC_ICON: Record<string, string> = { rybnik: '🪷', reka: '🌉', potok: '🌲', prehrada: '⛵' };

export function missionText(m: Mission): { icon: string; text: string } {
  return describeMission(m, (id) => {
    try {
      const s = getSpecies(id);
      // kde ryba žije (ikony míst), ať dítě ví, kam pro ni jít
      return `${s.name} ${s.locations.map((l) => LOC_ICON[l] ?? '').join('')}`;
    } catch {
      return id;
    }
  });
}

export function missionIcon(m: Mission): HTMLElement {
  if (m.kind === 'species' && m.species) {
    return h('img', { src: fishThumbUrl(m.species), alt: '', loading: 'lazy' });
  }
  return h('span', { 'aria-hidden': 'true' }, missionText(m).icon);
}

export function openMissions(save: Save): Promise<unknown> {
  const list = h('div', { class: 'mission-list' });
  for (const m of save.missions) {
    const d = missionText(m);
    list.append(
      h(
        'div',
        { class: 'mission-row' },
        h('span', { class: 'ico' }, missionIcon(m)),
        h(
          'div',
          null,
          h('b', null, d.text),
          h('div', { class: `g92-progress g92-progress--sm${isDone(m) ? ' g92-progress--success' : ''}`, style: `--value:${m.progress / m.target}` }),
        ),
        h('span', { class: 'rew', html: `${m.progress}/${m.target} · +${m.reward} ${coinHTML}` }),
      ),
    );
  }
  list.append(h('p', { class: 'g92-muted', style: 'text-align:center' }, `Za každou splněnou misi dostaneš mince a hned další misi. Splněno celkem: ${save.missionsDone}`));
  return openDialog({ title: 'Mise', icon: UI_ICONS.flame, content: list, actions: [{ label: 'Jdu chytat!', icon: UI_ICONS.check }] }).closed;
}

/** Denní odměna se sérií 7 dní. */
export function openDaily(save: Save, onClaim: (coins: number) => void): void {
  const now = new Date();
  const can = canClaim(save.daily, now);
  const today = nextStreakDay(save.daily, now);
  const strip = h('div', { class: 'daily-strip' });
  DAILY_REWARDS.forEach((r, i) => {
    const day = i + 1;
    const done = can ? day < today : day <= today;
    const isToday = day === today;
    strip.append(
      h(
        'div',
        { class: `daily-day${done ? ' is-done' : ''}${isToday && can ? ' is-today' : ''}` },
        h('span', { class: 'emo', 'aria-hidden': 'true', html: done ? '✅' : day === 7 ? '🎁' : coinHTML }),
        h('span', { class: 'lbl' }, `Den ${day}`),
        h('b', null, `+${r}`),
      ),
    );
  });
  const content = h(
    'div',
    { class: 'g92-stack', style: 'gap:14px' },
    h('p', { class: 'g92-muted' }, can ? 'Přijď každý den a odměna poroste! Sedmý den je velké překvapení.' : 'Dnešní odměnu už máš. Přijď zase zítra!'),
    strip,
  );
  const d = openDialog({
    title: 'Denní odměna',
    icon: UI_ICONS.sparkle,
    content,
    actions: can ? [{ label: `Vyzvednout +${DAILY_REWARDS[today - 1]} mincí`, value: 'claim', icon: COIN_SVG }] : [{ label: 'Dobře' }],
  });
  void d.closed.then((v) => {
    if (v !== 'claim') return;
    const r = claimDailyReward(save, new Date());
    if (r) {
      sfx.coin();
      setTimeout(() => sfx.levelUp(), 200);
      confetti({ particleCount: 90 });
      onClaim(r.reward);
    }
  });
}
