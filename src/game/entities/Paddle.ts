import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';

/**
 * Purely visual: position comes from PongSimulation or server snapshots.
 * Drawn as vector graphics so it stays crisp at any screen density.
 */
export class Paddle {
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
    this.scene = scene;
    const w = PONG_CONFIG.paddle.width;
    const h = PONG_CONFIG.paddle.height;

    this.glow = scene.add.graphics();
    this.glow.fillStyle(color, 0.18);
    this.glow.fillRoundedRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, (h + 16) / 2);
    this.glow.setDepth(4);

    this.body = scene.add.graphics();
    this.body.fillStyle(color, 1);
    this.body.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    this.body.fillStyle(0xffffff, 0.35);
    this.body.fillRoundedRect(-w / 2 + 10, -h / 2 + 4, w - 20, 5, 2.5);
    this.body.lineStyle(2, 0xffffff, 0.9);
    this.body.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    this.body.setDepth(5);

    this.setPosition(x, y);
  }

  getX() {
    return this.body.x;
  }

  setPosition(x: number, y: number) {
    this.body.setPosition(x, y);
    this.glow.setPosition(x, y);
  }

  /** Squash on impact; harder hits squash more. */
  playImpactFeedback(intensity = 0.5) {
    this.scene.tweens.killTweensOf([this.body, this.glow]);
    this.body.setScale(1);
    this.glow.setScale(1).setAlpha(1);
    const squash = 0.04 + intensity * 0.08;
    this.scene.tweens.add({
      targets: this.body,
      scaleX: 1 + squash,
      scaleY: 1 - squash * 1.5,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
    this.scene.tweens.add({
      targets: this.glow,
      scaleX: 1.15,
      scaleY: 1.6,
      alpha: 0.4,
      duration: 160,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  destroy() {
    this.scene.tweens.killTweensOf([this.body, this.glow]);
    this.body.destroy();
    this.glow.destroy();
  }
}
