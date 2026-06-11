import { useEffect, useRef, useState } from 'react';
import { useFaceUploadStore } from '../faceUploadStore';

type FaceCropEditorProps = {
  onConfirm: (croppedUrl: string) => void;
  onCancel: () => void;
};

export function FaceCropEditor({ onConfirm, onCancel }: FaceCropEditorProps) {
  const { image, detection } = useFaceUploadStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

  // Crop settings
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const VIEWPORT_SIZE = 360;
  const CROP_RADIUS = 100;

  // Load the image element
  useEffect(() => {
    if (!image) return;
    const img = new Image();
    img.src = image.previewUrl;
    img.onload = () => {
      setImgElement(img);

      // Math for auto-centering based on MediaPipe bounding box
      const baseScale = Math.max(VIEWPORT_SIZE / img.naturalWidth, VIEWPORT_SIZE / img.naturalHeight);

      if (detection && detection.box) {
        const box = detection.box;
        // Bounding box center in natural image coordinates
        const faceCx = box.x + box.width / 2;
        const faceCy = box.y + box.height / 2;

        // Target face diameter in viewport pixels (e.g., occupies ~60% of crop diameter)
        const targetFaceSize = (CROP_RADIUS * 2) * 0.65;
        const currentFaceSize = Math.max(box.width, box.height);

        // Required scale and zoom
        const targetScale = targetFaceSize / currentFaceSize;
        const initialZoom = Math.max(1, targetScale / baseScale);
        setZoom(initialZoom);

        // Offset to center faceCx, faceCy
        const finalScale = baseScale * initialZoom;
        const faceDx = (img.naturalWidth / 2 - faceCx) * finalScale;
        const faceDy = (img.naturalHeight / 2 - faceCy) * finalScale;
        setOffset({ x: faceDx, y: faceDy });
      } else {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      }
    };
  }, [image, detection]);

  // Render crop canvas preview
  useEffect(() => {
    if (!imgElement || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);

    // Calculate scaling
    const baseScale = Math.max(VIEWPORT_SIZE / imgElement.naturalWidth, VIEWPORT_SIZE / imgElement.naturalHeight);
    const currentScale = baseScale * zoom;

    const w = imgElement.naturalWidth * currentScale;
    const h = imgElement.naturalHeight * currentScale;

    // Position of image center
    const x = VIEWPORT_SIZE / 2 + offset.x - w / 2;
    const y = VIEWPORT_SIZE / 2 + offset.y - h / 2;

    // Draw image
    ctx.drawImage(imgElement, x, y, w, h);

    // Draw dark semi-transparent overlay with a circular cutout
    ctx.fillStyle = 'rgba(21, 14, 40, 0.72)';
    ctx.beginPath();
    // Outer rectangle (clockwise)
    ctx.rect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);
    // Inner circle (counter-clockwise) to cut out
    ctx.arc(VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2, CROP_RADIUS, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    // Draw circle border
    ctx.strokeStyle = '#ff8dc7';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255, 141, 199, 0.6)';
    ctx.beginPath();
    ctx.arc(VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2, CROP_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;
  }, [imgElement, zoom, offset]);

  // Drag interaction handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Touch support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX - offset.x, y: touch.clientY - offset.y };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y,
    });
  };

  // Perform actual crop extraction
  const handleConfirm = () => {
    if (!imgElement) return;

    // Create a 256x256 target canvas for high quality avatar
    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = 256;
    targetCanvas.height = 256;
    const targetCtx = targetCanvas.getContext('2d');
    if (!targetCtx) return;

    // Image scaling factors
    const baseScale = Math.max(VIEWPORT_SIZE / imgElement.naturalWidth, VIEWPORT_SIZE / imgElement.naturalHeight);
    const currentScale = baseScale * zoom;

    // Viewport relative offsets mapping back to original image
    // Center of viewport crop circle is at (VIEWPORT_SIZE/2, VIEWPORT_SIZE/2)
    // Relative to the image, the top-left of our crop box is:
    // cropLeft = VIEWPORT_SIZE/2 - CROP_RADIUS
    // cropTop = VIEWPORT_SIZE/2 - CROP_RADIUS
    //
    // The image was drawn at:
    // imgX = VIEWPORT_SIZE / 2 + offset.x - w / 2
    // imgY = VIEWPORT_SIZE / 2 + offset.y - h / 2
    //
    // Let's compute the source coordinates on the natural image:
    const cropBoxXInViewport = VIEWPORT_SIZE / 2 - CROP_RADIUS;
    const cropBoxYInViewport = VIEWPORT_SIZE / 2 - CROP_RADIUS;

    const sourceX = (cropBoxXInViewport - (VIEWPORT_SIZE / 2 + offset.x - (imgElement.naturalWidth * currentScale) / 2)) / currentScale;
    const sourceY = (cropBoxYInViewport - (VIEWPORT_SIZE / 2 + offset.y - (imgElement.naturalHeight * currentScale) / 2)) / currentScale;

    const sourceWidth = (CROP_RADIUS * 2) / currentScale;
    const sourceHeight = (CROP_RADIUS * 2) / currentScale;

    // Draw to target canvas
    targetCtx.drawImage(
      imgElement,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      256,
      256
    );

    // Save as data URL
    const dataUrl = targetCanvas.toDataURL('image/png');
    onConfirm(dataUrl);
  };

  return (
    <div className="crop-editor-overlay">
      <div className="crop-editor">
        <h2 className="crop-editor__title">Crop Your Avatar Badge</h2>
        <p className="crop-editor__subtitle">
          Drag the photo to center your face inside the crop circle. Use the slider to zoom.
        </p>

        <div className="crop-editor__viewport-wrapper">
          <canvas
            ref={canvasRef}
            width={VIEWPORT_SIZE}
            height={VIEWPORT_SIZE}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUpOrLeave}
            className="crop-editor__canvas"
          />
        </div>

        <div className="crop-editor__controls">
          <label htmlFor="zoom-range" className="crop-editor__label">
            Zoom: {zoom.toFixed(1)}x
          </label>
          <input
            id="zoom-range"
            type="range"
            min="1"
            max="6"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="crop-editor__slider"
          />
        </div>

        <div className="crop-editor__actions">
          <button type="button" className="face-upload__ghost-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="face-upload__button" onClick={handleConfirm}>
            Confirm Crop
          </button>
        </div>
      </div>
    </div>
  );
}
