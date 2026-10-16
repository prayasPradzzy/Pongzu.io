import type { FaceDetector, ImageSegmenter } from '@mediapipe/tasks-vision';

// Must match the installed @mediapipe/tasks-vision version: the WASM runtime
// and the JS wrapper are only guaranteed to work together at the same version.
const MEDIAPIPE_VERSION = '0.10.35';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const SEGMENTER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite';

const OUTPUT_SIZE = 192;
const OUTLINE_PX = 7;

type Vision = Awaited<ReturnType<typeof import('@mediapipe/tasks-vision')['FilesetResolver']['forVisionTasks']>>;

class FaceDetectorService {
  private visionPromise: Promise<{ vision: Vision; lib: typeof import('@mediapipe/tasks-vision') }> | null = null;
  private detectorPromise: Promise<FaceDetector> | null = null;
  private segmenterPromise: Promise<ImageSegmenter> | null = null;

  /** Loads MediaPipe on first use so players who never upload a face never download it. */
  private loadVision() {
    if (!this.visionPromise) {
      this.visionPromise = (async () => {
        const lib = await import('@mediapipe/tasks-vision');
        const vision = await lib.FilesetResolver.forVisionTasks(WASM_URL);
        return { vision, lib };
      })();
      // A failed load (offline, blocked CDN) shouldn't poison every later attempt.
      this.visionPromise.catch(() => {
        this.visionPromise = null;
      });
    }
    return this.visionPromise;
  }

  private loadDetector(): Promise<FaceDetector> {
    if (!this.detectorPromise) {
      this.detectorPromise = this.loadVision().then(({ vision, lib }) =>
        lib.FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL },
          runningMode: 'IMAGE',
        }),
      );
      this.detectorPromise.catch(() => {
        this.detectorPromise = null;
      });
    }
    return this.detectorPromise;
  }

  private loadSegmenter(): Promise<ImageSegmenter> {
    if (!this.segmenterPromise) {
      this.segmenterPromise = this.loadVision().then(({ vision, lib }) =>
        lib.ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: SEGMENTER_MODEL_URL },
          runningMode: 'IMAGE',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        }),
      );
      this.segmenterPromise.catch(() => {
        this.segmenterPromise = null;
      });
    }
    return this.segmenterPromise;
  }

  async detect(image: HTMLImageElement) {
    const detector = await this.loadDetector();
    return detector.detect(image);
  }

  /** Start downloading the background-removal model before the player needs it. */
  prefetchSegmenter() {
    void this.loadSegmenter().catch(() => {});
  }

  /**
   * Cuts the person out of a square crop and gives it a white sticker
   * outline. Returns a transparent image data URL, or null if no person was
   * found (the caller then falls back to the plain circle photo).
   */
  async cutOutHead(crop: HTMLCanvasElement): Promise<string | null> {
    const segmenter = await this.loadSegmenter();
    const result = segmenter.segment(crop);
    try {
      const masks = result.confidenceMasks ?? [];
      // Single-mask models give "person"; two-mask models put person second.
      const mask = masks.length >= 2 ? masks[1] : masks[0];
      if (!mask) return null;
      return buildSticker(crop, mask.getAsFloat32Array(), mask.width, mask.height);
    } finally {
      result.close();
    }
  }
}

function buildSticker(crop: HTMLCanvasElement, confidence: Float32Array, maskW: number, maskH: number): string | null {
  // 1. Person-only image at mask resolution, with soft edges.
  const cut = document.createElement('canvas');
  cut.width = maskW;
  cut.height = maskH;
  const cutCtx = cut.getContext('2d');
  if (!cutCtx) return null;
  cutCtx.drawImage(crop, 0, 0, maskW, maskH);
  const pixels = cutCtx.getImageData(0, 0, maskW, maskH);

  let covered = 0;
  for (let i = 0; i < confidence.length; i++) {
    const t = Math.min(1, Math.max(0, (confidence[i] - 0.3) / 0.4)); // smoothstep-ish edge
    const alpha = t * t * (3 - 2 * t);
    pixels.data[i * 4 + 3] = Math.round(alpha * 255);
    if (alpha > 0.5) covered++;
  }
  const coverage = covered / confidence.length;
  // Nothing (or everything) detected as a person — not a usable cut-out.
  if (coverage < 0.08 || coverage > 0.97) return null;
  cutCtx.putImageData(pixels, 0, 0);

  // 2. White silhouette for the sticker outline.
  const silhouette = document.createElement('canvas');
  silhouette.width = maskW;
  silhouette.height = maskH;
  const silCtx = silhouette.getContext('2d');
  if (!silCtx) return null;
  silCtx.drawImage(cut, 0, 0);
  silCtx.globalCompositeOperation = 'source-in';
  silCtx.fillStyle = '#ffffff';
  silCtx.fillRect(0, 0, maskW, maskH);

  // 3. Compose: outline ring (silhouette stamped around a circle), then the person.
  const out = document.createElement('canvas');
  out.width = OUTPUT_SIZE;
  out.height = OUTPUT_SIZE;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  const inset = OUTLINE_PX + 2;
  const size = OUTPUT_SIZE - inset * 2;
  ctx.imageSmoothingQuality = 'high';
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    ctx.drawImage(
      silhouette,
      inset + Math.cos(angle) * OUTLINE_PX,
      inset + Math.sin(angle) * OUTLINE_PX,
      size,
      size,
    );
  }
  ctx.drawImage(cut, inset, inset, size, size);

  // WebP keeps transparency at a fraction of PNG's size; Safari falls back to PNG.
  const webp = out.toDataURL('image/webp', 0.9);
  return webp.startsWith('data:image/webp') ? webp : out.toDataURL('image/png');
}

export const faceDetectorService = new FaceDetectorService();
