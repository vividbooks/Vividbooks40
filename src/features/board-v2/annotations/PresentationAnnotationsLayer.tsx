import { useEffect, useState } from 'react';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { AssetPicker } from '../../../components/shared/AssetPicker';
import type { AssetPickerResult } from '../../../types/assets';
import { AnnotationCanvas } from './AnnotationCanvas';
import { AnnotationToolbar } from './AnnotationToolbar';
import type { AnnotationGridPresetId } from './annotation-types';
import type { PresentationAnnotationsController } from './annotation-session-store';

async function loadUrlAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Image data URL conversion failed'));
    reader.readAsDataURL(blob);
  });
}

async function inlineImagesForCapture(target: HTMLElement): Promise<() => void> {
  const restorers: Array<() => void> = [];

  const imgElements = Array.from(target.querySelectorAll('img'));
  await Promise.all(
    imgElements.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
        return;
      }

      try {
        const dataUrl = await loadUrlAsDataUrl(src);
        const previousSrc = img.src;
        img.src = dataUrl;
        restorers.push(() => {
          img.src = previousSrc;
        });
      } catch (error) {
        console.warn('[annotations] failed to inline img for capture', src, error);
      }
    }),
  );

  const svgImageElements = Array.from(target.querySelectorAll('image'));
  await Promise.all(
    svgImageElements.map(async (imageEl) => {
      const href =
        imageEl.getAttribute('href') ??
        imageEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      if (!href || href.startsWith('data:') || href.startsWith('blob:')) {
        return;
      }

      try {
        const dataUrl = await loadUrlAsDataUrl(href);
        const previousHref = href;
        imageEl.setAttribute('href', dataUrl);
        imageEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
        restorers.push(() => {
          imageEl.setAttribute('href', previousHref);
          imageEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', previousHref);
        });
      } catch (error) {
        console.warn('[annotations] failed to inline svg image for capture', href, error);
      }
    }),
  );

  return () => {
    restorers.reverse().forEach((restore) => restore());
  };
}

interface PresentationAnnotationsLayerProps {
  slideId: string;
  controller: PresentationAnnotationsController;
  renderCanvas?: boolean;
  renderToolbar?: boolean;
  toolbarPlacement?: 'inside-slide' | 'gutter' | 'screen-corner';
  toolbarRightOffset?: number;
}

export function PresentationAnnotationsLayer({
  slideId,
  controller,
  renderCanvas = true,
  renderToolbar = true,
  toolbarPlacement = 'inside-slide',
  toolbarRightOffset,
}: PresentationAnnotationsLayerProps) {
  const {
    activeTool,
    brushSize,
    brushColor,
    brushKind,
    brushStrokeStyle,
    textColor,
    textFontSize,
    stickerSize,
    selectedSticker,
    pinnedStickerRowId,
    canRedo,
    canUndo,
    clearSlide,
    commitSnapshot,
    getSlideState,
    redo,
    setActiveTool,
    setBrushColor,
    setBrushKind,
    setBrushSize,
    setBrushStrokeStyle,
    setTextColor,
    setTextFontSize,
    setStickerSize,
    setSelectedSticker,
    setPinnedStickerRowId,
    setSheetMenuOpen,
    setSheetPreset,
    setToolbarOpen,
    sheetMenuOpen,
    toolbarOpen,
    toggleSheet,
    undo,
  } = controller;

  const snapshot = getSlideState(slideId);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [lastPatternPreset, setLastPatternPreset] = useState<AnnotationGridPresetId>('grid-lg');
  const [showImagePicker, setShowImagePicker] = useState(false);

  useEffect(() => {
    setSelectedObjectId(null);
    setSheetMenuOpen(false);
  }, [setSheetMenuOpen, slideId]);

  useEffect(() => {
    if (!toolbarOpen) {
      setSheetMenuOpen(false);
    }
  }, [setSheetMenuOpen, toolbarOpen]);

  const handleSelectSheetPreset = (preset: AnnotationGridPresetId) => {
    if (preset !== 'blank') {
      setLastPatternPreset(preset);
    }
    setSheetPreset(slideId, preset);
    setSheetMenuOpen(false);
  };

  const handleToggleSheet = () => {
    if (snapshot.sheetEnabled) {
      setSheetMenuOpen(false);
    }
    toggleSheet(slideId);
  };

  const handleSelectBlankSheet = () => {
    if (snapshot.sheetPreset !== 'blank') {
      setLastPatternPreset(snapshot.sheetPreset);
    }
    setSheetPreset(slideId, 'blank');
    setSheetMenuOpen(false);
  };

  const handleSelectPatternSheet = () => {
    const nextPreset = snapshot.sheetPreset !== 'blank' ? snapshot.sheetPreset : lastPatternPreset;
    setSheetPreset(slideId, nextPreset);
    setSheetMenuOpen(false);
  };

  const handleImageSelect = (result: AssetPickerResult) => {
    const aspectRatio = result.width && result.height ? result.width / result.height : 1.4;
    const width = 0.24;
    const height = Math.min(0.28, Math.max(0.12, width / Math.max(0.5, aspectRatio)));
    commitSnapshot(slideId, {
      ...snapshot,
      objects: [
        ...snapshot.objects,
        {
          id: crypto.randomUUID(),
          kind: 'image',
          x: 0.5 - width / 2,
          y: 0.5 - height / 2,
          width,
          height,
          url: result.url,
          alt: result.name,
        },
      ],
    });
    setActiveTool('select');
    setShowImagePicker(false);
  };

  const handleCapture = async () => {
    const target = document.querySelector<HTMLElement>(
      `[data-annotation-capture-slide-id="${slideId}"]`,
    );

    if (!target) {
      toast.error('Nepodařilo se najít slide pro screenshot.');
      return;
    }

    const previousOverflow = target.style.overflow;
    const previousTransform = target.style.transform;
    let restoreInlinedImages: (() => void) | null = null;

    try {
      target.style.overflow = 'visible';
      target.style.transform = 'none';
      restoreInlinedImages = await inlineImagesForCapture(target);

      const canvas = await html2canvas(target, {
        backgroundColor: null,
        useCORS: true,
        foreignObjectRendering: true,
        logging: false,
        scale: Math.min(2, window.devicePixelRatio || 1.5),
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `vividboard-slide-${slideId}.png`;
      link.click();
      toast.success('Screenshot byl uložen.');
    } catch (error) {
      console.error('[annotations] screenshot failed', error);

      try {
        const fallbackCanvas = await html2canvas(target, {
          backgroundColor: '#ffffff',
          useCORS: true,
          foreignObjectRendering: false,
          logging: false,
          scale: 1,
        });

        const link = document.createElement('a');
        link.href = fallbackCanvas.toDataURL('image/png');
        link.download = `vividboard-slide-${slideId}.png`;
        link.click();
        toast.success('Screenshot byl uložen přes fallback.');
        return;
      } catch (fallbackError) {
        console.error('[annotations] screenshot fallback failed', fallbackError);
      }

      const message = error instanceof Error ? error.message : 'Neznámá chyba';
      toast.error(`Screenshot se nepodařilo vytvořit: ${message}`);
    } finally {
      restoreInlinedImages?.();
      target.style.overflow = previousOverflow;
      target.style.transform = previousTransform;
    }
  };

  return (
    <>
      {renderCanvas && (
        <AnnotationCanvas
          snapshot={snapshot}
          activeTool={activeTool}
          interactionEnabled={toolbarOpen}
          brushSize={brushSize}
          brushColor={brushColor}
          brushKind={brushKind}
          brushStrokeStyle={brushStrokeStyle}
          textColor={textColor}
          textFontSize={textFontSize}
          stickerSize={stickerSize}
          selectedSticker={selectedSticker}
          selectedObjectId={selectedObjectId}
          onSelectedObjectIdChange={setSelectedObjectId}
          onCommitSnapshot={(nextSnapshot) => commitSnapshot(slideId, nextSnapshot)}
        />
      )}
      {renderToolbar && (
        <AnnotationToolbar
          placement={toolbarPlacement}
          rightOffset={toolbarRightOffset}
          isOpen={toolbarOpen}
          onToggleOpen={() => setToolbarOpen(!toolbarOpen)}
          activeTool={activeTool}
          onSelectTool={(tool) => {
            setActiveTool(tool);
            setToolbarOpen(true);
          }}
          sheetEnabled={snapshot.sheetEnabled}
          sheetPreset={snapshot.sheetPreset}
          sheetMenuOpen={sheetMenuOpen}
          onToggleSheet={handleToggleSheet}
          onToggleSheetMenu={() => setSheetMenuOpen(!sheetMenuOpen)}
          onSelectBlankSheet={handleSelectBlankSheet}
          onSelectPatternSheet={handleSelectPatternSheet}
          onSelectSheetPreset={handleSelectSheetPreset}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          brushColor={brushColor}
          onBrushColorChange={setBrushColor}
          brushKind={brushKind}
          onBrushKindChange={setBrushKind}
          brushStrokeStyle={brushStrokeStyle}
          onBrushStrokeStyleChange={setBrushStrokeStyle}
          textColor={textColor}
          onTextColorChange={setTextColor}
          textFontSize={textFontSize}
          onTextFontSizeChange={setTextFontSize}
          stickerSize={stickerSize}
          onStickerSizeChange={setStickerSize}
          selectedSticker={selectedSticker}
          onSelectSticker={setSelectedSticker}
          pinnedStickerRowId={pinnedStickerRowId}
          onPinnedStickerRowChange={setPinnedStickerRowId}
          onOpenImagePicker={() => setShowImagePicker(true)}
          onCapture={handleCapture}
          canUndo={canUndo(slideId)}
          canRedo={canRedo(slideId)}
          onUndo={() => undo(slideId)}
          onRedo={() => redo(slideId)}
          onClear={() => {
            clearSlide(slideId);
            setSelectedObjectId(null);
          }}
        />
      )}
      <AssetPicker
        isOpen={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onSelect={handleImageSelect}
        showUpload={true}
        showLibrary={true}
        showGiphy={false}
        showGoogle={false}
        showVividbooks={true}
        defaultTab="upload"
      />
    </>
  );
}
