/**
 * Zvuky hry syntetizované ve WebAudio (žádné soubory): efekty, naviják, okolí (voda, ptáci, cvrčci, žáby) a hudba.
 */
export type Sfx =
  | 'cast'
  | 'splash'
  | 'bigSplash'
  | 'nibble'
  | 'bite'
  | 'hook'
  | 'snap'
  | 'miss'
  | 'catch'
  | 'fanfare'
  | 'coin'
  | 'combo'
  | 'levelup'
  | 'click'
  | 'bubble'
  | 'quack'
  | 'perfect'
  | 'tick';

type Ambience = { water: number; birds: boolean; night: boolean; frogs: boolean };

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private ambGain!: GainNode;
  private noise!: AudioBuffer;
  private waterFilter: BiquadFilterNode | null = null;
  private waterGain: GainNode | null = null;
  private reelTimer = 0;
  private reeling = false;
  private reelRate = 0;
  private amb: Ambience = { water: 0.5, birds: true, night: false, frogs: false };
  private ambTimer = 0;
  private musicTimer = 0;
  private musicStep = 0;
  private musicNote = 0;
  soundOn = true;
  musicOn = true;
  ambienceOn = true;
  /** v ukázkovém režimu (úvodní obrazovka) jsou efekty ztlumené */
  quiet = false;

  /** Musí se zavolat z uživatelského gesta (klik/ťuk/klávesa). */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.volume * 1.2;
      this.master.connect(ctx.destination);
      this.sfxGain = ctx.createGain();
      this.sfxGain.connect(this.master);
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.master);
      this.ambGain = ctx.createGain();
      this.ambGain.gain.value = 0;
      this.ambGain.connect(this.master);
      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02; // hnědý šum
        d[i] = i % 2 ? white * 0.5 : last * 3.5;
      }
      this.startWater();
      this.applyVolumes();
      if (this.rainLevel > 0) this.setRain(this.rainLevel);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setEnabled(sound: boolean, music: boolean): void {
    this.soundOn = sound;
    this.musicOn = music;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxGain.gain.setTargetAtTime(this.soundOn ? (this.quiet ? 0.25 : 1) : 0, t, 0.05);
    this.ambGain.gain.setTargetAtTime(this.soundOn && this.ambienceOn ? 1 : 0, t, 0.3);
    this.musicGain.gain.setTargetAtTime(this.soundOn && this.musicOn ? 0.06 : 0, t, 0.4);
  }

  private volume = 0.9;
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx) this.master.gain.setTargetAtTime(this.volume * 1.2, this.ctx.currentTime, 0.05);
  }

  setQuiet(q: boolean): void {
    this.quiet = q;
    this.applyVolumes();
  }

  suspend(): void {
    void this.ctx?.suspend();
  }
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setAmbience(a: Ambience): void {
    this.amb = a;
    if (this.waterFilter && this.ctx && this.waterGain) {
      const t = this.ctx.currentTime;
      this.waterFilter.frequency.setTargetAtTime(350 + a.water * 900, t, 0.5);
      this.waterGain.gain.setTargetAtTime(0.025 + a.water * 0.05, t, 0.5);
    }
  }

  private rainGain: GainNode | null = null;
  private rainLevel = 0;

  /** šumění deště 0..1 */
  setRain(level: number): void {
    this.rainLevel = level;
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.rainGain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2600;
      f.Q.value = 0.4;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.ambGain);
      src.start();
      this.rainGain = g;
    }
    this.rainGain.gain.setTargetAtTime(level * 0.09, ctx.currentTime, 1.2);
  }

  private startWater(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    f.Q.value = 0.3;
    const g = ctx.createGain();
    g.gain.value = 0.04;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(this.ambGain);
    src.start();
    lfo.start();
    this.waterFilter = f;
    this.waterGain = g;
  }

  /** Voláno každý snímek – naviják, okolní zvuky, hudba. */
  tick(dt: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.reeling && this.reelRate > 0) {
      this.reelTimer -= dt;
      if (this.reelTimer <= 0) {
        this.reelTimer = 1 / (10 + this.reelRate * 16);
        this.click(2400 + Math.random() * 300, 0.018, 0.12);
      }
    }
    if (this.soundOn && this.ambienceOn) {
      this.ambTimer -= dt;
      if (this.ambTimer <= 0) {
        this.ambTimer = 1.5 + Math.random() * 4;
        if (this.amb.night) {
          if (Math.random() < 0.7) this.cricket();
          if (this.amb.frogs && Math.random() < 0.35) this.frog();
        } else if (this.amb.birds && Math.random() < 0.6) this.bird();
        else if (this.amb.frogs && Math.random() < 0.25) this.frog();
      }
    }
    if (this.soundOn && this.musicOn) {
      this.musicTimer -= dt;
      if (this.musicTimer <= 0) this.musicTick();
    }
  }

  setReel(on: boolean, rate = 1): void {
    this.reeling = on;
    this.reelRate = rate;
  }

  private click(freq: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  private tone(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; vol?: number; to?: number; delay?: number; attack?: number; dest?: AudioNode } = {},
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const vol = opts.vol ?? 0.2;
    const att = opts.attack ?? 0.01;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(opts.dest ?? this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, freq: number, to: number, vol: number, q = 1, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  play(name: Sfx): void {
    if (!this.ctx || !this.soundOn) return;
    switch (name) {
      case 'cast':
        this.noiseBurst(0.35, 900, 3500, 0.25, 0.8);
        break;
      case 'splash':
        this.noiseBurst(0.35, 1800, 400, 0.45, 0.9);
        this.tone(600, 0.12, { to: 180, vol: 0.12, type: 'sine' });
        break;
      case 'bigSplash':
        this.noiseBurst(0.6, 1400, 250, 0.6, 0.7);
        this.noiseBurst(0.4, 2600, 800, 0.3, 1.2, 0.08);
        break;
      case 'nibble':
        this.tone(900, 0.07, { to: 500, vol: 0.12 });
        break;
      case 'bite':
        this.tone(420, 0.18, { to: 140, vol: 0.35, type: 'triangle' });
        this.noiseBurst(0.25, 1200, 300, 0.3, 1);
        break;
      case 'hook':
        this.tone(700, 0.08, { to: 1400, vol: 0.22, type: 'triangle' });
        this.tone(1400, 0.1, { vol: 0.12, delay: 0.07 });
        break;
      case 'snap':
        this.noiseBurst(0.12, 5000, 2000, 0.5, 3);
        this.tone(300, 0.35, { to: 90, vol: 0.2, type: 'sawtooth', delay: 0.05 });
        break;
      case 'miss':
        this.tone(440, 0.18, { to: 330, vol: 0.14, type: 'triangle' });
        this.tone(330, 0.26, { to: 250, vol: 0.12, type: 'triangle', delay: 0.16 });
        break;
      case 'catch':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { vol: 0.2, type: 'triangle', delay: i * 0.08 }));
        break;
      case 'fanfare':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
          this.tone(f, i === 6 ? 0.6 : 0.2, { vol: 0.2, type: 'triangle', delay: i * 0.1 }),
        );
        break;
      case 'coin':
        this.tone(988, 0.08, { vol: 0.16, type: 'square' });
        this.tone(1319, 0.25, { vol: 0.14, type: 'square', delay: 0.07 });
        break;
      case 'combo':
        [784, 988, 1175].forEach((f, i) => this.tone(f, 0.14, { vol: 0.14, type: 'square', delay: i * 0.06 }));
        break;
      case 'perfect':
        this.tone(880, 0.14, { to: 1760, vol: 0.2, type: 'triangle' });
        this.tone(1760, 0.3, { vol: 0.1, delay: 0.1 });
        break;
      case 'levelup':
        [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { vol: 0.18, type: 'triangle', delay: i * 0.12 }));
        break;
      case 'click':
        this.tone(660, 0.06, { vol: 0.12, type: 'triangle' });
        break;
      case 'tick':
        this.tone(1200, 0.04, { vol: 0.1, type: 'square' });
        break;
      case 'bubble':
        this.tone(500, 0.12, { to: 1400, vol: 0.18 });
        break;
      case 'quack':
        this.tone(520, 0.12, { to: 380, vol: 0.2, type: 'sawtooth' });
        this.tone(480, 0.14, { to: 340, vol: 0.18, type: 'sawtooth', delay: 0.16 });
        break;
    }
  }

  private bird(): void {
    const base = 2600 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      this.tone(base * (1 + Math.random() * 0.2), 0.09, {
        to: base * (0.7 + Math.random() * 0.6),
        vol: 0.035,
        delay: i * 0.13,
        dest: this.ambGain,
      });
    }
  }

  private cricket(): void {
    for (let i = 0; i < 3; i++) this.tone(4400, 0.05, { vol: 0.02, type: 'square', delay: i * 0.07, dest: this.ambGain });
  }

  private frog(): void {
    this.tone(170, 0.09, { to: 140, vol: 0.08, type: 'square', dest: this.ambGain });
    this.tone(190, 0.12, { to: 150, vol: 0.07, type: 'square', delay: 0.14, dest: this.ambGain });
  }

  private musicTick(): void {
    const scaleDay = [0, 2, 4, 7, 9, 12, 14, 16];
    const scaleNight = [0, 3, 5, 7, 10, 12, 15];
    const sc = this.amb.night ? scaleNight : scaleDay;
    const root = this.amb.night ? 220 : 261.6;
    this.musicStep++;
    this.musicNote = Math.max(0, Math.min(sc.length - 1, this.musicNote + Math.round((Math.random() - 0.5) * 3)));
    const semi = sc[this.musicNote] ?? 0;
    const f = root * Math.pow(2, semi / 12);
    this.tone(f, 1.2, { type: 'sine', vol: 0.5, attack: 0.05, dest: this.musicGain });
    if (this.musicStep % 4 === 1) this.tone(root / 2, 2.4, { type: 'triangle', vol: 0.35, attack: 0.2, dest: this.musicGain });
    if (Math.random() < 0.3) this.tone(f * 1.5, 0.8, { type: 'sine', vol: 0.2, delay: 0.25, dest: this.musicGain });
    this.musicTimer = (this.amb.night ? 0.9 : 0.6) + Math.random() * 0.4;
  }
}
