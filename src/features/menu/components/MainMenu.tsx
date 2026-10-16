import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { DIFFICULTY_PRESETS } from '../../../game/config/pongConfig';
import { useSettings } from '../../settings/settings';

export function MainMenu() {
  const { setUiStage, setGameMode, playerName, croppedAvatarUrl, difficulty } = useFaceUploadStore();
  const { matchLength } = useSettings();

  const quickPlay = () => {
    setGameMode('cpu');
    setUiStage('playing');
  };

  const sameDevice = () => {
    setGameMode('local');
    setUiStage('playing');
  };

  return (
    <section className="face-upload">
      <div className="face-upload__panel main-menu-panel">
        <div className="main-menu__brand">
          <span className="main-menu__logo" aria-hidden="true">🏓</span>
          <h1 className="main-menu__title">Pongzu</h1>
          <p className="main-menu__tagline">Put your face on the ball. Smash your friends.</p>
        </div>

        <button type="button" className="profile-chip" onClick={() => setUiStage('profile')}>
          <span className="profile-chip__avatar">
            {croppedAvatarUrl ? <img src={croppedAvatarUrl} alt="" /> : <span aria-hidden="true">🙂</span>}
          </span>
          <span className="profile-chip__text">
            <strong>{playerName.trim() ? `Hi, ${playerName.trim()}!` : 'Hi there!'}</strong>
            <small>{croppedAvatarUrl ? 'Your face is the ball · Edit' : 'Add your face to the ball →'}</small>
          </span>
        </button>

        <button type="button" className="main-menu__play" onClick={quickPlay}>
          <span className="main-menu__play-icon" aria-hidden="true">▶</span>
          <span className="main-menu__play-label">
            <strong>Play</strong>
            <small>
              vs CPU · {DIFFICULTY_PRESETS[difficulty].label} · first to {matchLength}
            </small>
          </span>
        </button>

        <div className="main-menu__grid">
          <button type="button" className="main-menu__tile" onClick={() => setUiStage('cpuSetup')}>
            <span aria-hidden="true">🤖</span>
            <strong>Vs CPU</strong>
            <small>Pick difficulty</small>
          </button>
          <button type="button" className="main-menu__tile" onClick={sameDevice}>
            <span aria-hidden="true">👥</span>
            <strong>2 Players</strong>
            <small>One phone, two thumbs</small>
          </button>
          <button
            type="button"
            className="main-menu__tile main-menu__tile--wide"
            onClick={() => setUiStage('multiplayerMenu')}
          >
            <span aria-hidden="true">🌐</span>
            <strong>Play a friend online</strong>
            <small>Send an invite link</small>
          </button>
        </div>

        <div className="main-menu__footer-row">
          <button type="button" className="main-menu__small" onClick={() => setUiStage('stats')}>
            📊 Stats
          </button>
          <button type="button" className="main-menu__small" onClick={() => setUiStage('settings')}>
            ⚙️ Settings
          </button>
        </div>
      </div>
    </section>
  );
}
