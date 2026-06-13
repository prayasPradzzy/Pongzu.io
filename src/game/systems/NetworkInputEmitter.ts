import type { SocketService } from '../../features/multiplayer/SocketService';
import type { InputUpdatePayload } from '../../../server/src/protocol/events';

type HorizontalDirection = -1 | 0 | 1;

/** Reads keyboard input and emits to server, throttled to max 60/s */
export class NetworkInputEmitter {
  private seq = 0;
  private lastDirection: HorizontalDirection = 0;
  private lastEmitTime = 0;
  private readonly leftKey: Phaser.Input.Keyboard.Key;
  private readonly rightKey: Phaser.Input.Keyboard.Key;
  private readonly socketService: SocketService;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, socketService: SocketService) {
    this.scene = scene;
    this.socketService = socketService;

    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input required.');

    this.leftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.rightKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  update(currentPaddleX: number) {
    const left = this.leftKey.isDown;
    const right = this.rightKey.isDown;
    const pointer = this.scene.input.activePointer;

    let direction: HorizontalDirection = 0;
    if (left && !right) direction = -1;
    else if (right && !left) direction = 1;
    else if (pointer && pointer.isDown) {
      const diff = pointer.x - currentPaddleX;
      if (Math.abs(diff) > 4) {
        direction = Math.sign(diff) as HorizontalDirection;
      }
    }

    // Only emit on direction change (direction-change driven) or at most 60Hz
    const now = Date.now();
    const changed = direction !== this.lastDirection;
    const rateLimitOk = now - this.lastEmitTime >= 16;

    if (changed || rateLimitOk) {
      this.lastDirection = direction;
      this.lastEmitTime = now;
      this.seq++;

      const payload: InputUpdatePayload = { direction, seq: this.seq };
      this.socketService.sendInput(payload);
    }
  }

  getDirection(): HorizontalDirection {
    return this.lastDirection;
  }

  getLastSeq(): number {
    return this.seq;
  }
}
