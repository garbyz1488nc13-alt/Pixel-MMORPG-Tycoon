/**
 * Procedural 8-bit audio: every sound is synthesised with Web Audio oscillators
 * and noise (no audio files). Music is a generative chiptune loop with a calm
 * mood and a faster "battle" mood used while a raid is fighting a boss.
 */
export type Sfx = 'hit' | 'death' | 'levelup' | 'quest' | 'slam' | 'enrage' | 'fanfare' | 'wipe' | 'click' | 'place';
export type MusicMood = 'calm' | 'battle';

/** Minimum ms between two plays of the same sound (busy battles stay listenable). */
const THROTTLE: Record<Sfx, number> = { hit: 70, death: 90, levelup: 200, quest: 300, slam: 150, enrage: 500, fanfare: 1500, wipe: 1500, click: 40, place: 60 };

// A minor pentatonic (MIDI) for melodies; chord roots for i–VI–III–VII and I–vi–IV–V.
const PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76];
const PROGRESSIONS: Record<MusicMood, number[][]> = {
  calm: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]],
  battle: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]],
};
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngineImpl {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<Sfx, number>();
  private sfxVolume = 0.5;
  private musicVolume = 0.3;
  private musicOn = false;
  private mood: MusicMood = 'calm';
  private timer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private seed = 1;

  /** Create the context lazily on the first user gesture (browser autoplay rules). */
  unlock(): void {
    if (typeof window === 'undefined') return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) {
      try {
        this.ctx = new Ctx();
      } catch {
        return;
      }
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.connect(this.ctx.destination);
      this.musicGain.connect(this.ctx.destination);
      this.applyVolumes();
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.musicOn && this.timer === null) this.startScheduler();
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    this.applyVolumes();
    if (music <= 0) this.stopScheduler();
    else if (this.musicOn && this.ctx && this.timer === null) this.startScheduler();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxGain!.gain.setTargetAtTime(this.sfxVolume * 0.5, t, 0.02);
    this.musicGain!.gain.setTargetAtTime(this.musicVolume * 0.35, t, 0.05);
  }

  // ------------------------------------------------------------ sfx
  play(name: Sfx): void {
    if (!this.ctx || this.sfxVolume <= 0 || this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - (this.last.get(name) ?? -1e9) < THROTTLE[name]) return;
    this.last.set(name, now);
    const t = this.ctx.currentTime + 0.01;
    switch (name) {
      case 'hit':
        this.tone('square', 260 + Math.random() * 60, 110, t, 0.06, 0.25);
        this.burst(t, 0.04, 0.15, 3000);
        break;
      case 'death':
        this.tone('square', 420, 70, t, 0.28, 0.25);
        break;
      case 'levelup':
        [72, 76, 79, 84].forEach((n, i) => this.tone('square', midi(n), midi(n), t + i * 0.07, 0.09, 0.2));
        break;
      case 'quest':
        this.tone('triangle', midi(79), midi(79), t, 0.12, 0.35);
        this.tone('triangle', midi(84), midi(84), t + 0.12, 0.2, 0.35);
        break;
      case 'slam':
        this.tone('sine', 120, 35, t, 0.35, 0.8);
        this.burst(t, 0.3, 0.6, 600);
        break;
      case 'enrage':
        this.tone('sawtooth', 90, 60, t, 0.5, 0.35, 12);
        break;
      case 'fanfare':
        [[67, 0], [67, 0.12], [67, 0.24], [72, 0.36], [76, 0.6], [79, 0.78]].forEach(([n, d], i) => this.tone('square', midi(n), midi(n), t + d, i === 5 ? 0.5 : 0.11, 0.22));
        [[48, 0.36], [55, 0.6]].forEach(([n, d]) => this.tone('triangle', midi(n), midi(n), t + d, 0.6, 0.35));
        break;
      case 'wipe':
        [[64, 0], [63, 0.3], [62, 0.6], [61, 0.9]].forEach(([n, d], i) => this.tone('sawtooth', midi(n - 12), midi(n - 12) * (i === 3 ? 0.94 : 1), t + d, i === 3 ? 0.8 : 0.28, 0.2, i === 3 ? 6 : 0));
        break;
      case 'click':
        this.tone('square', 900, 700, t, 0.03, 0.12);
        break;
      case 'place':
        this.tone('square', 330, 520, t, 0.06, 0.18);
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, vibrato = 0, out?: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = vibrato;
      lg.gain.value = f0 * 0.06;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out ?? this.sfxGain!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(t: number, dur: number, vol: number, cutoff: number, out?: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out ?? this.sfxGain!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------ music
  startMusic(): void {
    this.musicOn = true;
    if (this.ctx && this.musicVolume > 0) this.startScheduler();
  }

  stopMusic(): void {
    this.musicOn = false;
    this.stopScheduler();
  }

  setMood(mood: MusicMood): void {
    this.mood = mood;
  }

  get currentMood(): MusicMood {
    return this.mood;
  }

  private startScheduler(): void {
    if (this.timer !== null || !this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  private stopScheduler(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** 16th-note scheduler with a short look-ahead. */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const battle = this.mood === 'battle';
    const sixteenth = 60 / (battle ? 150 : 96) / 4;
    while (this.nextNoteTime < ctx.currentTime + 0.15) {
      const t = this.nextNoteTime;
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % 4;
      const chord = PROGRESSIONS[this.mood][bar];
      const out = this.musicGain!;
      // Bass: root on beats, octave bounce in battle.
      if (s % 4 === 0 || (battle && s % 2 === 0)) {
        const n = chord[0] - 12 + (battle && s % 4 === 2 ? 12 : 0);
        this.tone('triangle', midi(n), midi(n), t, sixteenth * (battle ? 1.8 : 3.6), 0.5, 0, out);
      }
      // Arpeggio.
      if (s % 2 === 0) {
        const n = chord[(s / 2) % 3] + 12;
        this.tone('square', midi(n), midi(n), t, sixteenth * 0.9, 0.07, 0, out);
      }
      // Melody: generative pentatonic phrases, rests keep it airy.
      if (s % (battle ? 2 : 4) === 0 && this.rnd() < (battle ? 0.7 : 0.55)) {
        const n = PENTA[Math.floor(this.rnd() * PENTA.length)] + (battle ? 0 : 12);
        this.tone('square', midi(n), midi(n), t, sixteenth * (battle ? 1.6 : 3.2), 0.12, 0, out);
      }
      // Drums.
      if (s % 8 === 0) this.tone('sine', 140, 40, t, 0.12, 0.7, 0, out);
      if (s % 8 === 4) this.burst(t, 0.08, 0.35, 4000, out);
      if (battle && s % 2 === 1) this.burst(t, 0.02, 0.15, 8000, out);
      this.step++;
      this.nextNoteTime += sixteenth;
    }
  }
}

export const audio = new AudioEngineImpl();
