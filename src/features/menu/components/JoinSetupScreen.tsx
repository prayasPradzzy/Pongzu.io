import { useState } from 'react';
import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { OptionalFaceUpload } from '../../faceUpload/components/OptionalFaceUpload';
import { socketService } from '../../multiplayer/SocketService';

export function JoinSetupScreen() {
  const {
    playerName,
    croppedAvatarUrl,
    setPlayerName,
    setGameMode,
    setUiStage,
    roomCode,
  } = useFaceUploadStore();

  const [joinCode, setJoinCode] = useState(roomCode || '');
  const [error, setError] = useState<string | null>(null);

  const handleJoin = () => {
    if (!joinCode.trim() || joinCode.trim().length < 4) {
      setError('Enter a 4-letter room code.');
      return;
    }
    if (!playerName.trim()) {
      setError('Enter your name.');
      return;
    }
    setError(null);
    setGameMode('online');
    socketService.connect();

    setTimeout(() => {
      socketService.joinRoom({
        code: joinCode.toUpperCase().trim(),
        playerName: playerName || 'Player',
        avatarDataUrl: croppedAvatarUrl,
      });
    }, 80);

    setUiStage('lobby');
  };

  return (
    <section className="face-upload">
      <div className="face-upload__panel setup-panel">
        <p className="face-upload__eyebrow">Join Room</p>
        <h1 className="face-upload__title setup__title">Join a Game</h1>
        <p className="face-upload__copy">Enter the room code from your friend, then set up your profile.</p>

        {/* Room code */}
        <div className="setup__field">
          <label className="setup__label" htmlFor="join-code">Room Code</label>
          <input
            id="join-code"
            className="setup__input setup__input--code"
            type="text"
            maxLength={4}
            placeholder="XXXX"
            value={joinCode}
            disabled={!!roomCode}
            onChange={(e) => {
              setJoinCode(e.target.value.toUpperCase());
              setError(null);
            }}
            autoFocus
          />
        </div>

        {/* Name input */}
        <div className="setup__field">
          <label className="setup__label" htmlFor="join-name">Your Name</label>
          <input
            id="join-name"
            className="setup__input"
            type="text"
            placeholder="Enter your name"
            maxLength={20}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </div>

        {/* Optional face upload */}
        <OptionalFaceUpload />

        {error && <p className="lobby-error">{error}</p>}

        {/* Join */}
        <button
          type="button"
          className="face-upload__start-button"
          onClick={handleJoin}
          disabled={!joinCode.trim() || !playerName.trim()}
        >
          Join Room →
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
