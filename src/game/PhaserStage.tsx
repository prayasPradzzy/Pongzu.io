import { useEffect, useRef } from 'react';
import { useFaceUploadStore } from '../features/faceUpload';
import { createPongGame } from './utils/createPongGame';
import { socketService } from '../features/multiplayer/SocketService';
import { getSettings } from '../features/settings/settings';

/** Phaser draws text once; make sure the game font is ready first (but never wait long). */
function waitForGameFont(): Promise<void> {
  if (!document.fonts?.load) return Promise.resolve();
  const loaded = Promise.all([
    document.fonts.load('800 32px Nunito'),
    document.fonts.load('700 32px Nunito'),
  ]).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
  return Promise.race([loaded, timeout]).catch(() => undefined);
}

export function PhaserStage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const {
    croppedAvatarUrl,
    faceBallMode,
    difficulty,
    gameMode,
    multiplayerRole,
    roomCode,
    playerName,
    opponentName,
    opponentAvatarUrl,
    resetToMenu,
    leaveRoom,
    setUiStage,
  } = useFaceUploadStore();

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false;

    void waitForGameFont().then(() => {
      if (cancelled || !containerRef.current) return;
      const { matchLength } = getSettings();

      if (gameMode === 'online') {
        game = createPongGame(containerRef.current, {
          mode: 'online',
          croppedAvatarUrl,
          faceBallMode,
          role: multiplayerRole ?? 'guest',
          roomCode: roomCode ?? '',
          playerName,
          opponentName: opponentName ?? 'Opponent',
          opponentAvatarUrl,
          socketService,
          onExit: () => {
            socketService.sendExit();
            socketService.disconnect();
            leaveRoom('mainMenu');
          },
        });
      } else if (gameMode === 'local') {
        game = createPongGame(containerRef.current, {
          mode: 'local',
          croppedAvatarUrl,
          faceBallMode,
          playerName,
          winningScore: matchLength,
          onExit: () => resetToMenu(),
        });
      } else {
        game = createPongGame(containerRef.current, {
          mode: 'cpu',
          croppedAvatarUrl,
          faceBallMode,
          difficulty,
          playerName,
          winningScore: matchLength,
          onExit: () => resetToMenu(),
          onChangeDifficulty: () => setUiStage('cpuSetup'),
        });
      }
    });

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="phaser-stage" />;
}
