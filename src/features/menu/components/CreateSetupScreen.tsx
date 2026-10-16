import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { OptionalFaceUpload } from '../../faceUpload/components/OptionalFaceUpload';

export function CreateSetupScreen() {
  const {
    playerName,
    setPlayerName,
    setGameMode,
    setMultiplayerRole,
    setRoomCode,
    setUiStage,
  } = useFaceUploadStore();

  const handleCreate = () => {
    if (!playerName.trim()) return;
    // The lobby connects and creates the room once its listeners are in place.
    setGameMode('online');
    setMultiplayerRole('host');
    setRoomCode(null);
    setUiStage('lobby');
  };

  return (
    <section className="face-upload">
      <div className="face-upload__panel setup-panel">
        <p className="face-upload__eyebrow">Create Room</p>
        <h1 className="face-upload__title setup__title">Host a Game</h1>
        <p className="face-upload__copy">Set up your profile, then create a room to share with a friend.</p>

        {/* Name input */}
        <div className="setup__field">
          <label className="setup__label" htmlFor="create-name">Your Name</label>
          <input
            id="create-name"
            className="setup__input"
            type="text"
            placeholder="Enter your name"
            maxLength={20}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
        </div>

        {/* Optional face upload */}
        <OptionalFaceUpload />

        {/* Create */}
        <button
          type="button"
          className="face-upload__start-button"
          onClick={handleCreate}
          disabled={!playerName.trim()}
        >
          Create Room →
        </button>

        <button
          type="button"
          className="face-upload__ghost-button setup__back"
          onClick={() => setUiStage('multiplayerMenu')}
        >
          ← Back
        </button>
      </div>
    </section>
  );
}
