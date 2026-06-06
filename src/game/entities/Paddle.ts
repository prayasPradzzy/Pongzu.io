import Phaser from 'phaser';

import { PONG_CONFIG, type PaddleSide } from '../config/pongConfig';

const PADDLE_TEXTURE_KEY = 'pong-paddle';

export class Paddle {
  private readonly sprite: Phaser.Physics.Arcade.Image;
  private readonly scene: Phaser.Scene;
  private readonly side: PaddleSide;

  constructor(
    scene: Phaser.Scene,
    side: PaddleSide,
    x: number,
    y: number,
    tint: number,
  ) {
    this.scene = scene;
    this.side = side;
    this.ensureTexture();

    this.sprite = this.scene.physics.add.image(x, y, PADDLE_TEXTURE_KEY);
    this.sprite.setTint(tint);
    this.sprite.setImmovable(true);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setBounce(0);
    this.sprite.setDragX(0);
    this.sprite.setMaxVelocity(PONG_CONFIG.paddle.speed, 0);
    this.sprite.setAlpha(0.98);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setSize(PONG_CONFIG.paddle.width, PONG_CONFIG.paddle.height, true);
  }

  getSprite() {
    return this.sprite;
  }

  getSide() {
    return this.side;
  }

  getX() {
    return this.sprite.x;
  }

  getWidth() {
    return this.sprite.displayWidth;
  }

  setHorizontalVelocity(direction: number) {
    this.sprite.setVelocityX(direction * PONG_CONFIG.paddle.speed);
  }

  clampToBounds(width: number) {
    const halfWidth = this.sprite.displayWidth / 2;
    const leftLimit = PONG_CONFIG.arenaPadding + halfWidth;
    const rightLimit = width - PONG_CONFIG.arenaPadding - halfWidth;
    const clampedX = Phaser.Math.Clamp(this.sprite.x, leftLimit, rightLimit);

    this.sprite.setX(clampedX);
  }

  setPosition(x: number, y: number) {
    this.sprite.setPosition(x, y);
  }

  playImpactFeedback() {
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.06,
      scaleY: 0.95,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
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