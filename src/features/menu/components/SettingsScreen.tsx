import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { updateSettings, useSettings, type MatchLength } from '../../settings/settings';
import { audioManager } from '../../../game/systems/AudioManager';

const MATCH_LENGTHS: MatchLength[] = [5, 7, 11];

export function SettingsScreen() {
  const { setUiStage } = useFaceUploadStore();
  const settings = useSettings();

  return (
    <section className="face-upload">
      <div className="face-upload__panel setup-panel">
        <p className="face-upload__eyebrow">Settings</p>
        <h1 className="face-upload__title setup__title">Settings</h1>

        <div className="setup__field">
          <label className="setup__label" htmlFor="music-volume">
            Music · {Math.round(settings.musicVolume * 100)}%
          </label>
          <input
            id="music-volume"
            className="settings__slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.musicVolume}
            onChange={(e) => updateSettings({ musicVolume: Number(e.target.value) })}
          />
        </div>

        <div className="setup__field">
          <label className="setup__label" htmlFor="sfx-volume">
            Sound effects · {Math.round(settings.sfxVolume * 100)}%
          </label>
          <input
            id="sfx-volume"
            className="settings__slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.sfxVolume}
            onChange={(e) => updateSettings({ sfxVolume: Number(e.target.value) })}
            onPointerUp={() => audioManager.playPaddleHit(0.4, 6)}
          />
        </div>

        <div className="setup__field">
          <span className="setup__label">Match length (CPU &amp; 2 players)</span>
          <div className="settings__segmented" role="radiogroup" aria-label="Match length">
            {MATCH_LENGTHS.map((length) => (
              <button
                key={length}
                type="button"
                role="radio"
                aria-checked={settings.matchLength === length}
                className={`settings__segment ${settings.matchLength === length ? 'active' : ''}`}
                onClick={() => updateSettings({ matchLength: length })}
              >
                First to {length}
              </button>
            ))}
          </div>
        </div>

        <label className="settings__toggle">
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => updateSettings({ muted: e.target.checked })}
          />
          <span>
            <strong>Mute all sound</strong>
            <small>Music and effects</small>
          </span>
        </label>

        <label className="settings__toggle">
          <input
            type="checkbox"
            checked={settings.reduceMotion}
            onChange={(e) => updateSettings({ reduceMotion: e.target.checked })}
          />
          <span>
            <strong>Reduce motion</strong>
            <small>No screen shake, flashes or confetti</small>
          </span>
        </label>

        <button type="button" className="face-upload__start-button" onClick={() => setUiStage('mainMenu')}>
          Done
        </button>
      </div>
    </section>
  );
}
