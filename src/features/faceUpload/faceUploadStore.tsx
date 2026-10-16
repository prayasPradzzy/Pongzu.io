/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import type {
  FaceUploadActions,
  FaceUploadImage,
  FaceUploadState,
  FaceDetectionResult,
  UiStage,
} from './faceUploadTypes';

type FaceUploadAction =
  | { type: 'select-image'; image: FaceUploadImage }
  | { type: 'clear-image' }
  | { type: 'begin-match' }
  | { type: 'reset-to-menu' }
  | { type: 'leave-room'; stage: UiStage }
  | { type: 'set-detection'; detection: FaceDetectionResult | null }
  | { type: 'set-cropped-avatar-url'; url: string | null }
  | { type: 'set-face-ball-mode'; enabled: boolean }
  | { type: 'set-ui-stage'; stage: UiStage }
  | { type: 'set-show-crop-editor'; show: boolean }
  | { type: 'set-difficulty'; difficulty: FaceUploadState['difficulty'] }
  // Multiplayer actions
  | { type: 'set-game-mode'; mode: 'cpu' | 'online' }
  | { type: 'set-multiplayer-role'; role: 'host' | 'guest' | null }
  | { type: 'set-room-code'; code: string | null }
  | { type: 'set-opponent'; name: string | null; avatarUrl: string | null }
  | { type: 'set-connection-status'; status: FaceUploadState['connectionStatus'] }
  | { type: 'set-disconnect-reason'; reason: string | null }
  | { type: 'set-player-name'; name: string };

type FaceUploadContextValue = FaceUploadState & FaceUploadActions;

const NAME_STORAGE_KEY = 'pongzu-name';
const FACE_STORAGE_KEY = 'pongzu-face';

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked (private mode etc.)
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // storage blocked or full — the game still works, it just won't remember
  }
}

// Name and face are remembered between visits so returning players can jump straight in.
const storedFace = readStored(FACE_STORAGE_KEY);
const rememberedFace = storedFace && storedFace.startsWith('data:image/') ? storedFace : null;

const initialState: FaceUploadState = {
  image: null,
  detection: null,
  uiStage: 'mainMenu',
  croppedAvatarUrl: rememberedFace,
  faceBallMode: rememberedFace !== null,
  showCropEditor: false,
  difficulty: 'medium',
  // Multiplayer
  gameMode: null,
  multiplayerRole: null,
  roomCode: null,
  opponentName: null,
  opponentAvatarUrl: null,
  connectionStatus: 'idle',
  disconnectReason: null,
  playerName: (readStored(NAME_STORAGE_KEY) ?? '').slice(0, 20),
};

const FaceUploadContext = createContext<FaceUploadContextValue | undefined>(undefined);

function reducer(state: FaceUploadState, action: FaceUploadAction): FaceUploadState {
  switch (action.type) {
    case 'select-image':
      return {
        ...state,
        image: action.image,
        croppedAvatarUrl: null,
        showCropEditor: true, // open crop editor inline — don't change uiStage
      };
    case 'clear-image':
      return {
        ...state,
        image: null,
        detection: null,
        croppedAvatarUrl: null,
        showCropEditor: false,
        faceBallMode: false,
      };
    case 'begin-match':
      return {
        ...state,
        uiStage: 'playing',
      };
    case 'reset-to-menu':
    case 'leave-room':
      // The chosen face and name deliberately survive, so a rematch or a new
      // room doesn't mean uploading and cropping again.
      return {
        ...state,
        uiStage: action.type === 'leave-room' ? action.stage : 'mainMenu',
        image: null,
        detection: null,
        showCropEditor: false,
        gameMode: null,
        multiplayerRole: null,
        roomCode: null,
        opponentName: null,
        opponentAvatarUrl: null,
        connectionStatus: 'idle',
        disconnectReason: null,
      };
    case 'set-detection':
      return { ...state, detection: action.detection };
    case 'set-cropped-avatar-url':
      return { ...state, croppedAvatarUrl: action.url, faceBallMode: action.url !== null, showCropEditor: false };
    case 'set-face-ball-mode':
      return { ...state, faceBallMode: action.enabled };
    case 'set-ui-stage':
      return { ...state, uiStage: action.stage };
    case 'set-show-crop-editor':
      return { ...state, showCropEditor: action.show };
    case 'set-difficulty':
      return { ...state, difficulty: action.difficulty };
    // Multiplayer
    case 'set-game-mode':
      return { ...state, gameMode: action.mode };
    case 'set-multiplayer-role':
      return { ...state, multiplayerRole: action.role };
    case 'set-room-code':
      return { ...state, roomCode: action.code };
    case 'set-opponent':
      return { ...state, opponentName: action.name, opponentAvatarUrl: action.avatarUrl };
    case 'set-connection-status':
      return { ...state, connectionStatus: action.status };
    case 'set-disconnect-reason':
      return { ...state, disconnectReason: action.reason };
    case 'set-player-name':
      return { ...state, playerName: action.name };
    default:
      return state;
  }
}

export function FaceUploadProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<FaceUploadContextValue>(
    () => ({
      ...state,
      selectImage: (file: File) => {
        const previewUrl = URL.createObjectURL(file);
        dispatch({
          type: 'select-image',
          image: { file, previewUrl, name: file.name, size: file.size, type: file.type },
        });
      },
      clearImage: () => dispatch({ type: 'clear-image' }),
      beginMatch: () => dispatch({ type: 'begin-match' }),
      resetToMenu: () => dispatch({ type: 'reset-to-menu' }),
      leaveRoom: (stage) => dispatch({ type: 'leave-room', stage }),
      setDetection: (detection) => dispatch({ type: 'set-detection', detection }),
      setCroppedAvatarUrl: (url) => dispatch({ type: 'set-cropped-avatar-url', url }),
      setFaceBallMode: (enabled) => dispatch({ type: 'set-face-ball-mode', enabled }),
      setUiStage: (stage) => dispatch({ type: 'set-ui-stage', stage }),
      setShowCropEditor: (show) => dispatch({ type: 'set-show-crop-editor', show }),
      setDifficulty: (difficulty) => dispatch({ type: 'set-difficulty', difficulty }),
      // Multiplayer
      setGameMode: (mode) => dispatch({ type: 'set-game-mode', mode }),
      setMultiplayerRole: (role) => dispatch({ type: 'set-multiplayer-role', role }),
      setRoomCode: (code) => dispatch({ type: 'set-room-code', code }),
      setOpponent: (name, avatarUrl) => dispatch({ type: 'set-opponent', name, avatarUrl }),
      setConnectionStatus: (status) => dispatch({ type: 'set-connection-status', status }),
      setDisconnectReason: (reason) => dispatch({ type: 'set-disconnect-reason', reason }),
      setPlayerName: (name) => dispatch({ type: 'set-player-name', name }),
    }),
    [state],
  );

  useEffect(() => {
    return () => {
      if (state.image) {
        URL.revokeObjectURL(state.image.previewUrl);
      }
    };
  }, [state.image]);

  useEffect(() => {
    writeStored(NAME_STORAGE_KEY, state.playerName.trim() || null);
  }, [state.playerName]);

  useEffect(() => {
    writeStored(FACE_STORAGE_KEY, state.croppedAvatarUrl);
  }, [state.croppedAvatarUrl]);

  return <FaceUploadContext.Provider value={value}>{children}</FaceUploadContext.Provider>;
}

export function useFaceUploadStore() {
  const context = useContext(FaceUploadContext);
  if (!context) {
    throw new Error('useFaceUploadStore must be used inside FaceUploadProvider.');
  }
  return context;
}