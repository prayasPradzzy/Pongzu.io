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
  easy: { label: 'Easy', reactionDelay: 340, speedMultiplier: 0.5, aimError: 60, aggression: 0 },
  medium: { label: 'Medium', reactionDelay: 250, speedMultiplier: 0.6, aimError: 44, aggression: 0.25 },
  hard: { label: 'Hard', reactionDelay: 190, speedMultiplier: 0.72, aimError: 30, aggression: 0.45 },
  nightmare: { label: 'Nightmare', reactionDelay: 140, speedMultiplier: 0.82, aimError: 20, aggression: 0.6 },
};

// Gameplay numbers are mirrored in server/src/game/ServerBallSimulator.ts —
// change both together or online and CPU matches will feel different.
export const PONG_CONFIG = {
  // Tall, phone-shaped arena (logical pixels). The server uses the same size.
  arena: { width: 600, height: 1000 },
  arenaPadding: 24,
  winningScore: 7,
  paddle: {
    width: 120,
    height: 20,
    speed: 760,
    topOffset: 92,
    bottomOffset: 92,
  },
  ball: {
    radius: 20,
    initialSpeed: 880,
    speedBoost: 60,
    boostEveryHits: 2,
    maxSpeed: 1800,
    // How much of the bounce angle comes from where the ball meets the paddle.
    impactInfluence: 0.72,
    // Extra angle added when the paddle is moving at impact ("spin").
    spinInfluence: 0.16,
    maxXRatio: 0.82,
  },
  countdownSeconds: 3,
  pointPauseMs: 1200,
  colors: {
    background: '#F3EAFF',
    arenaTop: '#F4EBFF',
    arenaMid: '#F1E4FF',
    arenaBottom: '#FDE8F5',
    frame: 0xa98bff,
    glow: 0xffd6ec,
    ball: 0xffffff,
    ballOutline: 0x6a4be0,
    paddleTop: 0x7c5cff,
    paddleBottom: 0xff4fa3,
    text: '#5B3FD6',
    mutedText: '#8F78E8',
    flash: 0xffffff,
    cyan: 0xb9a4ff,
    pink: 0xff6fb5,
    hot: 0xff5a5a,
  },
} as const;

export type PaddleSide = 'top' | 'bottom';
export type ServeDirection = 'up' | 'down';
