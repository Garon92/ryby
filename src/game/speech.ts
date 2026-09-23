/**
 * Český hlas (Web Speech API). Když prohlížeč český hlas nemá, nemluví vůbec
 * (původní hra použila anglický hlas a názvy ryb komolila).
 */
class Speech {
  private voice: SpeechSynthesisVoice | null = null;
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  enabled = true;
  private listeners = new Set<() => void>();

  constructor() {
    if (!this.synth) return;
    const pick = () => {
      const voices = this.synth?.getVoices() ?? [];
      const cs = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('cs'));
      // přednost mají lokální (offline) a „přirozené“ hlasy
      this.voice =
        cs.find((v) => /natural|premium|enhanced/i.test(v.name)) ?? cs.find((v) => v.localService) ?? cs[0] ?? null;
      for (const l of this.listeners) l();
    };
    pick();
    this.synth.addEventListener?.('voiceschanged', pick);
  }

  get available(): boolean {
    return !!this.synth && !!this.voice;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  speak(text: string, opts: { rate?: number; interrupt?: boolean } = {}): void {
    if (!this.enabled || !this.synth || !this.voice) return;
    try {
      if (opts.interrupt !== false) this.synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = this.voice;
      u.lang = this.voice.lang;
      u.rate = opts.rate ?? 0.95;
      u.pitch = 1.05;
      this.synth.speak(u);
    } catch {
      /* ignore */
    }
  }

  stop(): void {
    this.synth?.cancel();
  }
}

export const speech = new Speech();
