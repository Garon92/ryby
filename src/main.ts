import './kit/kit.css';
import './styles/app.css';
import {
  autoPause,
  confetti,
  countdown,
  getSettings,
  h,
  setSettings,
  openSettingsDialog,
  recordActivity,
  sfx,
  showHelp,
  showPause,
  subscribeSettings,
  toast,
  UI_ICONS,
  vocative,
} from './kit';
import { LOCATION_BY_ID } from './data/locations';
import { SPECIES, type LocationId } from './data/species';
import { BAITS, type BaitId } from './data/shop';
import { Engine, type LostReason, type Phase } from './game/engine';
import type { Fish } from './game/fish';
import type { Mission } from './game/logic/missions';
import { levelInfo } from './game/logic/progress';
import { starsFor } from './game/logic/scoring';
import { canClaim } from './game/logic/daily';
import { albumProgress, applyCatch, applyPerfect, checkAchievements, ensureMissions, unlockedLocations } from './game/rewards';
import type { Achievement } from './game/logic/achievements';
import { speech } from './game/speech';
import { TIMED_SECONDS, type CatchEvent, type Difficulty, type GameMode } from './game/types';
import { persist, resetSave, save } from './store';
import { openAlbum } from './ui/album';
import { COIN_SVG } from './ui/icons';
import { fmtTime } from './ui/common';
import { showCatchCard, showMiniCatch } from './ui/catchCard';
import { missionText, openDaily, openMissions } from './ui/dialogs';
import { Hud } from './ui/hud';
import { openResults } from './ui/results';
import { settingsExtra } from './ui/settings';
import { openShop } from './ui/shop';
import { openStart, recordKey, setLocationPreview, type StartChoice } from './ui/start';
import type { ClockMode } from './store/save';

// ————————————————————————————————— DOM —————————————————————————————————

const appbar = document.querySelector('g92-appbar') as HTMLElement;
const stage = document.getElementById('stage') as HTMLElement;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const pauseBtn = h('button', { type: 'button', slot: 'actions', class: 'g92-btn g92-btn--ghost g92-btn--icon', 'aria-label': 'Pauza (Esc)', title: 'Pauza', html: UI_ICONS.pause, hidden: true });
appbar.prepend(pauseBtn);

/** start = úvod; play = hraje se; pause = pauza (overlay); modal = hra stojí kvůli dialogu/albu;
 *  card = karta úlovku; photo = foto režim; results = výsledky */
type State = 'start' | 'play' | 'pause' | 'modal' | 'card' | 'results' | 'photo';
let state: State = 'start';

/** Jediné místo, kde se mění stav – drží v souladu tlačítko pauzy, zvuk scény a třídu na <body>. */
function setState(next: State): void {
  state = next;
  const trip = next === 'play' || next === 'pause' || next === 'modal' || next === 'card' || next === 'photo';
  const wasHidden = pauseBtn.hidden;
  pauseBtn.hidden = !trip || next === 'card' || next === 'modal';
  const resume = next === 'pause' || next === 'photo';
  pauseBtn.innerHTML = resume ? UI_ICONS.play : UI_ICONS.pause;
  const label = next === 'photo' ? 'Zpět do hry (Esc)' : resume ? 'Pokračovat (Esc)' : 'Pauza (Esc)';
  pauseBtn.setAttribute('aria-label', label);
  pauseBtn.title = label;
  // zvuk scény (okolí, hudba, naviják) jen když se opravdu hraje
  engine.audio.setActive(next === 'play' || next === 'photo' || next === 'card');
  document.body.classList.toggle('is-trip', trip);
  document.body.classList.toggle('is-playing', next === 'play');
  // lišta si po změně slotu znovu spočítá, jestli se vejde název (kit ≤ 0.6 to sám nepozná)
  if (wasHidden !== pauseBtn.hidden) appbar.setAttribute('app', 'ryby');
}

/** Pozastaví hru kvůli dialogu / albu a po zavření ji zase pustí. */
async function suspendFor<T>(fn: () => Promise<T>): Promise<T> {
  const wasPlaying = state === 'play';
  const wasStart = state === 'start';
  if (wasPlaying) {
    setState('modal');
    engine.setPaused(true);
    hud.toggleBaitPop(false);
  } else if (wasStart) engine.setPaused(true);
  try {
    return await fn();
  } finally {
    if (wasPlaying && state === 'modal') {
      setState('play');
      engine.setPaused(false);
    } else if (wasStart && state === 'start') engine.setPaused(false);
  }
}

// ————————————————————————————————— engine + hud —————————————————————————————————

interface Session {
  location: LocationId;
  mode: GameMode;
  clock: ClockMode;
  difficulty: Difficulty;
  timeLeft: number;
  elapsed: number;
  score: number;
  coins: number;
  catches: CatchEvent[];
  combo: number;
  lastCatchAt: number;
  completed: Mission[];
  levelUps: { level: number; title: string }[];
  unlocked: string[];
  trophies: Achievement[];
  fights: number;
  waits: number;
  scoring: boolean;
}

let session: Session | null = null;

const engine = new Engine(canvas, {
  onPhase: (p) => onPhase(p),
  onCatch: (f, meta) => void onCatch(f, meta.perfect, meta.night),
  onLost: (r) => onLost(r),
  onPerfect: () => onPerfect(),
  onTreasure: (c) => {
    save.coins += c;
    if (session) session.coins += c;
    hud.setCoins(save.coins, true);
    persist();
  },
  onHidden: () => {
    if (state === 'play') void pause();
  },
  onTick: (dt) => tick(dt),
  onRare: (f) => {
    if (state !== 'play' || engine.autopilot) return;
    hud.message(f.rainbow ? 'Připlula duhová ryba!' : 'Připlula vzácná ryba!', f.rainbow ? '🌈' : '✨', 'good', 2400);
    sfx.tone({ freq: 1320, to: 1760, dur: 0.25, type: 'sine', gain: 0.4 });
  },
});
const hud = new Hud(stage);
hud.onBait = (b) => setBait(b);
hud.onMissions = () => void suspendFor(() => openMissions(save));

function applyPrefs(): void {
  const p = save.prefs;
  const s = getSettings();
  engine.audio.setEnabled(s.sound, p.music);
  engine.audio.setVolume(s.volume);
  // hlas je samostatné nastavení („Předčítání“), zvuk = efekty a hudba (QA C-13)
  speech.enabled = p.voice;
  engine.hints = p.hints;
  engine.setLite(p.effects === 'lite' || document.documentElement.dataset.motion === 'reduce');
  engine.autopilot = p.autopilot && state !== 'start';
  engine.gear = { ...save.equipped };
  engine.known = new Set(Object.keys(save.album));
  hud.setBait(save.equipped.bait, save.owned.bait);
  hud.setCoins(save.coins);
  hud.setMissions(save.missions);
  persist();
}
subscribeSettings(() => applyPrefs());

function setBait(b: BaitId): void {
  if (!save.owned.bait.includes(b)) return;
  save.equipped.bait = b;
  engine.setBait(b);
  hud.setBait(b, save.owned.bait);
  const it = BAITS.find((x) => x.id === b);
  if (it && state === 'play') hud.message(`Návnada: ${it.name}`, it.icon, '', 1400);
  persist();
}

function cycleBait(): void {
  const owned = BAITS.filter((b) => save.owned.bait.includes(b.id as BaitId));
  const i = owned.findIndex((b) => b.id === save.equipped.bait);
  const next = owned[(i + 1) % owned.length];
  if (next) {
    sfx.tap();
    setBait(next.id as BaitId);
  }
}

function reportActivity(): void {
  const alb = albumProgress(save);
  const lvl = levelInfo(save.xp).level;
  recordActivity('ryby', { metric: { label: 'Album', value: `${alb.caught}/${alb.total}` }, progress: alb.caught / alb.total, note: `Úroveň ${lvl}` });
}

// ————————————————————————————————— start —————————————————————————————————

let startUi: { refresh: () => void } | null = null;

function showHome(): void {
  setState('start');
  session = null;
  engine.attract = true;
  engine.autopilot = false;
  engine.setPaused(false);
  engine.difficulty = 'easy';
  hud.show(false);
  hud.clearMessage();
  stage.classList.add('is-attract');
  if (engine.loc.id !== save.prefs.location && unlockedLocations(save).includes(save.prefs.location)) engine.setLocation(save.prefs.location);
  engine.setClock(save.prefs.clock === 'flow' ? 'day' : save.prefs.clock, false);
  engine.setRain(false, true);
  if (save.prefs.clock === 'flow') engine.hour = 9.5;
  startUi = openStart(save, (c) => void onStartChoice(c));
  // první spuštění dne → nabídni denní odměnu
  if (save.prefs.seenHelp && canClaim(save.daily, new Date()) && !dailyOffered) {
    dailyOffered = true;
    setTimeout(() => {
      if (state === 'start') void suspendFor(() => openDaily(save, onDailyClaim));
    }, 700);
  }
}
let dailyOffered = false;

function onDailyClaim(coins: number): void {
  toast(`Denní odměna: +${coins} mincí!`, { variant: 'success', icon: COIN_SVG });
  announceTrophies(checkAchievements(save));
  persist(true);
  startUi?.refresh();
  hud.setCoins(save.coins, true);
}

setLocationPreview((id) => {
  if (state === 'start' && engine.loc.id !== id) engine.setLocation(id);
});

async function onStartChoice(c: StartChoice): Promise<void> {
  switch (c.kind) {
    case 'album':
      await suspendFor(() => openAlbum(save, { focus: c.focus }));
      startUi?.refresh();
      return;
    case 'shop':
      await suspendFor(() => openShop(save, () => applyPrefs()));
      startUi?.refresh();
      return;
    case 'missions':
      void suspendFor(() => openMissions(save));
      return;
    case 'daily':
      void suspendFor(() => openDaily(save, onDailyClaim));
      return;
    case 'play':
      save.prefs.location = c.location;
      save.prefs.mode = c.mode;
      save.prefs.clock = c.clock;
      save.prefs.difficulty = c.difficulty;
      save.prefs.seenHelp = true;
      persist(true);
      await startSession();
  }
}

async function startSession(): Promise<void> {
  const p = save.prefs;
  engine.audio.unlock();
  stage.classList.remove('is-attract');
  engine.attract = false;
  engine.difficulty = p.difficulty;
  if (engine.loc.id !== p.location) engine.setLocation(p.location);
  else engine.resetRound();
  engine.setClock(p.clock, p.mode === 'timed');
  // občas prší – ryby pak berou lépe
  const rainy = Math.random() < 0.22;
  engine.setRain(rainy, true);
  applyPrefs();
  engine.autopilot = p.autopilot;
  session = {
    location: p.location,
    mode: p.mode,
    clock: p.clock,
    difficulty: p.difficulty,
    timeLeft: TIMED_SECONDS,
    elapsed: 0,
    score: 0,
    coins: 0,
    catches: [],
    combo: 0,
    lastCatchAt: 0,
    completed: [],
    levelUps: [],
    unlocked: [],
    trophies: [],
    fights: 0,
    waits: 0,
    scoring: !p.autopilot,
  };
  save.stats.sessions += 1;
  hud.setTimed(p.mode === 'timed');
  hud.setTimer(TIMED_SECONDS, TIMED_SECONDS);
  hud.setScore(0);
  hud.setStars(p.mode === 'timed' && !p.autopilot ? 0 : null);
  hud.setCombo(0);
  hud.setClock(engine.hour, rainy);
  clockShown = -1;
  hud.show(true);
  setState('play');
  engine.setPaused(true);
  await countdown({ container: stage });
  if (state !== 'play') return;
  engine.setPaused(false);
  hud.message(p.autopilot ? 'Autopilot chytá za tebe' : 'Ťukni do vody u ryby', p.autopilot ? '🤖' : '👆', '', 2600);
  if (rainy) setTimeout(() => state === 'play' && hud.message('Prší – ryby lépe berou!', '🌧️', 'good', 2600), 2900);
}

// ————————————————————————————————— hra —————————————————————————————————

let clockShown = -1;
function tick(dt: number): void {
  const s = session;
  if (!s || state !== 'play') return;
  s.elapsed += dt;
  save.stats.playSeconds += dt;
  if (Math.floor(engine.hour * 6) !== clockShown) {
    clockShown = Math.floor(engine.hour * 6);
    hud.setClock(engine.hour, engine.raining);
  }
  if (s.mode === 'timed') {
    const before = Math.ceil(s.timeLeft);
    s.timeLeft = Math.max(0, s.timeLeft - dt);
    const now = Math.ceil(s.timeLeft);
    if (now !== before) {
      hud.setTimer(s.timeLeft, TIMED_SECONDS);
      if (now <= 5 && now > 0) sfx.tone({ freq: 880, dur: 0.08, type: 'square', gain: 0.3 });
    }
    // čas vypršel – dochytat rozdělanou rybu, pak konec
    if (s.timeLeft <= 0 && engine.phase !== 'fight' && engine.phase !== 'landing') void endSession();
  }
  const f = engine.fightState;
  if (engine.phase === 'fight' && f && !engine.autopilot) {
    if (f.tension > 0.86) hud.message('Pusť! Vlasec by praskl!', '✋', 'alert', 0);
    else if (s.fights <= 2 || f.tension < 0.2) hud.message(touchUi ? 'Drž prst a navíjej' : 'Drž myš nebo mezerník', '👇', '', 0);
    else hud.clearMessage();
  }
}

function onPhase(p: Phase): void {
  const s = session;
  if (!s || state !== 'play' || engine.autopilot) return;
  switch (p) {
    case 'waiting':
      s.waits++;
      if (s.waits <= 2) hud.message('Počkej, až se splávek potopí', '🔴', '', 2400);
      break;
    case 'bite':
      if (s.difficulty === 'easy') hud.message('Záběr!', '🐟', 'good', 900);
      else hud.message('Záběr! Ťukni!', '❗', 'alert', 1400);
      break;
    case 'fight':
      s.fights++;
      break;
    case 'landing':
    case 'idle':
      hud.clearMessage();
      break;
  }
}

function onLost(r: LostReason): void {
  const s = session;
  if (!s) return;
  s.combo = 0;
  hud.setCombo(0);
  if (r === 'snapped') save.stats.snapped++;
  if (r === 'escaped') save.stats.escaped++;
  if (engine.autopilot) return;
  const msg: Record<LostReason, [string, string]> = {
    late: ['Utekla! Ťukni hned, jak se splávek potopí', '💨'],
    early: ['Moc brzy! Počkej, až se splávek potopí', '⏳'],
    snapped: ['Prásk! Vlasec praskl – pouštěj v červeném', '💥'],
    escaped: ['Ryba odplavala – víc navíjej', '🌊'],
  };
  const [t, i] = msg[r];
  hud.message(t, i, '', 2600);
}

function onPerfect(): void {
  if (!session?.scoring) return;
  const done = applyPerfect(save, Math.random);
  announceMissions(done);
  announceTrophies(checkAchievements(save));
  hud.setMissions(save.missions);
  persist();
}

/** Oznámení trofejí; `into` = místo toastů je vypsat do karty úlovku. */
function announceTrophies(list: Achievement[], into?: string[]): void {
  if (!list.length) return;
  for (const a of list) {
    session?.trophies.push(a);
    if (session) session.coins += a.reward;
    const text = `Trofej: ${a.icon} ${a.name}! +${a.reward} mincí`;
    if (into) into.push(`🏆 ${text}`);
    else toast(text, { variant: 'accent', icon: UI_ICONS.trophy, duration: 4200 });
  }
  setTimeout(() => sfx.win(), 250);
  hud.setCoins(save.coins, true);
}

function announceMissions(done: Mission[], into?: string[]): void {
  if (!done.length) return;
  for (const m of done) {
    session?.completed.push(m);
    if (session) session.coins += m.reward;
    if (into) into.push(`🎯 ${missionText(m).text} ✓ +${m.reward} mincí`);
    else toast(`Mise splněna! +${m.reward} mincí`, { variant: 'success', icon: COIN_SVG });
  }
  sfx.levelUp();
  hud.setCoins(save.coins, true);
}

async function onCatch(f: Fish, perfect: boolean, night: boolean): Promise<void> {
  const s = session;
  if (!s) return;
  const now = performance.now();
  s.combo = now - s.lastCatchAt < 45000 || s.lastCatchAt === 0 ? s.combo + 1 : 1;
  s.lastCatchAt = now;
  const unlockedBefore = unlockedLocations(save);
  const out = applyCatch(
    save,
    {
      species: f.species,
      sizeCm: f.sizeCm,
      trophy: f.trophy,
      rainbow: f.rainbow,
      perfect,
      night,
      location: s.location,
      bait: save.equipped.bait,
      combo: s.combo,
    },
    new Date(),
    Math.random,
    s.scoring,
  );
  s.catches.push(out.event);
  engine.known = new Set(Object.keys(save.album));
  if (s.scoring) {
    s.score += out.points.points;
    s.coins += out.coins;
  }
  hud.setScore(s.score, true);
  if (s.mode === 'timed' && s.scoring) {
    const before = starsFor(s.score - (s.scoring ? out.points.points : 0), s.difficulty);
    const now = starsFor(s.score, s.difficulty);
    hud.setStars(now);
    if (now > before) {
      hud.message(now === 3 ? 'Tři hvězdy! Jsi mistr!' : `${now}. hvězda!`, '⭐', 'good', 1800);
      sfx.play('levelUp');
    }
  }
  hud.setCoins(save.coins, true);
  hud.setCombo(s.scoring ? s.combo : 0);
  hud.setMissions(save.missions);
  if (s.combo >= 2 && s.scoring) sfx.play('coin');
  const big = (out.newSpecies || out.record || f.trophy || f.rainbow || out.released) && state === 'play';
  // při velké kartě úlovku se novinky vypíšou do ní (toasty by překryly tlačítka)
  const notes: string[] | undefined = big ? [] : undefined;
  announceMissions(out.completed, notes);
  announceTrophies(out.achievements, notes);
  if (out.levelAfter > out.levelBefore) {
    const info = levelInfo(save.xp);
    s.levelUps.push({ level: info.level, title: info.title });
    if (notes) notes.push(`⬆️ Nová úroveň ${info.level}: ${info.title}!`);
    else toast(`Nová úroveň ${info.level}: ${info.title}!`, { variant: 'accent', icon: UI_ICONS.trophy });
    engine.audio.play('levelup');
    for (const id of unlockedLocations(save)) {
      if (!unlockedBefore.includes(id)) {
        s.unlocked.push(LOCATION_BY_ID[id].name);
        const t = `Odemčeno nové místo: ${LOCATION_BY_ID[id].icon} ${LOCATION_BY_ID[id].name}!`;
        if (notes) notes.push(`🔓 ${t}`);
        else toast(t, { variant: 'success' });
      }
    }
  }
  persist();
  reportActivity();
  engine.audio.play(out.newSpecies || f.trophy || f.rainbow ? 'fanfare' : 'catch');
  const name = getSettings().playerName.trim();
  speech.speak(out.newSpecies ? `${name ? `Výborně, ${vocative(name)}! ` : ''}Nový druh! ${f.species.name}` : f.species.name);
  if (!big) {
    showMiniCatch(stage, f.species, f.sizeCm, s.scoring ? out.points.points : null);
    return;
  }
  if (out.newSpecies || f.trophy || f.rainbow) confetti({ particleCount: 120, origin: { x: 0.5, y: 0.35 } });
  setState('card');
  engine.setPaused(true);
  hud.clearMessage();
  let toAlbum = false;
  await showCatchCard({
    species: f.species,
    outcome: out,
    sizeCm: f.sizeCm,
    scoring: s.scoring,
    autoCloseMs: engine.autopilot ? 3500 : undefined,
    onAlbum: () => (toAlbum = true),
    notes,
  });
  if (toAlbum) await openAlbum(save, { focus: f.species.id });
  speech.stop();
  if (state === 'card') {
    setState('play');
    engine.setPaused(false);
  }
}

// ————————————————————————————————— pauza / konec —————————————————————————————————

let pausing = false;
let pauseOverlay: ReturnType<typeof showPause> | null = null;
async function pause(): Promise<void> {
  if (state !== 'play' || pausing) return;
  pausing = true;
  setState('pause');
  engine.setPaused(true);
  hud.clearMessage();
  hud.toggleBaitPop(false);
  const s = session;
  const photoBtn = h('button', { type: 'button', class: 'g92-btn g92-btn--soft g92-btn--lg' }, '📷 Fotka');
  const albumB = h('button', { type: 'button', class: 'g92-btn g92-btn--soft g92-btn--lg' }, '📖 Album');
  const extra = h('div', { class: 'g92-overlay__row', style: 'width:100%' }, albumB, photoBtn);
  const ov = (pauseOverlay = showPause({
    subtitle: s ? `${LOCATION_BY_ID[s.location].icon} ${LOCATION_BY_ID[s.location].name}` : undefined,
    stats: s
      ? [
          { label: 'Ryb', value: s.catches.length },
          { label: 'Body', value: s.score },
          ...(s.mode === 'timed' ? [{ label: 'Zbývá', value: fmtTime(s.timeLeft) }] : []),
        ]
      : [],
    menuHref: null,
    menuLabel: 'Ukončit hru',
    extra,
  }));
  photoBtn.addEventListener('click', () => ov.close('photo' as 'resume'));
  albumB.addEventListener('click', () => ov.close('album' as 'resume'));
  const choice = (await ov) as string;
  pausing = false;
  pauseOverlay = null;
  if (choice === 'photo') return photoMode();
  if (choice === 'album') {
    await openAlbum(save);
    setState('play');
    return pause();
  }
  if (choice === 'restart') return startSession();
  if (choice === 'menu') return endSession(true);
  setState('play');
  engine.setPaused(false);
}

let exitPhoto: (() => void) | null = null;

function photoMode(): void {
  setState('photo');
  hud.show(false);
  engine.setPaused(false);
  const save_ = h('button', { type: 'button', class: 'g92-btn g92-btn--secondary' }, '💾 Uložit obrázek');
  const back = h('button', { type: 'button', class: 'g92-btn' }, '✓ Zpět do hry');
  const bar = h('div', { class: 'photo-exit g92-row' }, save_, back);
  stage.append(bar);
  save_.addEventListener('click', async () => {
    const blob = await engine.snapshot();
    if (!blob) return;
    const a = h('a', { href: URL.createObjectURL(blob), download: `ryby-${new Date().toISOString().slice(0, 10)}.png` }) as HTMLAnchorElement;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    sfx.success();
  });
  exitPhoto = () => {
    exitPhoto = null;
    bar.remove();
    hud.show(true);
    setState('play');
    void pause();
  };
  back.addEventListener('click', () => exitPhoto?.());
}

/** Konec výpravy. `aborted` = hráč ji ukončil dřív (nepočítá se rekord ani hvězdy). */
async function endSession(aborted = false): Promise<void> {
  const s = session;
  if (!s || state === 'results') return;
  setState('results');
  engine.setPaused(true);
  engine.reelHeld = false;
  hud.show(false);
  hud.clearMessage();
  const early = aborted && (s.mode === 'free' ? false : s.timeLeft > 0);
  let best = save.records[recordKey(s.location, s.difficulty)] ?? 0;
  let isNewBest = false;
  if (s.mode === 'timed' && s.scoring && !early && s.score > best) {
    best = s.score;
    isNewBest = true;
    save.records[recordKey(s.location, s.difficulty)] = s.score;
  }
  persist(true);
  reportActivity();
  const choice = await openResults({
    mode: s.mode,
    difficulty: s.difficulty,
    score: s.score,
    best,
    isNewBest,
    catches: s.catches,
    coins: s.coins,
    completed: s.completed,
    levelUps: s.levelUps,
    unlocked: s.unlocked,
    trophies: s.trophies,
    seconds: s.elapsed,
    scoring: s.scoring,
    aborted: early,
  });
  if (choice === 'again') return startSession();
  if (choice === 'album') await openAlbum(save);
  showHome();
}

// ————————————————————————————————— vstup —————————————————————————————————

let touchUi = matchMedia('(pointer: coarse)').matches;

function localPoint(e: PointerEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

canvas.addEventListener('pointerdown', (e) => {
  touchUi = e.pointerType !== 'mouse';
  if (state !== 'play') return;
  engine.audio.unlock();
  if (engine.autopilot) return;
  e.preventDefault();
  canvas.setPointerCapture?.(e.pointerId);
  const p = localPoint(e);
  hud.toggleBaitPop(false);
  engine.action(p.x, p.y);
});
const release = () => {
  engine.reelHeld = false;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' && state === 'play') {
    engine.aim = localPoint(e);
    engine.keyAimActive = false;
  }
});
canvas.addEventListener('pointerleave', () => (engine.aim = null));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

window.addEventListener('keydown', (e) => {
  if (isTyping(e.target) || document.querySelector('dialog[open], .sheet')) return;
  const k = e.key;
  // foto režim: Esc / P = zpět do hry
  if (state === 'photo' && (k === 'Escape' || k === 'p' || k === 'P')) {
    e.preventDefault();
    exitPhoto?.();
    return;
  }
  if (state !== 'play') return;
  if (k === 'Escape' && hud.baitMenuOpen) {
    // Esc nejdřív zavře nabídku návnad
    e.preventDefault();
    hud.toggleBaitPop(false);
    return;
  }
  if (k === 'Escape' || k === 'p' || k === 'P') {
    e.preventDefault();
    void pause();
    return;
  }
  if (k === 'm' || k === 'M') {
    // M = zvuk, F = celá obrazovka (jako v ostatních hrách)
    e.preventDefault();
    setSettings({ sound: !getSettings().sound });
    return;
  }
  if (k === 'f' || k === 'F') {
    e.preventDefault();
    void (appbar as HTMLElement & { toggleFullscreen?: () => Promise<void> }).toggleFullscreen?.();
    return;
  }
  if (engine.autopilot) return;
  if (k === ' ' || k === 'Enter') {
    const target = e.target as HTMLElement | null;
    if (target && target !== document.body && target.closest('button, a')) return;
    e.preventDefault();
    if (e.repeat) return;
    touchUi = false;
    engine.audio.unlock();
    engine.action();
    return;
  }
  const step = e.shiftKey ? 0.08 : 0.035;
  if (k === 'ArrowLeft') engine.moveKeyAim(-step, 0);
  else if (k === 'ArrowRight') engine.moveKeyAim(step, 0);
  else if (k === 'ArrowUp') engine.moveKeyAim(0, -step);
  else if (k === 'ArrowDown') engine.moveKeyAim(0, step);
  else if (k === 'b' || k === 'B') cycleBait();
  else return;
  e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  if (e.key === ' ' || e.key === 'Enter') engine.reelHeld = false;
});

// tlačítko v liště: pauza / pokračovat
pauseBtn.addEventListener('click', () => {
  if (state === 'photo') exitPhoto?.();
  else if (pauseOverlay) pauseOverlay.close('resume');
  else void pause();
});

// nápověda z lišty: během hry hru pozastaví
appbar.addEventListener('g92-help', (e) => {
  e.preventDefault();
  void suspendFor(async () => {
    await showHelp()?.closed;
  });
});

appbar.addEventListener('g92-settings', (e) => {
  e.preventDefault();
  void suspendFor(() => openSettings());
});

function openSettings(): Promise<unknown> {
  const d = openSettingsDialog({
    extra: settingsExtra(
      save,
      () => {
        applyPrefs();
        startUi?.refresh();
      },
      () => {
        resetSave();
        ensureMissions(save, Math.random);
        applyPrefs();
        d.close();
        if (state === 'start') location.reload();
      },
    ),
  });
  return d.closed;
}

autoPause(() => {
  if (state === 'play') void pause();
});

window.addEventListener('resize', () => engine.resize());
new ResizeObserver(() => engine.resize()).observe(stage);

// ————————————————————————————————— start —————————————————————————————————

ensureMissions(save, Math.random);
// trofeje za postup z dřívějška (např. po migraci) – oznámit po startu (víc najednou jako jeden souhrn)
setTimeout(() => {
  const got = checkAchievements(save);
  if (got.length <= 2) return announceTrophies(got);
  const coins = got.reduce((a, t) => a + t.reward, 0);
  const word = got.length >= 5 ? 'nových trofejí' : 'nové trofeje';
  toast(`Máš ${got.length} ${word}! +${coins} mincí – najdeš je v albu.`, { variant: 'accent', icon: UI_ICONS.trophy, duration: 5000 });
  persist();
  startUi?.refresh();
}, 1200);
engine.setLocation(unlockedLocations(save).includes(save.prefs.location) ? save.prefs.location : 'rybnik');
applyPrefs();
engine.start();
reportActivity();
showHome();

// pro testy / ladění
declare global {
  interface Window {
    __ryby?: { engine: Engine; save: typeof save; state: () => State; species: number };
  }
}
window.__ryby = { engine, save, state: () => state, species: SPECIES.length };
