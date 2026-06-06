import type Phaser from 'phaser';

import { PONG_CONFIG, type PaddleSide, type ServeDirection } from '../config/pongConfig';
import { GameHud } from '../ui/GameHud';

type ServeCallback = (direction: ServeDirection) => void;

export class ScoreManager {
  private topScore = 0;
  private bottomScore = 0;
  private rallyHits = 0;
  private currentBallSpeed: number = PONG_CONFIG.ball.initialSpeed;
  private roundActive = false;
  private matchOver = false;
  private readonly scene: Phaser.Scene;
  private readonly hud: GameHud;
  private readonly onServe: ServeCallback;

  constructor(scene: Phaser.Scene, hud: GameHud, onServe: ServeCallback) {
    this.scene = scene;
    this.hud = hud;
    this.onServe = onServe;
  }

  startMatch(initialServe: ServeDirection) {
    this.matchOver = false;
    this.roundActive = false;
    this.currentBallSpeed = PONG_CONFIG.ball.initialSpeed;
    this.rallyHits = 0;
    this.hud.setScore(this.topScore, this.bottomScore);
    this.hud.showMessage('READY');
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

  registerPaddleHit() {
    this.rallyHits += 1;

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
    this.scene.physics.world.pause();

    if (winner === 'top') {
      this.topScore += 1;
    } else {
      this.bottomScore += 1;
    }

    this.hud.setScore(this.topScore, this.bottomScore);
    this.hud.showPointMessage(`${winner.toUpperCase()} SCORES`);
    this.hud.showMessage('POINT');
    this.scene.cameras.main.flash(80, 0, 229, 255, false);

    this.rallyHits = 0;
    this.currentBallSpeed = PONG_CONFIG.ball.initialSpeed;

    if (this.topScore >= PONG_CONFIG.winningScore || this.bottomScore >= PONG_CONFIG.winningScore) {
      this.matchOver = true;
      this.hud.hideCountdown();
      this.hud.hideMessage();
      this.hud.hidePointMessage();
      this.hud.showWinScreen(this.topScore > this.bottomScore ? 'TOP PLAYER' : 'BOTTOM PLAYER');
      this.scene.physics.world.pause();
      return;
    }

    this.scene.time.delayedCall(PONG_CONFIG.pointPauseMs, () => {
      this.runCountdown(nextServe);
    });
  }

  private runCountdown(nextServe: ServeDirection) {
    const countdownText = ['3', '2', '1', 'GO'];
    let index = 0;

    const tick = () => {
      if (index < countdownText.length) {
        this.hud.showCountdown(countdownText[index]);
        index += 1;
        this.scene.time.delayedCall(500, tick);
        return;
      }

      this.hud.hideCountdown();
      this.hud.hidePointMessage();
      this.hud.hideMessage();
      this.hud.hideWinScreen();
      this.roundActive = true;
      this.scene.physics.world.resume();
      this.onServe(nextServe);
    };

    tick();
  }
}