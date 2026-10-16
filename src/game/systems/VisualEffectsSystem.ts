import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';
import { audioManager } from './AudioManager';

const PARTICLE_TEXTURE_KEY = 'pong-particle';

export class VisualEffectsSystem {
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly flash: Phaser.GameObjects.Arc;
  private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly scene: Phaser.Scene;
  private readonly trailAnchor = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.ensureParticleTexture();

    this.glow = this.scene.add.circle(0, 0, 94, PONG_CONFIG.colors.glow, 0.18);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);

    this.flash = this.scene.add.circle(0, 0, 18, PONG_CONFIG.colors.flash, 0);
    this.flash.setBlendMode(Phaser.BlendModes.ADD);

    this.trail = this.scene.add.particles(0, 0, PARTICLE_TEXTURE_KEY, {
      speed: { min: 8, max: 18 },
      frequency: 28,
      lifespan: { min: 560, max: 920 },
      quantity: 1,
      scale: { start: 0.42, end: 0 },
      alpha: { start: 0.45, end: 0 },
      tint: [0xffffff, PONG_CONFIG.colors.pink, PONG_CONFIG.colors.cyan],
      blendMode: Phaser.BlendModes.ADD,
    });

    this.emitter = this.scene.add.particles(0, 0, PARTICLE_TEXTURE_KEY, {
      speed: { min: 120, max: 240 },
      lifespan: { min: 180, max: 320 },
      quantity: 0,
      scale: { start: 0.42, end: 0 },
      alpha: { start: 0.75, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      angle: { min: 0, max: 360 },
    });
  }

  updateGlow(x: number, y: number, time: number) {
    this.glow.setPosition(x, y);
    const pulse = 1 + Math.sin(time * 0.004) * 0.06;
    this.glow.setScale(pulse);
    this.glow.setAlpha(0.14 + Math.sin(time * 0.004) * 0.04);
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

  playPaddleHit(x: number, y: number) {
    this.flash.setPosition(x, y);
    this.flash.setScale(0.7);
    this.flash.setAlpha(0.7);

    this.scene.tweens.add({
      targets: this.flash,
      alpha: 0,
      scaleX: 1.65,
      scaleY: 1.65,
      duration: 120,
      ease: 'Quad.easeOut',
    });

    this.emitter.explode(14, x, y);
    this.scene.cameras.main.shake(18, 0.0018);
    this.playHitSoundHook();
  }

  playScorePulse() {
    this.scene.cameras.main.flash(120, 255, 255, 255, false);
  }

  /** Larger particle burst + stronger shake for a scored point */
  playScoreExplosion(x: number, y: number) {
    this.emitter.explode(24, x, y);
    this.scene.cameras.main.shake(30, 0.004);
    audioManager.playScore();
  }

  /** Small flash + subtle shake for side-wall bounces */
  playWallBounce(x: number, y: number) {
    this.flash.setPosition(x, y);
    this.flash.setScale(0.35);
    this.flash.setAlpha(0.4);

    this.scene.tweens.add({
      targets: this.flash,
      alpha: 0,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 80,
      ease: 'Quad.easeOut',
    });

    this.emitter.explode(5, x, y);
    this.scene.cameras.main.shake(12, 0.0008);
    audioManager.playWallBounce();
  }

  destroy() {
    this.glow.destroy();
    this.flash.destroy();
    this.trail.destroy();
    this.emitter.destroy();
  }

  private ensureParticleTexture() {
    if (this.scene.textures.exists(PARTICLE_TEXTURE_KEY)) {
      return;
    }

    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(4, 4, 3.5);
    graphics.generateTexture(PARTICLE_TEXTURE_KEY, 8, 8);
    graphics.destroy();
  }

  private playHitSoundHook() {
    audioManager.playPaddleHit();
  }
}