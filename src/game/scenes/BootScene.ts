import Phaser from 'phaser';

import { CPU_FACE, FACE_PACK, renderEmojiCanvas } from '../../features/faceUpload/facePack';

/** Texture keys for the two faces the ball can wear. Bottom player = "me". */
export const FACE_ME = 'face-me';
export const FACE_OPPONENT = 'face-opp';

const FACE_SIZE = 256;

/**
 * Loads avatars and turns them into ball textures.
 *   - Cut-out heads (transparent background) are used as-is: a floating sticker.
 *   - Ordinary photos are clipped to a circle with a white sticker rim.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    const config = this.registry.get('customConfig');
    if (config?.croppedAvatarUrl) {
      this.load.image('src-me', config.croppedAvatarUrl);
    }
    if (config?.mode === 'online' && config?.opponentAvatarUrl) {
      this.load.image('src-opp', config.opponentAvatarUrl);
    }
  }

  create() {
    const config = this.registry.get('customConfig');

    if (this.textures.exists('src-me')) {
      this.buildFace(FACE_ME, this.textures.get('src-me').getSourceImage() as HTMLImageElement);
    }

    if (config?.mode === 'online') {
      if (this.textures.exists('src-opp')) {
        this.buildFace(FACE_OPPONENT, this.textures.get('src-opp').getSourceImage() as HTMLImageElement);
      }
    } else {
      // The CPU gets a robot; player 2 on the same device gets a random cartoon face.
      const emoji = config?.mode === 'local'
        ? FACE_PACK[Math.floor(Math.random() * FACE_PACK.length)]
        : CPU_FACE;
      this.buildFace(FACE_OPPONENT, renderEmojiCanvas(emoji, FACE_SIZE));
    }

    this.scene.start(config?.mode === 'online' ? 'online-pong' : 'pong');
  }

  private buildFace(key: string, source: HTMLImageElement | HTMLCanvasElement) {
    if (this.textures.exists(key)) this.textures.remove(key);

    const canvas = document.createElement('canvas');
    canvas.width = FACE_SIZE;
    canvas.height = FACE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const half = FACE_SIZE / 2;

    if (hasTransparentEdges(source)) {
      ctx.drawImage(source, 0, 0, FACE_SIZE, FACE_SIZE);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(half, half, half - 8, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(source, 0, 0, FACE_SIZE, FACE_SIZE);
      ctx.restore();

      // Sticker rim so the face reads as a ball against the light arena.
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(half, half, half - 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#6a4be0';
      ctx.beginPath();
      ctx.arc(half, half, half - 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    this.textures.addCanvas(key, canvas);
  }
}

/** True when the image's corners are see-through, i.e. a background-removed head or an emoji. */
function hasTransparentEdges(source: HTMLImageElement | HTMLCanvasElement): boolean {
  const probe = document.createElement('canvas');
  probe.width = 16;
  probe.height = 16;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0, 16, 16);
  const corners = [
    [0, 0],
    [15, 0],
    [0, 15],
    [15, 15],
  ];
  try {
    return corners.some(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] < 200);
  } catch {
    return false; // tainted canvas — treat as a photo
  }
}
