import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';
import { getSettings } from '../../features/settings/settings';
import { ARENA_WIDTH } from '../utils/sceneSetup';

const PARTICLE_TEXTURE_KEY = 'pong-particle';
const CONFETTI_TEXTURE_KEY = 'pong-confetti';
const CONFETTI_COLORS = [0xff4fa3, 0x7c5cff, 0xffd84d, 0x4dd9ff, 0x7dffb0, 0xffffff];

/**
 * Visual juice only (no sound, no gameplay). Respects the "reduce motion"
 * setting by skipping shakes, flashes and confetti.
 */
export class VisualEffectsSystem {
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly flash: Phaser.GameObjects.Arc;
  private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private readonly scene: Phaser.Scene;
  private readonly trailAnchor = { x: 0, y: 0 };
  private heat = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.ensureTextures();

    this.glow = this.scene.add.circle(0, 0, PONG_CONFIG.ball.radius * 2.2, PONG_CONFIG.colors.glow, 0.35);
    this.glow.setBlendMode(Phaser.BlendModes.NORMAL);
    this.glow.setDepth(8);

    this.flash = this.scene.add.circle(0, 0, 22, PONG_CONFIG.colors.flash, 0);
    this.flash.setBlendMode(Phaser.BlendModes.ADD);
    this.flash.setDepth(11);

    this.trail = this.scene.add.particles(0, 0, PARTICLE_TEXTURE_KEY, {
      speed: { min: 4, max: 14 },
      frequency: 22,
      lifespan: { min: 260, max: 420 },
      quantity: 1,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.55, end: 0 },
      tint: [PONG_CONFIG.colors.pink, PONG_CONFIG.colors.cyan, 0xffffff],
    });
    this.trail.setDepth(9);

    this.sparks = this.scene.add.particles(0, 0, PARTICLE_TEXTURE_KEY, {
      speed: { min: 140, max: 320 },
      lifespan: { min: 200, max: 380 },
      quantity: 0,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [PONG_CONFIG.colors.pink, PONG_CONFIG.colors.paddleTop, 0xffd84d],
      angle: { min: 0, max: 360 },
      emitting: false,
    });
    this.sparks.setDepth(12);
  }

  private get calm() {
    return getSettings().reduceMotion;
  }

  updateGlow(x: number, y: number, time: number) {
    this.glow.setPosition(x, y);
    const pulse = 1 + Math.sin(time * 0.006) * 0.08;
    this.glow.setScale(pulse * (1 + this.heat * 0.35));
  }

  /** 0 = calm, 1 = top speed. A faster ball gets a longer, hotter trail. */
  setHeat(heat: number) {
    this.heat = Phaser.Math.Clamp(heat, 0, 1);
    this.glow.setFillStyle(this.heat > 0.6 ? 0xffb0b0 : PONG_CONFIG.colors.glow, 0.3 + this.heat * 0.2);
    this.trail.frequency = Phaser.Math.Linear(26, 8, this.heat);
    this.trail.quantity = this.heat > 0.75 ? 2 : 1;
  }

  /** Hide the glow and stop the trail while there is no ball on the table. */
  setBallVisible(visible: boolean) {
    this.glow.setVisible(visible);
    this.trail.emitting = visible;
  }

  followBall() {
    this.trail.startFollow(this.trailAnchor, 0, 0, true);
  }

  trackBall(x: number, y: number) {
    this.trailAnchor.x = x;
    this.trailAnchor.y = y;
  }

  /** intensity 0–1: how hard the hit was (ball speed). */
  playPaddleHit(x: number, y: number, intensity = 0.3) {
    this.flash.setPosition(x, y);
    this.flash.setScale(0.7);
    this.flash.setAlpha(0.75);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: 0,
      scaleX: 1.8 + intensity,
      scaleY: 1.8 + intensity,
      duration: 130,
      ease: 'Quad.easeOut',
    });

    this.sparks.explode(10 + Math.round(intensity * 18), x, y);
    if (!this.calm) {
      this.scene.cameras.main.shake(40 + intensity * 70, 0.0015 + intensity * 0.0055);
    }
  }

  /** Big burst where the ball left the arena. */
  playScoreExplosion(x: number, y: number) {
    this.sparks.explode(36, x, y);
    if (!this.calm) {
      this.scene.cameras.main.shake(140, 0.007);
    }
  }

  /** Small flash + tiny shake for side-wall bounces */
  playWallBounce(x: number, y: number) {
    this.flash.setPosition(x, y);
    this.flash.setScale(0.35);
    this.flash.setAlpha(0.45);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: 0,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 90,
      ease: 'Quad.easeOut',
    });
    this.sparks.explode(5, x, y);
    if (!this.calm) {
      this.scene.cameras.main.shake(20, 0.001);
    }
  }

  /** Brief colour flash of the whole screen (skipped with reduce motion). */
  flashScreen(r: number, g: number, b: number) {
    if (!this.calm) {
      this.scene.cameras.main.flash(90, r, g, b, false);
    }
  }

  /** Confetti rain for a victory. */
  celebrate() {
    if (this.calm) return;
    this.confetti?.destroy();
    this.confetti = this.scene.add.particles(0, -20, CONFETTI_TEXTURE_KEY, {
      x: { min: 0, max: ARENA_WIDTH },
      speedY: { min: 180, max: 420 },
      speedX: { min: -90, max: 90 },
      gravityY: 260,
      rotate: { start: 0, end: 540 },
      scale: { min: 0.6, max: 1.2 },
      lifespan: 3200,
      frequency: 12,
      quantity: 2,
      tint: CONFETTI_COLORS,
    });
    this.confetti.setDepth(60);
    this.scene.time.delayedCall(1400, () => this.confetti?.stop());
  }

  destroy() {
    this.glow.destroy();
    this.flash.destroy();
    this.trail.destroy();
    this.sparks.destroy();
    this.confetti?.destroy();
  }

  private ensureTextures() {
    if (!this.scene.textures.exists(PARTICLE_TEXTURE_KEY)) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(8, 8, 7);
      graphics.generateTexture(PARTICLE_TEXTURE_KEY, 16, 16);
      graphics.destroy();
    }
    if (!this.scene.textures.exists(CONFETTI_TEXTURE_KEY)) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(0, 0, 8, 14);
      graphics.generateTexture(CONFETTI_TEXTURE_KEY, 8, 14);
      graphics.destroy();
    }
  }
}
