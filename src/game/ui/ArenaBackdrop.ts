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
    const hex = (value: string) => Phaser.Display.Color.HexStringToColor(value).color;
    const add = () => {
      const g = scene.add.graphics();
      g.setDepth(0);
      this.layers.push(g);
      return g;
    };

    // Vertical gradient (same colour across each row, so no diagonal seam).
    const arena = add();
    arena.fillGradientStyle(
      hex(PONG_CONFIG.colors.arenaTop),
      hex(PONG_CONFIG.colors.arenaTop),
      hex(PONG_CONFIG.colors.arenaBottom),
      hex(PONG_CONFIG.colors.arenaBottom),
      1,
    );
    arena.fillRect(0, 0, width, height);

    // Soft tinted halves: the opponent's side is lilac, yours is pink.
    const halves = add();
    halves.fillStyle(PONG_CONFIG.colors.paddleTop, 0.05);
    halves.fillRect(0, 0, width, height / 2);
    halves.fillStyle(PONG_CONFIG.colors.paddleBottom, 0.05);
    halves.fillRect(0, height / 2, width, height / 2);

    // Polka dots for a playful texture
    const dots = add();
    dots.fillStyle(0xffffff, 0.55);
    for (let y = 40; y < height; y += 56) {
      for (let x = (y / 56) % 2 === 0 ? 28 : 56; x < width; x += 56) {
        dots.fillCircle(x, y, 2.2);
      }
    }

    // Frame
    const pad = PONG_CONFIG.arenaPadding;
    const frame = add();
    frame.lineStyle(4, PONG_CONFIG.colors.frame, 0.9);
    frame.strokeRoundedRect(pad, pad, width - pad * 2, height - pad * 2, 30);
    frame.lineStyle(2, 0xffffff, 0.9);
    frame.strokeRoundedRect(pad + 6, pad + 6, width - (pad + 6) * 2, height - (pad + 6) * 2, 24);

    // Centre line + circle
    frame.lineStyle(3, PONG_CONFIG.colors.frame, 0.45);
    for (let x = pad + 20; x < width - pad - 20; x += 30) {
      frame.lineBetween(x, height / 2, x + 16, height / 2);
    }
    frame.strokeCircle(width / 2, height / 2, 70);
  }

  destroy() {
    this.layers.forEach((layer) => layer.destroy());
  }
}
