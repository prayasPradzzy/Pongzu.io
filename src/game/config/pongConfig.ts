export type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare';

export type DifficultyPreset = {
  label: string;
  /** ms the CPU needs to "see" your shot before it starts moving to intercept. */
  reactionDelay: number;
  /** CPU paddle speed as a fraction of the player's paddle speed. */
  speedMultiplier: number;
  /** Max px the CPU misjudges where the ball will land. */
  aimError: number;
  /** 0–1: how far off-centre the CPU tries to hit, to send the ball at an angle. */
  aggression: number;
};

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: { label: 'Easy', reactionDelay: 320, speedMultiplier: 0.55, aimError: 64, aggression: 0 },
  medium: { label: 'Medium', reactionDelay: 220, speedMultiplier: 0.72, aimError: 40, aggression: 0.25 },
  hard: { label: 'Hard', reactionDelay: 140, speedMultiplier: 0.88, aimError: 22, aggression: 0.45 },
  nightmare: { label: 'Nightmare', reactionDelay: 90, speedMultiplier: 0.96, aimError: 12, aggression: 0.6 },
};

// Gameplay numbers are mirrored in server/src/game/ServerBallSimulator.ts —
// change both together or online and CPU matches will feel different.
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
    radius: 18,
    initialSpeed: 500,
    speedBoost: 32,
    boostEveryHits: 2,
    maxSpeed: 1040,
    // How much of the bounce angle comes from where the ball meets the paddle.
    impactInfluence: 0.72,
    // Extra angle added when the paddle is moving at impact ("spin").
    spinInfluence: 0.16,
    maxXRatio: 0.82,
  },
  countdownSeconds: 3,
  pointPauseMs: 1200,
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
