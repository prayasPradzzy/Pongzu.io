import Phaser from 'phaser';

import { PONG_CONFIG, DIFFICULTY_PRESETS, type Difficulty } from '../config/pongConfig';
import type { Paddle } from '../entities/Paddle';
import type { Ball } from '../entities/Ball';

export class CpuController {
  private readonly preset;
  private targetX: number;
  private lastUpdateTime = 0;
  private errorOffset = 0;

  constructor(private readonly scene: Phaser.Scene, difficulty: Difficulty) {
    this.preset = DIFFICULTY_PRESETS[difficulty];
    this.targetX = scene.scale.width / 2;
  }

  update(paddle: Paddle, ball: Ball, width: number) {
    const now = this.scene.time.now;

    // Only recalculate target after reaction delay
    if (now - this.lastUpdateTime > this.preset.reactionDelay) {
      this.lastUpdateTime = now;
      this.targetX = this.predictInterceptX(ball, width);

      // Apply accuracy error
      if (this.preset.accuracy < 1) {
        const maxError = PONG_CONFIG.paddle.width * (1 - this.preset.accuracy);
        this.errorOffset = Phaser.Math.FloatBetween(-maxError, maxError);
      } else {
        this.errorOffset = 0;
      }
    }

    const target = this.targetX + this.errorOffset;
    const paddleX = paddle.getX();
    const deadZone = 6;

    const diff = target - paddleX;
    if (Math.abs(diff) < deadZone) {
      paddle.setHorizontalVelocity(0);
    } else {
      const dir = diff > 0 ? 1 : -1;
      paddle.setHorizontalVelocity(dir * this.preset.speedMultiplier);
    }
  }

  private predictInterceptX(ball: Ball, width: number): number {
    const body = ball.getSprite().body as Phaser.Physics.Arcade.Body;
    const vy = body.velocity.y;
    const vx = body.velocity.x;

    // Ball moving away from CPU (downward) — return to center
    if (vy >= 0) {
      return width / 2;
    }

    // Predict time to reach the CPU paddle y-position
    const targetY = PONG_CONFIG.paddle.topOffset;
    const dy = targetY - ball.getY();
    const timeToReach = dy / vy; // vy is negative, dy is negative, so positive result

    if (timeToReach <= 0) {
      return width / 2;
    }

    // Predict x-position, simulating wall bounces
    let predictedX = ball.getX() + vx * timeToReach;

    // Simulate wall bounces within arena bounds
    const leftWall = PONG_CONFIG.arenaPadding + PONG_CONFIG.ball.radius;
    const rightWall = width - PONG_CONFIG.arenaPadding - PONG_CONFIG.ball.radius;
    const arenaWidth = rightWall - leftWall;

    if (arenaWidth > 0) {
      // Normalize position relative to left wall
      predictedX -= leftWall;
      // Use modular reflection to handle bounces
      const cycles = Math.floor(predictedX / arenaWidth);
      predictedX = predictedX - cycles * arenaWidth;
      if (predictedX < 0) predictedX = -predictedX;
      // If in an odd cycle, reflect
      const segment = Math.floor(predictedX / arenaWidth);
      const remainder = predictedX - segment * arenaWidth;
      predictedX = segment % 2 === 0 ? remainder : arenaWidth - remainder;
      predictedX += leftWall;
    }

    return Phaser.Math.Clamp(predictedX, PONG_CONFIG.arenaPadding, width - PONG_CONFIG.arenaPadding);
  }
}
