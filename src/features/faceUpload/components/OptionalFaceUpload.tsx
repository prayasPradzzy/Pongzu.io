import { useEffect, useState } from 'react';
import { useFaceUploadStore } from '../faceUploadStore';
import { FaceCropEditor } from './FaceCropEditor';
import { faceDetectorService } from '../FaceDetectorService';

/**
 * Self-contained optional face-ball upload widget.
 * Renders inline within any setup screen. Handles:
 *   file pick → face detection → crop editor modal → face-ball preview
 *
 * When a face is cropped, faceBallMode is automatically enabled.
 * Does NOT change uiStage. All state flows through the global store.
 */
export function OptionalFaceUpload() {
  const {
    image,
    detection,
    croppedAvatarUrl,
    showCropEditor,
    selectImage,
    clearImage,
    setDetection,
    setCroppedAvatarUrl,
    setShowCropEditor,
  } = useFaceUploadStore();

  const [isDetecting, setIsDetecting] = useState(false);
  const inputId = 'optional-face-upload-input';

  // Auto-run face detection when a new image arrives
  useEffect(() => {
    if (!image || !showCropEditor || detection) return;

    setIsDetecting(true);
    const img = new Image();
    img.src = image.previewUrl;
    img.onload = async () => {
      try {
        const result = await faceDetectorService.detect(img);
        if (result.detections && result.detections.length > 0) {
          const face = result.detections[0];
          const box = face.boundingBox;
          if (box) {
            const avatarScaleX = 1.8;
            const avatarScaleY = 2.1;
            const expandedWidth = box.width * avatarScaleX;
            const expandedHeight = box.height * avatarScaleY;
            setDetection({
              box: {
                x: box.originX - (expandedWidth - box.width) / 2,
                y: box.originY - (expandedHeight - box.height) / 2,
                width: expandedWidth,
                height: expandedHeight,
              },
              confidence: face.categories?.[0]?.score ?? 0,
            });
          } else {
            setDetection(null);
          }
        } else {
          setDetection(null);
        }
      } catch {
        setDetection(null);
      } finally {
        setIsDetecting(false);
      }
    };
    img.onerror = () => setIsDetecting(false);
  }, [image, showCropEditor, detection, setDetection]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectImage(file);
    e.target.value = '';
  };

  const handleCropConfirm = (croppedUrl: string) => {
    setCroppedAvatarUrl(croppedUrl);
    // faceBallMode is auto-enabled by the store when cropped avatar is set
  };

  const handleCropCancel = () => {
    clearImage();
  };

  // ─── No face yet: show upload button ───────────────────────────────────
  if (!croppedAvatarUrl && !showCropEditor) {
    return (
      <div className="ofu">
        <button
          type="button"
          className="ofu__add-btn"
          onClick={() => document.getElementById(inputId)?.click()}
        >
          <span className="ofu__add-icon">🤪</span>
          <span className="ofu__add-text">
            <strong>Add Face Ball</strong>
            <small>Optional — your face becomes the ball!</small>
          </span>
        </button>
        <input
          id={inputId}
          className="face-upload__input"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  // ─── Detecting / Crop editor open ──────────────────────────────────────
  if (showCropEditor) {
    if (isDetecting) {
      return (
        <div className="ofu ofu--loading">
          <div className="ofu__spinner" />
          <span>Detecting face…</span>
        </div>
      );
    }
    if (image) {
      return (
        <>
          <FaceCropEditor onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
          <input
            id={inputId}
            className="face-upload__input"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
        </>
      );
    }
  }

  // ─── Face added: show preview ──────────────────────────────────────────
  return (
    <div className="ofu ofu--preview">
      <div className="ofu__face-ring">
        <img src={croppedAvatarUrl!} alt="Face ball" className="ofu__face-img" />
      </div>

      <div className="ofu__preview-info">
        <span className="ofu__preview-label">🤪 Face Added ✓</span>
        <span className="ofu__preview-sub">Your face will be the ball!</span>
      </div>

      <div className="ofu__preview-actions">
        <button
          type="button"
          className="ofu__small-btn"
          onClick={() => setShowCropEditor(true)}
        >
          Change Face
        </button>
        <button
          type="button"
          className="ofu__small-btn ofu__small-btn--danger"
          onClick={clearImage}
        >
          Remove Face
        </button>
      </div>

      <input
        id={inputId}
        className="face-upload__input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
    </div>
  );
}
