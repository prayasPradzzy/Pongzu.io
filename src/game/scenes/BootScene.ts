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
      
      // Generate high-res circular face-ball texture (128x128)
      // This will be scaled down visually by Ball.ts but kept crisp
      const faceSize = 128;
      const ballCanvas = this.textures.createCanvas('face-ball', faceSize, faceSize);
      if (ballCanvas) {
        const ctx = ballCanvas.getContext();
        ctx.beginPath();
        ctx.arc(faceSize / 2, faceSize / 2, faceSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(sourceImage, 0, 0, faceSize, faceSize);
        
        // Draw subtle physics ring (since visual radius = 2.0 * physics radius, ring is at 1/2 of faceSize / 2)
        ctx.beginPath();
        ctx.arc(faceSize / 2, faceSize / 2, faceSize / 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        ballCanvas.refresh();
      }
    }

    if (config?.mode === 'online') {
      this.scene.start('online-pong');
    } else {
      this.scene.start('pong');
    }
  }
}