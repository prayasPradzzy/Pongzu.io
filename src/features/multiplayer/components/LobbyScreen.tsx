import { useEffect, useRef, useState } from 'react';
import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { socketService } from '../SocketService';

type LobbyPhase =
  | 'connecting'      // Reaching the server / waiting for it to confirm the room
  | 'waiting-guest'   // Host: room is open, nobody has joined yet
  | 'both-present'    // Both players present, waiting for ready
  | 'ready-waiting'   // Local player is ready, waiting for opponent
  | 'starting'        // Both ready, countdown running
  | 'error';          // Room unavailable or connection failed

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older browsers / insecure contexts
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

export function LobbyScreen() {
  const {
    multiplayerRole,
    roomCode,
    opponentName,
    playerName,
    croppedAvatarUrl,
    opponentAvatarUrl,
    setRoomCode,
    setOpponent,
    setUiStage,
    leaveRoom,
  } = useFaceUploadStore();

  const isHost = multiplayerRole === 'host';

  const [phase, setPhase] = useState<LobbyPhase>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [slowConnect, setSlowConnect] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // Create/join exactly once per visit to this screen.
    if (startedRef.current) return;
    startedRef.current = true;

    let matchStarted = false;
    let failed = false;

    const fail = (message: string) => {
      if (failed || matchStarted) return;
      failed = true;
      socketService.disconnect();
      setError(message);
      setPhase('error');
    };

    socketService.connect();

    const unsubscribers = [
      socketService.onRoomCreated(({ code }) => {
        setRoomCode(code);
        setPhase('waiting-guest');
      }),

      socketService.onRoomJoined(({ code, opponentName: oName, opponentAvatarUrl: oAvatar }) => {
        setRoomCode(code);
        setOpponent(oName, oAvatar);
        setPhase('both-present');
      }),

      socketService.onRoomOpponentJoined(({ opponentName: oName, opponentAvatarUrl: oAvatar }) => {
        setOpponent(oName, oAvatar);
        setNotice(null);
        setPhase('both-present');
      }),

      socketService.onRoomOpponentLeft(() => {
        setOpponent(null, null);
        setOpponentReady(false);
        setLocalReady(false);
        setNotice('Your opponent left. The room is still open — share the code again.');
        setPhase('waiting-guest');
      }),

      socketService.onRoomError(({ message }) => fail(message)),
      socketService.onRoomClosed(({ reason }) => fail(reason || 'The room was closed.')),

      socketService.onLobbyOpponentReady(() => setOpponentReady(true)),

      socketService.onGameCountdown(({ value }) => {
        setCountdown(value);
        setPhase('starting');
      }),

      socketService.onMatchStart(() => {
        matchStarted = true;
        setUiStage('playing');
      }),

      socketService.onStatusChange((status) => {
        if (status === 'failed') {
          fail("Couldn't reach the game server. Check your connection and try again.");
        } else if (status === 'reconnecting') {
          // Dropping out of a lobby gives up the seat, so there is nothing to resume.
          fail('Connection lost. Please try again.');
        }
      }),
    ];

    if (multiplayerRole === 'host') {
      socketService.createRoom({ playerName: playerName || 'Player', avatarDataUrl: croppedAvatarUrl });
    } else {
      socketService.joinRoom({
        code: roomCode ?? '',
        playerName: playerName || 'Player',
        avatarDataUrl: croppedAvatarUrl,
      });
    }

    // Free-tier servers sleep when idle; reassure the player while one wakes up.
    const slowTimer = setTimeout(() => setSlowConnect(true), 4000);

    return () => {
      clearTimeout(slowTimer);
      unsubscribers.forEach((off) => off());
    };
    // Runs once on mount with the values the setup screen put in the store.
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
    leaveRoom('multiplayerMenu');
  };

  const flashCopied = (what: 'code' | 'link') => {
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyCode = async () => {
    if (!roomCode) return;
    await copyText(roomCode);
    flashCopied('code');
  };

  const handleShareLink = async () => {
    if (!roomCode) return;
    const inviteLink = `${window.location.origin}/join/${roomCode}`;

    // Phones get the native share sheet (WhatsApp, Messages, …).
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Pongzu',
          text: `${playerName || 'A friend'} challenged you to Face Pong!`,
          url: inviteLink,
        });
        return;
      } catch {
        // Share sheet dismissed or unavailable — fall back to copying.
      }
    }
    await copyText(inviteLink);
    flashCopied('link');
  };

  return (
    <section className="face-upload">
      <div className="face-upload__panel lobby-panel">
        <p className="face-upload__eyebrow">Online Multiplayer</p>

        {phase === 'connecting' && (
          <>
            <h1 className="face-upload__title">{isHost ? 'Creating room…' : `Joining ${roomCode ?? 'room'}…`}</h1>
            <div className="lobby-waiting-status">
              <span className="lobby-pulse" />
              Connecting to the game server…
            </div>
            {slowConnect && (
              <p className="face-upload__copy">
                The server is waking up. The first game of the day can take up to a minute — hang tight.
              </p>
            )}
          </>
        )}

        {phase === 'error' && (
          <>
            <h1 className="face-upload__title">{isHost ? "Couldn't create the room" : "Couldn't join"}</h1>
            <p className="lobby-error">{error}</p>
            <button
              type="button"
              className="face-upload__start-button"
              onClick={() => leaveRoom(isHost ? 'createSetup' : 'joinSetup')}
            >
              {isHost ? 'Try Again' : 'Try Another Code'}
            </button>
          </>
        )}

        {/* Waiting for guest — host view */}
        {phase === 'waiting-guest' && (
          <>
            <h1 className="face-upload__title">Room Created!</h1>
            <p className="face-upload__copy">Send this code or the invite link to your opponent.</p>
            <div className="lobby-room-code-wrap">
              <div className="lobby-room-code">{roomCode ?? '…'}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="lobby-copy-btn" onClick={handleCopyCode}>
                  {copied === 'code' ? '✓ Copied Code!' : '📋 Copy Code'}
                </button>
                <button type="button" className="lobby-copy-btn" onClick={handleShareLink}>
                  {copied === 'link' ? '✓ Copied Link!' : '🔗 Share Invite Link'}
                </button>
              </div>
            </div>
            <div className="lobby-waiting-status">
              <span className="lobby-pulse" />
              Waiting for opponent…
            </div>
            {notice && <p className="lobby-error">{notice}</p>}
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
              </div>
            )}

            <div className="lobby-players">
              {/* Local player */}
              <div className="lobby-player-card">
                <div className="lobby-player-avatar-ring">
                  {croppedAvatarUrl ? (
                    <img src={croppedAvatarUrl} alt="You" className="lobby-player-avatar" />
                  ) : (
                    <div className="lobby-player-avatar-placeholder">👤</div>
                  )}
                </div>
                <div className="lobby-player-name">{playerName || 'You'}</div>
                <div className={`lobby-ready-chip ${localReady ? 'ready' : ''}`}>
                  {localReady ? '✓ Ready' : 'Not ready'}
                </div>
              </div>

              <div className="lobby-vs">VS</div>

              {/* Opponent */}
              <div className="lobby-player-card">
                <div className="lobby-player-avatar-ring">
                  {opponentAvatarUrl ? (
                    <img src={opponentAvatarUrl} alt="Opponent" className="lobby-player-avatar" />
                  ) : (
                    <div className="lobby-player-avatar-placeholder">👤</div>
                  )}
                </div>
                <div className="lobby-player-name">{opponentName || 'Opponent'}</div>
                <div className={`lobby-ready-chip ${opponentReady ? 'ready' : ''}`}>
                  {opponentReady ? '✓ Ready' : 'Not ready'}
                </div>
              </div>
            </div>

            {phase === 'both-present' && (
              <button type="button" className="face-upload__start-button" onClick={handleReady}>
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

        <button type="button" className="face-upload__ghost-button lobby-leave-btn" onClick={handleLeave}>
          {phase === 'error' ? '← Back to Menu' : '← Leave Room'}
        </button>
      </div>
    </section>
  );
}
