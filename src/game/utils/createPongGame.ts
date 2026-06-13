import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';
import { BootScene } from '../scenes/BootScene';
import { PongScene } from '../scenes/PongScene';
import { OnlinePongScene } from '../scenes/OnlinePongScene';
import type { SocketService } from '../../features/multiplayer/SocketService';
import type { Role } from '../../../server/src/protocol/events';
import type { Difficulty } from '../config/pongConfig';

type CpuGameConfig = {
  mode: 'cpu';
  croppedAvatarUrl: string | null;
  faceBallMode: boolean;
  difficulty?: Difficulty;
  playerName?: string;
  onExit: () => void;
  onChangeDifficulty?: () => void;
};

type OnlineGameConfig = {
  mode: 'online';
  croppedAvatarUrl: string | null;
  faceBallMode: boolean;
  role: Role;
  roomCode: string;
  playerName: string;
  opponentName: string;
  opponentAvatarUrl: string | null;
  socketService: SocketService;
  onExit: () => void;
};

export type PongGameConfig = CpuGameConfig | OnlineGameConfig;

export function createPongGame(
  parent: HTMLDivElement | null,
  config: PongGameConfig,
): Phaser.Game {
  if (!parent) {
    throw new Error('Cannot create the Pong game without a mount element.');
  }

  const width = parent.clientWidth || window.innerWidth;
  const height = parent.clientHeight || window.innerHeight;

  const scenes = config.mode === 'online'
    ? [BootScene, OnlinePongScene]
    : [BootScene, PongScene];

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
    scene: scenes,
  });

  // Save full config into registry — all scenes read from here
  game.registry.set('customConfig', config);

  return game;
}