import type Phaser from 'phaser';

import { PONG_CONFIG, type PaddleSide, type ServeDirection } from '../config/pongConfig';
import { GameHud } from '../ui/GameHud';
import { audioManager } from './AudioManager';
import type { VisualEffectsSystem } from './VisualEffectsSystem';

type ServeCallback = (direction: ServeDirection) => void;

export class ScoreManager {
  private topScore = 0;
  private bottomScore = 0;
  private rallyHits = 0;
  private longestRally = 0;
  private currentBallSpeed: number = PONG_CONFIG.ball.initialSpeed;
  private roundActive = false;
  private matchOver = false;
  private countdownRun = 0;
  private readonly scene: Phaser.Scene;
  private readonly hud: GameHud;
  private readonly onServe: ServeCallback;
  private effects: VisualEffectsSystem | null = null;

  constructor(scene: Phaser.Scene, hud: GameHud, onServe: ServeCallback) {
    this.scene = scene;
    this.hud = hud;
    this.onServe = onServe;
  }

  /** Link the effects system so ScoreManager can trigger score explosions */
  setEffects(effects: VisualEffectsSystem) {
    this.effects = effects;
  }

  startMatch(initialServe: ServeDirection) {
    this.topScore = 0;
    this.bottomScore = 0;
    this.matchOver = false;
    this.roundActive = false;
    this.currentBallSpeed = PONG_CONFIG.ball.initialSpeed;
    this.rallyHits = 0;
    this.longestRally = 0;
    this.hud.setScore(this.topScore, this.bottomScore);
    this.hud.showMessage('READY');
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

  getLongestRally() {
    return this.longestRally;
  }

  getTopScore() {
    return this.topScore;
  }

  getBottomScore() {
    return this.bottomScore;
  }

  registerPaddleHit() {
    this.rallyHits += 1;

    if (this.rallyHits > this.longestRally) {
      this.longestRally = this.rallyHits;
    }

    if (this.rallyHits % PONG_CONFIG.ball.boostEveryHits === 0) {
      this.currentBallSpeed = Math.min(this.currentBallSpeed + PONG_CONFIG.ball.speedBoost, PONG_CONFIG.ball.maxSpeed);
    }

    return this.currentBallSpeed;
  }

  scorePoint(winner: PaddleSide, nextServe: ServeDirection) {
    if (!this.roundActive || this.matchOver) {
      return;
    }

    this.roundActive = false;

    if (winner === 'top') {
      this.topScore += 1;
    } else {
      this.bottomScore += 1;
    }

    this.hud.setScore(this.topScore, this.bottomScore);

    const label = winner === 'bottom' ? '🎉 YOU SCORE' : '😤 CPU SCORES';
    this.hud.showPointMessage(label);
    this.hud.showMessage('POINT');
    this.scene.cameras.main.flash(80, 0, 229, 255, false);

    // Score explosion effect at ball's last position (center of arena)
    const cx = this.scene.scale.width / 2;
    const cy = this.scene.scale.height / 2;
    this.effects?.playScoreExplosion(cx, cy);

    // Track rally before resetting
    if (this.rallyHits > this.longestRally) {
      this.longestRally = this.rallyHits;
    }
    this.rallyHits = 0;
    this.currentBallSpeed = PONG_CONFIG.ball.initialSpeed;

    if (this.topScore >= PONG_CONFIG.winningScore || this.bottomScore >= PONG_CONFIG.winningScore) {
      this.matchOver = true;
      this.hud.hideCountdown();
      this.hud.hideMessage();
      this.hud.hidePointMessage();

      const playerWon = this.bottomScore > this.topScore;
      if (playerWon) {
        audioManager.playWin();
      } else {
        audioManager.playLose();
      }

      this.hud.showWinScreen(playerWon ? 'victory' : 'defeat', {
        topScore: this.topScore,
        bottomScore: this.bottomScore,
        longestRally: this.longestRally,
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

    const tick = () => {
      if (run !== this.countdownRun) return; // superseded by a newer countdown
      if (index < countdownText.length) {
        const value = countdownText[index];
        const isGo = value === 'GO';

        // SFX
        if (isGo) {
          audioManager.playCountdownGo();
        } else {
          audioManager.playCountdownTick();
        }

        // Enhanced visual: show with scale-up, then fade out before next tick
        this.hud.showCountdown(value, isGo);

        index += 1;
        this.scene.time.delayedCall(500, tick);
        return;
      }

      this.hud.hideCountdown();
      this.hud.hidePointMessage();
      this.hud.hideMessage();
      this.roundActive = true;
      this.onServe(nextServe);
    };

    tick();
  }
}