import { useEffect, useRef } from 'react';
import { useFaceUploadStore } from '../features/faceUpload';
import { createPongGame } from './utils/createPongGame';

export function PhaserStage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { croppedAvatarUrl, faceBallMode, resetToMenu } = useFaceUploadStore();

  useEffect(() => {
    const game = createPongGame(containerRef.current, {
      croppedAvatarUrl,
      faceBallMode,
      onExit: () => resetToMenu(),
    });

    return () => {
      game?.destroy(true);
    };
  }, [croppedAvatarUrl, faceBallMode, resetToMenu]);

  return <div ref={containerRef} className="phaser-stage" />;
}