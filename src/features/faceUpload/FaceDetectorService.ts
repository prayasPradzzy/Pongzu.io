import type { FaceDetector } from '@mediapipe/tasks-vision';

// Must match the installed @mediapipe/tasks-vision version: the WASM runtime
// and the JS wrapper are only guaranteed to work together at the same version.
const MEDIAPIPE_VERSION = '0.10.35';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

class FaceDetectorService {
  private detectorPromise: Promise<FaceDetector> | null = null;

  /** Loads MediaPipe on first use so players who never upload a face never download it. */
  private load(): Promise<FaceDetector> {
    if (!this.detectorPromise) {
      this.detectorPromise = (async () => {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        return FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: 'IMAGE',
        });
      })();
      // A failed load (offline, blocked CDN) shouldn't poison every later attempt.
      this.detectorPromise.catch(() => {
        this.detectorPromise = null;
      });
    }
    return this.detectorPromise;
  }

  async detect(image: HTMLImageElement) {
    const detector = await this.load();
    return detector.detect(image);
  }
}

export const faceDetectorService = new FaceDetectorService();
