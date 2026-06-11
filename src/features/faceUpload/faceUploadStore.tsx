/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import type {
  FaceUploadActions,
  FaceUploadImage,
  FaceUploadState,
  FaceDetectionResult,
} from './faceUploadTypes';

type FaceUploadAction =
  | { type: 'select-image'; image: FaceUploadImage }
  | { type: 'clear-image' }
  | { type: 'begin-match' }
  | { type: 'reset-to-menu' }
  | {
      type: 'set-detection';
      detection: FaceDetectionResult | null;
    }
  | { type: 'set-cropped-avatar-url'; url: string | null }
  | { type: 'set-face-ball-mode'; enabled: boolean }
  | { type: 'set-ui-stage'; stage: 'menu' | 'crop' | 'ready' | 'playing' };

type FaceUploadContextValue = FaceUploadState & FaceUploadActions;

const initialState: FaceUploadState = {
  image: null,
  detection: null,
  uiStage: 'menu',
  profile: {
    displayName: 'Player One',
    avatarLabel: 'P1',
    avatarUrl: null,
  },
  croppedAvatarUrl: null,
  faceBallMode: false,
};

const FaceUploadContext = createContext<FaceUploadContextValue | undefined>(undefined);

function reducer(state: FaceUploadState, action: FaceUploadAction): FaceUploadState {
  switch (action.type) {
    case 'select-image':
      return {
        ...state,
        image: action.image,
        uiStage: 'crop',
        croppedAvatarUrl: null, // Reset previous crop
      };
    case 'clear-image':
      return {
        ...state,
        image: null,
        detection: null,
        uiStage: 'menu',
        croppedAvatarUrl: null,
      };
    case 'begin-match':
      return {
        ...state,
        uiStage: 'playing',
      };
    case 'reset-to-menu':
      return {
        ...state,
        uiStage: 'menu',
        image: null,
        detection: null,
        croppedAvatarUrl: null,
      };
    case 'set-detection':
      return {
        ...state,
        detection: action.detection,
      };
    case 'set-cropped-avatar-url':
      return {
        ...state,
        croppedAvatarUrl: action.url,
      };
    case 'set-face-ball-mode':
      return {
        ...state,
        faceBallMode: action.enabled,
      };
    case 'set-ui-stage':
      return {
        ...state,
        uiStage: action.stage,
      };
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
          image: {
            file,
            previewUrl,
            name: file.name,
            size: file.size,
            type: file.type,
          },
        });
      },
      clearImage: () => dispatch({ type: 'clear-image' }),
      beginMatch: () => dispatch({ type: 'begin-match' }),
      resetToMenu: () => dispatch({ type: 'reset-to-menu' }),
      setDetection: (detection) =>
        dispatch({
          type: 'set-detection',
          detection,
        }),
      setCroppedAvatarUrl: (url) =>
        dispatch({
          type: 'set-cropped-avatar-url',
          url,
        }),
      setFaceBallMode: (enabled) =>
        dispatch({
          type: 'set-face-ball-mode',
          enabled,
        }),
      setUiStage: (stage) =>
        dispatch({
          type: 'set-ui-stage',
          stage,
        }),
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

  return <FaceUploadContext.Provider value={value}>{children}</FaceUploadContext.Provider>;
}

export function useFaceUploadStore() {
  const context = useContext(FaceUploadContext);

  if (!context) {
    throw new Error('useFaceUploadStore must be used inside FaceUploadProvider.');
  }

  return context;
}