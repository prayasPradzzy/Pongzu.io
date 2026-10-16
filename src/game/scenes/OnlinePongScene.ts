import Phaser from 'phaser';

import { Ball } from '../entities/Ball';
import { Paddle } from '../entities/Paddle';
import { PONG_CONFIG } from '../config/pongConfig';
import { GameHud } from '../ui/GameHud';
import { ArenaBackdrop } from '../ui/ArenaBackdrop';
import { VisualEffectsSystem } from '../systems/VisualEffectsSystem';
import { ReconciliationBuffer } from '../systems/ReconciliationBuffer';
import { NetworkInputEmitter } from '../systems/NetworkInputEmitter';
import { InputManager } from '../systems/InputManager';
import { advancePaddle, IDLE_CONTROL } from '../systems/PongSimulation';
import { audioManager } from '../systems/AudioManager';
import {
  socketService as socketServiceInstance,
  type ConnectionStatus,
} from '../../features/multiplayer/SocketService';
import type { Role, MatchState, MatchOverPayload, PlayerDisconnectedPayload } from '../../protocol/events';

type SocketServiceType = typeof socketServiceInstance;

/**
 * Online multiplayer Phaser scene.
 *
 * Ownership contract:
 *   Server owns: ball, both paddles, scores, match state, win/loss
 *   Client owns: rendering, input, visual effects, HUD
 *
 * The local paddle is predicted from input so it responds instantly, then
 * gently pulled back to the server's value whenever the two disagree.
 *
 * In server space the host is the top paddle. The host's view is flipped
 * vertically so every player sees themselves at the bottom.
 */
export class OnlinePongScene extends Phaser.Scene {
  private ball!: Ball;
  private myPaddle!: Paddle; // drawn at the bottom
  private opponentPaddle!: Paddle; // drawn at the top
  private hud!: GameHud;
  private effects!: VisualEffectsSystem;
  private backdrop!: ArenaBackdrop;

  private inputManager!: InputManager;
  private netInput!: NetworkInputEmitter;
  private snapshots!: ReconciliationBuffer;

  private role!: Role;
  private flipped = false;
  private socketService!: SocketServiceType;
  private unsubscribers: Array<() => void> = [];

  private localPaddleX = 0;
  private lastInputActiveAt = 0;
  private matchState: MatchState = 'lobby';
  private shownTopScore = 0;
  private shownBottomScore = 0;

  // For spotting bounces in the rendered ball path
  private lastBallVx = 0;
  private lastBallVy = 0;

  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayTimer: Phaser.Time.TimerEvent | null = null;
  private opponentAway = false;
  private connectionLost = false;
  private matchOver = false;
  private roomClosed = false;
  private rematchVoted = false;

  constructor() {
    super('online-pong');
  }

  create() {
    const { width, height } = this.scale;
    const config = this.registry.get('customConfig');
    this.role = config?.role ?? 'guest';
    this.flipped = this.role === 'host';
    this.socketService = config?.socketService;

    this.backdrop = new ArenaBackdrop(this);
    this.backdrop.draw(width, height);

    this.hud = new GameHud(this);
    this.hud.resize(width, height);
    this.effects = new VisualEffectsSystem(this);

    this.opponentPaddle = new Paddle(this, width / 2, PONG_CONFIG.paddle.topOffset, PONG_CONFIG.colors.paddleTop);
    this.myPaddle = new Paddle(
      this,
      width / 2,
      height - PONG_CONFIG.paddle.bottomOffset,
      PONG_CONFIG.colors.paddleBottom,
    );

    this.ball = new Ball(this, width / 2, height / 2);
    this.ball.setVisible(false);
    this.effects.setBallVisible(false);
    this.effects.followBall();

    this.localPaddleX = width / 2;
    this.snapshots = new ReconciliationBuffer();
    this.inputManager = new InputManager(this);
    this.netInput = new NetworkInputEmitter(this.socketService);

    this.registerSocketListeners();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    // Destroying the whole game (leaving the screen) skips SHUTDOWN, and the
    // socket outlives the scene — its listeners must never fire into a dead HUD.
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseExternal, this);

    audioManager.playBGM();
  }

  update(time: number, delta: number) {
    const { width, height } = this.scale;
    const topY = PONG_CONFIG.paddle.topOffset;
    const bottomY = height - PONG_CONFIG.paddle.bottomOffset;

    // ── Authoritative state (newest packet, no render delay) ──
    const latest = this.snapshots.getLatest();
    if (latest && !this.matchOver) {
      this.matchState = latest.state;
      this.applyScore(latest.topScore, latest.bottomScore);
    }

    // ── Local paddle: predict from input, then reconcile ──
    const blocked = this.opponentAway || this.connectionLost || this.roomClosed || this.matchOver;
    const canMove =
      !blocked &&
      (this.matchState === 'playing' || this.matchState === 'countdown' || this.matchState === 'point_scored');
    const control = canMove ? this.inputManager.getControl() : IDLE_CONTROL;

    if (canMove) {
      this.netInput.send(control);
    } else {
      this.netInput.release();
    }

    const moved = advancePaddle(this.localPaddleX, control, Math.min(delta, 100), width);
    this.localPaddleX = moved.x;
    if (moved.moved !== 0 || control.direction !== 0) {
      this.lastInputActiveAt = time;
    }

    if (latest) {
      const serverX = this.role === 'host' ? latest.hostPaddleX : latest.guestPaddleX;
      this.reconcilePaddle(serverX, time, delta);
    }

    // ── Render the delayed, smoothed world ──
    const view = this.snapshots.getInterpolatedState();
    let ballVisible = false;

    if (view) {
      const opponentX = this.role === 'host' ? view.guestPaddleX : view.hostPaddleX;
      this.opponentPaddle.setPosition(opponentX, topY);

      ballVisible = view.state === 'playing' && !blocked;
      if (ballVisible) {
        const ballX = view.ball.x;
        const ballY = this.flipped ? height - view.ball.y : view.ball.y;
        this.ball.setPosition(ballX, ballY);
        this.ball.roll(view.ball.vx, delta);
        this.detectBounces(view.ball.vx, view.ball.vy, ballX, ballY, height);
        this.effects.trackBall(ballX, ballY);
        this.effects.updateGlow(ballX, ballY, time);
      } else {
        this.lastBallVx = 0;
        this.lastBallVy = 0;
      }
    }

    this.ball.setVisible(ballVisible);
    this.effects.setBallVisible(ballVisible);
    this.myPaddle.setPosition(this.localPaddleX, bottomY);

    this.hud.setNamePositions(this.opponentPaddle.getX(), this.localPaddleX, topY, bottomY);
    this.hud.setPing(this.socketService.ping);
  }

  /**
   * The server's copy of our paddle trails our prediction by roughly one
   * round trip while we're moving, so only correct what latency can't explain,
   * and settle exactly onto the server value once we've stopped.
   */
  private reconcilePaddle(serverX: number, time: number, delta: number) {
    const error = serverX - this.localPaddleX;
    if (Math.abs(error) < 0.5) return;

    const latencySeconds = this.socketService.ping / 1000 + 0.12;
    const settled = time - this.lastInputActiveAt > latencySeconds * 1000;

    if (settled) {
      this.localPaddleX += error * Math.min(1, delta / 80);
      return;
    }

    const allowance = PONG_CONFIG.paddle.speed * latencySeconds + 20;
    if (Math.abs(error) > allowance) {
      this.localPaddleX += error - Math.sign(error) * allowance;
    }
  }

  private detectBounces(vx: number, vy: number, x: number, y: number, height: number) {
    const vyFlipped = this.lastBallVy !== 0 && Math.sign(vy) !== Math.sign(this.lastBallVy);
    const vxFlipped = this.lastBallVx !== 0 && vx !== 0 && Math.sign(vx) !== Math.sign(this.lastBallVx);

    if (vyFlipped) {
      this.effects.playPaddleHit(x, y);
      (y > height / 2 ? this.myPaddle : this.opponentPaddle).playImpactFeedback();
      this.ball.playHitStretch();
    } else if (vxFlipped) {
      this.effects.playWallBounce(x, y);
    }

    this.lastBallVx = vx;
    this.lastBallVy = vy;
  }

  /** Scores arrive in server space (top = host); the HUD wants (opponent, me). */
  private applyScore(top: number, bottom: number) {
    if (top === this.shownTopScore && bottom === this.shownBottomScore) return;
    this.shownTopScore = top;
    this.shownBottomScore = bottom;
    this.hud.setScore(this.flipped ? bottom : top, this.flipped ? top : bottom);
  }

  // ─── Socket event wiring ───────────────────────────────────────────────────

  private registerSocketListeners() {
    const svc = this.socketService;
    if (!svc) return;

    this.unsubscribers = [
      svc.onGameStateSnapshot((snap) => this.snapshots.push(snap)),

      svc.onGameScore(({ top, bottom }) => this.applyScore(top, bottom)),

      svc.onMatchStateChange(({ state }) => {
        this.matchState = state;
      }),

      svc.onGameCountdown(({ value }) => {
        const isGo = value === 'GO';
        if (isGo) audioManager.playCountdownGo();
        else audioManager.playCountdownTick();
        this.hud.showCountdown(value, isGo);
      }),

      svc.onGameRoundStart(() => {
        this.hud.hideCountdown();
        this.hud.hidePointMessage();
        this.hud.hideMessage();
        this.ball.resetRotation();
      }),

      svc.onGameRoundEnd(({ scoringSide }) => {
        const localSide = this.role === 'host' ? 'top' : 'bottom';
        this.hud.showPointMessage(scoringSide === localSide ? '🎉 YOU SCORE' : '😤 OPPONENT SCORES');
        this.hud.showMessage('POINT');
        this.effects.playScoreExplosion(this.scale.width / 2, this.scale.height / 2);
        this.cameras.main.flash(80, 0, 229, 255, false);
        // The ball jumps back to the centre — don't blend across that.
        this.snapshots.clear();
      }),

      svc.onMatchOver((payload) => this.handleMatchOver(payload)),

      svc.onMatchRematchVote(() => {
        if (!this.rematchVoted && !this.roomClosed) {
          this.hud.setPlayAgainLabel('ACCEPT REMATCH');
        }
      }),

      svc.onMatchRematchStart(() => {
        this.matchOver = false;
        this.rematchVoted = false;
        this.matchState = 'countdown';
        this.localPaddleX = this.scale.width / 2;
        this.snapshots.clear();
        this.hud.hideWinScreen();
        this.applyScore(0, 0);
      }),

      svc.onPlayerDisconnected(({ graceMs }: PlayerDisconnectedPayload) => {
        this.opponentAway = true;
        this.hud.hideCountdown();
        this.showOverlay('Your opponent lost connection.', Math.round(graceMs / 1000));
      }),

      svc.onPlayerReconnected(() => {
        this.opponentAway = false;
        this.snapshots.clear();
        if (!this.connectionLost) this.hideOverlay();
      }),

      svc.onMatchRejoined(({ topScore, bottomScore }) => {
        this.connectionLost = false;
        this.snapshots.clear();
        this.applyScore(topScore, bottomScore);
        if (!this.opponentAway) this.hideOverlay();
      }),

      svc.onRoomClosed(({ reason }) => {
        this.roomClosed = true;
        if (this.matchOver) {
          this.hud.setPlayAgainLabel('OPPONENT LEFT', false);
        } else {
          this.showOverlay(reason || 'The room was closed.');
        }
      }),

      svc.onStatusChange((status: ConnectionStatus) => {
        if (this.roomClosed) return;
        if (status === 'reconnecting') {
          this.connectionLost = true;
          this.hud.hideCountdown();
          this.showOverlay('Connection lost.\nReconnecting…');
        } else if (status === 'failed') {
          this.connectionLost = true;
          this.roomClosed = true;
          if (this.matchOver) this.hud.setPlayAgainLabel('DISCONNECTED', false);
          else this.showOverlay("Couldn't reconnect to the server.");
        }
      }),
    ];

    this.events.on('rematch', () => {
      if (this.rematchVoted || this.roomClosed || !this.matchOver) return;
      this.rematchVoted = true;
      this.socketService.sendRematch();
      this.hud.setPlayAgainLabel('WAITING FOR OPPONENT…', false);
    });

    this.events.on('exit-match', () => {
      audioManager.stopBGM();
      this.registry.get('customConfig')?.onExit?.();
    });
  }

  private handleMatchOver({ winner, reason, stats }: MatchOverPayload) {
    this.matchOver = true;
    this.matchState = 'match_over';
    this.opponentAway = false;
    this.hideOverlay();
    this.hud.hideCountdown();
    this.hud.hideMessage();
    this.hud.hidePointMessage();
    this.applyScore(stats.topScore, stats.bottomScore);

    const localWon = winner === this.role;
    if (localWon) audioManager.playWin();
    else audioManager.playLose();

    // showWinScreen treats "bottom" as the local player.
    this.hud.showWinScreen(localWon ? 'victory' : 'defeat', {
      topScore: this.flipped ? stats.bottomScore : stats.topScore,
      bottomScore: this.flipped ? stats.topScore : stats.bottomScore,
      longestRally: stats.longestRally,
    }, reason === 'opponent_disconnected' ? 'Your opponent left the match.' : undefined);

    if (reason === 'opponent_disconnected') {
      // The server has already torn the room down.
      this.roomClosed = true;
      this.hud.setPlayAgainLabel('OPPONENT LEFT', false);
    }
  }

  // ─── Overlay (disconnects, closed rooms) ───────────────────────────────────

  private showOverlay(message: string, countdownSeconds?: number) {
    this.hideOverlay();

    const { width, height } = this.scale;
    const font = 'Nunito, system-ui, sans-serif';

    const bg = this.add.rectangle(0, 0, 380, 220, 0x0f0820, 0.92);
    bg.setStrokeStyle(2, 0xffb7e1, 0.7);
    bg.setRounded(20);

    const text = this.add.text(0, -54, message, {
      fontFamily: font,
      fontSize: '18px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 320 },
    });
    text.setOrigin(0.5);

    const returnBg = this.add.rectangle(0, 54, 280, 42, 0xffffff, 1);
    returnBg.setStrokeStyle(2, 0xff8dc7, 1);
    returnBg.setRounded(21);
    returnBg.setInteractive({ useHandCursor: true });
    returnBg.on('pointerdown', () => this.events.emit('exit-match'));

    const returnText = this.add.text(0, 54, 'RETURN TO MENU', {
      fontFamily: font,
      fontSize: '13px',
      color: '#ff8dc7',
      fontStyle: '800',
    });
    returnText.setOrigin(0.5);
    returnText.setLetterSpacing(1.5);

    const children: Phaser.GameObjects.GameObject[] = [bg, text, returnBg, returnText];

    if (countdownSeconds !== undefined) {
      let secondsLeft = countdownSeconds;
      const label = () => `Waiting ${secondsLeft}s for them to return…`;
      const countdownText = this.add.text(0, -6, label(), {
        fontFamily: font,
        fontSize: '14px',
        color: '#ffb7e1',
        align: 'center',
      });
      countdownText.setOrigin(0.5);
      children.push(countdownText);

      // Display only — the server decides when the wait is over.
      this.overlayTimer = this.time.addEvent({
        delay: 1000,
        repeat: countdownSeconds - 1,
        callback: () => {
          secondsLeft = Math.max(0, secondsLeft - 1);
          countdownText.setText(label());
        },
      });
    }

    this.overlay = this.add.container(width / 2, height / 2, children);
    this.overlay.setDepth(100);
  }

  private hideOverlay() {
    this.overlayTimer?.destroy();
    this.overlayTimer = null;
    this.overlay?.destroy();
    this.overlay = null;
  }

  /** Detach from everything that lives longer than this scene. Safe to call twice. */
  private releaseExternal() {
    audioManager.stopBGM();
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers = [];
  }

  private shutdown() {
    this.releaseExternal();
    this.events.off('rematch');
    this.events.off('exit-match');
    this.hideOverlay();
    this.effects.destroy();
    this.hud.destroy();
    this.backdrop.destroy();
  }
}
