import { PONG_CONFIG } from '../config/pongConfig';
import type { PaddleSide, StateSnapshot } from '../../protocol/events';

const BUFFER_SIZE = 30;
// Render this far behind the newest data so there are (almost) always two
// snapshots to blend between, even when packets arrive unevenly.
const RENDER_DELAY_MS = 60;
// If data stops arriving, keep the ball moving on its last heading this long.
const MAX_EXTRAPOLATION_MS = 90;
// The furthest ahead of the newest snapshot the ball is ever predicted. Beyond
// this a guess is too likely to be wrong to be worth drawing.
const MAX_PREDICTION_MS = 260;
const PREDICTION_STEP_MS = 4;
// How quickly a wrong prediction is blended away instead of snapping.
const CORRECTION_TIME_MS = 70;
// A jump this big between snapshots is a reset, not movement — don't blend it.
const TELEPORT_DISTANCE = 160;

/**
 * Smooths server snapshots for rendering.
 *
 * Snapshots are placed on the server's own timeline (their timestamp), not on
 * arrival time, so network jitter doesn't turn into ball stutter.
 */
export class ReconciliationBuffer {
  private buffer: StateSnapshot[] = [];
  /** Estimated (local clock − server clock), including one-way latency. */
  private clockOffset: number | null = null;

  // Last drawn ball, for blending away prediction errors.
  private drawn: { x: number; y: number; at: number } | null = null;

  push(snapshot: StateSnapshot) {
    const last = this.buffer[this.buffer.length - 1];
    if (last && snapshot.seq <= last.seq) return; // stale or duplicate

    const sample = performance.now() - snapshot.timestamp;
    if (this.clockOffset === null || sample < this.clockOffset) {
      // The fastest packet we've seen is the best estimate of the true offset.
      this.clockOffset = sample;
    } else {
      // Drift up slowly so one lucky packet doesn't pin the estimate forever.
      this.clockOffset += (sample - this.clockOffset) * 0.02;
    }

    this.buffer.push(snapshot);
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  /** The newest raw snapshot — authoritative state without render delay. */
  getLatest(): StateSnapshot | null {
    return this.buffer[this.buffer.length - 1] ?? null;
  }

  /** State to draw this frame, or null if nothing has arrived yet. */
  getInterpolatedState(): StateSnapshot | null {
    const count = this.buffer.length;
    if (count === 0 || this.clockOffset === null) return null;

    const renderTime = performance.now() - this.clockOffset - RENDER_DELAY_MS;
    const newest = this.buffer[count - 1];

    if (renderTime >= newest.timestamp) {
      return extrapolate(newest, Math.min(renderTime - newest.timestamp, MAX_EXTRAPOLATION_MS));
    }

    for (let i = count - 2; i >= 0; i--) {
      const older = this.buffer[i];
      if (older.timestamp <= renderTime) {
        return blend(older, this.buffer[i + 1], renderTime);
      }
    }

    return this.buffer[0];
  }

  /**
   * The ball to draw for the local player, on a timeline that slides with its
   * position so both paddles look right:
   *
   *   Near the opponent it is drawn slightly in the past, matching their
   *   (also delayed) paddle, so it visibly meets what hit it.
   *
   *   Near the local player it is predicted ahead by a full round trip. Input
   *   sent now reaches the server one trip from now, so this is the position
   *   the server will test the paddle against: what you see is what counts.
   *
   * The slide stretches over the whole table, so it only reads as the ball
   * speeding up a little on the way to you and slowing a little on the way out.
   */
  getBallView(mySide: PaddleSide, leadMs: number, paddleX: number, paddleDirection: number): StateSnapshot | null {
    const count = this.buffer.length;
    if (count === 0 || this.clockOffset === null) return null;

    const newest = this.buffer[count - 1];
    const now = performance.now();

    const topY = PONG_CONFIG.paddle.topOffset;
    const bottomY = PONG_CONFIG.arena.height - PONG_CONFIG.paddle.bottomOffset;
    const lastY = this.drawn?.y ?? newest.ball.y;
    const towardsBottom = Math.max(0, Math.min(1, (lastY - topY) / (bottomY - topY)));
    const closeness = mySide === 'bottom' ? towardsBottom : 1 - towardsBottom;
    const offsetMs = lerp(-RENDER_DELAY_MS, leadMs, closeness);

    const renderTime = now - this.clockOffset + offsetMs;
    const target =
      renderTime > newest.timestamp
        ? predictBall(newest, Math.min(renderTime - newest.timestamp, MAX_PREDICTION_MS), mySide, paddleX, paddleDirection)
        : this.sampleAt(renderTime);

    return { ...newest, ball: this.smoothBall(target.ball, now) };
  }

  /** Drop buffered positions (e.g. the ball was reset) but keep the clock estimate. */
  clear() {
    this.buffer = [];
    this.drawn = null;
  }

  private sampleAt(renderTime: number): StateSnapshot {
    for (let i = this.buffer.length - 2; i >= 0; i--) {
      const older = this.buffer[i];
      if (older.timestamp <= renderTime) return blend(older, this.buffer[i + 1], renderTime);
    }
    return this.buffer[0];
  }

  /** When new data disagrees with where the ball was heading, ease over the gap. */
  private smoothBall(target: StateSnapshot['ball'], now: number): StateSnapshot['ball'] {
    let x = target.x;
    let y = target.y;
    if (this.drawn) {
      const elapsedMs = Math.min(now - this.drawn.at, 100);
      const dt = elapsedMs / 1000;
      // Compare heading-to-heading: a legitimate bounce isn't an error.
      const gapX = this.drawn.x + target.vx * dt - target.x;
      const gapY = this.drawn.y + target.vy * dt - target.y;
      if (Math.abs(gapX) <= TELEPORT_DISTANCE && Math.abs(gapY) <= TELEPORT_DISTANCE) {
        const keep = Math.exp(-elapsedMs / CORRECTION_TIME_MS);
        x += gapX * keep;
        y += gapY * keep;
      }
    }
    this.drawn = { x, y, at: now };
    return { ...target, x, y };
  }
}

function blend(older: StateSnapshot, newer: StateSnapshot, renderTime: number): StateSnapshot {
  const span = newer.timestamp - older.timestamp;
  const t = span > 0 ? Math.max(0, Math.min(1, (renderTime - older.timestamp) / span)) : 1;

  const teleported =
    Math.abs(newer.ball.x - older.ball.x) > TELEPORT_DISTANCE ||
    Math.abs(newer.ball.y - older.ball.y) > TELEPORT_DISTANCE;

  return {
    ...newer,
    ball: teleported
      ? newer.ball
      : {
          x: lerp(older.ball.x, newer.ball.x, t),
          y: lerp(older.ball.y, newer.ball.y, t),
          // Velocity of the segment being drawn, so bounce effects fire when
          // the ball visibly turns rather than when the packet arrived.
          vx: older.ball.vx,
          vy: older.ball.vy,
        },
    hostPaddleX: lerp(older.hostPaddleX, newer.hostPaddleX, t),
    guestPaddleX: lerp(older.guestPaddleX, newer.guestPaddleX, t),
  };
}

function extrapolate(snapshot: StateSnapshot, aheadMs: number): StateSnapshot {
  if (snapshot.state !== 'playing' || aheadMs <= 0) return snapshot;

  const dt = aheadMs / 1000;
  const radius = PONG_CONFIG.ball.radius;
  const left = PONG_CONFIG.arenaPadding + radius;
  const right = PONG_CONFIG.arena.width - PONG_CONFIG.arenaPadding - radius;

  return {
    ...snapshot,
    ball: {
      ...snapshot.ball,
      x: Math.max(left, Math.min(right, snapshot.ball.x + snapshot.ball.vx * dt)),
      y: snapshot.ball.y + snapshot.ball.vy * dt,
    },
  };
}

/**
 * Runs the ball forward from a snapshot with the server's rules: side walls, plus
 * the local paddle at its current position. The opponent's paddle isn't simulated
 * because the ball is only predicted on the local player's side of the table.
 */
function predictBall(
  snapshot: StateSnapshot,
  aheadMs: number,
  mySide: PaddleSide,
  paddleX: number,
  paddleDirection: number,
): StateSnapshot {
  if (snapshot.state !== 'playing' || aheadMs <= 0) return snapshot;

  const { radius, impactInfluence, spinInfluence, maxXRatio } = PONG_CONFIG.ball;
  const { width: paddleWidth, height: paddleHeight, topOffset, bottomOffset } = PONG_CONFIG.paddle;
  const left = PONG_CONFIG.arenaPadding + radius;
  const right = PONG_CONFIG.arena.width - PONG_CONFIG.arenaPadding - radius;
  const contactY =
    mySide === 'bottom'
      ? PONG_CONFIG.arena.height - bottomOffset - paddleHeight / 2 - radius
      : topOffset + paddleHeight / 2 + radius;
  const slabDepth = radius + paddleHeight;
  const reach = paddleWidth / 2 + radius;

  let { x, y, vx, vy } = snapshot.ball;
  for (let elapsed = 0; elapsed < aheadMs; elapsed += PREDICTION_STEP_MS) {
    const dt = Math.min(PREDICTION_STEP_MS, aheadMs - elapsed) / 1000;
    x += vx * dt;
    y += vy * dt;

    if (x < left) {
      x = left + (left - x);
      vx = Math.abs(vx);
    } else if (x > right) {
      x = right - (x - right);
      vx = -Math.abs(vx);
    }

    const incoming = mySide === 'bottom' ? vy > 0 : vy < 0;
    const pastContact = mySide === 'bottom' ? y - contactY : contactY - y;
    if (incoming && pastContact >= 0 && pastContact <= slabDepth && Math.abs(x - paddleX) <= reach) {
      const speed = Math.hypot(vx, vy);
      const impact = Math.max(-1, Math.min(1, (x - paddleX) / (paddleWidth / 2)));
      const xRatio = Math.max(-maxXRatio, Math.min(maxXRatio, impact * impactInfluence + paddleDirection * spinInfluence));
      const yRatio = Math.sqrt(1 - xRatio * xRatio);
      y = contactY;
      vx = xRatio * speed;
      vy = (mySide === 'bottom' ? -1 : 1) * yRatio * speed;
    }
  }

  return { ...snapshot, ball: { x, y, vx, vy } };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
