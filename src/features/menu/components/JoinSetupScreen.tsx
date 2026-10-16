import { useState } from 'react';
import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { OptionalFaceUpload } from '../../faceUpload/components/OptionalFaceUpload';

export function JoinSetupScreen() {
  const {
    playerName,
    setPlayerName,
    setGameMode,
    setMultiplayerRole,
    setRoomCode,
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
    // The lobby connects and joins once its listeners are in place.
    setGameMode('online');
    setMultiplayerRole('guest');
    setRoomCode(joinCode.toUpperCase().trim());
    setUiStage('lobby');
  };

  return (
    <section className="face-upload">
      <div className="face-upload__panel setup-panel">
        <p className="face-upload__eyebrow">Join Room</p>
        <h1 className="face-upload__title setup__title">Join a Game</h1>
        <p className="face-upload__copy">{roomCode ? `You've been invited to room ${roomCode}. Add your name and jump in.` : 'Enter the room code from your friend, then set up your profile.'}</p>

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
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus={!roomCode}
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
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus={!!roomCode}
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
          onClick={() => {
            setRoomCode(null);
            setUiStage('multiplayerMenu');
          }}
        >
          ← Back
        </button>
      </div>
    </section>
  );
}
