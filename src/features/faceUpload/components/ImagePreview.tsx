type ImagePreviewProps = {
  src: string;
  alt: string;
  fileName: string;
  fileSize: number;
};

function formatFileSize(bytes: number) {
  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

export function ImagePreview({ src, alt, fileName, fileSize }: ImagePreviewProps) {
  return (
    <div className="face-upload__preview-card">
      <div className="face-upload__preview-frame">
        <img className="face-upload__preview-image" src={src} alt={alt} />
      </div>
      <div className="face-upload__preview-meta">
        <div>{fileName}</div>
        <div>{formatFileSize(fileSize)}</div>
      </div>
    </div>
  );
}