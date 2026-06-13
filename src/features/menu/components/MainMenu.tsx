import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';

export function MainMenu() {
  const { setUiStage } = useFaceUploadStore();

  return (
    <section className="face-upload">
      <div className="face-upload__panel main-menu-panel">
        <div className="main-menu__brand">
          <span className="main-menu__logo">🏓</span>
          <h1 className="main-menu__title">Face Pong</h1>
          <p className="main-menu__tagline">Upload your face. Smash your friends.</p>
        </div>

        <div className="main-menu__buttons">
          <button
            type="button"
            className="main-menu__btn main-menu__btn--primary"
            onClick={() => setUiStage('cpuSetup')}
          >
            <span className="main-menu__btn-icon">🤖</span>
            <span className="main-menu__btn-label">
              <strong>Play vs CPU</strong>
              <small>Single player with AI opponent</small>
            </span>
          </button>

          <button
            type="button"
            className="main-menu__btn main-menu__btn--accent"
            onClick={() => setUiStage('multiplayerMenu')}
          >
            <span className="main-menu__btn-icon">🌐</span>
            <span className="main-menu__btn-label">
              <strong>Multiplayer</strong>
              <small>Play online with a friend</small>
            </span>
          </button>

          <button
            type="button"
            className="main-menu__btn main-menu__btn--ghost"
            onClick={() => setUiStage('stats')}
          >
            <span className="main-menu__btn-icon">📊</span>
            <span className="main-menu__btn-label">
              <strong>Statistics</strong>
              <small>Your match history</small>
            </span>
          </button>
        </div>

        <p className="main-menu__footer">v1.0 • Face detection powered by MediaPipe</p>
      </div>
    </section>
  );
}
