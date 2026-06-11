import { useEffect, useState } from 'react';
import { UploadFaceButton } from './UploadFaceButton';
import { FaceCropEditor } from './FaceCropEditor';

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
    uiStage,
    croppedAvatarUrl,
    faceBallMode,
    selectImage,
    clearImage,
    beginMatch,
    setDetection,
    setCroppedAvatarUrl,
    setFaceBallMode,
    setUiStage,
  } = useFaceUploadStore();

  const [isDetecting, setIsDetecting] = useState(false);

  // Auto-run face detection when a new image is selected
  useEffect(() => {
    if (image && uiStage === 'crop' && !detection) {
      setTimeout(() => setIsDetecting(true), 0);
      const img = new Image();
      img.src = image.previewUrl;
      img.onload = async () => {
        try {
          console.log('Lobby: image loaded, running auto face detection...');
          const result = await faceDetectorService.detect(img);
          console.log('Lobby: face detection result:', result);

          if (result.detections && result.detections.length > 0) {
            const face = result.detections[0];
            const box = face.boundingBox;

            if (box) {
              const avatarScaleX = 1.8;
              const avatarScaleY = 2.1;
              const expandedWidth = box.width * avatarScaleX;
              const expandedHeight = box.height * avatarScaleY;
              const expandedX = box.originX - (expandedWidth - box.width) / 2;
              const expandedY = box.originY - (expandedHeight - box.height) / 2;

              setDetection({
                box: {
                  x: expandedX,
                  y: expandedY,
                  width: expandedWidth,
                  height: expandedHeight,
                },
                confidence: face.categories?.[0]?.score ?? 0,
              });
            } else {
              setDetection(null);
            }
          } else {
            console.log('Lobby: no faces detected');
            setDetection(null);
          }
        } catch (error) {
          console.error('Auto detection error:', error);
          setDetection(null);
        } finally {
          setIsDetecting(false);
        }
      };
      img.onerror = () => {
        console.error('Failed to load image preview for detection.');
        setIsDetecting(false);
      };
    }
  }, [image, uiStage, detection, setDetection]);

  const handleStart = () => {
    beginMatch();
    onStartGame();
  };

  const handleCropConfirm = (croppedUrl: string) => {
    setCroppedAvatarUrl(croppedUrl);
    setUiStage('ready');
  };

  const handleCropCancel = () => {
    clearImage();
  };

  return (
    <section className="face-upload">
      <div className="face-upload__panel">
        <p className="face-upload__eyebrow">Face Pong</p>

        <h1 className="face-upload__title">
          {uiStage === 'ready' ? 'Ready to play!' : 'Pick a face for your paddle badge.'}
        </h1>

        <p className="face-upload__copy">
          {uiStage === 'ready'
            ? 'Your avatar badge is ready. Toggle settings below and start the match!'
            : 'Upload a picture of yourself. We will automatically frame your face for your circular avatar badge.'}
        </p>

        {uiStage === 'menu' && (
          <>
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
                <div className="face-upload__support-label">Step 1</div>
                <div>Upload face photo</div>
              </div>

              <div className="face-upload__support-card">
                <div className="face-upload__support-label">Step 2</div>
                <div>MediaPipe auto crop</div>
              </div>

              <div className="face-upload__support-card">
                <div className="face-upload__support-label">Step 3</div>
                <div>Play with Face-Ball!</div>
              </div>
            </div>
          </>
        )}

        {/* Display loading state when running detection */}
        {isDetecting && (
          <div className="face-upload__preview-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px' }}>
            <div className="loading-spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(123, 92, 230, 0.15)', borderTop: '4px solid #7b5ce6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ color: '#7b5ce6', fontWeight: 600 }}>Analyzing face with MediaPipe...</div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Render Crop Editor Modal when in crop stage and image is ready */}
        {uiStage === 'crop' && image && !isDetecting && (
          <FaceCropEditor onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
        )}

        {/* Render Cropped Preview and Settings when in ready stage */}
        {uiStage === 'ready' && croppedAvatarUrl && (
          <>
            <div className="face-upload__preview-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                className="face-upload__preview-frame"
                style={{
                  width: '128px',
                  height: '128px',
                  borderRadius: '50%',
                  border: '3px solid #ff8dc7',
                  boxShadow: '0 0 16px rgba(255, 141, 199, 0.4)',
                  overflow: 'hidden',
                }}
              >
                <img
                  className="face-upload__preview-image"
                  src={croppedAvatarUrl}
                  alt="Cropped face avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div className="face-upload__preview-meta" style={{ marginTop: '12px' }}>
                <span style={{ fontWeight: 700, color: '#7b5ce6' }}>Avatar Badge Generated</span>
              </div>
            </div>

            {/* Face-Ball Mode Settings Card */}
            <div className="face-upload__setting-card">
              <label className="face-upload__checkbox-label">
                <input
                  type="checkbox"
                  checked={faceBallMode}
                  onChange={(e) => setFaceBallMode(e.target.checked)}
                  className="face-upload__checkbox"
                />
                <span className="face-upload__checkbox-text">
                  <strong>Face-Ball Mode 🤪</strong>
                  <p>Play with your cropped face bouncing around as the ball instead of the default ball!</p>
                </span>
              </label>
            </div>

            <div className="face-upload__actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="face-upload__ghost-button"
                onClick={clearImage}
                style={{ flex: 1 }}
              >
                Choose Another Face
              </button>
              <button
                type="button"
                className="face-upload__ghost-button"
                onClick={() => setUiStage('crop')}
                style={{ flex: 1 }}
              >
                Adjust Crop
              </button>
            </div>

            <button
              type="button"
              className="face-upload__start-button"
              onClick={handleStart}
            >
              Start Match
            </button>
          </>
        )}
      </div>
    </section>
  );
}