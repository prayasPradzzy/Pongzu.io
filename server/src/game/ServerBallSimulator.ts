import type { ServeDirection, PaddleSide } from '../protocol/events.js';

// Mirror of pongConfig.ts — no Phaser import possible on server
export const SERVER_PONG_CONFIG = {
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
  pointPauseMs: 700,
  countdownMs: 500, // ms per countdown tick
} as const;

export class ServerBallSimulator {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;

  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.x = width / 2;
    this.y = height / 2;
    this.vx = 0;
    this.vy = 0;
    this.speed = SERVER_PONG_CONFIG.ball.initialSpeed;
  }

  reset() {
    this.x = this.width / 2;
    this.y = this.height / 2;
    this.vx = 0;
    this.vy = 0;
  }

  /** Mirror of Ball.serve() — uses seeded random for determinism */
  serve(direction: ServeDirection, seed: number) {
    // Deterministic "random" from seed — same formula, different RNG
    const xRatio = (((seed % 1000) / 1000) * 0.64) - 0.32; // range [-0.32, 0.32]
    const yRatio = Math.sqrt(Math.max(0.1, 1 - xRatio * xRatio));
    const yDirection = direction === 'down' ? 1 : -1;
    this.vx = xRatio * this.speed;
    this.vy = yDirection * yRatio * this.speed;
  }

  /** Advance simulation by deltaMs milliseconds */
  step(deltaMs: number): void {
    const dt = deltaMs / 1000;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const radius = SERVER_PONG_CONFIG.ball.radius;
    const leftWall = radius;
    const rightWall = this.width - radius;

    // Horizontal wall bounces
    if (this.x <= leftWall) {
      this.x = leftWall;
      this.vx = Math.abs(this.vx);
    } else if (this.x >= rightWall) {
      this.x = rightWall;
      this.vx = -Math.abs(this.vx);
    }

    // Maintain speed after wall bounce (mirror of Ball.maintainSpeed)
    this.maintainSpeed();
  }

  /** Mirror of Ball.bounceFromPaddle() */
  bounceFromPaddle(paddleX: number, paddleWidth: number, side: PaddleSide): void {
    const paddleHalfWidth = paddleWidth / 2;
    const raw = (this.x - paddleX) / paddleHalfWidth;
    const impactOffset = Math.max(-1, Math.min(1, raw));
    const xRatio = Math.max(-0.78, Math.min(0.78, impactOffset * 0.72));
    const yRatio = Math.sqrt(Math.max(0.18, 1 - xRatio * xRatio));
    const yDirection = side === 'top' ? 1 : -1;

    this.vx = xRatio * this.speed;
    this.vy = yDirection * yRatio * this.speed;
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.maintainSpeed();
  }

  /** Returns the scoring side if ball is out of bounds, or null */
  checkOutOfBounds(): PaddleSide | null {
    const radius = SERVER_PONG_CONFIG.ball.radius;
    if (this.y < -radius) return 'bottom'; // ball exited top → bottom player scores
    if (this.y > this.height + radius) return 'top'; // ball exited bottom → top player scores
    return null;
  }

  getState() {
    return { x: this.x, y: this.y, vx: this.vx, vy: this.vy };
  }

  private maintainSpeed() {
    const lengthSq = this.vx * this.vx + this.vy * this.vy;
    if (lengthSq < 0.0001) return;
    const scale = this.speed / Math.sqrt(lengthSq);
    this.vx *= scale;
    this.vy *= scale;
  }
}
