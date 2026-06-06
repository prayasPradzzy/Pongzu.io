import Phaser from 'phaser';

import { Ball } from '../entities/Ball';
import { Paddle } from '../entities/Paddle';
import { PONG_CONFIG, type PaddleSide, type ServeDirection } from '../config/pongConfig';
import { GameHud } from '../ui/GameHud';
import { InputManager } from '../systems/InputManager';
import { ScoreManager } from '../systems/ScoreManager';
import { VisualEffectsSystem } from '../systems/VisualEffectsSystem';

export class PongScene extends Phaser.Scene {
  private inputManager!: InputManager;
  private ball!: Ball;
  private topPaddle!: Paddle;
  private bottomPaddle!: Paddle;
  private hud!: GameHud;
  private scoreManager!: ScoreManager;
  private effects!: VisualEffectsSystem;
  private arenaGraphics!: Phaser.GameObjects.Graphics;
  private vignetteGraphics!: Phaser.GameObjects.Graphics;
  private frameGraphics!: Phaser.GameObjects.Graphics;
  private sparkleGraphics!: Phaser.GameObjects.Graphics;
  private cloudGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super('pong');
  }

  create() {
    this.configureWorld(this.scale.width, this.scale.height);
    this.drawArenaBackdrop(this.scale.width, this.scale.height);

    const arenaCenterX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.inputManager = new InputManager(this);
    this.hud = new GameHud(this);
    this.hud.resize(this.scale.width, this.scale.height);
    this.effects = new VisualEffectsSystem(this);

    this.topPaddle = new Paddle(
      this,
      'top',
      arenaCenterX,
      PONG_CONFIG.paddle.topOffset,
      PONG_CONFIG.colors.paddleTop,
    );

    this.bottomPaddle = new Paddle(
      this,
      'bottom',
      arenaCenterX,
      this.scale.height - PONG_CONFIG.paddle.bottomOffset,
      PONG_CONFIG.colors.paddleBottom,
    );

    this.ball = new Ball(this, arenaCenterX, centerY);
    this.scoreManager = new ScoreManager(this, this.hud, (direction) => this.launchBall(direction));
    this.effects.followBall();

    this.physics.add.collider(this.ball.getSprite(), this.topPaddle.getSprite(), () => {
      this.handlePaddleHit(this.topPaddle);
    });

    this.physics.add.collider(this.ball.getSprite(), this.bottomPaddle.getSprite(), () => {
      this.handlePaddleHit(this.bottomPaddle);
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.scoreManager.startMatch(Phaser.Math.Between(0, 1) === 0 ? 'up' : 'down');
  }

  update() {
    const width = this.scale.width;
    const height = this.scale.height;

    this.topPaddle.setHorizontalVelocity(this.inputManager.getTopDirection());
    this.bottomPaddle.setHorizontalVelocity(this.inputManager.getBottomDirection());
    this.topPaddle.clampToBounds(width);
    this.bottomPaddle.clampToBounds(width);
    this.effects.trackBall(this.ball.getX(), this.ball.getY());
    this.effects.updateGlow(this.ball.getX(), this.ball.getY(), this.time.now);
    this.hud.setAvatarPositions(
      this.topPaddle.getX(),
      this.bottomPaddle.getX(),
      PONG_CONFIG.paddle.topOffset,
      height - PONG_CONFIG.paddle.bottomOffset,
    );

    if (this.scoreManager.isMatchOver()) {
      return;
    }

    if (!this.scoreManager.isRoundActive()) {
      return;
    }

    this.ball.maintainSpeed(this.scoreManager.getCurrentBallSpeed());

    if (this.ball.isOutOfBounds(height)) {
      const scoringSide: PaddleSide = this.ball.getY() < 0 ? 'bottom' : 'top';
      const serveDirection: ServeDirection = scoringSide === 'top' ? 'down' : 'up';

      this.scoreManager.scorePoint(scoringSide, serveDirection);
    }
  }

  private handlePaddleHit(paddle: Paddle) {
    const speed = this.scoreManager.registerPaddleHit();
    this.ball.bounceFromPaddle(paddle, speed);
    this.effects.playPaddleHit(this.ball.getX(), this.ball.getY());
    paddle.playImpactFeedback();
  }

  private launchBall(direction: ServeDirection) {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.ball.reset(centerX, centerY);
    this.ball.serve(direction, this.scoreManager.getCurrentBallSpeed());
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    this.configureWorld(gameSize.width, gameSize.height);
    this.drawArenaBackdrop(gameSize.width, gameSize.height);
    this.hud.resize(gameSize.width, gameSize.height);

    this.topPaddle.setPosition(gameSize.width / 2, PONG_CONFIG.paddle.topOffset);
    this.bottomPaddle.setPosition(gameSize.width / 2, gameSize.height - PONG_CONFIG.paddle.bottomOffset);
    this.topPaddle.clampToBounds(gameSize.width);
    this.bottomPaddle.clampToBounds(gameSize.width);
  }

  private configureWorld(width: number, height: number) {
    this.physics.world.setBounds(0, 0, width, height);
    this.physics.world.setBoundsCollision(true, true, false, false);
  }

  private drawArenaBackdrop(width: number, height: number) {
    this.cameras.main.setBackgroundColor(PONG_CONFIG.colors.background);

    if (!this.arenaGraphics) {
      this.arenaGraphics = this.add.graphics();
    }

    if (!this.vignetteGraphics) {
      this.vignetteGraphics = this.add.graphics();
    }

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
    if (!this.frameGraphics) {
      this.frameGraphics = this.add.graphics();
    }

    const frame = this.frameGraphics;
    frame.clear();
    const framePadding = PONG_CONFIG.arenaPadding;

    frame.lineStyle(2, PONG_CONFIG.colors.frame, 0.8);
    frame.strokeRoundedRect(
      framePadding,
      framePadding,
      width - framePadding * 2,
      height - framePadding * 2,
      28,
    );

    frame.lineStyle(1, PONG_CONFIG.colors.cyan, 0.18);
    frame.strokeRoundedRect(
      framePadding + 10,
      framePadding + 10,
      width - (framePadding + 10) * 2,
      height - (framePadding + 10) * 2,
      22,
    );
  }

  private drawBackgroundDecoration(width: number, height: number) {
    if (!this.sparkleGraphics) {
      this.sparkleGraphics = this.add.graphics();
    }

    if (!this.cloudGraphics) {
      this.cloudGraphics = this.add.graphics();
    }

    const sparkleLayer = this.sparkleGraphics;
    const cloudLayer = this.cloudGraphics;

    sparkleLayer.clear();
    sparkleLayer.fillStyle(0xffffff, 1);

    const sparkleCount = Math.max(16, Math.floor((width * height) / 180000));
    for (let index = 0; index < sparkleCount; index += 1) {
      const x = Phaser.Math.Between(40, width - 40);
      const y = Phaser.Math.Between(56, height - 56);
      const size = Phaser.Math.Between(1, 3);
      sparkleLayer.fillCircle(x, y, size);
    }

    sparkleLayer.setAlpha(0.12);

    cloudLayer.clear();
    cloudLayer.fillStyle(0xffffff, 0.08);
    const cloudY = height * 0.18;
    cloudLayer.fillEllipse(width * 0.18, cloudY, 160, 42);
    cloudLayer.fillEllipse(width * 0.27, cloudY + 16, 220, 52);
    cloudLayer.fillEllipse(width * 0.76, cloudY + 6, 180, 44);
    cloudLayer.fillEllipse(width * 0.68, cloudY + 22, 240, 56);

    const petalLayer = this.add.graphics();
    petalLayer.fillStyle(0xffb7e1, 0.11);
    petalLayer.fillEllipse(width * 0.1, height * 0.78, 18, 8);
    petalLayer.fillEllipse(width * 0.82, height * 0.22, 20, 9);
    petalLayer.fillEllipse(width * 0.42, height * 0.14, 16, 7);
    petalLayer.fillEllipse(width * 0.58, height * 0.85, 18, 8);
  }

  private shutdown() {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.effects.destroy();
    this.hud.destroy();
    this.arenaGraphics?.destroy();
    this.vignetteGraphics?.destroy();
    this.frameGraphics?.destroy();
    this.sparkleGraphics?.destroy();
    this.cloudGraphics?.destroy();
  }
}