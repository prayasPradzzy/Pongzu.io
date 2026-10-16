import { PONG_CONFIG, DIFFICULTY_PRESETS, type Difficulty, type DifficultyPreset } from '../config/pongConfig';
import type { PaddleControl, PongSimulation } from './PongSimulation';

/**
 * Drives the top paddle. Each time the player sends the ball its way the CPU:
 *   1. waits out its reaction time,
 *   2. predicts where the ball will arrive (misjudging by up to aimError),
 *   3. lines up slightly off-centre so its return comes back at an angle.
 * Between shots it drifts part-way back to the middle, which is what leaves
 * the corners open for a well-placed shot.
 */
export class CpuController {
  private readonly preset: DifficultyPreset;
  private targetX: number;
  private wasIncoming = false;
  private reactAt = 0;
  private aimError = 0;
  private aimOffset = 0;

  constructor(difficulty: Difficulty, arenaWidth: number) {
    this.preset = DIFFICULTY_PRESETS[difficulty];
    this.targetX = arenaWidth / 2;
  }

  update(sim: PongSimulation, now: number): PaddleControl {
    const incoming = sim.isBallInPlay && sim.ball.vy < 0;

    if (incoming && !this.wasIncoming) {
      this.reactAt = now + this.preset.reactionDelay;
      this.aimError = randomBetween(-this.preset.aimError, this.preset.aimError);
      const side = Math.random() < 0.5 ? -1 : 1;
      this.aimOffset =
        side * this.preset.aggression * (PONG_CONFIG.paddle.width / 2) * randomBetween(0.4, 1);
    } else if (!incoming && this.wasIncoming) {
      // Shot returned (or point over): ease back towards the middle.
      const center = sim.width / 2;
      this.targetX = center + (sim.topPaddleX - center) * 0.35;
    }
    this.wasIncoming = incoming;

    if (incoming && now >= this.reactAt) {
      this.targetX = this.predictInterceptX(sim) + this.aimError + this.aimOffset;
    }

    return { direction: 0, targetX: this.targetX, speedScale: this.preset.speedMultiplier };
  }

  /** Where the ball will cross the CPU's paddle line, accounting for wall bounces. */
  private predictInterceptX(sim: PongSimulation): number {
    const { x, y, vx, vy } = sim.ball;
    const radius = PONG_CONFIG.ball.radius;
    const contactY = PONG_CONFIG.paddle.topOffset + PONG_CONFIG.paddle.height / 2 + radius;
    const time = (contactY - y) / vy; // vy < 0 and the ball is below the line → positive
    if (!(time > 0)) return x;

    const left = PONG_CONFIG.arenaPadding + radius;
    const span = sim.width - PONG_CONFIG.arenaPadding - radius - left;
    const period = span * 2;

    // Unfold the wall bounces: travel in a straight line, then fold back.
    let rel = (((x + vx * time - left) % period) + period) % period;
    if (rel > span) rel = period - rel;
    return left + rel;
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
