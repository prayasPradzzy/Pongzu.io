import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';

const PADDLE_TEXTURE_KEY = 'pong-paddle';

/** Purely visual: position comes from PongSimulation or server snapshots. */
export class Paddle {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number, tint: number) {
    this.scene = scene;
    this.ensureTexture();

    this.sprite = this.scene.add.image(x, y, PADDLE_TEXTURE_KEY);
    this.sprite.setTint(tint);
    this.sprite.setAlpha(0.98);
  }

  getX() {
    return this.sprite.x;
  }

  setPosition(x: number, y: number) {
    this.sprite.setPosition(x, y);
  }

  playImpactFeedback() {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(1);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.06,
      scaleY: 0.95,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
  }

  private ensureTexture() {
    if (this.scene.textures.exists(PADDLE_TEXTURE_KEY)) {
      return;
    }

    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0xffffff, 0.18);
    graphics.fillRoundedRect(0, 0, PONG_CONFIG.paddle.width, PONG_CONFIG.paddle.height, 10);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRoundedRect(2, 2, PONG_CONFIG.paddle.width - 4, PONG_CONFIG.paddle.height - 4, 8);
    graphics.fillStyle(0xffffff, 0.22);
    graphics.fillRoundedRect(8, 3, PONG_CONFIG.paddle.width - 16, 4, 4);
    graphics.generateTexture(PADDLE_TEXTURE_KEY, PONG_CONFIG.paddle.width, PONG_CONFIG.paddle.height);
    graphics.destroy();
  }
}
