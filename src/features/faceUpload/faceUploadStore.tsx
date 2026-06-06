import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import type {
  FacePlayerProfile,
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
    };

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
};

const FaceUploadContext = createContext<FaceUploadContextValue | undefined>(undefined);

function reducer(state: FaceUploadState, action: FaceUploadAction): FaceUploadState {
  switch (action.type) {
    case 'select-image':
      return {
        ...state,
        image: action.image,
        uiStage: 'ready',
      };
    case 'clear-image':
      return {
        ...state,
        image: null,
        uiStage: 'menu',
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
      };
    default:
      return state;
    case 'set-detection':
  return {
    ...state,
    detection: action.detection,
  };
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

export function createFacePlayerProfile(displayName: string, avatarLabel: string, avatarUrl: string | null): FacePlayerProfile {
  return { displayName, avatarLabel, avatarUrl };
}