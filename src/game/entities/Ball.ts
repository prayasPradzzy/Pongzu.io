import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';

export const PLAIN_BALL_KEY = 'pong-ball';
const BALL_TEXTURE_KEY = PLAIN_BALL_KEY;
// Textures are drawn well above display size so they stay crisp when the
// camera zooms for high-density screens.
const TEXTURE_SCALE = 4;

/**
 * Purely visual: position comes from PongSimulation (CPU / same device) or
 * server snapshots (online), never from a physics body.
 *
 * The ball can wear a face texture, tumbles with sideways speed, and heats
 * up (turns red and jitters) as rallies get fast.
 */
export class Ball {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;
  private baseScale = 1;
  private isFace = false;
  private heat = 0;
  private stretchTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.ensureTexture();
    this.sprite = this.scene.add.image(x, y, BALL_TEXTURE_KEY);
    this.sprite.setOrigin(0.5);
    this.sprite.setDepth(10);
    this.setFace(null);
  }

  getX() {
    return this.sprite.x;
  }

  getY() {
    return this.sprite.y;
  }

  setVisible(visible: boolean) {
    this.sprite.setVisible(visible);
  }

  setPosition(x: number, y: number) {
    this.sprite.setPosition(x, y);
  }

  /** Wear a face texture, or null for the plain ball. */
  setFace(textureKey: string | null) {
    const useFace = textureKey !== null && this.scene.textures.exists(textureKey);
    this.isFace = useFace;
    this.sprite.setTexture(useFace ? textureKey : BALL_TEXTURE_KEY);
    // Faces are drawn a little larger than the hitbox so they're recognisable.
    const diameter = PONG_CONFIG.ball.radius * 2 * (useFace ? 1.3 : 1);
    this.sprite.setDisplaySize(diameter, diameter);
    this.baseScale = this.sprite.scaleX;
    this.sprite.setRotation(0);
  }

  /** Face balls tumble as they fly — sideways speed sets the spin. */
  roll(vx: number, deltaMs: number) {
    const spin = (vx / PONG_CONFIG.ball.radius) * (deltaMs / 1000) * (this.isFace ? 0.35 : 0.15);
    this.sprite.rotation += spin;
  }

  /** 0 = calm, 1 = top speed: tints the ball red and adds a nervous jitter. */
  setHeat(heat: number, time: number) {
    this.heat = Phaser.Math.Clamp(heat, 0, 1);
    const hot = Phaser.Math.Clamp((this.heat - 0.55) / 0.45, 0, 1);
    if (hot <= 0) {
      this.sprite.clearTint();
    } else {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xffffff),
        Phaser.Display.Color.ValueToColor(PONG_CONFIG.colors.hot),
        100,
        hot * 70,
      );
      this.sprite.setTint(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
    }

    if (!this.stretchTween?.isPlaying()) {
      const wobble = hot > 0 ? 1 + Math.sin(time * 0.045) * 0.05 * hot : 1;
      this.sprite.setScale(this.baseScale * wobble, this.baseScale / wobble);
    }
  }

  resetRotation() {
    this.sprite.setRotation(0);
  }

  playHitStretch() {
    this.stretchTween?.stop();
    this.sprite.setScale(this.baseScale);
    this.stretchTween = this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.baseScale * 1.22,
      scaleY: this.baseScale * 0.8,
      duration: 70,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  destroy() {
    this.stretchTween?.stop();
    this.sprite.destroy();
  }

  private ensureTexture() {
    if (this.scene.textures.exists(BALL_TEXTURE_KEY)) {
      return;
    }

    const r = PONG_CONFIG.ball.radius * TEXTURE_SCALE;
    const graphics = this.scene.add.graphics();

    // Dark outline so the white ball pops against the pastel arena.
    graphics.fillStyle(PONG_CONFIG.colors.ballOutline, 1);
    graphics.fillCircle(r, r, r);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(r, r, r - 3 * TEXTURE_SCALE);
    graphics.fillStyle(0xffd3ea, 1);
    graphics.fillCircle(r + 2 * TEXTURE_SCALE, r + 3 * TEXTURE_SCALE, r - 8 * TEXTURE_SCALE);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(r - 1 * TEXTURE_SCALE, r - 1 * TEXTURE_SCALE, r - 8 * TEXTURE_SCALE);
    graphics.fillStyle(0xffffff, 0.95);
    graphics.fillCircle(r - 6 * TEXTURE_SCALE, r - 7 * TEXTURE_SCALE, 4 * TEXTURE_SCALE); // shine
    graphics.generateTexture(BALL_TEXTURE_KEY, r * 2, r * 2);
    graphics.destroy();
  }
}
