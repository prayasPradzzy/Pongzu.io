import { useEffect, useRef } from 'react';
import { useFaceUploadStore } from '../features/faceUpload';
import { createPongGame } from './utils/createPongGame';
import { socketService } from '../features/multiplayer/SocketService';

export function PhaserStage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const {
    croppedAvatarUrl,
    faceBallMode,
    gameMode,
    multiplayerRole,
    roomCode,
    playerName,
    opponentName,
    opponentAvatarUrl,
    resetToMenu,
  } = useFaceUploadStore();

  useEffect(() => {
    if (!containerRef.current) return;

    let game: Phaser.Game | null = null;

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
          resetToMenu();
        },
      });
    } else {
      game = createPongGame(containerRef.current, {
        mode: 'cpu',
        croppedAvatarUrl,
        faceBallMode,
        playerName,
        onExit: () => resetToMenu(),
        onChangeDifficulty: () => resetToMenu(),
      });
    }

    return () => {
      game?.destroy(true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="phaser-stage" />;
}