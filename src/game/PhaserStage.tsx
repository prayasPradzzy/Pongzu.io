import { useEffect, useRef } from 'react';

import { createPongGame } from './utils/createPongGame';

export function PhaserStage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let game: import('phaser').Game | undefined;

    game = createPongGame(containerRef.current);

    return () => {
      game?.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="phaser-stage" />;
}