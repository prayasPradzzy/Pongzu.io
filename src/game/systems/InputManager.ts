import Phaser from 'phaser';

type HorizontalDirection = -1 | 0 | 1;

export class InputManager {
  private readonly bottomLeft: Phaser.Input.Keyboard.Key;
  private readonly bottomRight: Phaser.Input.Keyboard.Key;

  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const keyboard = scene.input.keyboard;

    if (!keyboard) {
      throw new Error('Keyboard input is required for Face Pong.');
    }

    this.bottomLeft = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.bottomRight = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  getBottomDirection() {
    return this.readDirection(this.bottomLeft.isDown, this.bottomRight.isDown);
  }

  getPointerX(): number | null {
    const pointer = this.scene.input.activePointer;
    if (pointer && pointer.isDown) {
      return pointer.x;
    }
    return null;
  }

  private readDirection(leftPressed: boolean, rightPressed: boolean): HorizontalDirection {
    if (leftPressed === rightPressed) {
      return 0;
    }

    return leftPressed ? -1 : 1;
  }
}