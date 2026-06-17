import type { StateSnapshot } from './events';

const BUFFER_SIZE = 8;
const RENDER_DELAY_MS = 50; // render 50ms behind to always have 2 snapshots

type BufferedSnapshot = StateSnapshot & { receivedAt: number };

export class ReconciliationBuffer {
  private buffer: BufferedSnapshot[] = [];
  private serverTimeOffset = 0;

  setServerTimeOffset(offset: number) {
    this.serverTimeOffset = offset;
  }

  push(snapshot: StateSnapshot) {
    const entry: BufferedSnapshot = { ...snapshot, receivedAt: Date.now() };
    this.buffer.push(entry);
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  /**
   * Returns interpolated state for the current render moment.
   * Returns null if not enough data yet.
   */
  getInterpolatedState(): StateSnapshot | null {
    if (this.buffer.length < 2) {
      return this.buffer[0] ?? null;
    }

    const renderTime = Date.now() - this.serverTimeOffset - RENDER_DELAY_MS;

    // Find the two snapshots that straddle renderTime
    let older: BufferedSnapshot | null = null;
    let newer: BufferedSnapshot | null = null;

    for (let i = 0; i < this.buffer.length - 1; i++) {
      const a = this.buffer[i];
      const b = this.buffer[i + 1];
      if (a.receivedAt <= renderTime && b.receivedAt >= renderTime) {
        older = a;
        newer = b;
        break;
      }
    }

    // If render time is past all snapshots, use latest
    if (!older || !newer) {
      return this.buffer[this.buffer.length - 1];
    }

    const span = newer.receivedAt - older.receivedAt;
    const alpha = span > 0 ? (renderTime - older.receivedAt) / span : 1;
    const t = Math.max(0, Math.min(1, alpha));

    return {
      seq: newer.seq,
      timestamp: newer.timestamp,
      lastAckedInputSeq: newer.lastAckedInputSeq,
      ball: {
        x: lerp(older.ball.x, newer.ball.x, t),
        y: lerp(older.ball.y, newer.ball.y, t),
        vx: newer.ball.vx,
        vy: newer.ball.vy,
      },
      hostPaddleX: lerp(older.hostPaddleX, newer.hostPaddleX, t),
      guestPaddleX: lerp(older.guestPaddleX, newer.guestPaddleX, t),
    };
  }

  clear() {
    this.buffer = [];
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
