"use client";

import assets from "@/lib/generated/assets.json";

export type SfxGroup = keyof typeof assets.sfx;
export type Stinger = "win" | "blackjack" | "lose" | "push" | "bust" | "turn" | "tick" | "click" | "coin";

interface SoundSettings {
  volume: number;
  sfx: boolean;
  music: boolean;
  ambience: boolean;
  voice: boolean;
}

const NOTE = (n: number) => 440 * 2 ** ((n - 69) / 12);

// ii-V-I lounge progression, one chord per bar (MIDI notes).
const PROGRESSION = [
  { root: 50, chord: [62, 65, 69, 72] }, // Dm7
  { root: 43, chord: [59, 62, 65, 69] }, // G7
  { root: 48, chord: [60, 64, 67, 71] }, // Cmaj7
  { root: 45, chord: [61, 64, 67, 69] }, // A7
  { root: 50, chord: [62, 65, 69, 72] }, // Dm7
  { root: 43, chord: [59, 62, 65, 69] }, // G7
  { root: 52, chord: [62, 67, 71, 74] }, // Em7
  { root: 45, chord: [61, 64, 67, 71] }, // A7
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private pulse: PeriodicWave | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private settings: SoundSettings = { volume: 0.7, sfx: true, music: true, ambience: true, voice: true };
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private ambTimer: ReturnType<typeof setInterval> | null = null;
  private ambSource: AudioBufferSourceNode | null = null;
  private nextBeat = 0;
  private beat = 0;
  private voice: SpeechSynthesisVoice | null = null;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      this.master.connect(comp).connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.ambBus = ctx.createGain();
      for (const bus of [this.sfxBus, this.musicBus, this.ambBus]) bus.connect(this.master);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      // 25% duty pulse wave for the chiptune voices.
      const n = 32;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
      this.pulse = ctx.createPeriodicWave(real, imag);
      this.applySettings();
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Call from a user gesture: browsers only allow audio after one. */
  unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.preload();
    this.syncLoops();
  }

  get ready() {
    return this.ctx?.state === "running";
  }

  configure(settings: SoundSettings) {
    this.settings = settings;
    this.applySettings();
    this.syncLoops();
  }

  private applySettings() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.volume, t, 0.05);
    this.sfxBus?.gain.setTargetAtTime(this.settings.sfx ? 1 : 0, t, 0.05);
    this.musicBus?.gain.setTargetAtTime(this.settings.music ? 0.16 : 0, t, 0.3);
    this.ambBus?.gain.setTargetAtTime(this.settings.ambience ? 0.07 : 0, t, 0.3);
  }

  private preload() {
    if (this.loading || !this.ctx) return;
    const ctx = this.ctx;
    const files = Object.values(assets.sfx).flat();
    this.loading = Promise.all(
      files.map(async (url) => {
        try {
          const res = await fetch(url);
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(url, buf);
        } catch {
          // Missing or undecodable files fall back to synthesized sounds.
        }
      }),
    ).then(() => {});
  }

  /** Plays a random variation of a Kenney sound group after `delay` seconds. */
  play(group: SfxGroup, opts: { delay?: number; volume?: number; rate?: number } = {}) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || !this.settings.sfx) return;
    const list = assets.sfx[group];
    const url = list[Math.floor(Math.random() * list.length)];
    const buffer = this.buffers.get(url);
    const at = ctx.currentTime + Math.max(0, opts.delay ?? 0);
    if (!buffer) {
      if (group.startsWith("chip")) this.stinger("coin", opts.delay);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = (opts.rate ?? 1) * (0.94 + Math.random() * 0.12);
    const gain = ctx.createGain();
    gain.gain.value = opts.volume ?? 0.9;
    src.connect(gain).connect(this.sfxBus);
    src.start(at);
  }

  private tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType | "pulse"; gain?: number; bus?: GainNode | null; slide?: number } = {}) {
    const ctx = this.ctx;
    const bus = opts.bus ?? this.sfxBus;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    if (opts.type === "pulse" && this.pulse) osc.setPeriodicWave(this.pulse);
    else osc.type = (opts.type as OscillatorType) ?? "square";
    osc.frequency.setValueAtTime(freq, at);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), at + dur);
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.18;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    osc.connect(g).connect(bus);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private hiss(at: number, dur: number, opts: { freq?: number; q?: number; gain?: number; type?: BiquadFilterType; bus?: GainNode | null } = {}) {
    const ctx = this.ctx;
    const bus = opts.bus ?? this.sfxBus;
    if (!ctx || !bus || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? "bandpass";
    filter.frequency.value = opts.freq ?? 3000;
    filter.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.2, at);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    src.connect(filter).connect(g).connect(bus);
    src.start(at, Math.random());
    src.stop(at + dur + 0.02);
  }

  /** Short synthesized chiptune cues. */
  stinger(kind: Stinger, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.settings.sfx) return;
    const t = ctx.currentTime + delay;
    switch (kind) {
      case "win":
        [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), t + i * 0.07, 0.22, { type: "pulse", gain: 0.12 }));
        [72, 76, 79].forEach((n) => this.tone(NOTE(n), t + 0.3, 0.5, { type: "triangle", gain: 0.1 }));
        break;
      case "blackjack":
        [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => this.tone(NOTE(n), t + i * 0.055, 0.2, { type: "pulse", gain: 0.11 }));
        [84, 88, 91].forEach((n) => this.tone(NOTE(n), t + 0.42, 0.9, { type: "square", gain: 0.06 }));
        for (let i = 0; i < 6; i++) this.tone(NOTE(96 + ((i * 5) % 12)), t + 0.45 + i * 0.09, 0.12, { type: "sine", gain: 0.08 });
        break;
      case "lose":
        [67, 64, 60].forEach((n, i) => this.tone(NOTE(n), t + i * 0.13, 0.26, { type: "triangle", gain: 0.13 }));
        break;
      case "push":
        [64, 64].forEach((n, i) => this.tone(NOTE(n), t + i * 0.12, 0.12, { type: "pulse", gain: 0.09 }));
        break;
      case "bust":
        this.tone(110, t, 0.4, { type: "sawtooth", gain: 0.12, slide: 0.45 });
        this.hiss(t, 0.25, { freq: 400, gain: 0.12, type: "lowpass" });
        break;
      case "turn":
        this.tone(NOTE(81), t, 0.5, { type: "sine", gain: 0.12 });
        this.tone(NOTE(88), t + 0.11, 0.6, { type: "sine", gain: 0.1 });
        break;
      case "tick":
        this.tone(1250, t, 0.035, { type: "square", gain: 0.05 });
        break;
      case "click":
        this.tone(900, t, 0.025, { type: "square", gain: 0.05 });
        break;
      case "coin":
        this.tone(NOTE(88), t, 0.06, { type: "square", gain: 0.06 });
        this.tone(NOTE(93), t + 0.05, 0.12, { type: "square", gain: 0.06 });
        break;
    }
  }

  private syncLoops() {
    if (!this.ctx) return;
    if (this.settings.music && !this.musicTimer) this.startMusic();
    if (!this.settings.music && this.musicTimer) this.stopMusic();
    if (this.settings.ambience && !this.ambTimer) this.startAmbience();
    if (!this.settings.ambience && this.ambTimer) this.stopAmbience();
  }

  private startMusic() {
    const ctx = this.ctx;
    if (!ctx) return;
    const spb = 60 / 92;
    this.nextBeat = ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== "running") return;
      while (this.nextBeat < this.ctx.currentTime + 0.2) {
        this.scheduleBeat(this.beat, this.nextBeat, spb);
        this.nextBeat += spb;
        this.beat++;
      }
    }, 40);
  }

  private stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleBeat(beat: number, t: number, spb: number) {
    const bus = this.musicBus;
    const bar = Math.floor(beat / 4) % PROGRESSION.length;
    const inBar = beat % 4;
    const { root, chord } = PROGRESSION[bar];
    const next = PROGRESSION[(bar + 1) % PROGRESSION.length].root;
    // Walking bass.
    const walk = [root, root + 4, root + 7, next + (next > root ? -1 : 1)];
    this.tone(NOTE(walk[inBar]), t, spb * 0.9, { type: "triangle", gain: 0.55, bus });
    // Comping on 2 and 4.
    if (inBar === 1 || inBar === 3) {
      for (const n of chord) this.tone(NOTE(n), t + spb * 0.05, spb * 0.35, { type: "pulse", gain: 0.06, bus });
    }
    // A gentle arpeggio every other bar.
    if (bar % 2 === 1) {
      const swing = [0, 0.62];
      swing.forEach((s, i) => {
        const n = chord[(inBar * 2 + i) % chord.length] + 12;
        this.tone(NOTE(n), t + s * spb, spb * 0.3, { type: "pulse", gain: 0.05, bus });
      });
    }
    // Brushes: swung hi-hat, soft kick and snare.
    this.hiss(t, 0.05, { freq: 9000, type: "highpass", gain: 0.12, bus });
    this.hiss(t + spb * 0.62, 0.04, { freq: 9000, type: "highpass", gain: 0.08, bus });
    if (inBar === 0 || inBar === 2) this.tone(70, t, 0.18, { type: "sine", gain: 0.5, slide: 0.5, bus });
    if (inBar === 1 || inBar === 3) this.hiss(t, 0.16, { freq: 2200, q: 0.7, gain: 0.1, bus });
  }

  private startAmbience() {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.ambBus) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    const g = ctx.createGain();
    g.gain.value = 0.6;
    src.connect(lp).connect(g).connect(this.ambBus);
    src.start();
    this.ambSource = src;
    this.ambTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== "running" || Math.random() > 0.35) return;
      // A distant slot machine paying out.
      const t = this.ctx.currentTime;
      const base = 79 + Math.floor(Math.random() * 5);
      for (let i = 0; i < 5; i++) this.tone(NOTE(base + [0, 4, 7, 12, 7][i]), t + i * 0.09, 0.15, { type: "sine", gain: 0.25, bus: this.ambBus });
    }, 5000);
  }

  private stopAmbience() {
    if (this.ambTimer) clearInterval(this.ambTimer);
    this.ambTimer = null;
    try {
      this.ambSource?.stop();
    } catch {
      // already stopped
    }
    this.ambSource = null;
  }

  /** Dealer voice through the Web Speech API (Latin American Spanish when available). */
  speak(text: string, onStart?: () => void, onEnd?: () => void) {
    if (!this.settings.voice || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    if (!this.voice) {
      const voices = synth.getVoices();
      this.voice =
        voices.find((v) => /es[-_](CO|MX|US|419|AR|CL|PE)/i.test(v.lang)) ?? voices.find((v) => v.lang.toLowerCase().startsWith("es")) ?? null;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.voice?.lang ?? "es-CO";
    if (this.voice) u.voice = this.voice;
    u.rate = 1.04;
    u.pitch = 0.92;
    u.volume = Math.min(1, this.settings.volume * 1.2);
    u.onstart = () => onStart?.();
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    if (synth.speaking) synth.cancel();
    synth.speak(u);
  }
}

export const sound = new SoundEngine();
