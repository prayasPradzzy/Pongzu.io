import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { socketService } from '../SocketService';

export function ModeSelectScreen() {
  const {
    croppedAvatarUrl,
    faceBallMode,
    playerName,
    setGameMode,
    setUiStage,
    clearImage,
  } = useFaceUploadStore();

  const handleCpu = () => {
    setGameMode('cpu');
    setUiStage('playing');
  };

  const handleCreate = () => {
    socketService.connect();
    setGameMode('online');
    setUiStage('lobby');

    // Emit create after a tick to ensure listeners are registered
    setTimeout(() => {
      socketService.createRoom({
        playerName,
        avatarDataUrl: croppedAvatarUrl,
      });
    }, 80);
  };

  const handleJoin = () => {
    socketService.connect();
    setGameMode('online');
    setUiStage('lobby');
    // LobbyScreen handles the join flow when no roomCode yet
  };

  return (
    <section className="face-upload">
      <div className="face-upload__panel mode-select-panel">
        <p className="face-upload__eyebrow">Face Pong</p>
        <h1 className="face-upload__title mode-select__title">Choose your battle</h1>
        <p className="face-upload__copy">Ready to play, {playerName || 'Player'}!</p>

        {croppedAvatarUrl && (
          <div className="mode-select__avatar">
            <img src={croppedAvatarUrl} alt="Your avatar" className="mode-select__avatar-img" />
          </div>
        )}

        {faceBallMode && (
          <div className="mode-select__faceball-badge">🤪 Face-Ball Mode ON</div>
        )}

        <div className="mode-select__buttons">
          <button
            type="button"
            className="mode-select__btn mode-select__btn--cpu"
            onClick={handleCpu}
          >
            <span className="mode-select__btn-icon">🤖</span>
            <span className="mode-select__btn-label">
              <strong>Play vs CPU</strong>
              <small>Classic single player</small>
            </span>
          </button>

          <button
            type="button"
            className="mode-select__btn mode-select__btn--create"
            onClick={handleCreate}
          >
            <span className="mode-select__btn-icon">🔑</span>
            <span className="mode-select__btn-label">
              <strong>Create Room</strong>
              <small>Share code with a friend</small>
            </span>
          </button>

          <button
            type="button"
            className="mode-select__btn mode-select__btn--join"
            onClick={handleJoin}
          >
            <span className="mode-select__btn-icon">🚀</span>
            <span className="mode-select__btn-label">
              <strong>Join Room</strong>
              <small>Enter a friend's code</small>
            </span>
          </button>
        </div>

        <button
          type="button"
          className="face-upload__ghost-button mode-select__back"
          onClick={clearImage}
        >
          ← Change Face
        </button>
      </div>
    </section>
  );
}
