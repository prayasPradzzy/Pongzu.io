import type { Difficulty } from '../../game/config/pongConfig';

export type SavedStats = {
  wins: number;
  losses: number;
  matchesPlayed: number;
  longestRally: number;
  /** Highest ball speed reached, in km/h as shown in game. */
  topSpeed: number;
  highestDifficultyBeaten: string;
  onlineWins: number;
};

const STORAGE_KEY = 'facepong-stats';
const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'nightmare'];

const EMPTY: SavedStats = {
  wins: 0,
  losses: 0,
  matchesPlayed: 0,
  longestRally: 0,
  topSpeed: 0,
  highestDifficultyBeaten: '',
  onlineWins: 0,
};

export function loadStats(): SavedStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<SavedStats>) };
  } catch {
    // storage unavailable or corrupted
  }
  return { ...EMPTY };
}

/** Records a finished CPU (difficulty set) or online (difficulty null) match. */
export function recordMatch(
  won: boolean,
  match: { longestRally: number; topSpeed: number; difficulty: Difficulty | null },
) {
  const saved = loadStats();
  saved.matchesPlayed += 1;
  if (won) {
    saved.wins += 1;
    if (match.difficulty) {
      const beaten = DIFFICULTY_ORDER.indexOf(match.difficulty);
      if (beaten > DIFFICULTY_ORDER.indexOf(saved.highestDifficultyBeaten as Difficulty)) {
        saved.highestDifficultyBeaten = match.difficulty;
      }
    } else {
      saved.onlineWins += 1;
    }
  } else {
    saved.losses += 1;
  }
  saved.longestRally = Math.max(saved.longestRally, match.longestRally);
  saved.topSpeed = Math.max(saved.topSpeed, match.topSpeed);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // not persisted
  }
}

/** Ball speed in px/s → a fun "km/h" figure for the HUD. */
export function toKmh(pixelsPerSecond: number): number {
  return Math.round(pixelsPerSecond * 0.18);
}
