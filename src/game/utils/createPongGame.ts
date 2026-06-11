import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';
import { BootScene } from '../scenes/BootScene';
import { PongScene } from '../scenes/PongScene';

type PongGameConfig = {
  croppedAvatarUrl: string | null;
  faceBallMode: boolean;
  onExit: () => void;
};

export function createPongGame(
  parent: HTMLDivElement | null,
  config: PongGameConfig
) {
  if (!parent) {
    throw new Error('Cannot create the Pong game without a mount element.');
  }

  const width = parent.clientWidth || window.innerWidth;
  const height = parent.clientHeight || window.innerHeight;

  const game = new Phaser.Game({
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

  // Save config into registry for scene access
  game.registry.set('customConfig', config);

  return game;
}