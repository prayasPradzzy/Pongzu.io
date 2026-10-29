import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { DIFFICULTY_PRESETS } from '../../../game/config/pongConfig';
import { useSettings } from '../../settings/settings';
import { CourtRally } from './CourtRally';

export function MainMenu() {
  const { setUiStage, setGameMode, playerName, croppedAvatarUrl, difficulty } = useFaceUploadStore();
  const { matchLength, reduceMotion } = useSettings();
  const name = playerName.trim();

  const quickPlay = () => {
    setGameMode('cpu');
    setUiStage('playing');
  };

  const sameDevice = () => {
    setGameMode('local');
    setUiStage('playing');
  };

  return (
    <section className="rec-menu">
      <div className="rec-menu__inner">
        <CourtRally faceUrl={croppedAvatarUrl} autoServe={!reduceMotion} />

        <p className="rec-menu__face">
          {name ? `Hi, ${name}. ` : ''}
          <button type="button" className="rec-menu__link" onClick={() => setUiStage('profile')}>
            {croppedAvatarUrl ? 'Change your face' : 'Put your face on the ball'}
          </button>
        </p>

        <h1 className="rec-menu__title">Pongzu</h1>

        <button type="button" className="rec-menu__play" onClick={quickPlay}>
          <span className="rec-menu__play-label">Play vs CPU</span>
          <span className="rec-menu__play-detail">
            {DIFFICULTY_PRESETS[difficulty].label}, first to {matchLength}
          </span>
        </button>

        <div className="rec-menu__modes">
          <button type="button" className="rec-menu__mode" onClick={sameDevice}>
            <strong>Two players</strong>
            <span>One phone, two thumbs</span>
          </button>
          <button type="button" className="rec-menu__mode" onClick={() => setUiStage('multiplayerMenu')}>
            <strong>Online</strong>
            <span>Send a friend a link</span>
          </button>
        </div>

        <nav className="rec-menu__footer" aria-label="More">
          <button type="button" className="rec-menu__link" onClick={() => setUiStage('cpuSetup')}>
            Difficulty
          </button>
          <button type="button" className="rec-menu__link" onClick={() => setUiStage('stats')}>
            Stats
          </button>
          <button type="button" className="rec-menu__link" onClick={() => setUiStage('settings')}>
            Settings
          </button>
        </nav>
      </div>
    </section>
  );
}
