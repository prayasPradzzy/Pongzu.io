import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../utils/sceneSetup';

/** The static arena art shared by every match scene. */
export class ArenaBackdrop {
  private readonly layers: Phaser.GameObjects.Graphics[] = [];

  constructor(scene: Phaser.Scene) {
    scene.cameras.main.setBackgroundColor(PONG_CONFIG.colors.background);

    const width = ARENA_WIDTH;
    const height = ARENA_HEIGHT;
    const { chalk, net } = PONG_CONFIG.colors;
    const pad = PONG_CONFIG.arenaPadding;

    const lines = scene.add.graphics();
    lines.setDepth(0);
    this.layers.push(lines);

    // Centre line runs the length of the table, end to end.
    lines.fillStyle(chalk, 0.85);
    lines.fillRect(width / 2 - 1.5, pad, 3, height - pad * 2);

    // Net across the middle: navy band with a chalk tape, as seen from above.
    lines.fillStyle(net, 1);
    lines.fillRect(pad, height / 2 - 6, width - pad * 2, 12);
    lines.fillStyle(chalk, 1);
    lines.fillRect(pad, height / 2 - 1.5, width - pad * 2, 3);

    // Chalk edge of the table.
    lines.lineStyle(5, chalk, 1);
    lines.strokeRoundedRect(pad, pad, width - pad * 2, height - pad * 2, 8);
  }

  destroy() {
    this.layers.forEach((layer) => layer.destroy());
  }
}
