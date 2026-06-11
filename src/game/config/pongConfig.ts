export type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare';

export type DifficultyPreset = {
  label: string;
  reactionDelay: number;
  speedMultiplier: number;
  accuracy: number;
};

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: { label: 'Easy', reactionDelay: 350, speedMultiplier: 0.7, accuracy: 0.7 },
  medium: { label: 'Medium', reactionDelay: 180, speedMultiplier: 0.9, accuracy: 0.85 },
  hard: { label: 'Hard', reactionDelay: 80, speedMultiplier: 1.0, accuracy: 0.95 },
  nightmare: { label: 'Nightmare', reactionDelay: 0, speedMultiplier: 1.15, accuracy: 1.0 },
};

export const PONG_CONFIG = {
  arenaPadding: 28,
  winningScore: 7,
  paddle: {
    width: 132,
    height: 18,
    speed: 720,
    topOffset: 56,
    bottomOffset: 56,
  },
  ball: {
    radius: 14,
    initialSpeed: 500,
    speedBoost: 32,
    boostEveryHits: 4,
    maxSpeed: 980,
  },
  countdownSeconds: 3,
  pointPauseMs: 700,
  colors: {
    background: '#F8F1FF',
    arenaTop: '#F5E8FF',
    arenaMid: '#EFD9FF',
    arenaBottom: '#FDEBFF',
    frame: 0xc8b6ff,
    glow: 0xffffff,
    ball: 0xffffff,
    paddleTop: 0xc8b6ff,
    paddleBottom: 0xffb7e1,
    text: '#7B5CE6',
    mutedText: '#9A84E8',
    flash: 0xffffff,
    cyan: 0xc8b6ff,
    pink: 0xff8dc7,
  },
} as const;

export type PaddleSide = 'top' | 'bottom';
export type ServeDirection = 'up' | 'down';