export type UiStage =
  | 'mainMenu'
  | 'cpuSetup'
  | 'multiplayerMenu'
  | 'createSetup'
  | 'joinSetup'
  | 'lobby'
  | 'playing'
  | 'crop'
  | 'faceBall'
  | 'gameOver'
  | 'modeSelect'
  | 'ready'
  | 'menu'
  | 'stats';

export type FaceUploadState = {
  image: FaceUploadImage | null;
  uiStage: UiStage;

  detection: FaceDetectionResult | null;

  croppedAvatarUrl: string | null;
  faceBallMode: boolean;

  // ─── Multiplayer state ──────────────────────────────────────────────────
  gameMode: 'cpu' | 'online' | null;
  multiplayerRole: 'host' | 'guest' | null;
  roomCode: string | null;
  opponentName: string | null;
  opponentAvatarUrl: string | null;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'error';
  disconnectReason: string | null;
  playerName: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'nightmare';
  showCropEditor: boolean;
};

export type FaceUploadImage = {
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  type: string;
};

export type FaceUploadActions = {
  selectImage: (file: File) => void;
  clearImage: () => void;
  beginMatch: () => void;
  resetToMenu: () => void;
  setDetection: (detection: FaceDetectionResult | null) => void;
  setCroppedAvatarUrl: (url: string | null) => void;
  setFaceBallMode: (enabled: boolean) => void;
  setUiStage: (stage: UiStage) => void;
  setShowCropEditor: (show: boolean) => void;
  setDifficulty: (difficulty: FaceUploadState['difficulty']) => void;

  // ─── Multiplayer actions ────────────────────────────────────────────────
  setGameMode: (mode: 'cpu' | 'online') => void;
  setMultiplayerRole: (role: 'host' | 'guest' | null) => void;
  setRoomCode: (code: string | null) => void;
  setOpponent: (name: string, avatarUrl: string | null) => void;
  setConnectionStatus: (status: 'idle' | 'connecting' | 'connected' | 'error') => void;
  setDisconnectReason: (reason: string | null) => void;
  setPlayerName: (name: string) => void;
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