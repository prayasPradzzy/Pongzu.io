import Phaser from 'phaser';

import { PONG_CONFIG, type ServeDirection } from '../config/pongConfig';
import type { Paddle } from './Paddle';

const BALL_TEXTURE_KEY = 'pong-ball';

export class Ball {
  private readonly sprite: Phaser.Physics.Arcade.Image;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.ensureTexture();

    // Use face-ball texture if it exists — BootScene creates it from either
    // local player's face or opponent's face, so both clients see the same ball.
    const useFaceBall = this.scene.textures.exists('face-ball');
    const textureKey = useFaceBall ? 'face-ball' : BALL_TEXTURE_KEY;

    this.sprite = this.scene.physics.add.image(x, y, textureKey);

    if (useFaceBall) {
      // Face-ball texture is 128×128. Display it at ball diameter so visual
      // matches collision. setCircle must account for the texture→display scale
      // so the physics body is centered on the rendered sprite.
      const diameter = PONG_CONFIG.ball.radius * 2;
      this.sprite.setDisplaySize(diameter, diameter);
      const texSize = 128; // BootScene creates face-ball at this size
      const bodyOffset = (texSize - diameter) / 2;
      this.sprite.setCircle(PONG_CONFIG.ball.radius, bodyOffset, bodyOffset);
    } else {
      // Default texture is exactly diameter×diameter — no offset needed
      this.sprite.setCircle(PONG_CONFIG.ball.radius);
    }

    this.sprite.setOrigin(0.5);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setBounce(1, 1);
    this.sprite.setDrag(0, 0);
    this.sprite.setDamping(false);
    this.sprite.setAlpha(0.98);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
  }

  getSprite() {
    return this.sprite;
  }

  getX() {
    return this.sprite.x;
  }

  getY() {
    return this.sprite.y;
  }

  getRadius() {
    return PONG_CONFIG.ball.radius;
  }

  reset(x: number, y: number) {
    this.sprite.setPosition(x, y);
    this.sprite.setVelocity(0, 0);
    this.sprite.setAcceleration(0, 0);
    this.sprite.setAngle(0);
    this.sprite.setAlpha(1);
    this.sprite.setVisible(true);
  }

  serve(direction: ServeDirection, speed: number) {
    const xRatio = Phaser.Math.FloatBetween(-0.32, 0.32);
    const yRatio = Math.sqrt(Math.max(0.1, 1 - xRatio * xRatio));
    const yDirection = direction === 'down' ? 1 : -1;

    this.setVelocityFromVector(xRatio * speed, yDirection * yRatio * speed);
  }

  bounceFromPaddle(paddle: Paddle, speed: number) {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const paddleHalfWidth = paddle.getWidth() / 2;
    const impactOffset = Phaser.Math.Clamp((this.sprite.x - paddle.getX()) / paddleHalfWidth, -1, 1);
    const xRatio = Phaser.Math.Clamp(impactOffset * 0.72, -0.78, 0.78);
    const yRatio = Math.sqrt(Math.max(0.18, 1 - xRatio * xRatio));
    const yDirection = paddle.getSide() === 'top' ? 1 : -1;

    body.setVelocity(xRatio * speed, yDirection * yRatio * speed);
    this.playHitStretch(impactOffset);
  }

  maintainSpeed(speed: number) {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const lengthSquared = vx * vx + vy * vy;

    if (lengthSquared < 0.0001) {
      return;
    }

    const scale = speed / Math.sqrt(lengthSquared);
    body.setVelocity(vx * scale, vy * scale);
  }

  isOutOfBounds(height: number) {
    const radius = this.getRadius();
    return this.sprite.y < -radius || this.sprite.y > height + radius;
  }

  setPosition(x: number, y: number) {
    this.sprite.setPosition(x, y);
  }

  private setVelocityFromVector(x: number, y: number) {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(x, y);
  }

  private playHitStretch(impactOffset: number) {
    const squashX = 1.14 - Math.abs(impactOffset) * 0.05;
    const squashY = 0.86 + Math.abs(impactOffset) * 0.03;

    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: squashX,
      scaleY: squashY,
      duration: 80,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  private ensureTexture() {
    if (this.scene.textures.exists(BALL_TEXTURE_KEY)) {
      return;
    }

    const r = PONG_CONFIG.ball.radius;
    const diameter = r * 2;
    const graphics = this.scene.add.graphics();

    // All circles drawn within the diameter×diameter canvas so the visual
    // exactly matches the physics body. No glow halo extends beyond bounds.
    graphics.fillStyle(PONG_CONFIG.colors.pink, 0.14);
    graphics.fillCircle(r, r, r);           // outer glow — clamped to radius
    graphics.fillStyle(PONG_CONFIG.colors.cyan, 0.12);
    graphics.fillCircle(r, r, r - 1);
    graphics.fillStyle(PONG_CONFIG.colors.ball, 1);
    graphics.fillCircle(r, r, r - 2);
    graphics.fillStyle(0xfff7fd, 0.95);
    graphics.fillCircle(r - 3, r - 4, r - 7); // highlight
    graphics.generateTexture(BALL_TEXTURE_KEY, diameter, diameter);
    graphics.destroy();
  }
}