import { PONG_CONFIG, type PaddleSide, type ServeDirection } from '../config/pongConfig';

/**
 * Framework-free Pong physics used by CPU matches, and by online matches to
 * predict the local paddle. It mirrors the server's Room/ServerBallSimulator
 * so both modes play identically.
 */

/** How a paddle wants to move this frame. */
export type PaddleControl = {
  /** Keyboard: -1 left, 0 still, 1 right. */
  direction: number;
  /** Touch/mouse/AI: x to glide towards. Takes priority over direction. */
  targetX: number | null;
  /** Fraction of full paddle speed (CPU difficulty). */
  speedScale: number;
};

export type SimEvent =
  | { type: 'wall'; x: number; y: number }
  | { type: 'paddle'; side: PaddleSide; x: number; y: number }
  | { type: 'score'; side: PaddleSide };

export const IDLE_CONTROL: PaddleControl = { direction: 0, targetX: null, speedScale: 1 };

// Physics advances in small fixed slices so the result doesn't depend on the
// display's frame rate and a fast ball can't skip through a paddle.
const SUBSTEP_MS = 4;
const MAX_FRAME_MS = 100;

/** Moves a paddle one step. Returns the new x and the direction it actually moved. */
export function advancePaddle(
  x: number,
  control: PaddleControl,
  stepMs: number,
  arenaWidth: number,
): { x: number; moved: number } {
  const halfWidth = PONG_CONFIG.paddle.width / 2;
  const leftLimit = PONG_CONFIG.arenaPadding + halfWidth;
  const rightLimit = arenaWidth - PONG_CONFIG.arenaPadding - halfWidth;
  const maxStep = PONG_CONFIG.paddle.speed * control.speedScale * (stepMs / 1000);

  const wanted =
    control.targetX !== null
      ? Math.max(-maxStep, Math.min(maxStep, control.targetX - x))
      : control.direction * maxStep;
  const next = Math.max(leftLimit, Math.min(rightLimit, x + wanted));
  const delta = next - x;

  return { x: next, moved: Math.abs(delta) > 0.01 ? Math.sign(delta) : 0 };
}

export class PongSimulation {
  readonly width: number;
  readonly height: number;

  ball = { x: 0, y: 0, vx: 0, vy: 0 };
  topPaddleX: number;
  bottomPaddleX: number;

  private speed: number = PONG_CONFIG.ball.initialSpeed;
  private topMoved = 0;
  private bottomMoved = 0;
  private ballInPlay = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.topPaddleX = width / 2;
    this.bottomPaddleX = width / 2;
    this.resetBall();
  }

  get isBallInPlay() {
    return this.ballInPlay;
  }

  resetBall() {
    this.ball.x = this.width / 2;
    this.ball.y = this.height / 2;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ballInPlay = false;
  }

  centerPaddles() {
    this.topPaddleX = this.width / 2;
    this.bottomPaddleX = this.width / 2;
  }

  serve(direction: ServeDirection, speed: number) {
    this.resetBall();
    this.speed = speed;
    const xRatio = Math.random() * 0.64 - 0.32;
    const yRatio = Math.sqrt(1 - xRatio * xRatio);
    this.ball.vx = xRatio * speed;
    this.ball.vy = (direction === 'down' ? 1 : -1) * yRatio * speed;
    this.ballInPlay = true;
  }

  /** Ball speed after the next paddle hit (set by the score manager's rally boost). */
  setSpeed(speed: number) {
    this.speed = speed;
  }

  /**
   * Advance the world. Paddles always move; the ball only moves while in play.
   * onPaddleHit lets the caller raise the ball speed before the bounce is applied.
   */
  step(
    deltaMs: number,
    top: PaddleControl,
    bottom: PaddleControl,
    onPaddleHit?: (side: PaddleSide) => number,
  ): SimEvent[] {
    const events: SimEvent[] = [];
    let remaining = Math.min(deltaMs, MAX_FRAME_MS);

    while (remaining > 0) {
      const stepMs = Math.min(remaining, SUBSTEP_MS);
      remaining -= stepMs;

      const topResult = advancePaddle(this.topPaddleX, top, stepMs, this.width);
      this.topPaddleX = topResult.x;
      this.topMoved = topResult.moved;

      const bottomResult = advancePaddle(this.bottomPaddleX, bottom, stepMs, this.width);
      this.bottomPaddleX = bottomResult.x;
      this.bottomMoved = bottomResult.moved;

      if (this.ballInPlay) {
        this.stepBall(stepMs, events, onPaddleHit);
      }
    }

    return events;
  }

  private stepBall(stepMs: number, events: SimEvent[], onPaddleHit?: (side: PaddleSide) => number) {
    const dt = stepMs / 1000;
    const ball = this.ball;
    const radius = PONG_CONFIG.ball.radius;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Side walls — reflect, keeping the distance travelled past the wall.
    const leftWall = PONG_CONFIG.arenaPadding + radius;
    const rightWall = this.width - PONG_CONFIG.arenaPadding - radius;
    if (ball.x < leftWall) {
      ball.x = leftWall + (leftWall - ball.x);
      ball.vx = Math.abs(ball.vx);
      events.push({ type: 'wall', x: ball.x, y: ball.y });
    } else if (ball.x > rightWall) {
      ball.x = rightWall - (ball.x - rightWall);
      ball.vx = -Math.abs(ball.vx);
      events.push({ type: 'wall', x: ball.x, y: ball.y });
    }

    // Paddles
    const topY = PONG_CONFIG.paddle.topOffset;
    const bottomY = this.height - PONG_CONFIG.paddle.bottomOffset;
    const halfHeight = PONG_CONFIG.paddle.height / 2;
    const reach = PONG_CONFIG.paddle.width / 2 + radius;

    if (
      ball.vy < 0 &&
      ball.y - radius <= topY + halfHeight &&
      ball.y >= topY - halfHeight &&
      Math.abs(ball.x - this.topPaddleX) <= reach
    ) {
      ball.y = topY + halfHeight + radius;
      if (onPaddleHit) this.speed = onPaddleHit('top');
      this.bounce(this.topPaddleX, 'top', this.topMoved);
      events.push({ type: 'paddle', side: 'top', x: ball.x, y: ball.y });
    } else if (
      ball.vy > 0 &&
      ball.y + radius >= bottomY - halfHeight &&
      ball.y <= bottomY + halfHeight &&
      Math.abs(ball.x - this.bottomPaddleX) <= reach
    ) {
      ball.y = bottomY - halfHeight - radius;
      if (onPaddleHit) this.speed = onPaddleHit('bottom');
      this.bounce(this.bottomPaddleX, 'bottom', this.bottomMoved);
      events.push({ type: 'paddle', side: 'bottom', x: ball.x, y: ball.y });
    }

    // Out of bounds — the opposite side scores.
    if (ball.y < -radius) {
      this.ballInPlay = false;
      events.push({ type: 'score', side: 'bottom' });
    } else if (ball.y > this.height + radius) {
      this.ballInPlay = false;
      events.push({ type: 'score', side: 'top' });
    }
  }

  private bounce(paddleX: number, side: PaddleSide, paddleMoved: number) {
    const { impactInfluence, spinInfluence, maxXRatio } = PONG_CONFIG.ball;
    const impactOffset = Math.max(-1, Math.min(1, (this.ball.x - paddleX) / (PONG_CONFIG.paddle.width / 2)));
    const xRatio = Math.max(
      -maxXRatio,
      Math.min(maxXRatio, impactOffset * impactInfluence + paddleMoved * spinInfluence),
    );
    const yRatio = Math.sqrt(1 - xRatio * xRatio);

    this.ball.vx = xRatio * this.speed;
    this.ball.vy = (side === 'top' ? 1 : -1) * yRatio * this.speed;
  }
}
