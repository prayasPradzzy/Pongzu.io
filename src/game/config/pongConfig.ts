export const PONG_CONFIG = {
  arenaPadding: 28,
  winningScore: 9,
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