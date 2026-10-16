import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';

const BALL_TEXTURE_KEY = 'pong-ball';
const FACE_TEXTURE_KEY = 'face-ball';

/**
 * Purely visual: position comes from PongSimulation (CPU) or server snapshots
 * (online), never from a physics body.
 */
export class Ball {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;
  private readonly baseScale: number;
  private readonly isFace: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.ensureTexture();

    // BootScene builds 'face-ball' from the local player's face (or the
    // opponent's if the local player has none).
    this.isFace = this.scene.textures.exists(FACE_TEXTURE_KEY);
    this.sprite = this.scene.add.image(x, y, this.isFace ? FACE_TEXTURE_KEY : BALL_TEXTURE_KEY);
    this.sprite.setOrigin(0.5);

    const diameter = PONG_CONFIG.ball.radius * 2;
    this.sprite.setDisplaySize(diameter, diameter);
    this.baseScale = this.sprite.scaleX;
  }

  getX() {
    return this.sprite.x;
  }

  getY() {
    return this.sprite.y;
  }

  setVisible(visible: boolean) {
    this.sprite.setVisible(visible);
  }

  setPosition(x: number, y: number) {
    this.sprite.setPosition(x, y);
  }

  /** Face balls tumble as they fly — sideways speed sets the spin. */
  roll(vx: number, deltaMs: number) {
    if (!this.isFace) return;
    this.sprite.rotation += (vx / PONG_CONFIG.ball.radius) * (deltaMs / 1000) * 0.35;
  }

  resetRotation() {
    this.sprite.setRotation(0);
  }

  playHitStretch() {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(this.baseScale);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.baseScale * 1.14,
      scaleY: this.baseScale * 0.88,
      duration: 80,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
  }

  private ensureTexture() {
    if (this.scene.textures.exists(BALL_TEXTURE_KEY)) {
      return;
    }

    const r = PONG_CONFIG.ball.radius;
    const diameter = r * 2;
    const graphics = this.scene.add.graphics();

    // Everything stays inside the diameter so what you see is what collides.
    graphics.fillStyle(PONG_CONFIG.colors.pink, 0.14);
    graphics.fillCircle(r, r, r);
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
