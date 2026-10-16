import Phaser from 'phaser';

import type { PaddleControl } from './PongSimulation';
import { ARENA_HEIGHT, pointerToArena } from '../utils/sceneSetup';

export type InputScheme = {
  /** Which keys move this paddle. */
  keys: 'all' | 'arrows' | 'wasd';
  /** Which part of the screen this player's finger/mouse controls. */
  region: 'any' | 'top' | 'bottom';
};

/** Single player: any key, anywhere on screen. */
export const SOLO_INPUT: InputScheme = { keys: 'all', region: 'any' };

/**
 * Reads one player's intent.
 *   Keyboard: A / D and/or ← / →
 *   Touch / mouse: hold and the paddle glides to the pointer
 */
export class InputManager {
  private readonly leftKeys: Phaser.Input.Keyboard.Key[] = [];
  private readonly rightKeys: Phaser.Input.Keyboard.Key[] = [];
  private readonly scene: Phaser.Scene;
  private readonly scheme: InputScheme;

  constructor(scene: Phaser.Scene, scheme: InputScheme = SOLO_INPUT) {
    this.scene = scene;
    this.scheme = scheme;

    // Touch-only devices may have no keyboard plugin — that's fine.
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      const { KeyCodes } = Phaser.Input.Keyboard;
      if (scheme.keys !== 'arrows') {
        this.leftKeys.push(keyboard.addKey(KeyCodes.A));
        this.rightKeys.push(keyboard.addKey(KeyCodes.D));
      }
      if (scheme.keys !== 'wasd') {
        this.leftKeys.push(keyboard.addKey(KeyCodes.LEFT));
        this.rightKeys.push(keyboard.addKey(KeyCodes.RIGHT));
      }
    }
  }

  getControl(): PaddleControl {
    const left = this.leftKeys.some((key) => key.isDown);
    const right = this.rightKeys.some((key) => key.isDown);

    if (left !== right) {
      return { direction: left ? -1 : 1, targetX: null, speedScale: 1 };
    }

    for (const pointer of this.scene.input.manager.pointers) {
      if (!pointer.isDown) continue;
      const { x, y } = pointerToArena(this.scene, pointer);
      if (this.scheme.region === 'top' && y >= ARENA_HEIGHT / 2) continue;
      if (this.scheme.region === 'bottom' && y < ARENA_HEIGHT / 2) continue;
      return { direction: 0, targetX: x, speedScale: 1 };
    }

    return { direction: 0, targetX: null, speedScale: 1 };
  }
}
