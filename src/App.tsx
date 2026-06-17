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
