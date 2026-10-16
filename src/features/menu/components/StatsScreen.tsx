import { useFaceUploadStore } from '../../faceUpload/faceUploadStore';
import { loadStats } from '../../stats/statsStore';

export function StatsScreen() {
  const { setUiStage } = useFaceUploadStore();
  const stats = loadStats();
  const winRate = stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0;

  return (
    <section className="face-upload">
      <div className="face-upload__panel setup-panel">
        <p className="face-upload__eyebrow">Your Stats</p>
        <h1 className="face-upload__title setup__title">Statistics</h1>

        <div className="stats-grid">
          <div className="stats-card">
            <span className="stats-card__value">{stats.matchesPlayed}</span>
            <span className="stats-card__label">Matches</span>
          </div>
          <div className="stats-card">
            <span className="stats-card__value">{stats.wins}</span>
            <span className="stats-card__label">Wins</span>
          </div>
          <div className="stats-card">
            <span className="stats-card__value">{stats.losses}</span>
            <span className="stats-card__label">Losses</span>
          </div>
          <div className="stats-card">
            <span className="stats-card__value">{winRate}%</span>
            <span className="stats-card__label">Win Rate</span>
          </div>
          <div className="stats-card">
            <span className="stats-card__value">{stats.longestRally}</span>
            <span className="stats-card__label">Longest Rally</span>
          </div>
          <div className="stats-card">
            <span className="stats-card__value stats-card__value--text">{stats.highestDifficultyBeaten || '—'}</span>
            <span className="stats-card__label">Best Difficulty</span>
          </div>
          <div className="stats-card">
            <span className="stats-card__value">{stats.topSpeed ? `${stats.topSpeed}` : '—'}</span>
            <span className="stats-card__label">Top Speed km/h</span>
          </div>
          <div className="stats-card">
            <span className="stats-card__value">{stats.onlineWins}</span>
            <span className="stats-card__label">Online Wins</span>
          </div>
        </div>

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
