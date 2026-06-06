import { ImagePreview } from './ImagePreview';
import { UploadFaceButton } from './UploadFaceButton';
import { FaceDetectionOverlay } from './FaceDetectionOverlay';

import { useFaceUploadStore } from '../faceUploadStore';
import { faceDetectorService } from '../FaceDetectorService';

type FaceUploadMenuProps = {
  onStartGame: () => void;
};

export function FaceUploadMenu({
  onStartGame,
}: FaceUploadMenuProps) {
  const {
    image,
    detection,
    selectImage,
    clearImage,
    beginMatch,
    setDetection,
  } = useFaceUploadStore();

  const handleStart = () => {
    beginMatch();
    onStartGame();
  };

  const handleTestDetection = async () => {
    if (!image) {
      console.log('No image selected');
      return;
    }

    const img = new Image();

    img.src = image.previewUrl;

    img.onload = async () => {
      try {
        console.log('Image loaded');

        const result =
          await faceDetectorService.detect(img);

        console.log(
          'Face detection result:',
          result
        );

        if (
          result.detections &&
          result.detections.length > 0
        ) {
          const face =
  result.detections[0];

const box =
  face.boundingBox;

if (!box) {
  console.log(
    'No bounding box returned'
  );
  return;
}

/*
  Face detector boxes are usually too tight.
  Expand them for avatar/profile use.
*/

const avatarScaleX = 1.8;
const avatarScaleY = 2.1;

const expandedWidth =
  box.width * avatarScaleX;

const expandedHeight =
  box.height * avatarScaleY;

const expandedX =
  box.originX -
  (expandedWidth - box.width) / 2;

const expandedY =
  box.originY -
  (expandedHeight - box.height) / 2;

setDetection({
  box: {
    x: expandedX,
    y: expandedY,
    width: expandedWidth,
    height: expandedHeight,
  },

  confidence:
    face.categories?.[0]?.score ?? 0,
});

console.log(
  'Expanded Bounding Box:',
  {
    x: expandedX,
    y: expandedY,
    width: expandedWidth,
    height: expandedHeight,
  }
);

          console.log(
            'Detection saved to store'
          );

          console.log(
            'Bounding Box:',
            box
          );
        } else {
          console.log(
            'No faces detected'
          );

          setDetection(null);
        }
      } catch (error) {
        console.error(
          'Detection failed:',
          error
        );
      }
    };
  };

  return (
    <section className="face-upload">
      <div className="face-upload__panel">
        <p className="face-upload__eyebrow">
          Face Pong
        </p>

        <h1 className="face-upload__title">
          Pick a face for your paddle badge.
        </h1>

        <p className="face-upload__copy">
          Upload an image now. Face detection
          and crop editing will be added later
          on top of this flow.
        </p>

        <div className="face-upload__actions">
          <UploadFaceButton
            onFileSelected={selectImage}
          />

          <button
            type="button"
            className="face-upload__ghost-button"
            onClick={clearImage}
            disabled={!image}
          >
            Clear
          </button>
        </div>

        <div className="face-upload__support-grid">
          <div className="face-upload__support-card">
            <div className="face-upload__support-label">
              Done
            </div>
            <div>
              MediaPipe face detection
            </div>
          </div>

          <div className="face-upload__support-card">
            <div className="face-upload__support-label">
              Next
            </div>
            <div>
              Crop editor
            </div>
          </div>

          <div className="face-upload__support-card">
            <div className="face-upload__support-label">
              Later
            </div>
            <div>
              Face-ball generation
            </div>
          </div>
        </div>

        {image ? (
          <>
            <ImagePreview
              src={image.previewUrl}
              alt="Selected face preview"
              fileName={image.name}
              fileSize={image.size}
            />

            {detection && (
              <FaceDetectionOverlay
                imageUrl={image.previewUrl}
                detection={detection}
              />
            )}

            <button
              type="button"
              className="face-upload__ghost-button"
              onClick={handleTestDetection}
            >
              Test Detection
            </button>
          </>
        ) : null}

        <button
          type="button"
          className="face-upload__start-button"
          onClick={handleStart}
        >
          Start Match
        </button>
      </div>
    </section>
  );
}