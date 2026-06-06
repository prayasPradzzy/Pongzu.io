import {
  FaceDetector,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

class FaceDetectorService {
  private detector: FaceDetector | null = null;

  async initialize() {
    if (this.detector) {
      console.log("MediaPipe already initialized");
      return;
    }

    console.log("Initializing MediaPipe...");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );

    this.detector = await FaceDetector.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
        },
        runningMode: "IMAGE",
      }
    );

    console.log("MediaPipe initialized successfully");
  }

  async detect(image: HTMLImageElement) {
    if (!this.detector) {
      await this.initialize();
    }

    console.log("Running face detection...");

    const result = this.detector!.detect(image);

    console.log("Detection result:", result);

    return result;
  }
}

export const faceDetectorService = new FaceDetectorService();