import Phaser from 'phaser';

import { Ball, PLAIN_BALL_KEY } from '../entities/Ball';
import { Paddle } from '../entities/Paddle';
import { DIFFICULTY_PRESETS, PONG_CONFIG, type Difficulty, type PaddleSide, type ServeDirection } from '../config/pongConfig';
import { GameHud, controlsHint, hasSeenControlsHint, markControlsHintSeen } from '../ui/GameHud';
import { ArenaBackdrop } from '../ui/ArenaBackdrop';
import { InputManager, SOLO_INPUT } from '../systems/InputManager';
import { ScoreManager, type MatchResult } from '../systems/ScoreManager';
import { VisualEffectsSystem } from '../systems/VisualEffectsSystem';
import { CpuController } from '../systems/CpuController';
import { PongSimulation, type PaddleControl } from '../systems/PongSimulation';
import { audioManager } from '../systems/AudioManager';
import { FACE_ME, FACE_OPPONENT } from './BootScene';
import { ARENA_HEIGHT, ARENA_WIDTH, setupSharpCamera } from '../utils/sceneSetup';
import { recordMatch, toKmh } from '../../features/stats/statsStore';

// A short freeze on fast hits makes them land with weight.
const HIT_STOP_MS = 45;
const HIT_STOP_SPEED = 0.62; // fraction of max speed
const RALLY_MILESTONES = [10, 20, 30, 50, 75, 100];

/**
 * Locally simulated match. The local player is always the bottom paddle.
 *   mode 'cpu'   — top paddle is the CPU
 *   mode 'local' — top paddle is player 2 on the same device
 */
export class PongScene extends Phaser.Scene {
  private mode: 'cpu' | 'local' = 'cpu';
  private difficulty: Difficulty = 'medium';
  private bottomInput!: InputManager;
  private topInput: InputManager | null = null;
  private cpuController: CpuController | null = null;
  private sim!: PongSimulation;
  private ball!: Ball;
  private topPaddle!: Paddle;
  private bottomPaddle!: Paddle;
  private hud!: GameHud;
  private scoreManager!: ScoreManager;
  private effects!: VisualEffectsSystem;
  private backdrop!: ArenaBackdrop;
  private freezeUntil = 0;
  private whooshedThisRally = false;
  private topName = 'CPU';
  private bottomName = 'YOU';
  private hintVisible = false;

  constructor() {
    super('pong');
  }

  create() {
    const config = this.registry.get('customConfig');
    this.mode = config?.mode === 'local' ? 'local' : 'cpu';
    this.difficulty = config?.difficulty ?? 'medium';
    const local = this.mode === 'local';
    this.topName = local ? 'Player 2' : 'CPU';
    this.bottomName = local ? config?.playerName || 'Player 1' : config?.playerName || 'You';

    setupSharpCamera(this);
    this.backdrop = new ArenaBackdrop(this);

    this.sim = new PongSimulation(ARENA_WIDTH, ARENA_HEIGHT);
    if (local) {
      // Player 1 (bottom): ← → or the bottom half of the screen. Player 2 (top): A D or the top half.
      this.bottomInput = new InputManager(this, { keys: 'arrows', region: 'bottom' });
      this.topInput = new InputManager(this, { keys: 'wasd', region: 'top' });
    } else {
      this.bottomInput = new InputManager(this, SOLO_INPUT);
      this.cpuController = new CpuController(this.difficulty, ARENA_WIDTH);
    }

    this.hud = new GameHud(this, {
      topName: this.topName,
      bottomName: this.bottomName,
      showPing: false,
      faceTopPlayer: local,
      showChangeDifficulty: !local,
      playAgainLabel: 'PLAY AGAIN',
    });
    this.effects = new VisualEffectsSystem(this);

    this.topPaddle = new Paddle(this, ARENA_WIDTH / 2, PONG_CONFIG.paddle.topOffset, PONG_CONFIG.colors.paddleTop);
    this.bottomPaddle = new Paddle(
      this,
      ARENA_WIDTH / 2,
      ARENA_HEIGHT - PONG_CONFIG.paddle.bottomOffset,
      PONG_CONFIG.colors.paddleBottom,
    );

    this.ball = new Ball(this, ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    // You start out hitting your opponent's face. After that the ball wears
    // the face of whoever conceded the last point.
    this.ball.setFace(this.textures.exists(FACE_OPPONENT) ? FACE_OPPONENT : null);
    this.ball.setVisible(false);
    this.effects.setBallVisible(false);
    this.effects.followBall();

    this.scoreManager = new ScoreManager(this, this.hud, {
      winningScore: config?.winningScore ?? PONG_CONFIG.winningScore,
      pointMessage: (scorer) => {
        if (local) return `🎉 ${(scorer === 'bottom' ? this.bottomName : this.topName).toUpperCase()} SCORES`;
        return scorer === 'bottom' ? '🎉 YOU SCORE' : '😤 CPU SCORES';
      },
      onServe: (direction) => this.launchBall(direction),
      onMatchOver: (result) => this.handleMatchOver(result),
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    // Destroying the whole game skips SHUTDOWN; the music must still stop.
    this.events.once(Phaser.Scenes.Events.DESTROY, () => audioManager.stopMusic());

    this.events.on('rematch', () => {
      this.sim.centerPaddles();
      this.sim.resetBall();
      this.ball.setVisible(false);
      this.scoreManager.startMatch(Math.random() < 0.5 ? 'up' : 'down');
    });

    this.events.on('exit-match', () => {
      audioManager.stopMusic();
      this.registry.get('customConfig')?.onExit?.();
    });

    this.scoreManager.startMatch(Math.random() < 0.5 ? 'up' : 'down');
    audioManager.startMusic();

    const touch = this.sys.game.device.input.touch;
    if (local) {
      this.hud.showHint(touch ? '👆 Each player drags in their own half' : 'Bottom: ← →   ·   Top: A D');
      this.hintVisible = true;
    } else if (!hasSeenControlsHint()) {
      this.hud.showHint(controlsHint(touch));
      this.hintVisible = true;
    }
  }

  update(time: number, delta: number) {
    const sim = this.sim;

    const topControl: PaddleControl = this.cpuController
      ? this.cpuController.update(sim, time)
      : this.topInput!.getControl();
    const bottomControl = this.bottomInput.getControl();

    // Hit-stop: hold the ball still for a beat, but keep paddles responsive.
    const frozen = time < this.freezeUntil;
    const events = frozen
      ? []
      : sim.step(delta, topControl, bottomControl, () => this.onPaddleHit());
    if (frozen) {
      sim.step(delta, topControl, bottomControl, undefined, true);
    }

    for (const event of events) {
      if (event.type === 'wall') {
        this.effects.playWallBounce(event.x, event.y);
        audioManager.playWallBounce();
      } else if (event.type === 'paddle') {
        this.handleHitEffects(event.side, event.x, event.y);
      } else {
        this.handleScore(event.side);
      }
    }

    this.topPaddle.setPosition(sim.topPaddleX, PONG_CONFIG.paddle.topOffset);
    this.bottomPaddle.setPosition(sim.bottomPaddleX, ARENA_HEIGHT - PONG_CONFIG.paddle.bottomOffset);

    if (sim.isBallInPlay) {
      const heat = this.heat();
      this.ball.setPosition(sim.ball.x, sim.ball.y);
      if (!frozen) this.ball.roll(sim.ball.vx, delta);
      this.ball.setHeat(heat, time);
      this.effects.setHeat(heat);
      this.effects.trackBall(sim.ball.x, sim.ball.y);
      this.effects.updateGlow(sim.ball.x, sim.ball.y, time);
    }
    this.effects.setBallVisible(sim.isBallInPlay);

    this.hud.setNamePositions(sim.topPaddleX, sim.bottomPaddleX);
  }

  /** 0 at serve speed, 1 at max speed. */
  private heat() {
    const { initialSpeed, maxSpeed } = PONG_CONFIG.ball;
    return (this.scoreManager.getCurrentBallSpeed() - initialSpeed) / (maxSpeed - initialSpeed);
  }

  private onPaddleHit(): number {
    const speed = this.scoreManager.registerPaddleHit();
    if (speed / PONG_CONFIG.ball.maxSpeed >= HIT_STOP_SPEED) {
      this.freezeUntil = this.time.now + HIT_STOP_MS;
    }
    return speed;
  }

  private handleHitEffects(side: PaddleSide, x: number, y: number) {
    const heat = this.heat();
    const rally = this.scoreManager.getRallyHits();
    this.effects.playPaddleHit(x, y, heat);
    (side === 'top' ? this.topPaddle : this.bottomPaddle).playImpactFeedback(heat);
    this.ball.playHitStretch();
    audioManager.playPaddleHit(heat, rally);

    // First successful hit: the player has figured out the controls.
    if (this.hintVisible && side === 'bottom') {
      this.hintVisible = false;
      this.hud.hideHint();
      if (this.mode === 'cpu') markControlsHintSeen();
    }

    if (rally >= 5) {
      this.hud.popText(`${rally}`, x, y, side === 'bottom');
    }
    if (RALLY_MILESTONES.includes(rally)) {
      this.hud.showBanner(`${rally} RALLY! 🔥`);
      audioManager.playRallyMilestone();
    }
    if (heat >= 0.85 && !this.whooshedThisRally) {
      this.whooshedThisRally = true;
      audioManager.playWhoosh();
    }
  }

  private handleScore(scorer: PaddleSide) {
    const exitX = this.sim.ball.x;
    const exitY = scorer === 'bottom' ? PONG_CONFIG.arenaPadding : ARENA_HEIGHT - PONG_CONFIG.arenaPadding;
    this.ball.setVisible(false);
    this.effects.playScoreExplosion(exitX, exitY);
    this.effects.flashScreen(255, 214, 236);
    audioManager.playScore(this.mode === 'local' || scorer === 'bottom');

    // Loser's face goes on the ball for the next point.
    const conceded = scorer === 'bottom' ? FACE_OPPONENT : FACE_ME;
    this.ball.setFace(this.textures.exists(conceded) ? conceded : null);

    this.scoreManager.scorePoint(scorer, scorer === 'top' ? 'down' : 'up');
  }

  private handleMatchOver(result: MatchResult) {
    const bottomWon = result.bottomScore > result.topScore;
    const lines = [
      `${result.bottomScore} – ${result.topScore}`,
      `Longest rally: ${result.longestRally} hits`,
      `Top speed: ${toKmh(result.topSpeed)} km/h`,
    ];

    if (this.mode === 'local') {
      const winner = bottomWon ? this.bottomName : this.topName;
      audioManager.playWin();
      this.effects.celebrate();
      this.hud.showWinScreen({
        victory: true,
        title: 'WINNER',
        subtitle: `${winner} wins!`,
        lines,
        loserFaceKey: bottomWon ? FACE_OPPONENT : this.textures.exists(FACE_ME) ? FACE_ME : PLAIN_BALL_KEY,
      });
      return;
    }

    recordMatch(bottomWon, {
      longestRally: result.longestRally,
      topSpeed: toKmh(result.topSpeed),
      difficulty: this.difficulty,
    });

    if (bottomWon) {
      audioManager.playWin();
      this.effects.celebrate();
    } else {
      audioManager.playLose();
    }

    this.hud.showWinScreen({
      victory: bottomWon,
      title: bottomWon ? 'VICTORY' : 'DEFEAT',
      subtitle: bottomWon ? `You beat the CPU!` : 'The CPU wins this one',
      lines: [...lines, `Difficulty: ${DIFFICULTY_PRESETS[this.difficulty].label}`],
      loserFaceKey: bottomWon ? FACE_OPPONENT : this.textures.exists(FACE_ME) ? FACE_ME : PLAIN_BALL_KEY,
    });
  }

  private launchBall(direction: ServeDirection) {
    this.whooshedThisRally = false;
    this.sim.serve(direction, this.scoreManager.getCurrentBallSpeed());
    this.ball.resetRotation();
    this.ball.setPosition(this.sim.ball.x, this.sim.ball.y);
    this.ball.setVisible(true);
  }

  private shutdown() {
    audioManager.stopMusic();
    this.events.off('rematch');
    this.events.off('exit-match');
    this.effects.destroy();
    this.hud.destroy();
    this.backdrop.destroy();
  }
}
