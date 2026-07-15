/**
 * AudioManager — Procedural SFX via Web Audio API
 *
 * All sounds are generated with oscillators and gain envelopes.
 * No external audio files are loaded. Mute state persists in localStorage.
 */

const STORAGE_KEY = 'pongzu-audio-muted';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private _muted: boolean;
  private masterGain: GainNode | null = null;
  private bgmOsc: OscillatorNode | null = null;
  private bgmGain: GainNode | null = null;

  /** Listeners notified when mute state changes */
  private listeners: Array<(muted: boolean) => void> = [];

  constructor() {
    this._muted = this.loadMuteState();
  }

  get muted(): boolean {
    return this._muted;
  }

  /** Must be called from a user gesture (click/tap) to unlock AudioContext */
  ensureContext() {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Web Audio not supported — all calls will be no-ops
    }
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    this.saveMuteState();
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : 1;
    }
    this.listeners.forEach((cb) => cb(this._muted));
    return this._muted;
  }

  onMuteChange(cb: (muted: boolean) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  // ─── Sound effects ────────────────────────────────────────────────────────

  /** Short bright pop — paddle hit */
  playPaddleHit() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Softer thud — wall bounce */
  playWallBounce() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.06);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /** Rising chime — point scored */
  playScore() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + i * 0.08;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain).connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  /** Click — countdown tick (3, 2, 1) */
  playCountdownTick() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /** Bright ping — countdown "GO" */
  playCountdownGo() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1047, now); // C6
    osc.frequency.exponentialRampToValueAtTime(1319, now + 0.06); // E6
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Ascending arpeggio — victory */
  playWin() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + i * 0.1;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain).connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  /** Descending tone — defeat */
  playLose() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const notes = [523, 440, 349, 262]; // C5 A4 F4 C4
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + i * 0.12;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  // ─── Background Music ─────────────────────────────────────────────────────

  playBGM() {
    this.ensureContext();
    if (!this.ctx || !this.masterGain || this.bgmOsc) return;

    this.bgmOsc = this.ctx.createOscillator();
    this.bgmGain = this.ctx.createGain();

    // Deep synth drone
    this.bgmOsc.type = 'sawtooth';
    this.bgmOsc.frequency.setValueAtTime(65.41, this.ctx.currentTime); // C2

    // Apply low-pass filter to make it a deep hum
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, this.ctx.currentTime);

    this.bgmGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.bgmGain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 2); // Fade in

    this.bgmOsc.connect(filter);
    filter.connect(this.bgmGain);
    this.bgmGain.connect(this.masterGain);

    this.bgmOsc.start();
  }

  stopBGM() {
    if (!this.ctx || !this.bgmOsc || !this.bgmGain) return;

    // Fade out
    this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, this.ctx.currentTime);
    this.bgmGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);

    this.bgmOsc.stop(this.ctx.currentTime + 1);

    // Clean up references after fade
    setTimeout(() => {
      this.bgmOsc = null;
      this.bgmGain = null;
    }, 1100);
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private loadMuteState(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private saveMuteState() {
    try {
      localStorage.setItem(STORAGE_KEY, String(this._muted));
    } catch {
      // localStorage not available — no-op
    }
  }
}

/** Singleton — shared across all scenes */
export const audioManager = new AudioManager();
