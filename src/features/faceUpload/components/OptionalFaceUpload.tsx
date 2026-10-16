import { useEffect, useState } from 'react';
import { useFaceUploadStore } from '../faceUploadStore';
import { FaceCropEditor } from './FaceCropEditor';
import { CameraCapture } from './CameraCapture';
import { faceDetectorService } from '../FaceDetectorService';
import { FACE_PACK, renderEmojiFace } from '../facePack';

const INPUT_ID = 'optional-face-upload-input';

/**
 * Face-ball picker, rendered inline on profile and setup screens:
 *   selfie camera / photo upload → face detection → crop (+ background removal)
 *   or one tap on a built-in cartoon face.
 *
 * All state flows through the global store; it never changes uiStage.
 */
export function OptionalFaceUpload() {
  const {
    image,
    croppedAvatarUrl,
    showCropEditor,
    selectImage,
    clearImage,
    setDetection,
    setCroppedAvatarUrl,
  } = useFaceUploadStore();

  // previewUrl of the image whose detection pass has finished (found a face or not)
  const [detectedFor, setDetectedFor] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const isDetecting = !!image && showCropEditor && detectedFor !== image.previewUrl;

  // Auto-run face detection when a new image arrives
  useEffect(() => {
    if (!image || !showCropEditor || detectedFor === image.previewUrl) return;

    let cancelled = false;
    const done = () => {
      if (!cancelled) setDetectedFor(image.previewUrl);
    };
    const img = new Image();
    img.src = image.previewUrl;
    img.onload = async () => {
      try {
        const result = await faceDetectorService.detect(img);
        if (cancelled) return;
        const face = result.detections?.[0];
        const box = face?.boundingBox;
        if (box) {
          const expandedWidth = box.width * 1.8;
          const expandedHeight = box.height * 2.1;
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
      } catch {
        // Detection is a convenience — without it the player just crops by hand.
        if (!cancelled) setDetection(null);
      } finally {
        done();
      }
    };
    img.onerror = done;

    return () => {
      cancelled = true;
    };
  }, [image, showCropEditor, detectedFor, setDetection]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setChanging(false);
      selectImage(file);
    }
    e.target.value = '';
  };

  const pickEmoji = (emoji: string) => {
    setChanging(false);
    setCroppedAvatarUrl(renderEmojiFace(emoji));
  };

  const fileInput = (
    <input id={INPUT_ID} className="face-upload__input" type="file" accept="image/*" onChange={handleFileChange} />
  );

  // ─── Camera ────────────────────────────────────────────────────────────
  if (cameraOpen) {
    return (
      <CameraCapture
        onCancel={() => setCameraOpen(false)}
        onCapture={(photo) => {
          setCameraOpen(false);
          setChanging(false);
          selectImage(photo);
        }}
      />
    );
  }

  // ─── Detecting / crop editor ───────────────────────────────────────────
  if (showCropEditor && image) {
    if (isDetecting) {
      return (
        <div className="ofu ofu--loading">
          <div className="ofu__spinner" />
          <span>Finding your face…</span>
        </div>
      );
    }
    return (
      <>
        <FaceCropEditor onConfirm={(url) => setCroppedAvatarUrl(url)} onCancel={clearImage} />
        {fileInput}
      </>
    );
  }

  // ─── Face chosen: preview ──────────────────────────────────────────────
  if (croppedAvatarUrl && !changing) {
    const isPhoto = croppedAvatarUrl.startsWith('data:image/jpeg');
    return (
      <div className="ofu ofu--preview">
        <div className="ofu__face-ring">
          <img
            src={croppedAvatarUrl}
            alt="Your face ball"
            className={`ofu__face-img ${isPhoto ? '' : 'ofu__face-img--cutout'}`}
          />
        </div>

        <div className="ofu__preview-info">
          <span className="ofu__preview-label">🤪 Face ball ready</span>
          <span className="ofu__preview-sub">Your opponent has to smash it.</span>
        </div>

        <div className="ofu__preview-actions">
          <button type="button" className="ofu__small-btn" onClick={() => setChanging(true)}>
            Change
          </button>
          <button type="button" className="ofu__small-btn ofu__small-btn--danger" onClick={clearImage}>
            Remove
          </button>
        </div>
        {fileInput}
      </div>
    );
  }

  // ─── Picker ────────────────────────────────────────────────────────────
  return (
    <div className="face-picker">
      <span className="setup__label">Face Ball</span>
      <div className="face-picker__actions">
        <button type="button" className="face-picker__action" onClick={() => setCameraOpen(true)}>
          📷 Take a selfie
        </button>
        <button
          type="button"
          className="face-picker__action"
          onClick={() => document.getElementById(INPUT_ID)?.click()}
        >
          🖼️ Upload photo
        </button>
      </div>

      <span className="face-picker__pack-label">…or pick a face</span>
      <div className="face-picker__pack">
        {FACE_PACK.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="face-picker__emoji"
            onClick={() => pickEmoji(emoji)}
            aria-label={`Use ${emoji} as your face`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <p className="face-picker__privacy">
        🔒 Your photo is processed on this device. It's only shared with the opponent you're playing online.
      </p>

      {changing && (
        <button type="button" className="ofu__small-btn" onClick={() => setChanging(false)}>
          Keep current face
        </button>
      )}
      {fileInput}
    </div>
  );
}
