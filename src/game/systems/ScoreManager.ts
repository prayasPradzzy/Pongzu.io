import type Phaser from 'phaser';

import { PONG_CONFIG, type PaddleSide, type ServeDirection } from '../config/pongConfig';
import { GameHud } from '../ui/GameHud';
import { audioManager } from './AudioManager';

export type MatchResult = {
  topScore: number;
  bottomScore: number;
  longestRally: number;
  /** px/s */
  topSpeed: number;
};

type ScoreManagerOptions = {
  winningScore: number;
  /** Text shown when a side scores, e.g. "🎉 YOU SCORE". */
  pointMessage: (scorer: PaddleSide) => string;
  onServe: (direction: ServeDirection) => void;
  onMatchOver: (result: MatchResult) => void;
};

/** Match flow for locally simulated matches (CPU and same-device). */
export class ScoreManager {
  private topScore = 0;
  private bottomScore = 0;
  private rallyHits = 0;
  private longestRally = 0;
  private topSpeed = 0;
  private currentBallSpeed: number = PONG_CONFIG.ball.initialSpeed;
  private roundActive = false;
  private matchOver = false;
  private countdownRun = 0;
  private readonly scene: Phaser.Scene;
  private readonly hud: GameHud;
  private readonly options: ScoreManagerOptions;

  constructor(scene: Phaser.Scene, hud: GameHud, options: ScoreManagerOptions) {
    this.scene = scene;
    this.hud = hud;
    this.options = options;
  }

  startMatch(initialServe: ServeDirection) {
    this.topScore = 0;
    this.bottomScore = 0;
    this.matchOver = false;
    this.roundActive = false;
    this.currentBallSpeed = PONG_CONFIG.ball.initialSpeed;
    this.rallyHits = 0;
    this.longestRally = 0;
    this.topSpeed = 0;
    this.hud.setScore(0, 0);
    this.hud.showMessage(`FIRST TO ${this.options.winningScore}`);
    this.hud.hideWinScreen();
    this.runCountdown(initialServe);
  }

  isRoundActive() {
    return this.roundActive;
  }

  isMatchOver() {
    return this.matchOver;
  }

  getCurrentBallSpeed() {
    return this.currentBallSpeed;
  }

  getRallyHits() {
    return this.rallyHits;
  }

  /** Counts the hit and returns the ball speed for the return shot. */
  registerPaddleHit() {
    this.rallyHits += 1;
    this.longestRally = Math.max(this.longestRally, this.rallyHits);

    if (this.rallyHits % PONG_CONFIG.ball.boostEveryHits === 0) {
      this.currentBallSpeed = Math.min(this.currentBallSpeed + PONG_CONFIG.ball.speedBoost, PONG_CONFIG.ball.maxSpeed);
    }
    this.topSpeed = Math.max(this.topSpeed, this.currentBallSpeed);

    return this.currentBallSpeed;
  }

  scorePoint(winner: PaddleSide, nextServe: ServeDirection) {
    if (!this.roundActive || this.matchOver) {
      return;
    }

    this.roundActive = false;
    if (winner === 'top') this.topScore += 1;
    else this.bottomScore += 1;

    this.hud.setScore(this.topScore, this.bottomScore);
    this.hud.showPointMessage(this.options.pointMessage(winner));

    this.rallyHits = 0;
    this.currentBallSpeed = PONG_CONFIG.ball.initialSpeed;

    const target = this.options.winningScore;
    if (this.topScore >= target || this.bottomScore >= target) {
      this.matchOver = true;
      this.hud.hideCountdown();
      this.hud.hideMessage();
      this.hud.hidePointMessage();
      this.options.onMatchOver({
        topScore: this.topScore,
        bottomScore: this.bottomScore,
        longestRally: this.longestRally,
        topSpeed: this.topSpeed,
      });
      return;
    }

    const run = this.countdownRun;
    this.scene.time.delayedCall(PONG_CONFIG.pointPauseMs, () => {
      if (run === this.countdownRun && !this.matchOver) this.runCountdown(nextServe);
    });
  }

  private runCountdown(nextServe: ServeDirection) {
    const countdownText = ['3', '2', '1', 'GO'];
    let index = 0;
    const run = ++this.countdownRun;
    audioManager.duckMusic(true);

    const target = this.options.winningScore;
    if (this.topScore === target - 1 || this.bottomScore === target - 1) {
      this.hud.showBanner('MATCH POINT');
      audioManager.playRallyMilestone();
    }

    const tick = () => {
      if (run !== this.countdownRun) return; // superseded by a newer countdown
      if (index < countdownText.length) {
        const value = countdownText[index];
        const isGo = value === 'GO';
        if (isGo) audioManager.playCountdownGo();
        else audioManager.playCountdownTick();
        this.hud.showCountdown(value, isGo);
        index += 1;
        this.scene.time.delayedCall(500, tick);
        return;
      }

      this.hud.hideCountdown();
      this.hud.hidePointMessage();
      this.hud.hideMessage();
      audioManager.duckMusic(false);
      this.roundActive = true;
      this.options.onServe(nextServe);
    };

    tick();
  }
}
