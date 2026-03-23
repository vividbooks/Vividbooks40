import { useState } from 'react';

export interface UseEditorModalsReturn {
  showPreview: boolean;
  setShowPreview: (v: boolean) => void;
  showNewSlideDropdown: boolean;
  setShowNewSlideDropdown: (v: boolean) => void;
  showShareEditDialog: boolean;
  setShowShareEditDialog: (v: boolean) => void;
  showVersionHistory: boolean;
  setShowVersionHistory: (v: boolean) => void;
  showLiveSession: boolean;
  setShowLiveSession: (v: boolean) => void;
  showColorPicker: boolean;
  setShowColorPicker: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  showSlidePreviews: boolean;
  setShowSlidePreviews: (v: boolean) => void;
}

export function useEditorModals(): UseEditorModalsReturn {
  const [showPreview, setShowPreview] = useState(false);
  const [showNewSlideDropdown, setShowNewSlideDropdown] = useState(false);
  const [showShareEditDialog, setShowShareEditDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSlidePreviews, setShowSlidePreviews] = useState(false);

  return {
    showPreview, setShowPreview,
    showNewSlideDropdown, setShowNewSlideDropdown,
    showShareEditDialog, setShowShareEditDialog,
    showVersionHistory, setShowVersionHistory,
    showLiveSession, setShowLiveSession,
    showColorPicker, setShowColorPicker,
    showSettings, setShowSettings,
    showSlidePreviews, setShowSlidePreviews,
  };
}
