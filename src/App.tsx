import { PhaserStage } from './game/PhaserStage';
import { FaceUploadProvider, useFaceUploadStore } from './features/faceUpload';
import { MainMenu } from './features/menu/components/MainMenu';
import { CpuSetupScreen } from './features/menu/components/CpuSetupScreen';
import { MultiplayerMenu } from './features/menu/components/MultiplayerMenu';
import { CreateSetupScreen } from './features/menu/components/CreateSetupScreen';
import { JoinSetupScreen } from './features/menu/components/JoinSetupScreen';
import { StatsScreen } from './features/menu/components/StatsScreen';
import { LobbyScreen } from './features/multiplayer/components/LobbyScreen';

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { JoinRouteHandler } from './features/menu/components/JoinRouteHandler';
import { audioManager } from './game/systems/AudioManager';
import { useState, useEffect } from 'react';

function MuteButton() {
  const [muted, setMuted] = useState(audioManager.muted);

  useEffect(() => {
    return audioManager.onMuteChange((isMuted) => setMuted(isMuted));
  }, []);

  return (
    <button
      className={`mute-toggle-btn ${muted ? 'muted' : ''}`}
      onClick={() => audioManager.toggleMute()}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
    >
      {muted ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      )}
    </button>
  );
}

function AppContent() {
  const { uiStage } = useFaceUploadStore();

  return (
    <main className="app-root">
      <div className="game-shell">
        {uiStage === 'mainMenu' && <MainMenu />}
        {uiStage === 'cpuSetup' && <CpuSetupScreen />}
        {uiStage === 'multiplayerMenu' && <MultiplayerMenu />}
        {uiStage === 'createSetup' && <CreateSetupScreen />}
        {uiStage === 'joinSetup' && <JoinSetupScreen />}
        {uiStage === 'lobby' && <LobbyScreen />}
        {uiStage === 'stats' && <StatsScreen />}
        {uiStage === 'playing' && <PhaserStage />}
      </div>
      <MuteButton />
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <FaceUploadProvider>
        <Routes>
          <Route path="/join/:roomCode" element={<JoinRouteHandler />} />
          <Route path="/" element={<AppContent />} />
        </Routes>
      </FaceUploadProvider>
    </BrowserRouter>
  );
}

export default App;
