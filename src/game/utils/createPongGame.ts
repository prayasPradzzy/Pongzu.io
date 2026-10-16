import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';
import { BootScene } from '../scenes/BootScene';
import { PongScene } from '../scenes/PongScene';
import { OnlinePongScene } from '../scenes/OnlinePongScene';
import { socketService as socketServiceInstance } from '../../features/multiplayer/SocketService';
import type { Role } from '../../protocol/events';
import type { Difficulty } from '../config/pongConfig';
import { ARENA_HEIGHT, ARENA_WIDTH, pickRenderScale } from './sceneSetup';

type CpuGameConfig = {
  mode: 'cpu';
  croppedAvatarUrl: string | null;
  faceBallMode: boolean;
  difficulty?: Difficulty;
  playerName?: string;
  winningScore: number;
  onExit: () => void;
  onChangeDifficulty?: () => void;
};

/** Two players on one device: bottom = player 1, top = player 2. */
type LocalGameConfig = {
  mode: 'local';
  croppedAvatarUrl: string | null;
  faceBallMode: boolean;
  playerName?: string;
  winningScore: number;
  onExit: () => void;
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
  socketService: typeof socketServiceInstance;
  onExit: () => void;
};

export type PongGameConfig = CpuGameConfig | LocalGameConfig | OnlineGameConfig;

export function createPongGame(
  parent: HTMLDivElement | null,
  config: PongGameConfig,
): Phaser.Game {
  if (!parent) {
    throw new Error('Cannot create the Pong game without a mount element.');
  }

  const renderScale = pickRenderScale();

  const scenes = config.mode === 'online'
    ? [BootScene, OnlinePongScene]
    : [BootScene, PongScene];

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    // Logical arena is 600×1000 (shared with the server); the canvas is
    // rendered at renderScale× that and the camera zoomed to match.
    width: ARENA_WIDTH * renderScale,
    height: ARENA_HEIGHT * renderScale,
    backgroundColor: PONG_CONFIG.colors.background,
    // Gameplay runs on our own PongSimulation / server snapshots, so no
    // Phaser physics. The loop uses requestAnimationFrame for smooth motion.
    render: {
      antialias: true,
      roundPixels: false,
    },
    input: {
      // Two thumbs on one phone in same-device mode.
      activePointers: 3,
    },
    disableContextMenu: true,
    // All sound goes through our own AudioManager; Phaser's unused audio
    // context only produced errors when the game was torn down.
    audio: {
      noAudio: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: scenes,
  });

  // Save full config into registry — all scenes read from here
  game.registry.set('customConfig', config);
  game.registry.set('renderScale', renderScale);

  return game;
}
