import type {
  FaceDetectionResult,
} from "../faceUploadTypes";

type Props = {
  imageUrl: string;
  detection: FaceDetectionResult;
};

export function FaceDetectionOverlay({
  imageUrl,
  detection,
}: Props) {
  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        marginTop: "20px",
      }}
    >
      <img
        src={imageUrl}
        alt=""
        style={{
          maxWidth: "400px",
          display: "block",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: detection.box.x,
          top: detection.box.y,
          width: detection.box.width,
          height: detection.box.height,
          border: "3px solid hotpink",
          borderRadius: "12px",
          boxShadow:
            "0 0 20px hotpink",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}