import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';

export function MultiplayerMenu() {
  const { setUiStage } = useFaceUploadStore();

  return (
    <section className="face-upload">
      <div className="face-upload__panel main-menu-panel">
        <p className="face-upload__eyebrow">Online Multiplayer</p>
        <h1 className="face-upload__title main-menu__title" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)' }}>
          Play with a friend
        </h1>
        <p className="face-upload__copy">Create a room and share the code, or join an existing one.</p>

        <div className="main-menu__buttons">
          <button
            type="button"
            className="main-menu__btn main-menu__btn--primary"
            onClick={() => setUiStage('createSetup')}
          >
            <span className="main-menu__btn-icon">🔑</span>
            <span className="main-menu__btn-label">
              <strong>Create Room</strong>
              <small>Host a game and share a code</small>
            </span>
          </button>

          <button
            type="button"
            className="main-menu__btn main-menu__btn--accent"
            onClick={() => setUiStage('joinSetup')}
          >
            <span className="main-menu__btn-icon">🚀</span>
            <span className="main-menu__btn-label">
              <strong>Join Room</strong>
              <small>Enter a friend's room code</small>
            </span>
          </button>
        </div>

        <button
          type="button"
          className="face-upload__ghost-button setup__back"
          onClick={() => setUiStage('mainMenu')}
        >
          ← Back
        </button>
      </div>
    </section>
  );
}
