import { useEffect, useRef, useState } from 'react';

type CameraCaptureProps = {
  onCapture: (photo: File) => void;
  onCancel: () => void;
};

/** Front-camera selfie. The frame is handed to the normal crop/detect flow. */
export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      // Older browsers / non-HTTPS pages have no camera API at all.
      queueMicrotask(() => setError('Your browser can’t open the camera here. Upload a photo instead.'));
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const denied = err instanceof DOMException && err.name === 'NotAllowedError';
        setError(
          denied
            ? 'Camera permission was blocked. Allow it in your browser settings, or upload a photo instead.'
            : 'No camera found. Upload a photo instead.',
        );
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror like the preview so the photo matches what the player saw.
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      size,
      size,
    );

    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  };

  return (
    <div className="crop-editor-overlay">
      <div className="crop-editor">
        <h2 className="crop-editor__title">Say cheese! 📸</h2>
        <p className="crop-editor__subtitle">
          {error ?? 'Pull your best (or worst) face — it’s about to get smashed.'}
        </p>

        {!error && (
          <video
            ref={videoRef}
            className="camera-modal__video"
            playsInline
            muted
            onLoadedData={() => setReady(true)}
          />
        )}

        <div className="crop-editor__actions">
          <button type="button" className="face-upload__ghost-button" onClick={onCancel}>
            Cancel
          </button>
          {!error && (
            <button type="button" className="face-upload__button" onClick={capture} disabled={!ready}>
              {ready ? 'Snap!' : 'Starting camera…'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
