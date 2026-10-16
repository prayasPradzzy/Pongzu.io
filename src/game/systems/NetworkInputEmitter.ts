import { socketService as socketServiceInstance } from '../../features/multiplayer/SocketService';
import type { PaddleControl } from './PongSimulation';

type SocketServiceType = typeof socketServiceInstance;

// Resend the current input this often even if nothing changed, so a dropped
// packet can't leave the server believing a stale direction.
const KEEPALIVE_MS = 100;
// A dragged finger changes target every frame; cap how often that is sent.
const TARGET_INTERVAL_MS = 33;

/** Forwards the local player's paddle control to the server. */
export class NetworkInputEmitter {
  private seq = 0;
  private lastDirection = 0;
  private lastTargetX: number | null = null;
  private lastEmitTime = 0;
  private readonly socketService: SocketServiceType;

  constructor(socketService: SocketServiceType) {
    this.socketService = socketService;
  }

  send(control: PaddleControl) {
    const now = performance.now();
    const sinceLast = now - this.lastEmitTime;

    const modeChanged =
      control.direction !== this.lastDirection || (control.targetX === null) !== (this.lastTargetX === null);
    const targetMoved =
      control.targetX !== null && this.lastTargetX !== null && Math.abs(control.targetX - this.lastTargetX) >= 1;

    if (!modeChanged && !(targetMoved && sinceLast >= TARGET_INTERVAL_MS) && sinceLast < KEEPALIVE_MS) {
      return;
    }

    this.lastDirection = control.direction;
    this.lastTargetX = control.targetX;
    this.lastEmitTime = now;
    this.seq++;

    this.socketService.sendInput({
      direction: control.direction as -1 | 0 | 1,
      targetX: control.targetX === null ? null : Math.round(control.targetX),
      seq: this.seq,
    });
  }

  /** Tell the server we've let go (round over, overlay shown, …). */
  release() {
    if (this.lastDirection === 0 && this.lastTargetX === null) return;
    this.send({ direction: 0, targetX: null, speedScale: 1 });
  }
}
