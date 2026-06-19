import Phaser from 'phaser';


export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    const config = this.registry.get('customConfig');
    if (config?.croppedAvatarUrl) {
      this.load.image('user-avatar', config.croppedAvatarUrl);
    }
    // Also load opponent's avatar so both players can see a face ball
    if (config?.opponentAvatarUrl) {
      this.load.image('opponent-avatar', config.opponentAvatarUrl);
    }
  }

  create() {
    const config = this.registry.get('customConfig');

    // Determine which avatar to use for the face ball.
    // Prefer local player's face; fall back to opponent's face.
    let sourceImage: HTMLImageElement | null = null;
    if (config?.croppedAvatarUrl && this.textures.exists('user-avatar')) {
      sourceImage = this.textures.get('user-avatar').getSourceImage() as HTMLImageElement;
    } else if (config?.opponentAvatarUrl && this.textures.exists('opponent-avatar')) {
      sourceImage = this.textures.get('opponent-avatar').getSourceImage() as HTMLImageElement;
    }

    if (sourceImage) {
      const faceSize = 128;
      const ballCanvas = this.textures.createCanvas('face-ball', faceSize, faceSize);
      if (ballCanvas) {
        const ctx = ballCanvas.getContext();
        ctx.beginPath();
        ctx.arc(faceSize / 2, faceSize / 2, faceSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(sourceImage, 0, 0, faceSize, faceSize);
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