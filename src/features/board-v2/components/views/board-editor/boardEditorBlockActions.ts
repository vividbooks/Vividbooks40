import { toast } from 'sonner';
import type { InfoSlide, Quiz, QuizSettings, SlideBlock } from '../../../../../types/quiz';

export function handleBoardBlockSelectionChange({
  blockIndex,
  setSelectedBlockIndex,
  setShowPageSettings,
  setActivePanel,
  setShowBlockSettings,
}: {
  blockIndex: number | null;
  setSelectedBlockIndex: (value: number | null) => void;
  setShowPageSettings: (value: boolean) => void;
  setActivePanel: (value: 'board' | 'ai' | 'osnova' | 'library') => void;
  setShowBlockSettings: (value: boolean) => void;
}): void {
  setSelectedBlockIndex(blockIndex);

  if (blockIndex !== null) {
    setShowPageSettings(false);
    return;
  }

  setActivePanel('board');
  setShowBlockSettings(false);
}

export function openBoardBlockSettings({
  setShowBlockSettings,
  setBlockSettingsSection,
  initialSection = null,
}: {
  setShowBlockSettings: (value: boolean) => void;
  setBlockSettingsSection: (value: string | null) => void;
  initialSection?: string | null;
}): void {
  setShowBlockSettings(true);
  setBlockSettingsSection(initialSection);
}

export function updateBoardEditorQuizSettings({
  quiz,
  settingsUpdate,
  setQuiz,
  setIsDirty,
}: {
  quiz: Quiz | null;
  settingsUpdate: Partial<QuizSettings>;
  setQuiz: (value: Quiz) => void;
  setIsDirty: (value: boolean) => void;
}): void {
  if (!quiz) return;

  const updatedQuiz = {
    ...quiz,
    settings: { ...quiz.settings, ...settingsUpdate },
    updatedAt: new Date().toISOString(),
  };

  setQuiz(updatedQuiz);
  setIsDirty(true);
}

export function updateSelectedInfoBlock({
  selectedSlide,
  selectedBlockIndex,
  updates,
  updateSlide,
}: {
  selectedSlide: InfoSlide;
  selectedBlockIndex: number;
  updates: Partial<SlideBlock>;
  updateSlide: (slideId: string, updates: Record<string, unknown>) => void;
}): void {
  const newBlocks = [...selectedSlide.layout.blocks];
  newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], ...updates };
  updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout, blocks: newBlocks } });
}

export async function uploadImageToSelectedInfoBlock({
  file,
  uploadFile,
  selectedSlide,
  selectedBlockIndex,
  updateSlide,
}: {
  file: File;
  uploadFile: (file: File) => Promise<{ success: boolean; file?: { filePath: string }; error?: string }>;
  selectedSlide: InfoSlide;
  selectedBlockIndex: number;
  updateSlide: (slideId: string, updates: Record<string, unknown>) => void;
}): Promise<void> {
  const toastId = toast.loading('Nahrávám obrázek...');

  try {
    const result = await uploadFile(file);

    if (result.success && result.file) {
      updateSelectedInfoBlock({
        selectedSlide,
        selectedBlockIndex,
        updates: { content: result.file.filePath },
        updateSlide,
      });
      toast.success('Obrázek nahrán', { id: toastId });
      return;
    }

    toast.error(result.error || 'Chyba při nahrávání', { id: toastId });
  } catch (error) {
    console.error('Upload error:', error);
    toast.error('Neočekávaná chyba při nahrávání', { id: toastId });
  }
}
