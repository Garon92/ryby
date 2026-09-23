import { confirmDialog, h, sfx, toast } from '../kit';
import { SPECIES } from '../data/species';
import { speech } from '../game/speech';
import { levelInfo } from '../game/logic/progress';
import type { Save } from '../store/save';
import { fmtNum } from './common';

function toggle(id: string, label: string, hint: string | null, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const input = h('input', { type: 'checkbox', class: 'g92-toggle', role: 'switch', id }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener('change', () => {
    sfx.tap();
    onChange(input.checked);
  });
  const row = h('label', { class: 'g92-switch-row', for: id }, h('span', null, h('span', { class: 'g92-label' }, label), hint ? h('span', { class: 'g92-hint', style: 'display:block' }, hint) : null), input);
  return h('div', { class: 'g92-field' }, row);
}

/** Herní nastavení přidané do dialogu kitu (⚙ v liště). */
export function settingsExtra(save: Save, apply: () => void, onReset: () => void): HTMLElement {
  const p = save.prefs;
  const wrap = h('div', { class: 'ry-settings' }, h('h3', null, '🎣 Ryby'));
  wrap.append(
    toggle('ry-music', 'Hudba', 'Tichá melodie k rybaření', p.music, (v) => {
      p.music = v;
      apply();
    }),
  );
  const voiceHint = speech.available ? 'Po úlovku přečte název ryby česky (i když je zvuk vypnutý)' : 'Tento prohlížeč nemá český hlas – názvy se jen zobrazí';
  const voice = toggle('ry-voice', 'Předčítání', voiceHint, p.voice && speech.available, (v) => {
    p.voice = v;
    apply();
    if (v) speech.speak('Kapr obecný', { force: true });
  });
  if (!speech.available) (voice.querySelector('input') as HTMLInputElement).disabled = true;
  wrap.append(voice);
  wrap.append(
    toggle('ry-hints', 'Nápověda', 'Šipka ukáže rybu, když dlouho nic nechytáš', p.hints, (v) => {
      p.hints = v;
      apply();
    }),
  );
  wrap.append(
    toggle('ry-lite', 'Úsporná grafika', 'Méně efektů pro starší tablety a telefony', p.effects === 'lite', (v) => {
      p.effects = v ? 'lite' : 'full';
      apply();
    }),
  );
  wrap.append(
    toggle('ry-auto', 'Autopilot', 'Rybář chytá sám – ryby jdou do alba, ale bez mincí a bodů', p.autopilot, (v) => {
      p.autopilot = v;
      apply();
    }),
  );
  wrap.append(h('h3', null, '👪 Pro rodiče'));
  wrap.append(
    toggle('ry-unlock', 'Odemknout všechna místa', 'Řeka, potok i přehrada hned od začátku', p.unlockAll, (v) => {
      p.unlockAll = v;
      apply();
    }),
  );
  wrap.append(
    toggle('ry-uncaught', 'Album: ukazovat i nechycené ryby', 'Jména a zajímavosti všech 59 druhů', p.showUncaught, (v) => {
      p.showUncaught = v;
      apply();
    }),
  );
  const st = save.stats;
  const hours = Math.floor(st.playSeconds / 3600);
  const mins = Math.round((st.playSeconds % 3600) / 60);
  const big = st.biggest ? SPECIES.find((s) => s.id === st.biggest?.id) : null;
  const stats = h('div', { class: 'ry-stats' });
  const stat = (k: string, v: string) => stats.append(h('span', null, k), h('b', null, v));
  stat('Úroveň', `${levelInfo(save.xp).level} (${fmtNum(save.xp)} XP)`);
  stat('Úlovků celkem', fmtNum(st.catches));
  stat('Druhů v albu', `${Object.keys(save.album).length} / ${SPECIES.length}`);
  stat('Splněných misí', fmtNum(save.missionsDone));
  stat('Perfektních hodů', fmtNum(st.perfect));
  stat('Puštěno chráněných', fmtNum(st.released));
  stat('Největší úlovek', big && st.biggest ? `${big.name}, ${st.biggest.cm} cm` : '–');
  stat('Čas u vody', hours ? `${hours} h ${mins} min` : `${mins} min`);
  if (st.legacyBestScore) stat('Rekord z původní hry', fmtNum(st.legacyBestScore));
  wrap.append(h('h3', null, '📊 Statistika'), stats);
  const reset = h('button', { type: 'button', class: 'g92-btn g92-btn--danger g92-btn--sm' }, 'Smazat postup');
  reset.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Smazat celý postup?',
      message: 'Zmizí album, mince, úroveň i koupené věci. Tohle nejde vrátit.',
      confirmLabel: 'Smazat',
      danger: true,
    });
    if (ok) {
      onReset();
      toast('Postup smazán. Hezké chytání od začátku!');
    }
  });
  wrap.append(h('div', { class: 'g92-row' }, reset));
  return wrap;
}
