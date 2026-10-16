/**
 * AudioManager — all sound is synthesised with the Web Audio API.
 *
 * No audio files are downloaded: effects are layered oscillators and filtered
 * noise, and the music is a small step sequencer (drums, bass, chords, arp).
 * Volumes and mute come from the shared settings store.
 */

import { getSettings, subscribeSettings, updateSettings } from '../../features/settings/settings';

type Wave = OscillatorType;

const MUSIC_BASE_LEVEL = 0.32;
const SFX_BASE_LEVEL = 0.9;

// Music: 118 BPM, 16th-note steps, 4-bar loop  C – Am – F – G
const BPM = 118;
const STEP_SECONDS = 60 / BPM / 4;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;
const CHORDS = [
  { bass: 65.41, notes: [261.63, 329.63, 392.0] }, // C
  { bass: 55.0, notes: [220.0, 261.63, 329.63] }, // Am
  { bass: 87.31, notes: [261.63, 349.23, 440.0] }, // F
  { bass: 98.0, notes: [246.94, 293.66, 392.0] }, // G
];

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private duckBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStopTimer: ReturnType<typeof setTimeout> | null = null;
  private nextStepTime = 0;
  private step = 0;
  private loopCount = 0;

  private lastMuted = getSettings().muted;
  private muteListeners: Array<(muted: boolean) => void> = [];

  constructor() {
    subscribeSettings(() => {
      this.applyVolumes();
      const { muted } = getSettings();
      if (muted !== this.lastMuted) {
        this.lastMuted = muted;
        this.muteListeners.forEach((cb) => cb(muted));
      }
    });

    if (typeof document !== 'undefined') {
      // Don't let the music scheduler stutter in a background tab — just pause.
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend().catch(() => {});
        else void this.ctx.resume().catch(() => {});
      });
    }
  }

  get muted(): boolean {
    return getSettings().muted;
  }

  /**
   * Call from a tap/click/keypress. Browsers (Safari especially) keep audio
   * suspended until a user gesture resumes it.
   */
  unlock() {
    this.ensureContext();
    if (this.ctx && this.ctx.state === 'suspended' && !document.hidden) {
      void this.ctx.resume().catch(() => {});
    }
  }

  toggleMute(): boolean {
    updateSettings({ muted: !this.muted });
    return this.muted;
  }

  onMuteChange(cb: (muted: boolean) => void): () => void {
    this.muteListeners.push(cb);
    return () => {
      this.muteListeners = this.muteListeners.filter((l) => l !== cb);
    };
  }

  // ─── Sound effects ────────────────────────────────────────────────────────

  /**
   * intensity 0–1 = ball speed; rally = hits so far. The note climbs with the
   * rally so long exchanges build tension on their own.
   */
  playPaddleHit(intensity = 0.3, rally = 0) {
    const t = this.now();
    if (t === null) return;
    const pitch = 392 * Math.pow(2, Math.min(rally, 24) / 24) * cents((Math.random() - 0.5) * 40);

    this.tone(pitch, 'triangle', t, 0.14, 0.34, { endFreq: pitch * 0.97 });
    this.tone(pitch * 2, 'sine', t, 0.07, 0.12);
    this.noise(t, 0.035, 0.22 + intensity * 0.25, { filter: 'bandpass', freq: 2200 + intensity * 1800, q: 1.2 });
    this.tone(150, 'sine', t, 0.09, 0.18 + intensity * 0.25, { endFreq: 55 });
  }

  playWallBounce() {
    const t = this.now();
    if (t === null) return;
    this.noise(t, 0.03, 0.12, { filter: 'highpass', freq: 3500 });
    this.tone(1250, 'sine', t, 0.05, 0.07, { endFreq: 900 });
  }

  /** good = you scored (bright arpeggio); otherwise a deflated "bonk". */
  playScore(good = true) {
    const t = this.now();
    if (t === null) return;
    if (good) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 'triangle', t + i * 0.07, 0.22, 0.2));
      this.noise(t + 0.2, 0.35, 0.08, { filter: 'highpass', freq: 6000 });
    } else {
      this.tone(330, 'square', t, 0.12, 0.08, { endFreq: 300, lowpass: 1200 });
      this.tone(247, 'square', t + 0.12, 0.28, 0.08, { endFreq: 196, lowpass: 900 });
      this.tone(90, 'sine', t, 0.18, 0.25, { endFreq: 50 });
    }
  }

  playCountdownTick() {
    const t = this.now();
    if (t === null) return;
    this.tone(660, 'sine', t, 0.09, 0.2);
    this.noise(t, 0.015, 0.08, { filter: 'highpass', freq: 5000 });
  }

  playCountdownGo() {
    const t = this.now();
    if (t === null) return;
    [1046.5, 1318.5, 1568].forEach((f) => this.tone(f, 'square', t, 0.3, 0.06, { lowpass: 3000 }));
    this.tone(1046.5, 'triangle', t, 0.3, 0.2);
    this.noise(t, 0.25, 0.1, { filter: 'bandpass', freq: 800, endFreq: 5000, q: 0.8 });
  }

  playWin() {
    const t = this.now();
    if (t === null) return;
    const melody = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const timing = [0, 0.12, 0.24, 0.36, 0.6, 0.72];
    melody.forEach((f, i) => this.tone(f, 'square', t + timing[i], i === melody.length - 1 ? 0.8 : 0.14, 0.09, { lowpass: 3500 }));
    melody.forEach((f, i) => this.tone(f, 'triangle', t + timing[i], i === melody.length - 1 ? 0.8 : 0.14, 0.16));
    [261.63, 329.63, 392].forEach((f) => this.tone(f, 'triangle', t + 0.72, 0.9, 0.08));
    this.tone(130.81, 'sine', t + 0.72, 0.9, 0.25);
  }

  /** The classic sad trombone. */
  playLose() {
    const t = this.now();
    if (t === null) return;
    const notes = [233.08, 220.0, 207.65, 196.0];
    notes.forEach((f, i) => {
      const last = i === notes.length - 1;
      this.tone(f, 'sawtooth', t + i * 0.36, last ? 0.9 : 0.32, 0.1, {
        lowpass: 1100,
        vibrato: last ? 6 : 0,
        endFreq: last ? f * 0.97 : undefined,
      });
    });
  }

  /** Air-rush when the ball first hits top speed in a rally. */
  playWhoosh() {
    const t = this.now();
    if (t === null) return;
    this.noise(t, 0.4, 0.22, { filter: 'bandpass', freq: 400, endFreq: 4200, q: 1.5 });
  }

  /** Sparkle for rally milestones and match point. */
  playRallyMilestone() {
    const t = this.now();
    if (t === null) return;
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => this.tone(f, 'sine', t + i * 0.045, 0.18, 0.12));
  }

  /** Soft UI tick for menu buttons. */
  playClick() {
    const t = this.now();
    if (t === null) return;
    this.tone(880, 'sine', t, 0.05, 0.08, { endFreq: 1100 });
  }

  // ─── Music ────────────────────────────────────────────────────────────────

  startMusic() {
    this.ensureContext();
    if (!this.ctx || !this.musicBus) return;
    if (this.musicStopTimer) {
      clearTimeout(this.musicStopTimer);
      this.musicStopTimer = null;
    }
    this.fadeMusicTo(this.musicLevel(), 0.8);
    if (this.musicTimer) return;

    this.step = 0;
    this.loopCount = 0;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduleMusic(), LOOKAHEAD_MS);
  }

  stopMusic() {
    if (!this.musicTimer || !this.ctx) return;
    this.fadeMusicTo(0, 0.4);
    if (this.musicStopTimer) clearTimeout(this.musicStopTimer);
    this.musicStopTimer = setTimeout(() => {
      if (this.musicTimer) clearInterval(this.musicTimer);
      this.musicTimer = null;
      this.musicStopTimer = null;
    }, 450);
  }

  /** Lower the music during countdowns so the beeps cut through. */
  duckMusic(on: boolean) {
    if (!this.ctx || !this.duckBus) return;
    const t = this.ctx.currentTime;
    this.duckBus.gain.cancelScheduledValues(t);
    this.duckBus.gain.setTargetAtTime(on ? 0.4 : 1, t, 0.08);
  }

  private scheduleMusic() {
    if (!this.ctx) return;
    while (this.nextStepTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      this.playStep(this.step, this.nextStepTime);
      this.nextStepTime += STEP_SECONDS;
      this.step = (this.step + 1) % 64;
      if (this.step === 0) this.loopCount += 1;
    }
  }

  private playStep(step: number, t: number) {
    const bar = Math.floor(step / 16);
    const beat = step % 16;
    const chord = CHORDS[bar];
    const out = this.duckBus ?? undefined;

    // Drums
    if (beat === 0 || beat === 8 || beat === 10) {
      this.tone(120, 'sine', t, 0.16, 0.55, { endFreq: 42, dest: out });
    }
    if (beat === 4 || beat === 12) {
      this.noise(t, 0.12, 0.22, { filter: 'bandpass', freq: 1800, q: 0.7, dest: out });
      this.tone(190, 'triangle', t, 0.06, 0.12, { endFreq: 140, dest: out });
    }
    if (beat % 2 === 0) {
      this.noise(t, beat === 14 ? 0.12 : 0.03, beat % 4 === 2 ? 0.07 : 0.04, { filter: 'highpass', freq: 7500, dest: out });
    }

    // Bass
    if ([0, 3, 6, 8, 11, 14].includes(beat)) {
      const octave = beat === 6 || beat === 14 ? 2 : 1;
      this.tone(chord.bass * octave, 'triangle', t, STEP_SECONDS * 1.6, 0.32, { dest: out });
      this.tone(chord.bass * octave, 'square', t, STEP_SECONDS * 1.2, 0.05, { lowpass: 500, dest: out });
    }

    // Off-beat chord stabs
    if (beat === 2 || beat === 6 || beat === 10 || beat === 14) {
      chord.notes.forEach((f) => this.tone(f, 'square', t, STEP_SECONDS * 1.1, 0.022, { lowpass: 1800, dest: out }));
    }

    // Bell arpeggio on every other pass through the loop, for variety
    if (this.loopCount % 2 === 1 && beat % 2 === 0) {
      const note = chord.notes[(beat / 2) % 3] * 2;
      this.tone(note, 'sine', t, STEP_SECONDS * 1.8, 0.05, { dest: out });
    }
  }

  // ─── Building blocks ──────────────────────────────────────────────────────

  private now(): number | null {
    this.ensureContext();
    if (!this.ctx || !this.sfxBus || this.ctx.state !== 'running') return null;
    return this.ctx.currentTime;
  }

  private tone(
    freq: number,
    type: Wave,
    start: number,
    duration: number,
    volume: number,
    opts: { endFreq?: number; lowpass?: number; vibrato?: number; dest?: AudioNode } = {},
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), start + duration);

    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = opts.vibrato;
      depth.gain.value = freq * 0.03;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(start);
      lfo.stop(start + duration + 0.05);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    let node: AudioNode = osc;
    if (opts.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = opts.lowpass;
      node.connect(filter);
      node = filter;
    }
    node.connect(gain).connect(opts.dest ?? this.sfxBus!);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noise(
    start: number,
    duration: number,
    volume: number,
    opts: { filter: BiquadFilterType; freq: number; endFreq?: number; q?: number; dest?: AudioNode },
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter;
    filter.frequency.setValueAtTime(opts.freq, start);
    if (opts.endFreq) filter.frequency.exponentialRampToValueAtTime(opts.endFreq, start + duration);
    filter.Q.value = opts.q ?? 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(gain).connect(opts.dest ?? this.sfxBus!);
    src.start(start, Math.random() * 0.5);
    src.stop(start + duration + 0.02);
  }

  private ensureContext() {
    if (this.ctx) return;
    try {
      const ctx = new AudioContext();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.ratio.value = 4;
      compressor.connect(ctx.destination);

      this.master = ctx.createGain();
      this.master.connect(compressor);

      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0;
      this.musicBus.connect(this.master);
      this.duckBus = ctx.createGain();
      this.duckBus.connect(this.musicBus);

      // One second of white noise, reused by every percussive sound.
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;

      this.ctx = ctx;
      this.applyVolumes();
    } catch {
      // Web Audio not supported — all calls will be no-ops
    }
  }

  private musicLevel() {
    return MUSIC_BASE_LEVEL * getSettings().musicVolume;
  }

  private applyVolumes() {
    if (!this.ctx || !this.master || !this.sfxBus) return;
    const settings = getSettings();
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(SFX_BASE_LEVEL * settings.sfxVolume, t, 0.02);
    if (this.musicTimer && !this.musicStopTimer) this.fadeMusicTo(this.musicLevel(), 0.05);
  }

  private fadeMusicTo(level: number, seconds: number) {
    if (!this.ctx || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t);
    this.musicBus.gain.linearRampToValueAtTime(level, t + seconds);
  }
}

function cents(value: number) {
  return Math.pow(2, value / 1200);
}

export const audioManager = new AudioManager();
