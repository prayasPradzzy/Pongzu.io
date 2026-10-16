import type { ServeDirection, PaddleSide } from '../protocol/events.js';

// Mirror of pongConfig.ts — no Phaser import possible on server
export const SERVER_PONG_CONFIG = {
  // Tall, phone-shaped arena. Must match PONG_CONFIG.arena on the client.
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
  pointPauseMs: 1200,
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

  /** Mirror of Ball.serve() */
  serve(direction: ServeDirection) {
    const xRatio = Math.random() * 0.64 - 0.32; // range [-0.32, 0.32]
    const yRatio = Math.sqrt(1 - xRatio * xRatio);
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
    const leftWall = SERVER_PONG_CONFIG.arenaPadding + radius;
    const rightWall = this.width - SERVER_PONG_CONFIG.arenaPadding - radius;

    // Reflect off the side walls, keeping the distance travelled past the wall.
    if (this.x < leftWall) {
      this.x = leftWall + (leftWall - this.x);
      this.vx = Math.abs(this.vx);
    } else if (this.x > rightWall) {
      this.x = rightWall - (this.x - rightWall);
      this.vx = -Math.abs(this.vx);
    }
  }

  /**
   * Mirror of Ball.bounceFromPaddle().
   * paddleDirection is the paddle's movement at impact (-1, 0, 1) and adds spin.
   */
  bounceFromPaddle(paddleX: number, paddleWidth: number, side: PaddleSide, paddleDirection: number): void {
    const { impactInfluence, spinInfluence, maxXRatio } = SERVER_PONG_CONFIG.ball;
    const raw = (this.x - paddleX) / (paddleWidth / 2);
    const impactOffset = Math.max(-1, Math.min(1, raw));
    const xRatio = Math.max(
      -maxXRatio,
      Math.min(maxXRatio, impactOffset * impactInfluence + paddleDirection * spinInfluence),
    );
    const yRatio = Math.sqrt(1 - xRatio * xRatio);
    const yDirection = side === 'top' ? 1 : -1;

    this.vx = xRatio * this.speed;
    this.vy = yDirection * yRatio * this.speed;
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  /** Returns the scoring side if ball is out of bounds, or null */
  checkOutOfBounds(): PaddleSide | null {
    const radius = SERVER_PONG_CONFIG.ball.radius;
    if (this.y < -radius) return 'bottom'; // ball exited top → bottom player scores
    if (this.y > this.height + radius) return 'top'; // ball exited bottom → top player scores
    return null;
  }

  getState() {
    return { x: round1(this.x), y: round1(this.y), vx: round1(this.vx), vy: round1(this.vy) };
  }
}

/** One decimal place is plenty for rendering and keeps snapshots small. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
