import Phaser from 'phaser';

import { Ball } from '../entities/Ball';
import { Paddle } from '../entities/Paddle';
import { PONG_CONFIG, type Difficulty, type ServeDirection } from '../config/pongConfig';
import { GameHud } from '../ui/GameHud';
import { ArenaBackdrop } from '../ui/ArenaBackdrop';
import { InputManager } from '../systems/InputManager';
import { ScoreManager } from '../systems/ScoreManager';
import { VisualEffectsSystem } from '../systems/VisualEffectsSystem';
import { CpuController } from '../systems/CpuController';
import { PongSimulation } from '../systems/PongSimulation';
import { audioManager } from '../systems/AudioManager';

/** Single-player match against the CPU. The player is always the bottom paddle. */
export class PongScene extends Phaser.Scene {
  private inputManager!: InputManager;
  private cpuController!: CpuController;
  private sim!: PongSimulation;
  private ball!: Ball;
  private topPaddle!: Paddle;
  private bottomPaddle!: Paddle;
  private hud!: GameHud;
  private scoreManager!: ScoreManager;
  private effects!: VisualEffectsSystem;
  private backdrop!: ArenaBackdrop;

  constructor() {
    super('pong');
  }

  create() {
    const { width, height } = this.scale;
    const config = this.registry.get('customConfig');
    const difficulty: Difficulty = config?.difficulty ?? 'medium';

    this.backdrop = new ArenaBackdrop(this);
    this.backdrop.draw(width, height);

    this.sim = new PongSimulation(width, height);
    this.inputManager = new InputManager(this);
    this.cpuController = new CpuController(difficulty, width);
    this.hud = new GameHud(this);
    this.hud.resize(width, height);
    this.effects = new VisualEffectsSystem(this);

    this.topPaddle = new Paddle(this, width / 2, PONG_CONFIG.paddle.topOffset, PONG_CONFIG.colors.paddleTop);
    this.bottomPaddle = new Paddle(
      this,
      width / 2,
      height - PONG_CONFIG.paddle.bottomOffset,
      PONG_CONFIG.colors.paddleBottom,
    );

    this.ball = new Ball(this, width / 2, height / 2);
    this.ball.setVisible(false);

    this.scoreManager = new ScoreManager(this, this.hud, (direction) => this.launchBall(direction));
    this.scoreManager.setEffects(this.effects);
    this.effects.followBall();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    // Destroying the whole game skips SHUTDOWN; the music must still stop.
    this.events.once(Phaser.Scenes.Events.DESTROY, () => audioManager.stopBGM());

    this.events.on('rematch', () => {
      this.sim.centerPaddles();
      this.sim.resetBall();
      this.ball.setVisible(false);
      this.scoreManager.startMatch(Math.random() < 0.5 ? 'up' : 'down');
    });

    this.events.on('exit-match', () => {
      audioManager.stopBGM();
      this.registry.get('customConfig')?.onExit?.();
    });

    this.scoreManager.startMatch(Math.random() < 0.5 ? 'up' : 'down');
    audioManager.playBGM();
  }

  update(time: number, delta: number) {
    const height = this.scale.height;
    const sim = this.sim;

    const events = sim.step(
      delta,
      this.cpuController.update(sim, time),
      this.inputManager.getControl(),
      () => this.scoreManager.registerPaddleHit(),
    );

    for (const event of events) {
      if (event.type === 'wall') {
        this.effects.playWallBounce(event.x, event.y);
      } else if (event.type === 'paddle') {
        this.effects.playPaddleHit(event.x, event.y);
        (event.side === 'top' ? this.topPaddle : this.bottomPaddle).playImpactFeedback();
        this.ball.playHitStretch();
      } else {
        this.ball.setVisible(false);
        this.scoreManager.scorePoint(event.side, event.side === 'top' ? 'down' : 'up');
      }
    }

    this.topPaddle.setPosition(sim.topPaddleX, PONG_CONFIG.paddle.topOffset);
    this.bottomPaddle.setPosition(sim.bottomPaddleX, height - PONG_CONFIG.paddle.bottomOffset);

    if (sim.isBallInPlay) {
      this.ball.setPosition(sim.ball.x, sim.ball.y);
      this.ball.roll(sim.ball.vx, delta);
      this.effects.trackBall(sim.ball.x, sim.ball.y);
      this.effects.updateGlow(sim.ball.x, sim.ball.y, time);
    }
    this.effects.setBallVisible(sim.isBallInPlay);

    this.hud.setNamePositions(
      sim.topPaddleX,
      sim.bottomPaddleX,
      PONG_CONFIG.paddle.topOffset,
      height - PONG_CONFIG.paddle.bottomOffset,
    );
  }

  private launchBall(direction: ServeDirection) {
    this.sim.serve(direction, this.scoreManager.getCurrentBallSpeed());
    this.ball.resetRotation();
    this.ball.setPosition(this.sim.ball.x, this.sim.ball.y);
    this.ball.setVisible(true);
  }

  private shutdown() {
    audioManager.stopBGM();
    this.events.off('rematch');
    this.events.off('exit-match');
    this.effects.destroy();
    this.hud.destroy();
    this.backdrop.destroy();
  }
}
