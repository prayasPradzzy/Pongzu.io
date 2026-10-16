import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { SERVER_URL } from '../../../config/env';

type InviteStatus = 'checking' | 'not-found' | 'full';

const ROOM_CODE_PATTERN = /^[A-Z0-9]{4}$/;

/** Handles invite links: /join/ABCD */
export function JoinRouteHandler() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { setUiStage, setRoomCode } = useFaceUploadStore();
  const [slow, setSlow] = useState(false);

  const code = (roomCode ?? '').trim().toUpperCase();
  const validCode = ROOM_CODE_PATTERN.test(code);
  // A malformed code can't exist, so there's nothing to look up.
  const [status, setStatus] = useState<InviteStatus>(validCode ? 'checking' : 'not-found');

  const goTo = (stage: 'joinSetup' | 'mainMenu', prefill: string | null) => {
    setRoomCode(prefill);
    setUiStage(stage);
    navigate('/', { replace: true });
  };

  useEffect(() => {
    if (!validCode) return;

    let cancelled = false;
    const slowTimer = setTimeout(() => setSlow(true), 4000);

    const proceed = () => {
      setRoomCode(code);
      setUiStage('joinSetup');
      navigate('/', { replace: true });
    };

    fetch(`${SERVER_URL}/api/room/${code}/exists`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('bad response'))))
      .then((data: { exists?: boolean; joinable?: boolean }) => {
        if (cancelled) return;
        if (!data.exists) setStatus('not-found');
        else if (data.joinable === false) setStatus('full');
        else proceed();
      })
      .catch(() => {
        // Couldn't check (offline, server asleep). Let the player try anyway —
        // the lobby reports a clear error if the room really isn't there.
        if (!cancelled) proceed();
      });

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, [code, validCode, navigate, setRoomCode, setUiStage]);

  return (
    <main className="app-root">
      <div className="game-shell">
        <section className="face-upload">
          <div className="face-upload__panel setup-panel">
            <p className="face-upload__eyebrow">Invite Link</p>

            {status === 'checking' && (
              <>
                <h1 className="face-upload__title setup__title">Finding room {code}…</h1>
                <div className="lobby-waiting-status">
                  <span className="lobby-pulse" />
                  Checking with the game server…
                </div>
                {slow && (
                  <p className="face-upload__copy">
                    The server is waking up. This can take up to a minute the first time.
                  </p>
                )}
              </>
            )}

            {status !== 'checking' && (
              <>
                <h1 className="face-upload__title setup__title">
                  {status === 'full' ? 'That room is full' : 'Room not found'}
                </h1>
                <p className="face-upload__copy">
                  {status === 'full'
                    ? `Room ${code} already has two players. Ask your friend to create a new room.`
                    : `Room ${code || 'in this link'} doesn't exist any more. Rooms close when the host leaves — ask your friend for a fresh link.`}
                </p>
                <button type="button" className="face-upload__start-button" onClick={() => goTo('joinSetup', null)}>
                  Enter a Different Code
                </button>
                <button
                  type="button"
                  className="face-upload__ghost-button setup__back"
                  onClick={() => goTo('mainMenu', null)}
                >
                  ← Main Menu
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
