import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { OptionalFaceUpload } from '../../faceUpload/components/OptionalFaceUpload';
import type { FaceUploadState } from '../../faceUpload/faceUploadTypes';

const DIFFICULTIES: Array<{ key: FaceUploadState['difficulty']; label: string; desc: string }> = [
  { key: 'easy',      label: '🟢 Easy',      desc: 'Relaxed pace' },
  { key: 'medium',    label: '🟡 Medium',    desc: 'Fair challenge' },
  { key: 'hard',      label: '🔴 Hard',      desc: 'Fast & precise' },
  { key: 'nightmare', label: '💀 Nightmare', desc: 'No mercy' },
];

export function CpuSetupScreen() {
  const {
    playerName,
    difficulty,
    setPlayerName,
    setDifficulty,
    setGameMode,
    setUiStage,
  } = useFaceUploadStore();

  const handleStart = () => {
    setGameMode('cpu');
    setUiStage('playing');
  };

  return (
    <section className="face-upload">
      <div className="face-upload__panel setup-panel">
        <p className="face-upload__eyebrow">Single Player</p>
        <h1 className="face-upload__title setup__title">Play vs CPU</h1>

        {/* Name input */}
        <div className="setup__field">
          <label className="setup__label" htmlFor="cpu-name">Your Name</label>
          <input
            id="cpu-name"
            className="setup__input"
            type="text"
            placeholder="Enter your name"
            maxLength={20}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Optional face upload */}
        <OptionalFaceUpload />

        {/* Difficulty picker */}
        <div className="setup__field">
          <label className="setup__label">Difficulty</label>
          <div className="setup__difficulty-grid">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.key}
                type="button"
                className={`setup__diff-btn ${difficulty === d.key ? 'active' : ''}`}
                onClick={() => setDifficulty(d.key)}
              >
                <strong>{d.label}</strong>
                <small>{d.desc}</small>
              </button>
            ))}
          </div>
        </div>

        {/* Start */}
        <button
          type="button"
          className="face-upload__start-button"
          onClick={handleStart}
          disabled={!playerName.trim()}
        >
          Start Match →
        </button>

        <button
          type="button"
          className="face-upload__ghost-button setup__back"
          onClick={() => setUiStage('mainMenu')}
        >
          ← Back
        </button>
      </div>
    </section>
  );
}
