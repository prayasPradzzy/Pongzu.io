import type { PaddleSide, ServeDirection } from '../protocol/events.js';
import { SERVER_PONG_CONFIG } from './ServerBallSimulator.js';

export type MatchStats = {
  topScore: number;
  bottomScore: number;
  longestRally: number;
};

export class ServerScoreManager {
  private topScore = 0;
  private bottomScore = 0;
  private rallyHits = 0;
  private longestRally = 0;
  private currentBallSpeed: number = SERVER_PONG_CONFIG.ball.initialSpeed;

  reset() {
    this.topScore = 0;
    this.bottomScore = 0;
    this.rallyHits = 0;
    this.longestRally = 0;
    this.currentBallSpeed = SERVER_PONG_CONFIG.ball.initialSpeed;
  }

  registerPaddleHit(): number {
    this.rallyHits += 1;
    if (this.rallyHits > this.longestRally) {
      this.longestRally = this.rallyHits;
    }
    if (this.rallyHits % SERVER_PONG_CONFIG.ball.boostEveryHits === 0) {
      this.currentBallSpeed = Math.min(
        this.currentBallSpeed + SERVER_PONG_CONFIG.ball.speedBoost,
        SERVER_PONG_CONFIG.ball.maxSpeed,
      );
    }
    return this.currentBallSpeed;
  }

  scorePoint(winner: PaddleSide): { topScore: number; bottomScore: number; matchOver: boolean; nextServe: ServeDirection } {
    if (this.rallyHits > this.longestRally) {
      this.longestRally = this.rallyHits;
    }
    this.rallyHits = 0;
    this.currentBallSpeed = SERVER_PONG_CONFIG.ball.initialSpeed;

    if (winner === 'top') {
      this.topScore += 1;
    } else {
      this.bottomScore += 1;
    }

    const matchOver = this.topScore >= SERVER_PONG_CONFIG.winningScore || this.bottomScore >= SERVER_PONG_CONFIG.winningScore;
    const nextServe: ServeDirection = winner === 'top' ? 'down' : 'up';

    return { topScore: this.topScore, bottomScore: this.bottomScore, matchOver, nextServe };
  }

  getCurrentBallSpeed(): number {
    return this.currentBallSpeed;
  }

  getTopScore(): number { return this.topScore; }
  getBottomScore(): number { return this.bottomScore; }
  getLongestRally(): number { return this.longestRally; }

  isMatchOver(): boolean {
    return this.topScore >= SERVER_PONG_CONFIG.winningScore || this.bottomScore >= SERVER_PONG_CONFIG.winningScore;
  }

  getStats(): MatchStats {
    return {
      topScore: this.topScore,
      bottomScore: this.bottomScore,
      longestRally: this.longestRally,
    };
  }
}
