import { useCallback, useMemo, useState } from 'react';
import type {
  AnnotationActiveTool,
  AnnotationBrushKind,
  AnnotationGridPresetId,
  AnnotationObject,
  AnnotationSlideSnapshot,
  AnnotationSlideState,
  AnnotationStrokeStyle,
} from './annotation-types';
import type { AnnotationStickerItem } from './sticker-library';

const HISTORY_LIMIT = 50;

function cloneAnnotationObject(object: AnnotationObject): AnnotationObject {
  if (object.kind === 'stroke') {
    return {
      ...object,
      points: object.points.map((point) => ({ ...point })),
    };
  }

  return { ...object };
}

function createEmptySnapshot(): AnnotationSlideSnapshot {
  return {
    sheetEnabled: false,
    sheetPreset: 'blank',
    objects: [],
  };
}

function cloneSnapshot(snapshot: AnnotationSlideSnapshot): AnnotationSlideSnapshot {
  return {
    sheetEnabled: snapshot.sheetEnabled,
    sheetPreset: snapshot.sheetPreset,
    objects: snapshot.objects.map(cloneAnnotationObject),
  };
}

function createEmptyState(): AnnotationSlideState {
  return {
    ...createEmptySnapshot(),
    past: [],
    future: [],
  };
}

function getSnapshotFromState(state: AnnotationSlideState): AnnotationSlideSnapshot {
  return {
    sheetEnabled: state.sheetEnabled,
    sheetPreset: state.sheetPreset,
    objects: state.objects,
  };
}

export interface PresentationAnnotationsController {
  activeTool: AnnotationActiveTool;
  setActiveTool: (tool: AnnotationActiveTool) => void;
  toolbarOpen: boolean;
  setToolbarOpen: (value: boolean) => void;
  sheetMenuOpen: boolean;
  setSheetMenuOpen: (value: boolean) => void;
  brushSize: number;
  setBrushSize: (value: number) => void;
  brushColor: string;
  setBrushColor: (value: string) => void;
  brushKind: AnnotationBrushKind;
  setBrushKind: (value: AnnotationBrushKind) => void;
  textColor: string;
  setTextColor: (value: string) => void;
  textFontSize: number;
  setTextFontSize: (value: number) => void;
  brushStrokeStyle: AnnotationStrokeStyle;
  setBrushStrokeStyle: (value: AnnotationStrokeStyle) => void;
  stickerSize: number;
  setStickerSize: (value: number) => void;
  selectedSticker: AnnotationStickerItem | null;
  setSelectedSticker: (value: AnnotationStickerItem | null) => void;
  pinnedStickerRowId: string | null;
  setPinnedStickerRowId: (value: string | null) => void;
  getSlideState: (slideId: string) => AnnotationSlideState;
  commitSnapshot: (slideId: string, nextSnapshot: AnnotationSlideSnapshot) => void;
  replaceSnapshot: (slideId: string, nextSnapshot: AnnotationSlideSnapshot) => void;
  setSheetPreset: (slideId: string, preset: AnnotationGridPresetId) => void;
  toggleSheet: (slideId: string) => void;
  clearSlide: (slideId: string) => void;
  undo: (slideId: string) => void;
  redo: (slideId: string) => void;
  canUndo: (slideId: string) => boolean;
  canRedo: (slideId: string) => boolean;
}

export function usePresentationAnnotations(): PresentationAnnotationsController {
  const [slides, setSlides] = useState<Record<string, AnnotationSlideState>>({});
  const [activeTool, setActiveTool] = useState<AnnotationActiveTool>('select');
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [sheetMenuOpen, setSheetMenuOpen] = useState(false);
  const [brushSize, setBrushSize] = useState(8);
  const [brushColor, setBrushColor] = useState('#3f4b68');
  const [brushKind, setBrushKind] = useState<AnnotationBrushKind>('pen');
  const [textColor, setTextColor] = useState('#3f4b68');
  const [textFontSize, setTextFontSize] = useState(28);
  const [brushStrokeStyle, setBrushStrokeStyle] = useState<AnnotationStrokeStyle>('solid');
  const [stickerSize, setStickerSize] = useState(100);
  const [selectedSticker, setSelectedSticker] = useState<AnnotationStickerItem | null>(null);
  const [pinnedStickerRowId, setPinnedStickerRowId] = useState<string | null>(null);

  const getSlideState = useCallback((slideId: string) => {
    return slides[slideId] ?? createEmptyState();
  }, [slides]);

  const replaceSnapshot = useCallback((slideId: string, nextSnapshot: AnnotationSlideSnapshot) => {
    setSlides((prev) => {
      const current = prev[slideId] ?? createEmptyState();
      return {
        ...prev,
        [slideId]: {
          ...current,
          ...cloneSnapshot(nextSnapshot),
        },
      };
    });
  }, []);

  const commitSnapshot = useCallback((slideId: string, nextSnapshot: AnnotationSlideSnapshot) => {
    setSlides((prev) => {
      const current = prev[slideId] ?? createEmptyState();
      const currentSnapshot = cloneSnapshot(getSnapshotFromState(current));
      return {
        ...prev,
        [slideId]: {
          ...cloneSnapshot(nextSnapshot),
          past: [...current.past, currentSnapshot].slice(-HISTORY_LIMIT),
          future: [],
        },
      };
    });
  }, []);

  const setSheetPreset = useCallback((slideId: string, preset: AnnotationGridPresetId) => {
    const current = slides[slideId] ?? createEmptyState();
    commitSnapshot(slideId, {
      sheetEnabled: true,
      sheetPreset: preset,
      objects: current.objects,
    });
  }, [commitSnapshot, slides]);

  const toggleSheet = useCallback((slideId: string) => {
    const current = slides[slideId] ?? createEmptyState();
    commitSnapshot(slideId, {
      sheetEnabled: !current.sheetEnabled,
      sheetPreset: current.sheetPreset,
      objects: current.objects,
    });
  }, [commitSnapshot, slides]);

  const clearSlide = useCallback((slideId: string) => {
    commitSnapshot(slideId, createEmptySnapshot());
  }, [commitSnapshot]);

  const undo = useCallback((slideId: string) => {
    setSlides((prev) => {
      const current = prev[slideId] ?? createEmptyState();
      if (current.past.length === 0) return prev;
      const previousSnapshot = current.past[current.past.length - 1];
      const currentSnapshot = cloneSnapshot(getSnapshotFromState(current));
      return {
        ...prev,
        [slideId]: {
          ...cloneSnapshot(previousSnapshot),
          past: current.past.slice(0, -1),
          future: [currentSnapshot, ...current.future].slice(0, HISTORY_LIMIT),
        },
      };
    });
  }, []);

  const redo = useCallback((slideId: string) => {
    setSlides((prev) => {
      const current = prev[slideId] ?? createEmptyState();
      if (current.future.length === 0) return prev;
      const nextSnapshot = current.future[0];
      const currentSnapshot = cloneSnapshot(getSnapshotFromState(current));
      return {
        ...prev,
        [slideId]: {
          ...cloneSnapshot(nextSnapshot),
          past: [...current.past, currentSnapshot].slice(-HISTORY_LIMIT),
          future: current.future.slice(1),
        },
      };
    });
  }, []);

  const canUndo = useCallback((slideId: string) => {
    const current = slides[slideId];
    return !!current && current.past.length > 0;
  }, [slides]);

  const canRedo = useCallback((slideId: string) => {
    const current = slides[slideId];
    return !!current && current.future.length > 0;
  }, [slides]);

  return useMemo(() => ({
    activeTool,
    setActiveTool,
    toolbarOpen,
    setToolbarOpen,
    sheetMenuOpen,
    setSheetMenuOpen,
    brushSize,
    setBrushSize,
    brushColor,
    setBrushColor,
    brushKind,
    setBrushKind,
    textColor,
    setTextColor,
    textFontSize,
    setTextFontSize,
    brushStrokeStyle,
    setBrushStrokeStyle,
    stickerSize,
    setStickerSize,
    selectedSticker,
    setSelectedSticker,
    pinnedStickerRowId,
    setPinnedStickerRowId,
    getSlideState,
    commitSnapshot,
    replaceSnapshot,
    setSheetPreset,
    toggleSheet,
    clearSlide,
    undo,
    redo,
    canUndo,
    canRedo,
  }), [
    activeTool,
    brushSize,
    brushColor,
    brushKind,
    textColor,
    textFontSize,
    brushStrokeStyle,
    stickerSize,
    selectedSticker,
    pinnedStickerRowId,
    canRedo,
    canUndo,
    clearSlide,
    commitSnapshot,
    getSlideState,
    redo,
    replaceSnapshot,
    setSheetPreset,
    sheetMenuOpen,
    toggleSheet,
    toolbarOpen,
    undo,
  ]);
}
