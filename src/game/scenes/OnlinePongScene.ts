import Phaser from 'phaser';

import { Ball, PLAIN_BALL_KEY } from '../entities/Ball';
import { Paddle } from '../entities/Paddle';
import { PONG_CONFIG } from '../config/pongConfig';
import { GameHud, controlsHint, hasSeenControlsHint, markControlsHintSeen } from '../ui/GameHud';
import { ArenaBackdrop } from '../ui/ArenaBackdrop';
import { VisualEffectsSystem } from '../systems/VisualEffectsSystem';
import { ReconciliationBuffer } from '../systems/ReconciliationBuffer';
import { NetworkInputEmitter } from '../systems/NetworkInputEmitter';
import { InputManager } from '../systems/InputManager';
import { advancePaddle, IDLE_CONTROL } from '../systems/PongSimulation';
import { audioManager } from '../systems/AudioManager';
import { FACE_ME, FACE_OPPONENT } from './BootScene';
import { ARENA_HEIGHT, ARENA_WIDTH, setupSharpCamera } from '../utils/sceneSetup';
import { recordMatch, toKmh } from '../../features/stats/statsStore';
import {
  socketService as socketServiceInstance,
  type ConnectionStatus,
} from '../../features/multiplayer/SocketService';
import type { Role, MatchState, MatchOverPayload, PlayerDisconnectedPayload } from '../../protocol/events';

type SocketServiceType = typeof socketServiceInstance;

const ONLINE_WINNING_SCORE = PONG_CONFIG.winningScore;
const RALLY_MILESTONES = [10, 20, 30, 50, 75, 100];

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

  private localPaddleX = ARENA_WIDTH / 2;
  private lastInputActiveAt = 0;
  private matchState: MatchState = 'lobby';
  private myScore = 0;
  private opponentScore = 0;

  // For spotting bounces in the rendered ball path
  private lastBallVx = 0;
  private lastBallVy = 0;
  private rallyHits = 0;
  private topSpeed = 0;
  private whooshedThisRally = false;
  private hintVisible = false;

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
    const config = this.registry.get('customConfig');
    this.role = config?.role ?? 'guest';
    this.flipped = this.role === 'host';
    this.socketService = config?.socketService;

    setupSharpCamera(this);
    this.backdrop = new ArenaBackdrop(this);

    this.hud = new GameHud(this, {
      topName: config?.opponentName || 'Opponent',
      bottomName: config?.playerName || 'You',
      showPing: true,
      faceTopPlayer: false,
      showChangeDifficulty: false,
      playAgainLabel: 'REMATCH',
    });
    this.hud.setScore(0, 0);
    this.effects = new VisualEffectsSystem(this);

    this.opponentPaddle = new Paddle(this, ARENA_WIDTH / 2, PONG_CONFIG.paddle.topOffset, PONG_CONFIG.colors.paddleTop);
    this.myPaddle = new Paddle(
      this,
      ARENA_WIDTH / 2,
      ARENA_HEIGHT - PONG_CONFIG.paddle.bottomOffset,
      PONG_CONFIG.colors.paddleBottom,
    );

    this.ball = new Ball(this, ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    // Each player starts out smashing their opponent's face; after that the
    // ball wears the face of whoever conceded the last point.
    this.ball.setFace(this.pickFace(FACE_OPPONENT, FACE_ME));
    this.ball.setVisible(false);
    this.effects.setBallVisible(false);
    this.effects.followBall();

    this.snapshots = new ReconciliationBuffer();
    this.inputManager = new InputManager(this);
    this.netInput = new NetworkInputEmitter(this.socketService);

    this.registerSocketListeners();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    // Destroying the whole game (leaving the screen) skips SHUTDOWN, and the
    // socket outlives the scene — its listeners must never fire into a dead HUD.
    this.events.once(Phaser.Scenes.Events.DESTROY, this.releaseExternal, this);

    audioManager.startMusic();

    if (!hasSeenControlsHint()) {
      this.hud.showHint(controlsHint(this.sys.game.device.input.touch));
      this.hintVisible = true;
    }
  }

  update(time: number, delta: number) {
    const topY = PONG_CONFIG.paddle.topOffset;
    const bottomY = ARENA_HEIGHT - PONG_CONFIG.paddle.bottomOffset;

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

    const moved = advancePaddle(this.localPaddleX, control, Math.min(delta, 100), ARENA_WIDTH);
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
        const ballY = this.flipped ? ARENA_HEIGHT - view.ball.y : view.ball.y;
        const speed = Math.hypot(view.ball.vx, view.ball.vy);
        const heat = (speed - PONG_CONFIG.ball.initialSpeed) / (PONG_CONFIG.ball.maxSpeed - PONG_CONFIG.ball.initialSpeed);
        this.topSpeed = Math.max(this.topSpeed, speed);

        this.ball.setPosition(ballX, ballY);
        this.ball.roll(view.ball.vx, delta);
        this.ball.setHeat(heat, time);
        this.effects.setHeat(heat);
        this.detectBounces(view.ball.vx, view.ball.vy, ballX, ballY, heat);
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

    this.hud.setNamePositions(this.opponentPaddle.getX(), this.localPaddleX);
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

  private detectBounces(vx: number, vy: number, x: number, y: number, heat: number) {
    const vyFlipped = this.lastBallVy !== 0 && Math.sign(vy) !== Math.sign(this.lastBallVy);
    const vxFlipped = this.lastBallVx !== 0 && vx !== 0 && Math.sign(vx) !== Math.sign(this.lastBallVx);

    if (vyFlipped) {
      const mine = y > ARENA_HEIGHT / 2;
      this.rallyHits += 1;
      this.effects.playPaddleHit(x, y, heat);
      (mine ? this.myPaddle : this.opponentPaddle).playImpactFeedback(heat);
      this.ball.playHitStretch();
      audioManager.playPaddleHit(heat, this.rallyHits);
      if (mine && this.hintVisible) {
        this.hintVisible = false;
        this.hud.hideHint();
        markControlsHintSeen();
      }

      if (this.rallyHits >= 5) this.hud.popText(`${this.rallyHits}`, x, y, mine);
      if (RALLY_MILESTONES.includes(this.rallyHits)) {
        this.hud.showBanner(`${this.rallyHits} RALLY! 🔥`);
        audioManager.playRallyMilestone();
      }
      if (heat >= 0.85 && !this.whooshedThisRally) {
        this.whooshedThisRally = true;
        audioManager.playWhoosh();
      }
    } else if (vxFlipped) {
      this.effects.playWallBounce(x, y);
      audioManager.playWallBounce();
    }

    this.lastBallVx = vx;
    this.lastBallVy = vy;
  }

  /** Scores arrive in server space (top = host). */
  private applyScore(top: number, bottom: number) {
    const mine = this.flipped ? top : bottom;
    const theirs = this.flipped ? bottom : top;
    if (mine === this.myScore && theirs === this.opponentScore) return;
    this.myScore = mine;
    this.opponentScore = theirs;
    this.hud.setScore(theirs, mine);
  }

  /** First texture that exists, or null for the plain ball. */
  private pickFace(preferred: string, fallback: string): string | null {
    if (this.textures.exists(preferred)) return preferred;
    if (this.textures.exists(fallback)) return fallback;
    return null;
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
        if (value === '3') {
          audioManager.duckMusic(true);
          if (this.myScore === ONLINE_WINNING_SCORE - 1 || this.opponentScore === ONLINE_WINNING_SCORE - 1) {
            this.hud.showBanner('MATCH POINT');
            audioManager.playRallyMilestone();
          }
        }
        if (isGo) audioManager.playCountdownGo();
        else audioManager.playCountdownTick();
        this.hud.showCountdown(value, isGo);
      }),

      svc.onGameRoundStart(() => {
        this.hud.hideCountdown();
        this.hud.hidePointMessage();
        this.hud.hideMessage();
        this.ball.resetRotation();
        this.rallyHits = 0;
        this.whooshedThisRally = false;
        audioManager.duckMusic(false);
      }),

      svc.onGameRoundEnd(({ scoringSide }) => {
        const localSide = this.role === 'host' ? 'top' : 'bottom';
        const iScored = scoringSide === localSide;
        this.hud.showPointMessage(iScored ? '🎉 YOU SCORE' : '😤 OPPONENT SCORES');
        audioManager.playScore(iScored);
        const exitY = iScored ? PONG_CONFIG.arenaPadding : ARENA_HEIGHT - PONG_CONFIG.arenaPadding;
        this.effects.playScoreExplosion(this.ball.getX(), exitY);
        this.effects.flashScreen(255, 214, 236);
        // Loser's face goes on the ball for the next point.
        this.ball.setFace(iScored ? this.pickFace(FACE_OPPONENT, FACE_ME) : this.pickFace(FACE_ME, FACE_OPPONENT));
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
        this.localPaddleX = ARENA_WIDTH / 2;
        this.topSpeed = 0;
        this.snapshots.clear();
        this.hud.hideWinScreen();
        this.ball.setFace(this.pickFace(FACE_OPPONENT, FACE_ME));
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
      audioManager.stopMusic();
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
    audioManager.duckMusic(false);

    const localWon = winner === this.role;
    const forfeit = reason === 'opponent_disconnected';
    if (localWon) {
      audioManager.playWin();
      this.effects.celebrate();
    } else {
      audioManager.playLose();
    }

    recordMatch(localWon, {
      longestRally: stats.longestRally,
      topSpeed: toKmh(this.topSpeed),
      difficulty: null,
    });

    const opponentName = this.registry.get('customConfig')?.opponentName || 'Opponent';
    const lines = [
      `${this.myScore} – ${this.opponentScore}`,
      `Longest rally: ${stats.longestRally} hits`,
      `Top speed: ${toKmh(this.topSpeed)} km/h`,
    ];
    if (forfeit) lines.unshift('Your opponent left the match.');

    this.hud.showWinScreen({
      victory: localWon,
      title: localWon ? 'VICTORY' : 'DEFEAT',
      subtitle: localWon ? `You beat ${opponentName}!` : `${opponentName} wins!`,
      lines,
      loserFaceKey: localWon ? this.pickFace(FACE_OPPONENT, PLAIN_BALL_KEY) : this.pickFace(FACE_ME, PLAIN_BALL_KEY),
    });

    if (forfeit) {
      // The server has already torn the room down.
      this.roomClosed = true;
      this.hud.setPlayAgainLabel('OPPONENT LEFT', false);
    }
  }

  // ─── Overlay (disconnects, closed rooms) ───────────────────────────────────

  private showOverlay(message: string, countdownSeconds?: number) {
    this.hideOverlay();

    const font = 'Nunito, system-ui, sans-serif';

    const bg = this.add.rectangle(0, 0, 440, 250, 0x2a1a55, 0.94);
    bg.setStrokeStyle(3, 0xffb7e1, 0.8);
    bg.setRounded(26);

    const text = this.add.text(0, -62, message, {
      fontFamily: font,
      fontSize: '22px',
      fontStyle: '800',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 380 },
    });
    text.setOrigin(0.5);

    const returnBg = this.add.rectangle(0, 64, 300, 52, 0xffffff, 1);
    returnBg.setStrokeStyle(2, 0xff8dc7, 1);
    returnBg.setRounded(26);
    returnBg.setInteractive({ useHandCursor: true });
    returnBg.on('pointerdown', () => this.events.emit('exit-match'));

    const returnText = this.add.text(0, 64, 'MAIN MENU', {
      fontFamily: font,
      fontSize: '17px',
      color: '#ff4fa3',
      fontStyle: '900',
    });
    returnText.setOrigin(0.5);
    returnText.setLetterSpacing(1.5);

    const children: Phaser.GameObjects.GameObject[] = [bg, text, returnBg, returnText];

    if (countdownSeconds !== undefined) {
      let secondsLeft = countdownSeconds;
      const label = () => `Waiting ${secondsLeft}s for them to return…`;
      const countdownText = this.add.text(0, -8, label(), {
        fontFamily: font,
        fontSize: '17px',
        fontStyle: '700',
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

    this.overlay = this.add.container(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, children);
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
    audioManager.stopMusic();
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
