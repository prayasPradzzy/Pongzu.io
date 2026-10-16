import { PONG_CONFIG } from '../config/pongConfig';
import type { StateSnapshot } from '../../protocol/events';

const BUFFER_SIZE = 30;
// Render this far behind the newest data so there are (almost) always two
// snapshots to blend between, even when packets arrive unevenly.
const RENDER_DELAY_MS = 60;
// If data stops arriving, keep the ball moving on its last heading this long.
const MAX_EXTRAPOLATION_MS = 90;
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

  /** Drop buffered positions (e.g. the ball was reset) but keep the clock estimate. */
  clear() {
    this.buffer = [];
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
  const right = 800 - PONG_CONFIG.arenaPadding - radius;

  return {
    ...snapshot,
    ball: {
      ...snapshot.ball,
      x: Math.max(left, Math.min(right, snapshot.ball.x + snapshot.ball.vx * dt)),
      y: snapshot.ball.y + snapshot.ball.vy * dt,
    },
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
