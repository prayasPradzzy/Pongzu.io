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

    const { wood, chalk, paddleTop } = PONG_CONFIG.colors;

    this.glow = scene.add.graphics();
    this.glow.fillStyle(chalk, 0.14);
    this.glow.fillRoundedRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, (h + 16) / 2);
    this.glow.setDepth(4);

    this.body = scene.add.graphics();

    // Wooden handle points away from the net, towards the player holding it.
    const awayFromNet = y < PONG_CONFIG.arena.height / 2 ? -1 : 1;
    this.body.fillStyle(wood, 1);
    this.body.fillRoundedRect(-9, awayFromNet < 0 ? -h / 2 - 14 : h / 2 - 2, 18, 16, 4);

    this.body.fillStyle(color, 1);
    this.body.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);

    // Rubber pimples, the same texture as the menu's red buttons.
    this.body.fillStyle(color === paddleTop ? 0xffffff : 0x000000, color === paddleTop ? 0.12 : 0.18);
    for (let py = -h / 2 + 5; py < h / 2 - 2; py += 5) {
      for (let px = -w / 2 + 8; px < w / 2 - 6; px += 5) {
        this.body.fillCircle(px, py, 1.1);
      }
    }

    this.body.lineStyle(3, wood, 1);
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
