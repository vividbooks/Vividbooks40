import { useState, useEffect } from 'react';

export interface UseBlockSelectionReturn {
  selectedBlockIndex: number | null;
  setSelectedBlockIndex: (idx: number | null) => void;
  showBlockSettings: boolean;
  setShowBlockSettings: (v: boolean) => void;
  blockSettingsSection: string | null;
  setBlockSettingsSection: (section: string | null) => void;
  showBlockColorPicker: boolean;
  setShowBlockColorPicker: (v: boolean) => void;
  editingTextBlockIndex: number | null;
  setEditingTextBlockIndex: (idx: number | null) => void;
  clearBlockSelection: () => void;
}

export function useBlockSelection(): UseBlockSelectionReturn {
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [showBlockSettings, setShowBlockSettings] = useState(false);
  const [blockSettingsSection, setBlockSettingsSection] = useState<string | null>(null);
  const [showBlockColorPicker, setShowBlockColorPicker] = useState(false);
  const [editingTextBlockIndex, setEditingTextBlockIndex] = useState<number | null>(null);

  const clearBlockSelection = () => {
    setSelectedBlockIndex(null);
    setShowBlockSettings(false);
    setBlockSettingsSection(null);
    setEditingTextBlockIndex(null);
  };

  // Deselect block when clicking outside block & settings panel
  useEffect(() => {
    function handleGlobalMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target) return;

      if (target.closest('[data-settings-panel]')) return;
      if (target.closest('[class*="fixed inset-0"]') || target.closest('[role="dialog"]')) return;
      if (target.closest('[data-block-toolbar]')) return;
      if (target.closest('[data-slide-block]')) return;
      if (target.closest('[data-block-settings-row]')) return;

      if (selectedBlockIndex !== null || showBlockSettings) {
        setSelectedBlockIndex(null);
        setShowBlockSettings(false);
        setBlockSettingsSection(null);
        setEditingTextBlockIndex(null);
      }
    }

    document.addEventListener('mousedown', handleGlobalMouseDown);
    return () => document.removeEventListener('mousedown', handleGlobalMouseDown);
  }, [selectedBlockIndex, showBlockSettings]);

  return {
    selectedBlockIndex, setSelectedBlockIndex,
    showBlockSettings, setShowBlockSettings,
    blockSettingsSection, setBlockSettingsSection,
    showBlockColorPicker, setShowBlockColorPicker,
    editingTextBlockIndex, setEditingTextBlockIndex,
    clearBlockSelection,
  };
}
