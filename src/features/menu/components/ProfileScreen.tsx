import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { OptionalFaceUpload } from '../../faceUpload/components/OptionalFaceUpload';

/** Name + face, remembered on this device and used in every mode. */
export function ProfileScreen() {
  const { playerName, setPlayerName, setUiStage } = useFaceUploadStore();

  return (
    <section className="face-upload">
      <div className="face-upload__panel setup-panel">
        <p className="face-upload__eyebrow">Your Profile</p>
        <h1 className="face-upload__title setup__title">Who's playing?</h1>
        <p className="face-upload__copy">Your face becomes the ball when your opponent has to hit it.</p>

        <div className="setup__field">
          <label className="setup__label" htmlFor="profile-name">Your Name</label>
          <input
            id="profile-name"
            className="setup__input"
            type="text"
            placeholder="Enter your name"
            maxLength={20}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setUiStage('mainMenu')}
          />
        </div>

        <OptionalFaceUpload />

        <button type="button" className="face-upload__start-button" onClick={() => setUiStage('mainMenu')}>
          Done
        </button>
      </div>
    </section>
  );
}
