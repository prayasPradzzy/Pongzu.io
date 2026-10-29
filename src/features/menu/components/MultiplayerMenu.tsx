import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';

export function MultiplayerMenu() {
  const { setUiStage } = useFaceUploadStore();

  return (
    <section className="face-upload">
      <div className="face-upload__panel setup-panel">
        <h1 className="face-upload__title setup__title">Play a friend online</h1>
        <p className="face-upload__copy">Open a room and send your friend the code, or type in the code they sent you.</p>

        <div className="choice-list">
          <button type="button" className="choice" onClick={() => setUiStage('createSetup')}>
            <strong>Create a room</strong>
            <span>You get a code to share</span>
          </button>
          <button type="button" className="choice" onClick={() => setUiStage('joinSetup')}>
            <strong>Join a room</strong>
            <span>Type in your friend's code</span>
          </button>
        </div>

        <button
          type="button"
          className="face-upload__ghost-button setup__back"
          onClick={() => setUiStage('mainMenu')}
        >
          Back
        </button>
      </div>
    </section>
  );
}
