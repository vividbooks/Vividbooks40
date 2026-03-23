export function getBoardPreviewSlideIndex(
  selectedSlideId: string | null,
  slideIds: string[],
): number {
  if (!selectedSlideId) return 0;

  const previewSlideIndex = slideIds.findIndex((slideId) => slideId === selectedSlideId);
  return previewSlideIndex >= 0 ? previewSlideIndex : 0;
}

export function openBoardPreview(setShowPreview: (value: boolean) => void): void {
  setShowPreview(true);
}

export function closeBoardPreview(setShowPreview: (value: boolean) => void): void {
  setShowPreview(false);
}

export function closeBoardLiveSession(setShowLiveSession: (value: boolean) => void): void {
  setShowLiveSession(false);
}

export function openBoardShareEditDialog(setShowShareEditDialog: (value: boolean) => void): void {
  setShowShareEditDialog(true);
}

export function openBoardVersionHistory(setShowVersionHistory: (value: boolean) => void): void {
  setShowVersionHistory(true);
}

export function openBoardResultsTab(setViewMode: (mode: 'editor' | 'results') => void): void {
  setViewMode('results');
}

export function resetBoardCanvasInteraction({
  setSelectedBlockIndex,
  setShowBlockSettings,
  setActivePanel,
  setEditingTextBlockIndex,
  setShowPageSettings,
}: {
  setSelectedBlockIndex: (value: number | null) => void;
  setShowBlockSettings: (value: boolean) => void;
  setActivePanel: (value: 'board' | 'ai' | 'osnova' | 'library') => void;
  setEditingTextBlockIndex: (value: number | null) => void;
  setShowPageSettings: (value: boolean) => void;
}): void {
  setSelectedBlockIndex(null);
  setShowBlockSettings(false);
  setActivePanel('board');
  setEditingTextBlockIndex(null);
  setShowPageSettings(false);
}

export function clearBoardBlockSelection({
  setSelectedBlockIndex,
  setShowBlockSettings,
  setBlockSettingsSection,
  setEditingTextBlockIndex,
}: {
  setSelectedBlockIndex: (value: number | null) => void;
  setShowBlockSettings: (value: boolean) => void;
  setBlockSettingsSection?: (value: string | null) => void;
  setEditingTextBlockIndex?: (value: number | null) => void;
}): void {
  setSelectedBlockIndex(null);
  setShowBlockSettings(false);
  setBlockSettingsSection?.(null);
  setEditingTextBlockIndex?.(null);
}

export function resetBoardEditorSelection({
  setSelectedBlockIndex,
  setActivePanel,
  setShowPageSettings,
  setEditingTextBlockIndex,
}: {
  setSelectedBlockIndex: (value: number | null) => void;
  setActivePanel: (value: 'board' | 'ai' | 'osnova' | 'library') => void;
  setShowPageSettings: (value: boolean) => void;
  setEditingTextBlockIndex: (value: number | null) => void;
}): void {
  setSelectedBlockIndex(null);
  setActivePanel('board');
  setShowPageSettings(false);
  setEditingTextBlockIndex(null);
}
