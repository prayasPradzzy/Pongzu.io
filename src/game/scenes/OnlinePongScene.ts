import Phaser from 'phaser';

import { Ball } from '../entities/Ball';
import { Paddle } from '../entities/Paddle';
import { PONG_CONFIG } from '../config/pongConfig';
import { GameHud } from '../ui/GameHud';
import { VisualEffectsSystem } from '../systems/VisualEffectsSystem';
import { ReconciliationBuffer } from '../systems/ReconciliationBuffer';
import { NetworkInputEmitter } from '../systems/NetworkInputEmitter';
import type { SocketService } from '../../features/multiplayer/SocketService';
import type { Role } from '../../../server/src/protocol/events';

/**
 * Online multiplayer Phaser scene.
 *
 * Ownership contract:
 *   Server owns: ball position/velocity, scores, match state, win/loss
 *   Client owns: rendering, input reading, visual effects, HUD display
 *
 * The ball is NOT driven by Arcade Physics here — it is setPosition()'d each
 * frame from the ReconciliationBuffer's interpolated snapshot.
 */
export class OnlinePongScene extends Phaser.Scene {
  private ball!: Ball;
  private hostPaddle!: Paddle;   // top paddle — always host
  private guestPaddle!: Paddle;  // bottom paddle — always guest
  private hud!: GameHud;
  private effects!: VisualEffectsSystem;
  private arenaGraphics!: Phaser.GameObjects.Graphics;
  private vignetteGraphics!: Phaser.GameObjects.Graphics;
  private frameGraphics!: Phaser.GameObjects.Graphics;
  private sparkleGraphics!: Phaser.GameObjects.Graphics;
  private cloudGraphics!: Phaser.GameObjects.Graphics;

  private netInput!: NetworkInputEmitter;
  private reconcBuffer!: ReconciliationBuffer;

  private role!: Role;
  private socketService!: SocketService;

  // Local-prediction: apply own input immediately to local paddle
  private localPaddleX = 0;

  // Disconnect overlay
  private disconnectOverlay: Phaser.GameObjects.Container | null = null;
  private disconnectTimerEvent: Phaser.Time.TimerEvent | null = null;
  private isDisconnected = false;
  private rematchVoted = false;

  constructor() {
    super('online-pong');
  }

  create() {
    const config = this.registry.get('customConfig');
    this.role = config?.role ?? 'guest';
    this.socketService = config?.socketService;

    this.configureWorld(this.scale.width, this.scale.height);
    this.drawArenaBackdrop(this.scale.width, this.scale.height);

    const cx = this.scale.width / 2;
    const h = this.scale.height;

    this.hud = new GameHud(this);
    this.hud.resize(this.scale.width, h);
    this.effects = new VisualEffectsSystem(this);

    this.hostPaddle = new Paddle(this, 'top', cx, PONG_CONFIG.paddle.topOffset, PONG_CONFIG.colors.paddleTop);
    this.guestPaddle = new Paddle(this, 'bottom', cx, h - PONG_CONFIG.paddle.bottomOffset, PONG_CONFIG.colors.paddleBottom);

    this.ball = new Ball(this, cx, h / 2);

    // Disable Arcade Physics on ball body — server drives position
    const ballBody = this.ball.getSprite().body as Phaser.Physics.Arcade.Body;
    ballBody.enable = false;
    this.ball.getSprite().setVisible(false); // hide until round starts

    this.localPaddleX = cx;
    this.reconcBuffer = new ReconciliationBuffer();
    this.reconcBuffer.setServerTimeOffset(this.socketService?.serverTimeOffset ?? 0);
    this.netInput = new NetworkInputEmitter(this, this.socketService);

    this.effects.followBall();

    this.registerSocketListeners();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update() {
    const width = this.scale.width;
    const height = this.scale.height;

    if (this.isDisconnected) return;

    // Send our input to server
    this.netInput.update(this.localPaddleX);

    // Apply local prediction to our own paddle immediately
    const dir = this.netInput.getDirection();
    const dt = this.game.loop.delta / 1000;
    this.localPaddleX += dir * PONG_CONFIG.paddle.speed * dt;
    const halfW = PONG_CONFIG.paddle.width / 2;
    const left = PONG_CONFIG.arenaPadding + halfW;
    const right = width - PONG_CONFIG.arenaPadding - halfW;
    this.localPaddleX = Math.max(left, Math.min(right, this.localPaddleX));

    // Apply interpolated server state
    const snap = this.reconcBuffer.getInterpolatedState();
    if (snap) {
      // Ball
      this.ball.setPosition(snap.ball.x, snap.ball.y);
      this.ball.getSprite().setVisible(true);

      // Opponent's paddle comes from server; local paddle uses prediction
      if (this.role === 'host') {
        this.hostPaddle.setPosition(this.localPaddleX, PONG_CONFIG.paddle.topOffset);
        this.guestPaddle.setPosition(snap.guestPaddleX, height - PONG_CONFIG.paddle.bottomOffset);
      } else {
        this.guestPaddle.setPosition(this.localPaddleX, height - PONG_CONFIG.paddle.bottomOffset);
        this.hostPaddle.setPosition(snap.hostPaddleX, PONG_CONFIG.paddle.topOffset);
      }
    }

    // Visual effects track ball
    this.effects.trackBall(this.ball.getX(), this.ball.getY());
    this.effects.updateGlow(this.ball.getX(), this.ball.getY(), this.time.now);

    // Avatar badges follow paddles
    this.hud.setNamePositions(
      this.hostPaddle.getX(),
      this.guestPaddle.getX(),
      PONG_CONFIG.paddle.topOffset,
      height - PONG_CONFIG.paddle.bottomOffset,
    );
  }

  // ─── Socket event wiring ───────────────────────────────────────────────────

  private registerSocketListeners() {
    const svc = this.socketService;
    if (!svc) return;

    svc.onGameStateSnapshot((snap) => {
      this.reconcBuffer.push(snap);
    });

    svc.onGameScore(({ top, bottom }) => {
      this.hud.setScore(top, bottom);
    });

    svc.onGameCountdown(({ value }) => {
      this.hud.showCountdown(value);
    });

    svc.onGameRoundStart(() => {
      this.hud.hideCountdown();
      this.hud.hidePointMessage();
      this.hud.hideMessage();
      this.ball.getSprite().setVisible(true);
    });

    svc.onGameRoundEnd(({ scoringSide }) => {
      const label = scoringSide === 'bottom' ? 'YOU SCORE' : 'CPU SCORES';
      // Personalise based on role
      const localSide = this.role === 'host' ? 'top' : 'bottom';
      const youScore = scoringSide === localSide;
      this.hud.showPointMessage(youScore ? '🎉 YOU SCORE' : '😤 OPPONENT SCORES');
      this.hud.showMessage('POINT');
      this.effects.playPaddleHit(this.ball.getX(), this.ball.getY());
      this.cameras.main.flash(80, 0, 229, 255, false);
    });

    svc.onMatchOver(({ winner, reason, stats }) => {
      const localWon = winner === this.role;
      const outcome = localWon ? 'victory' : 'defeat';

      if (reason === 'opponent_disconnected') {
        this.hud.showMessage('OPPONENT LEFT');
      }

      this.hud.showWinScreen(outcome, {
        topScore: stats.topScore,
        bottomScore: stats.bottomScore,
        longestRally: stats.longestRally,
      });
    });

    svc.onMatchRematchStart(() => {
      this.hud.hideWinScreen();
      this.reconcBuffer.clear();
      this.ball.getSprite().setVisible(false);
      this.hud.setScore(0, 0);
      this.rematchVoted = false;
    });

    svc.onPlayerDisconnected(({ role }) => {
      this.isDisconnected = true;
      this.showDisconnectOverlay(role === this.role ? 'You disconnected' : 'Opponent disconnected…\nWaiting 10s for reconnect.');
    });

    svc.onPlayerReconnected(() => {
      this.isDisconnected = false;
      this.hideDisconnectOverlay();
    });

    // Win panel rematch button wires through socket
    this.events.on('rematch', () => {
      if (!this.rematchVoted) {
        this.rematchVoted = true;
        this.socketService.sendRematch();
      }
    });

    this.events.on('exit-match', () => {
      const customConfig = this.registry.get('customConfig');
      if (customConfig?.onExit) {
        customConfig.onExit();
      }
    });
  }

  // ─── Disconnect overlay ────────────────────────────────────────────────────

  private showDisconnectOverlay(message: string) {
    if (this.disconnectOverlay) return;

    const { width, height } = this.scale;
    const bg = this.add.rectangle(0, 0, 380, 220, 0x0f0820, 0.92);
    bg.setStrokeStyle(2, 0xffb7e1, 0.7);
    (bg as Phaser.GameObjects.Rectangle & { setRounded: (r: number) => void }).setRounded(20);

    const txt = this.add.text(0, -50, message, {
      fontFamily: 'Nunito, system-ui, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 320 },
    });
    txt.setOrigin(0.5);

    let secondsLeft = 15;
    const countdownTxt = this.add.text(0, -10, `Waiting ${secondsLeft}s for reconnect...`, {
      fontFamily: 'Nunito, system-ui, sans-serif',
      fontSize: '14px',
      color: '#ffb7e1',
      align: 'center',
    });
    countdownTxt.setOrigin(0.5);

    const returnBg = this.add.rectangle(0, 50, 280, 42, 0xffffff, 1);
    returnBg.setStrokeStyle(2, 0xff8dc7, 1);
    (returnBg as Phaser.GameObjects.Rectangle & { setRounded: (r: number) => void }).setRounded(21);
    returnBg.setInteractive({ useHandCursor: true });

    const returnText = this.add.text(0, 50, 'RETURN TO MENU', {
      fontFamily: 'Nunito, system-ui, sans-serif',
      fontSize: '13px',
      color: '#ff8dc7',
      fontStyle: '800',
    });
    returnText.setOrigin(0.5);
    returnText.setLetterSpacing(1.5);

    returnBg.on('pointerdown', () => {
      this.events.emit('exit-match');
    });

    returnBg.on('pointerover', () => { returnBg.setScale(1.03); returnText.setScale(1.03); });
    returnBg.on('pointerout', () => { returnBg.setScale(1); returnText.setScale(1); });

    this.disconnectOverlay = this.add.container(width / 2, height / 2, [bg, txt, countdownTxt, returnBg, returnText]);
    this.disconnectOverlay.setDepth(100);

    this.disconnectTimerEvent = this.time.addEvent({
      delay: 1000,
      repeat: 14,
      callback: () => {
        secondsLeft--;
        countdownTxt.setText(`Waiting ${secondsLeft}s for reconnect...`);
        if (secondsLeft <= 0) {
          this.events.emit('exit-match');
        }
      },
    });
  }

  private hideDisconnectOverlay() {
    if (this.disconnectTimerEvent) {
      this.disconnectTimerEvent.destroy();
      this.disconnectTimerEvent = null;
    }
    this.disconnectOverlay?.destroy();
    this.disconnectOverlay = null;
  }

  // ─── Arena drawing (same as PongScene) ────────────────────────────────────

  private configureWorld(width: number, height: number) {
    this.physics.world.setBounds(0, 0, width, height);
    this.physics.world.setBoundsCollision(true, true, false, false);
  }

  private drawArenaBackdrop(width: number, height: number) {
    this.cameras.main.setBackgroundColor(PONG_CONFIG.colors.background);
    if (!this.arenaGraphics) this.arenaGraphics = this.add.graphics();
    if (!this.vignetteGraphics) this.vignetteGraphics = this.add.graphics();
    this.arenaGraphics.clear();
    this.arenaGraphics.fillGradientStyle(
      Phaser.Display.Color.HexStringToColor(PONG_CONFIG.colors.arenaTop).color,
      Phaser.Display.Color.HexStringToColor(PONG_CONFIG.colors.arenaTop).color,
      Phaser.Display.Color.HexStringToColor(PONG_CONFIG.colors.arenaMid).color,
      Phaser.Display.Color.HexStringToColor(PONG_CONFIG.colors.arenaBottom).color,
      1,
    );
    this.arenaGraphics.fillRoundedRect(0, 0, width, height, 36);
    this.vignetteGraphics.clear();
    this.vignetteGraphics.fillStyle(0xffffff, 0.08);
    this.vignetteGraphics.fillRoundedRect(12, 12, width - 24, height - 24, 28);
    this.drawArenaFrame(width, height);
    this.drawBackgroundDecoration(width, height);
  }

  private drawArenaFrame(width: number, height: number) {
    if (!this.frameGraphics) this.frameGraphics = this.add.graphics();
    const frame = this.frameGraphics;
    frame.clear();
    const fp = PONG_CONFIG.arenaPadding;
    frame.lineStyle(2, PONG_CONFIG.colors.frame, 0.8);
    frame.strokeRoundedRect(fp, fp, width - fp * 2, height - fp * 2, 28);
    frame.lineStyle(1, PONG_CONFIG.colors.cyan, 0.18);
    frame.strokeRoundedRect(fp + 10, fp + 10, width - (fp + 10) * 2, height - (fp + 10) * 2, 22);
  }

  private drawBackgroundDecoration(width: number, height: number) {
    if (!this.sparkleGraphics) this.sparkleGraphics = this.add.graphics();
    if (!this.cloudGraphics) this.cloudGraphics = this.add.graphics();
    const sparkleLayer = this.sparkleGraphics;
    const cloudLayer = this.cloudGraphics;
    sparkleLayer.clear();
    sparkleLayer.fillStyle(0xffffff, 1);
    const sparkleCount = Math.max(16, Math.floor((width * height) / 180000));
    for (let i = 0; i < sparkleCount; i++) {
      const x = Phaser.Math.Between(40, width - 40);
      const y = Phaser.Math.Between(56, height - 56);
      sparkleLayer.fillCircle(x, y, Phaser.Math.Between(1, 3));
    }
    sparkleLayer.setAlpha(0.12);
    cloudLayer.clear();
    cloudLayer.fillStyle(0xffffff, 0.08);
    const cy = height * 0.18;
    cloudLayer.fillEllipse(width * 0.18, cy, 160, 42);
    cloudLayer.fillEllipse(width * 0.27, cy + 16, 220, 52);
    cloudLayer.fillEllipse(width * 0.76, cy + 6, 180, 44);
    cloudLayer.fillEllipse(width * 0.68, cy + 22, 240, 56);
    const petals = this.add.graphics();
    petals.fillStyle(0xffb7e1, 0.11);
    petals.fillEllipse(width * 0.1, height * 0.78, 18, 8);
    petals.fillEllipse(width * 0.82, height * 0.22, 20, 9);
    petals.fillEllipse(width * 0.42, height * 0.14, 16, 7);
    petals.fillEllipse(width * 0.58, height * 0.85, 18, 8);
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    this.configureWorld(gameSize.width, gameSize.height);
    this.drawArenaBackdrop(gameSize.width, gameSize.height);
    this.hud.resize(gameSize.width, gameSize.height);
    this.localPaddleX = gameSize.width / 2;
    if (this.disconnectOverlay) {
      this.disconnectOverlay.setPosition(gameSize.width / 2, gameSize.height / 2);
    }
  }

  private shutdown() {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.off('rematch');
    this.events.off('exit-match');
    this.socketService?.offAll();
    this.effects.destroy();
    this.hud.destroy();
    this.arenaGraphics?.destroy();
    this.vignetteGraphics?.destroy();
    this.frameGraphics?.destroy();
    this.sparkleGraphics?.destroy();
    this.cloudGraphics?.destroy();
    this.disconnectOverlay?.destroy();
  }
}
