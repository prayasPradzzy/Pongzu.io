export type FaceUploadState = {
  image: FaceUploadImage | null;
  uiStage: 'menu' | 'ready' | 'playing';

  detection: FaceDetectionResult | null;

  profile: FacePlayerProfile;
};

export type FaceUploadImage = {
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  type: string;
};

export type FacePlayerProfile = {
  displayName: string;
  avatarLabel: string;
  avatarUrl: string | null;
};

export type FaceUploadActions = {
  selectImage: (file: File) => void;

  clearImage: () => void;

  beginMatch: () => void;

  resetToMenu: () => void;

  setDetection: (
    detection: FaceDetectionResult | null
  ) => void;
};

export type FaceDetectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FaceDetectionResult = {
  box: FaceDetectionBox;
  confidence: number;
};