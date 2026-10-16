import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';

/** The static arena art shared by the CPU and online scenes. */
export class ArenaBackdrop {
  private readonly arena: Phaser.GameObjects.Graphics;
  private readonly vignette: Phaser.GameObjects.Graphics;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly sparkles: Phaser.GameObjects.Graphics;
  private readonly clouds: Phaser.GameObjects.Graphics;
  private readonly petals: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    scene.cameras.main.setBackgroundColor(PONG_CONFIG.colors.background);
    this.arena = scene.add.graphics();
    this.vignette = scene.add.graphics();
    this.frame = scene.add.graphics();
    this.sparkles = scene.add.graphics();
    this.clouds = scene.add.graphics();
    this.petals = scene.add.graphics();
  }

  draw(width: number, height: number) {
    const hex = (value: string) => Phaser.Display.Color.HexStringToColor(value).color;

    this.arena.clear();
    this.arena.fillGradientStyle(
      hex(PONG_CONFIG.colors.arenaTop),
      hex(PONG_CONFIG.colors.arenaTop),
      hex(PONG_CONFIG.colors.arenaMid),
      hex(PONG_CONFIG.colors.arenaBottom),
      1,
    );
    this.arena.fillRoundedRect(0, 0, width, height, 36);

    this.vignette.clear();
    this.vignette.fillStyle(0xffffff, 0.08);
    this.vignette.fillRoundedRect(12, 12, width - 24, height - 24, 28);

    const pad = PONG_CONFIG.arenaPadding;
    this.frame.clear();
    this.frame.lineStyle(2, PONG_CONFIG.colors.frame, 0.8);
    this.frame.strokeRoundedRect(pad, pad, width - pad * 2, height - pad * 2, 28);
    this.frame.lineStyle(1, PONG_CONFIG.colors.cyan, 0.18);
    this.frame.strokeRoundedRect(pad + 10, pad + 10, width - (pad + 10) * 2, height - (pad + 10) * 2, 22);
    // Centre line
    this.frame.lineStyle(2, PONG_CONFIG.colors.frame, 0.28);
    for (let x = pad + 24; x < width - pad - 24; x += 28) {
      this.frame.lineBetween(x, height / 2, x + 14, height / 2);
    }

    this.sparkles.clear();
    this.sparkles.fillStyle(0xffffff, 1);
    const sparkleCount = Math.max(16, Math.floor((width * height) / 180000));
    for (let i = 0; i < sparkleCount; i += 1) {
      this.sparkles.fillCircle(
        Phaser.Math.Between(40, width - 40),
        Phaser.Math.Between(56, height - 56),
        Phaser.Math.Between(1, 3),
      );
    }
    this.sparkles.setAlpha(0.12);

    this.clouds.clear();
    this.clouds.fillStyle(0xffffff, 0.08);
    const cloudY = height * 0.18;
    this.clouds.fillEllipse(width * 0.18, cloudY, 160, 42);
    this.clouds.fillEllipse(width * 0.27, cloudY + 16, 220, 52);
    this.clouds.fillEllipse(width * 0.76, cloudY + 6, 180, 44);
    this.clouds.fillEllipse(width * 0.68, cloudY + 22, 240, 56);

    this.petals.clear();
    this.petals.fillStyle(0xffb7e1, 0.11);
    this.petals.fillEllipse(width * 0.1, height * 0.78, 18, 8);
    this.petals.fillEllipse(width * 0.82, height * 0.22, 20, 9);
    this.petals.fillEllipse(width * 0.42, height * 0.14, 16, 7);
    this.petals.fillEllipse(width * 0.58, height * 0.85, 18, 8);
  }

  destroy() {
    this.arena.destroy();
    this.vignette.destroy();
    this.frame.destroy();
    this.sparkles.destroy();
    this.clouds.destroy();
    this.petals.destroy();
  }
}
