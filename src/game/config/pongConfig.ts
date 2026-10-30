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
  fonts: {
    display: '"Bagel Fat One", "Arial Rounded MT Bold", system-ui, sans-serif',
    body: 'Figtree, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  // Rec-room table tennis; mirrors the tokens at the top of src/index.css.
  colors: {
    background: '#1F5FAE',
    courtDeep: 0x174a88,
    chalk: 0xfbfaf7,
    net: 0x14213d,
    wood: 0xd4a66a,
    ball: 0xff9a1f,
    ballEdge: 0xd97c12,
    paddleTop: 0x1a1a1a,
    paddleBottom: 0xe0313f,
    text: '#FBFAF7',
    mutedText: '#DDE6F2',
    accentText: '#FF9A1F',
    strokeText: '#14213D',
    glow: 0xfbfaf7,
    flash: 0xffffff,
    hot: 0xe0313f,
  },
} as const;

export type PaddleSide = 'top' | 'bottom';
export type ServeDirection = 'up' | 'down';
