import { PhaserStage } from './game/PhaserStage';
import { FaceUploadMenu, FaceUploadProvider, useFaceUploadStore } from './features/faceUpload';

function AppContent() {
  const { uiStage } = useFaceUploadStore();

  return (
    <main className="app-root">
      <div className="game-shell">
        {uiStage === 'playing' ? <PhaserStage /> : <FaceUploadMenu onStartGame={() => undefined} />}
      </div>
    </main>
  );
}

function App() {
  return (
    <FaceUploadProvider>
      <AppContent />
    </FaceUploadProvider>
  );
}

export default App;
