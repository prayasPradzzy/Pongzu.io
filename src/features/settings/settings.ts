import { useSyncExternalStore } from 'react';

export type MatchLength = 5 | 7 | 11;

export type Settings = {
  /** 0–1 */
  musicVolume: number;
  /** 0–1 */
  sfxVolume: number;
  muted: boolean;
  /** Turns off screen shake, flashes and confetti. */
  reduceMotion: boolean;
  /** Points to win a CPU or same-device match. Online matches are always first to 7. */
  matchLength: MatchLength;
};

const STORAGE_KEY = 'pongzu-settings';
const LEGACY_MUTE_KEY = 'pongzu-audio-muted';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function load(): Settings {
  const defaults: Settings = {
    musicVolume: 0.5,
    sfxVolume: 0.8,
    muted: false,
    reduceMotion: prefersReducedMotion(),
    matchLength: 7,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Settings>;
      return {
        musicVolume: clamp01(saved.musicVolume, defaults.musicVolume),
        sfxVolume: clamp01(saved.sfxVolume, defaults.sfxVolume),
        muted: typeof saved.muted === 'boolean' ? saved.muted : defaults.muted,
        reduceMotion: typeof saved.reduceMotion === 'boolean' ? saved.reduceMotion : defaults.reduceMotion,
        matchLength: saved.matchLength === 5 || saved.matchLength === 11 ? saved.matchLength : 7,
      };
    }
    // Carry over the mute toggle from before settings existed.
    defaults.muted = localStorage.getItem(LEGACY_MUTE_KEY) === 'true';
  } catch {
    // storage unavailable — use defaults
  }
  return defaults;
}

function clamp01(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

let current: Settings = load();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // not persisted, still applied for this session
  }
  listeners.forEach((listener) => listener());
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook: re-renders when any setting changes. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}
