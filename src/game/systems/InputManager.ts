import Phaser from 'phaser';

import type { PaddleControl } from './PongSimulation';

/**
 * Reads the local player's intent.
 *   Keyboard: A / D or ← / →
 *   Touch / mouse: hold and the paddle glides to the pointer
 */
export class InputManager {
  private readonly leftKeys: Phaser.Input.Keyboard.Key[] = [];
  private readonly rightKeys: Phaser.Input.Keyboard.Key[] = [];
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Touch-only devices may have no keyboard plugin — that's fine.
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      const { KeyCodes } = Phaser.Input.Keyboard;
      this.leftKeys.push(keyboard.addKey(KeyCodes.A), keyboard.addKey(KeyCodes.LEFT));
      this.rightKeys.push(keyboard.addKey(KeyCodes.D), keyboard.addKey(KeyCodes.RIGHT));
    }
  }

  getControl(): PaddleControl {
    const left = this.leftKeys.some((key) => key.isDown);
    const right = this.rightKeys.some((key) => key.isDown);

    if (left !== right) {
      return { direction: left ? -1 : 1, targetX: null, speedScale: 1 };
    }

    const pointer = this.scene.input.activePointer;
    if (pointer && pointer.isDown) {
      return { direction: 0, targetX: pointer.x, speedScale: 1 };
    }

    return { direction: 0, targetX: null, speedScale: 1 };
  }
}
