import { ImagePreview } from './ImagePreview';
import { UploadFaceButton } from './UploadFaceButton';
import { useFaceUploadStore } from '../faceUploadStore';

type FaceUploadMenuProps = {
  onStartGame: () => void;
};

export function FaceUploadMenu({ onStartGame }: FaceUploadMenuProps) {
  const { image, selectImage, clearImage, beginMatch } = useFaceUploadStore();

  const handleStart = () => {
    beginMatch();
    onStartGame();
  };

  return (
    <section className="face-upload">
      <div className="face-upload__panel">
        <p className="face-upload__eyebrow">Face Pong</p>
        <h1 className="face-upload__title">Pick a face for your paddle badge.</h1>
        <p className="face-upload__copy">
          Upload an image now. Face detection and crop editing will be added later on top of this flow.
        </p>

        <div className="face-upload__actions">
          <UploadFaceButton onFileSelected={selectImage} />
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
            <div className="face-upload__support-label">Later</div>
            <div>MediaPipe face detection</div>
          </div>
          <div className="face-upload__support-card">
            <div className="face-upload__support-label">Later</div>
            <div>Crop editor</div>
          </div>
          <div className="face-upload__support-card">
            <div className="face-upload__support-label">Later</div>
            <div>Player profiles</div>
          </div>
        </div>

        {image ? (
          <ImagePreview src={image.previewUrl} alt="Selected face preview" fileName={image.name} fileSize={image.size} />
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