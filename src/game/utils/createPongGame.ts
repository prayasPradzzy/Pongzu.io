import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';
import { BootScene } from '../scenes/BootScene';
import { PongScene } from '../scenes/PongScene';

export function createPongGame(parent: HTMLDivElement | null) {
  if (!parent) {
    throw new Error('Cannot create the Pong game without a mount element.');
  }

  const width = parent.clientWidth || window.innerWidth;
  const height = parent.clientHeight || window.innerHeight;

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: PONG_CONFIG.colors.background,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    fps: {
      target: 60,
      forceSetTimeOut: true,
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PongScene],
  });
}