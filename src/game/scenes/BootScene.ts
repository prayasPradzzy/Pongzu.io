import Phaser from 'phaser';
import { PONG_CONFIG } from '../config/pongConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    const config = this.registry.get('customConfig');
    if (config?.croppedAvatarUrl) {
      this.load.image('user-avatar', config.croppedAvatarUrl);
    }
  }

  create() {
    const config = this.registry.get('customConfig');
    if (config?.croppedAvatarUrl && this.textures.exists('user-avatar')) {
      const sourceImage = this.textures.get('user-avatar').getSourceImage() as HTMLImageElement;
      
      // 1. Generate circular avatar texture (256x256)
      const canvasTexture = this.textures.createCanvas('circular-avatar', 256, 256);
      if (canvasTexture) {
        const ctx = canvasTexture.getContext();
        ctx.beginPath();
        ctx.arc(128, 128, 128, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(sourceImage, 0, 0, 256, 256);
        canvasTexture.refresh();
      }

      // 2. Generate circular face-ball texture matching ball size (diameter = radius * 2)
      const ballDiameter = PONG_CONFIG.ball.radius * 2;
      const ballCanvas = this.textures.createCanvas('face-ball', ballDiameter, ballDiameter);
      if (ballCanvas) {
        const ctx = ballCanvas.getContext();
        ctx.beginPath();
        ctx.arc(PONG_CONFIG.ball.radius, PONG_CONFIG.ball.radius, PONG_CONFIG.ball.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(sourceImage, 0, 0, ballDiameter, ballDiameter);
        ballCanvas.refresh();
      }
    }

    this.scene.start('pong');
  }
}