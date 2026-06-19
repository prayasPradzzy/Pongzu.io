import { useEffect, useRef, useState } from 'react';
import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { socketService } from '../SocketService';

type LobbyPhase =
  | 'waiting-guest'   // Host: waiting for guest
  | 'both-present'    // Both players present, waiting for ready
  | 'ready-waiting'   // Local player is ready, waiting for opponent
  | 'starting';       // Both ready, match starting

export function LobbyScreen() {
  const {
    multiplayerRole,
    roomCode,
    opponentName,
    playerName,
    setMultiplayerRole,
    setRoomCode,
    setOpponent,
    setUiStage,
    setDisconnectReason,
    resetToMenu,
  } = useFaceUploadStore();

  const [phase, setPhase] = useState<LobbyPhase>(
    multiplayerRole === 'guest' ? 'both-present' : 'waiting-guest'
  );
  const [error, setError] = useState<string | null>(null);
  const [opponentReady, setOpponentReady] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    socketService.onRoomCreated(({ code, role }) => {
      setRoomCode(code);
      setMultiplayerRole(role);
      setPhase('waiting-guest');
    });

    socketService.onRoomJoined(({ code, role, opponentName: oName, opponentAvatarUrl: oAvatar }) => {
      setRoomCode(code);
      setMultiplayerRole(role);
      setOpponent(oName, oAvatar);
      setPhase('both-present');
    });

    socketService.onRoomOpponentJoined(({ opponentName: oName, opponentAvatarUrl: oAvatar }) => {
      setOpponent(oName, oAvatar);
      setPhase('both-present');
    });

    socketService.onRoomError(({ message }) => {
      setError(message);
    });

    socketService.onLobbyOpponentReady(() => {
      setOpponentReady(true);
    });

    socketService.onGameCountdown(({ value }) => {
      setCountdown(value);
      setPhase('starting');
    });

    socketService.onMatchStart(() => {
      setUiStage('playing');
    });

    socketService.onPlayerDisconnected(({ reason }) => {
      setDisconnectReason(reason);
      setUiStage('playing');
    });

    return () => {
      socketService.offAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReady = () => {
    setLocalReady(true);
    socketService.sendReady();
    setPhase('ready-waiting');
  };

  const handleLeave = () => {
    socketService.sendExit();
    socketService.disconnect();
    resetToMenu();
  };

  const handleCopyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = roomCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    if (!roomCode) return;
    const inviteLink = `${window.location.origin}/join/${roomCode}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  return (
    <section className="face-upload">
      <div className="face-upload__panel lobby-panel">
        <p className="face-upload__eyebrow">Online Multiplayer</p>

        {/* Waiting for guest — host view */}
        {phase === 'waiting-guest' && (
          <>
            <h1 className="face-upload__title">Room Created!</h1>
            <p className="face-upload__copy">Share this code with your opponent.</p>
            <div className="lobby-room-code-wrap">
              <div className="lobby-room-code">{roomCode ?? '…'}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="lobby-copy-btn"
                  onClick={handleCopyCode}
                >
                  {codeCopied ? '✓ Copied Code!' : '📋 Copy Code'}
                </button>
                <button
                  type="button"
                  className="lobby-copy-btn"
                  onClick={handleCopyLink}
                >
                  {linkCopied ? '✓ Copied Link!' : '🔗 Copy Link'}
                </button>
              </div>
            </div>
            <div className="lobby-waiting-status">
              <span className="lobby-pulse" />
              Waiting for opponent…
            </div>
            {error && <p className="lobby-error">{error}</p>}
          </>
        )}

        {/* Both players present */}
        {(phase === 'both-present' || phase === 'ready-waiting' || phase === 'starting') && (
          <>
            <h1 className="face-upload__title">
              {phase === 'starting' ? `Get Ready! ${countdown ?? ''}` : 'Room Ready!'}
            </h1>

            {roomCode && (
              <div className="lobby-room-code-small">
                Room: <strong>{roomCode}</strong>
                <button
                  type="button"
                  className="lobby-copy-btn lobby-copy-btn--small"
                  onClick={handleCopyCode}
                >
                  {codeCopied ? '✓' : '📋'}
                </button>
              </div>
            )}

            <div className="lobby-players">
              {/* Local player */}
              <div className="lobby-player-card">
                <div className="lobby-player-name">{playerName || 'You'}</div>
                <div className={`lobby-ready-chip ${localReady ? 'ready' : ''}`}>
                  {localReady ? '✓ Ready' : 'Not ready'}
                </div>
              </div>

              <div className="lobby-vs">VS</div>

              {/* Opponent */}
              <div className="lobby-player-card">
                <div className="lobby-player-name">{opponentName ?? 'Opponent'}</div>
                <div className={`lobby-ready-chip ${opponentReady ? 'ready' : ''}`}>
                  {opponentReady ? '✓ Ready' : 'Not ready'}
                </div>
              </div>
            </div>

            {phase === 'both-present' && (
              <button
                type="button"
                className="face-upload__start-button"
                onClick={handleReady}
              >
                I'm Ready! →
              </button>
            )}

            {phase === 'ready-waiting' && (
              <div className="lobby-waiting-status">
                <span className="lobby-pulse" />
                Waiting for opponent to ready up…
              </div>
            )}
          </>
        )}

        <button
          type="button"
          className="face-upload__ghost-button lobby-leave-btn"
          onClick={handleLeave}
        >
          ← Leave Room
        </button>
      </div>
    </section>
  );
}
