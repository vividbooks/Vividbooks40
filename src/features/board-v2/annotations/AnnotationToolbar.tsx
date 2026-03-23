import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronRight,
  Eraser,
  Image as ImageIcon,
  Redo2,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { ANNOTATION_GRID_PRESETS, getAnnotationPresetLabel } from './annotation-grid-presets';
import { AnnotationStickerPanel } from './AnnotationStickerPanel';
import type {
  AnnotationActiveTool,
  AnnotationBrushKind,
  AnnotationGridPresetId,
  AnnotationStrokeStyle,
} from './annotation-types';
import type { AnnotationStickerItem } from './sticker-library';

interface AnnotationToolbarProps {
  placement?: 'inside-slide' | 'gutter' | 'screen-corner';
  rightOffset?: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTool: AnnotationActiveTool;
  onSelectTool: (tool: AnnotationActiveTool) => void;
  sheetEnabled: boolean;
  sheetPreset: AnnotationGridPresetId;
  sheetMenuOpen: boolean;
  onToggleSheet: () => void;
  onToggleSheetMenu: () => void;
  onSelectBlankSheet: () => void;
  onSelectPatternSheet: () => void;
  onSelectSheetPreset: (preset: AnnotationGridPresetId) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  brushColor: string;
  onBrushColorChange: (color: string) => void;
  brushKind: AnnotationBrushKind;
  onBrushKindChange: (kind: AnnotationBrushKind) => void;
  brushStrokeStyle: AnnotationStrokeStyle;
  onBrushStrokeStyleChange: (style: AnnotationStrokeStyle) => void;
  textColor: string;
  onTextColorChange: (color: string) => void;
  textFontSize: number;
  onTextFontSizeChange: (size: number) => void;
  stickerSize: number;
  onStickerSizeChange: (size: number) => void;
  selectedSticker: AnnotationStickerItem | null;
  onSelectSticker: (sticker: AnnotationStickerItem | null) => void;
  pinnedStickerRowId: string | null;
  onPinnedStickerRowChange: (value: string | null) => void;
  onOpenImagePicker: () => void;
  onCapture: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

const TOOL_BUTTON_BASE =
  'w-10 h-10 rounded-[16px] flex items-center justify-center transition-all duration-150 border';

const brushSizes = [4, 8, 14];
const textSizes = [20, 28, 36];
const sharedColors = ['#3f4b68', '#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#9333ea'];

function SheetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
      <path
        d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M14 3.5V8h4.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AnnotationLauncherIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 35" fill="none" className={className} aria-hidden="true">
      <path
        d="M6.17125 29.0263C7.2885 30.1192 8.43114 31.0343 9.64996 31.7714C10.8688 32.5085 12.0622 33.0931 13.2556 33.5506C14.4491 33.9827 15.5409 34.3385 16.5566 34.5673C17.5723 34.7961 18.4356 34.9486 19.1466 34.9994C19.5529 35.0502 19.883 34.974 20.1115 34.7706C20.34 34.5673 20.467 34.3385 20.4924 34.0844C20.5178 33.8048 20.4416 33.5506 20.2639 33.2964C20.0861 33.0422 19.8068 32.8897 19.4005 32.8389C18.7657 32.7626 17.9786 32.6101 17.0645 32.4068C16.1503 32.2035 15.1347 31.8985 14.0682 31.4918C13.0017 31.0851 11.9099 30.5767 10.818 29.9159C9.72614 29.255 8.71046 28.4671 7.74556 27.5012C6.17125 25.9507 4.95243 24.2478 4.03831 22.3923C3.1242 20.5368 2.56557 18.6559 2.33704 16.7242C2.10852 14.8178 2.26087 13.0132 2.76871 11.2848C3.27655 9.58182 4.16527 8.08218 5.43488 6.8113C6.47595 5.7946 7.64399 5.03207 8.96438 4.54914C10.2848 4.06621 11.6813 3.81203 13.1287 3.81203C14.576 3.81203 16.0234 3.98995 17.4707 4.37122C18.9181 4.75248 20.2639 5.28625 21.5335 5.94711L23.1839 4.3458C21.635 3.43077 19.9845 2.71907 18.2325 2.26156C16.4804 1.77862 14.7538 1.54987 13.0017 1.6007C11.2497 1.62612 9.59918 1.93113 7.99948 2.54115C6.42517 3.12576 5.00321 4.04079 3.78439 5.23541C2.61636 6.3792 1.72763 7.70092 1.09283 9.22597C0.508814 10.6748 0.127932 12.2761 0.0263641 13.9536C-0.0752042 15.6566 0.0771483 17.3596 0.508814 19.1388C0.940479 20.8926 1.60067 22.621 2.56557 24.2986C3.53047 25.9762 4.7239 27.552 6.19664 29.0263H6.17125ZM11.986 24.2986C13.0271 25.3407 14.1698 26.2303 15.4394 26.9929C16.6836 27.7554 17.9786 28.34 19.3243 28.7721C20.6701 29.2042 21.9905 29.4329 23.3109 29.4584C24.6313 29.4838 25.9009 29.3059 27.0689 28.8992C28.2624 28.4925 29.3288 27.8062 30.2683 26.8912C31.2332 25.9253 31.9188 24.8069 32.3505 23.5361C32.7822 22.2652 32.9599 20.8926 32.8583 19.4438C32.7822 17.995 32.4521 16.4954 31.8934 14.9449C31.3348 13.4199 30.5223 11.9202 29.5066 10.4714L27.8815 12.0982C28.9733 13.6995 29.7351 15.3008 30.2176 16.9529C30.7 18.6051 30.8016 20.1555 30.573 21.6043C30.3445 23.0531 29.7097 24.2986 28.6686 25.3153C27.7291 26.2557 26.6627 26.8404 25.4692 27.1454C24.2758 27.425 23.0316 27.4504 21.7366 27.1962C20.4416 26.942 19.172 26.4845 17.9024 25.7982C16.6328 25.112 15.4901 24.2732 14.4237 23.2819L11.986 24.324V24.2986Z"
        fill="currentColor"
      />
      <path
        d="M16.2244 20.7908L29.5552 8.00575L25.9241 4.42188L12.6187 17.1815L10.6127 21.8075C10.5111 22.0617 10.5365 22.265 10.7397 22.4938C10.9428 22.6971 11.1713 22.7734 11.4253 22.6717L16.2244 20.7908Z"
        fill="currentColor"
      />
      <path
        d="M31.3322 6.25272L33.2874 4.32099C33.7699 3.86347 33.9984 3.3297 33.9984 2.71968C33.9984 2.10966 33.7699 1.60131 33.3128 1.16921L32.678 0.584604C32.2464 0.177923 31.7639 0 31.1799 0C30.5959 0 30.088 0.228758 29.6564 0.660857L27.7266 2.61801L31.3322 6.22731V6.25272Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BrushToolIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6.69561 21.2211L18.7404 9.41537L14.4665 5.20117L2.42164 16.9471L0.0604899 22.4166C-0.0590618 22.7155 -0.0291739 22.9546 0.209929 23.2236C0.449033 23.4627 0.718024 23.5524 1.0169 23.4328L6.66572 21.2211H6.69561Z"
        fill="currentColor"
      />
      <path
        d="M20.8339 7.35438L23.1353 5.0829C23.7032 4.54492 23.9722 3.91727 23.9722 3.19996C23.9722 2.48265 23.7032 1.88489 23.1652 1.3768L22.418 0.689375C21.9398 0.211169 21.342 0.00195312 20.6546 0.00195312C19.9672 0.00195312 19.3694 0.270944 18.8613 0.779039L16.5898 3.08041L20.8339 7.32449V7.35438Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LaserPointerIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 26" fill="none" className={className} aria-hidden="true">
      <path
        d="M5.00956 25.9316H4.19956C4.14956 25.9116 4.08956 25.9016 4.03956 25.8816C3.52956 25.7316 2.99956 25.6516 2.51956 25.4316C0.919564 24.6916 -0.160436 22.7016 0.0195643 20.9316C0.149564 19.6316 0.709564 18.6016 1.77956 17.8316C3.27956 16.7516 4.73956 15.6216 6.21956 14.5116C6.29956 14.4516 6.37956 14.3816 6.46956 14.3116L6.44956 14.2616H6.17956C5.00956 14.2616 3.82956 14.2616 2.65956 14.2616C1.90956 14.2616 1.24956 14.0116 0.749564 13.4416C-0.470436 12.0416 -0.0804358 9.86156 1.54956 8.98156C1.64956 8.92156 1.75956 8.87156 1.85956 8.81156C7.09956 6.01156 12.3396 3.21156 17.5796 0.421562C17.9196 0.241562 18.2896 0.101563 18.6596 0.0315625C19.6096 -0.138437 20.4396 0.391562 20.7596 1.30156C21.0496 2.15156 20.7096 3.02156 19.8896 3.50156C16.8196 5.30156 13.7596 7.11156 10.6896 8.91156C10.6296 8.95156 10.5796 8.99156 10.4696 9.06156C10.6296 9.06156 10.7196 9.06156 10.8096 9.06156C13.2496 9.06156 15.6896 9.06156 18.1296 9.06156C18.3596 9.06156 18.5896 9.08156 18.8096 9.13156C20.2796 9.48156 21.1296 10.9816 20.7296 12.4916C20.5296 13.2516 20.0296 13.7816 19.4496 14.2916C15.5096 17.7616 11.5796 21.2516 7.63956 24.7416C7.15956 25.1716 6.61956 25.4916 6.00956 25.6716C5.67956 25.7716 5.33956 25.8316 5.00956 25.9116V25.9316ZM4.60956 24.6216C6.38956 24.6216 7.83956 23.1716 7.83956 21.3816C7.83956 19.6016 6.37956 18.1416 4.60956 18.1416C2.80956 18.1416 1.36956 19.6016 1.36956 21.4216C1.36956 23.1816 2.82956 24.6216 4.60956 24.6216Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CursorFilledIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4.367 2.556c-.655-.289-1.367.318-1.171.999l3.73 13.004c.206.72 1.102.954 1.63.425l2.317-2.316 3.329 6.422c.254.49.857.681 1.347.427l1.71-.887a.97.97 0 0 0 .426-1.319l-3.338-6.439h3.32c.767 0 1.246-.817.88-1.49L10.644 2.98a.97.97 0 0 0-.39-.35L4.367 2.556Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ShapesFilledIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3.25a1.1 1.1 0 0 1 .956.556l2.195 3.896a1.1 1.1 0 0 1-.956 1.64H9.805a1.1 1.1 0 0 1-.956-1.64l2.195-3.896A1.1 1.1 0 0 1 12 3.25Z"
        fill="currentColor"
      />
      <path
        d="M6.25 12.25A3.25 3.25 0 1 1 3 15.5a3.25 3.25 0 0 1 3.25-3.25Z"
        fill="currentColor"
      />
      <path
        d="M13.75 12.5c0-.69.56-1.25 1.25-1.25h4a1.25 1.25 0 0 1 1.25 1.25v4A1.25 1.25 0 0 1 19 17.75h-4a1.25 1.25 0 0 1-1.25-1.25v-4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function AnnotationToolbar({
  placement = 'inside-slide',
  rightOffset,
  isOpen,
  onToggleOpen,
  activeTool,
  onSelectTool,
  sheetEnabled,
  sheetPreset,
  sheetMenuOpen,
  onToggleSheet,
  onToggleSheetMenu,
  onSelectBlankSheet,
  onSelectPatternSheet,
  onSelectSheetPreset,
  brushSize,
  onBrushSizeChange,
  brushColor,
  onBrushColorChange,
  brushKind,
  onBrushKindChange,
  brushStrokeStyle,
  onBrushStrokeStyleChange,
  textColor,
  onTextColorChange,
  textFontSize,
  onTextFontSizeChange,
  stickerSize,
  onStickerSizeChange,
  selectedSticker,
  onSelectSticker,
  pinnedStickerRowId,
  onPinnedStickerRowChange,
  onOpenImagePicker,
  onCapture,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
}: AnnotationToolbarProps) {
  const [detailPanel, setDetailPanel] = useState<'brush' | 'text' | 'symbols' | null>(null);
  const [brushMoreOpen, setBrushMoreOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDetailPanel(null);
      setBrushMoreOpen(false);
    }
  }, [isOpen]);

  const currentPresetLabel = getAnnotationPresetLabel(sheetPreset);
  const isPatternSheet = sheetPreset !== 'blank';
  const isGutterPlacement = placement === 'gutter';
  const isScreenCornerPlacement = placement === 'screen-corner';

  const closedButtonClassName =
    isGutterPlacement
      ? 'absolute left-1/2 -translate-x-1/2 bottom-4 z-30 w-12 h-12 rounded-full shadow-xl flex items-center justify-center border'
      : isScreenCornerPlacement
      ? 'fixed z-30 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-colors'
      : 'absolute bottom-4 right-4 z-30 w-12 h-12 rounded-full shadow-xl flex items-center justify-center border';
  const toolbarRootClassName =
    isGutterPlacement
      ? 'absolute left-1/2 -translate-x-1/2 bottom-4 z-30 flex flex-col items-center gap-3'
      : isScreenCornerPlacement
      ? 'fixed left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3'
      : 'absolute right-6 top-6 bottom-6 z-30 flex items-start';
  const screenCornerStyle: CSSProperties | undefined = isScreenCornerPlacement ? { bottom: '16px' } : undefined;
  const screenCornerToggleStyle: CSSProperties | undefined = isScreenCornerPlacement
    ? { right: `${rightOffset ?? 20}px`, bottom: '16px' }
    : undefined;
  const screenCornerCircleStyle: CSSProperties = {
    backgroundColor: '#1e2533',
    color: 'rgba(255,255,255,0.7)',
  };

  const popupCardClassName =
    isScreenCornerPlacement
      ? 'pointer-events-auto border bg-white shadow-2xl overflow-hidden'
      : 'pointer-events-auto mr-2.5 border bg-white shadow-2xl overflow-hidden';
  const popupCardStyle: CSSProperties = {
    borderColor: '#d5ddef',
    borderRadius: 24,
    boxShadow: '0 22px 54px rgba(74, 88, 124, 0.18)',
  };
  const sectionLabelClassName = 'mb-2 text-[11px] font-semibold text-[#8c97b5]';
  const segmentedButtonStyle = (isSelected: boolean): CSSProperties => ({
    backgroundColor: isSelected ? '#59637f' : '#f7f9fd',
    color: isSelected ? '#ffffff' : '#5a6583',
    border: `1px solid ${isSelected ? '#59637f' : '#e2e8f4'}`,
    fontWeight: 700,
    fontSize: 13,
    borderRadius: 16,
    boxShadow: isSelected ? '0 10px 20px rgba(89,99,127,0.18)' : '0 1px 2px rgba(89,99,127,0.04)',
  });

  const iconButtonStyle = (isActive = false): CSSProperties => ({
    backgroundColor: isActive ? '#ffffff' : 'rgba(255,255,255,0.86)',
    color: '#5f6b88',
    borderColor: isActive ? '#d8dff0' : 'transparent',
    boxShadow: isActive ? '0 8px 20px rgba(89,99,127,0.18)' : 'none',
    borderRadius: 16,
    width: 40,
    minWidth: 40,
    height: 40,
    minHeight: 40,
    flexShrink: 0,
  });

  const renderBaseToolButton = (
    tool: AnnotationActiveTool,
    icon: React.ReactNode,
    title: string,
    onClick?: () => void,
    disabled = false,
  ) => {
    const isActive = activeTool === tool && (detailPanel === null || detailPanel === tool);
    return (
      <button
        key={tool}
        onClick={() => !disabled && (onClick ? onClick() : onSelectTool(tool))}
        className={TOOL_BUTTON_BASE}
        disabled={disabled}
        title={disabled ? `${title} bude v další fázi` : title}
        style={{ ...iconButtonStyle(isActive), opacity: disabled ? 0.45 : 1 }}
      >
        {icon}
      </button>
    );
  };

  const handleToolPress = (tool: AnnotationActiveTool) => {
    if (tool === 'brush') {
      onSelectTool('brush');
      setDetailPanel((prev) => {
        const next = prev === 'brush' ? null : 'brush';
        if (next !== 'brush') {
          setBrushMoreOpen(false);
        }
        return next;
      });
      return;
    }

    if (tool === 'text') {
      onSelectTool('text');
      setDetailPanel((prev) => (prev === 'text' ? null : 'text'));
      setBrushMoreOpen(false);
      return;
    }

    if (tool === 'image') {
      setDetailPanel(null);
      setBrushMoreOpen(false);
      onOpenImagePicker();
      return;
    }

    if (tool === 'symbols') {
      onSelectTool('symbols');
      setDetailPanel((prev) => (prev === 'symbols' ? null : 'symbols'));
      setBrushMoreOpen(false);
      return;
    }

    setDetailPanel(null);
    setBrushMoreOpen(false);
    onSelectTool(tool);
  };

  const renderColorSwatch = (
    color: string,
    isSelected: boolean,
    onClick: () => void,
  ) => (
    <button
      key={color}
      onClick={onClick}
      className="h-8 w-8 rounded-full border transition-all"
      style={{
        backgroundColor: color,
        borderColor: isSelected ? '#59637f' : '#ffffff',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(89,99,127,0.18), inset 0 0 0 2px rgba(255,255,255,0.92)'
          : '0 1px 4px rgba(89,99,127,0.12)',
        flexShrink: 0,
      }}
      title={`Barva ${color}`}
    />
  );

  if (!isOpen) {
    return (
      <button
        onClick={onToggleOpen}
        className={closedButtonClassName}
        style={{
          ...screenCornerToggleStyle,
          ...(isScreenCornerPlacement
            ? screenCornerCircleStyle
            : {
                backgroundColor: '#59637f',
                color: '#ffffff',
                borderColor: 'rgba(255,255,255,0.24)',
              }),
        }}
        title="Otevřít anotace"
      >
        <AnnotationLauncherIcon className="w-5 h-5" />
      </button>
    );
  }

  return (
    <>
      <div className={toolbarRootClassName} style={screenCornerStyle}>
        {sheetEnabled && (
          <div className={`${popupCardClassName} w-[260px] p-3.5`} style={popupCardStyle}>
            <div className="mb-3 flex items-center gap-2 px-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: '#eef2fb', color: '#59637f' }}
              >
                <SheetIcon />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-none text-[#55607d]">List</p>
                <p className="mt-1 text-[12px] leading-none text-[#8c97b5]">Plocha pro anotace</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-[18px] border bg-[#fbfcff] p-2.5" style={{ borderColor: '#e5ebf5' }}>
                <p className={sectionLabelClassName}>Typ listu</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={onSelectBlankSheet} className="px-3 py-2.5" style={segmentedButtonStyle(!isPatternSheet)}>
                    Prázdný
                  </button>
                  <button onClick={onSelectPatternSheet} className="px-3 py-2.5" style={segmentedButtonStyle(isPatternSheet)}>
                    Se vzorem
                  </button>
                </div>
              </div>

              {isPatternSheet && (
                <div className="rounded-[18px] border bg-[#fbfcff] p-2.5" style={{ borderColor: '#e5ebf5' }}>
                  <button
                    onClick={onToggleSheetMenu}
                    className="w-full px-3 py-2.5 flex items-center justify-between border"
                    style={{ borderColor: '#dfe6f3', borderRadius: 16, backgroundColor: '#ffffff' }}
                  >
                    <span className="text-[14px] font-semibold text-[#55607d]">{currentPresetLabel}</span>
                    <ChevronDown
                      className="w-4 h-4 text-[#5a6583] transition-transform"
                      style={{ transform: sheetMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>
                  {sheetMenuOpen && (
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      {ANNOTATION_GRID_PRESETS.filter((preset) => preset.id !== 'blank').map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => onSelectSheetPreset(preset.id)}
                          className="px-3 py-2.5 text-left"
                          style={{
                            ...segmentedButtonStyle(sheetPreset === preset.id),
                            minHeight: 46,
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {detailPanel === 'brush' ? (
          <div
            className="pointer-events-auto rounded-[24px] border shadow-xl overflow-x-auto max-w-[calc(100vw-120px)] px-3 py-2 flex items-center gap-2"
            style={{ backgroundColor: '#dbe1f0', borderColor: '#d5ddef', borderRadius: 24 }}
          >
            <button
              onClick={() => setDetailPanel(null)}
              className={TOOL_BUTTON_BASE}
              style={iconButtonStyle(true)}
              title="Zpět do toolbaru"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-px h-7 rounded-full bg-[#c7d1e7] flex-shrink-0" />
            {([
              { id: 'pen', label: 'Tužka' },
              { id: 'highlighter', label: 'Zvýrazňovač' },
            ] as Array<{ id: AnnotationBrushKind; label: string }>).map((item) => (
              <button
                key={item.id}
                onClick={() => onBrushKindChange(item.id)}
                className="px-3 py-2 min-w-[110px]"
                style={segmentedButtonStyle(brushKind === item.id)}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => setBrushMoreOpen((prev) => !prev)}
              className={TOOL_BUTTON_BASE}
              style={iconButtonStyle(brushMoreOpen)}
              title={brushMoreOpen ? 'Méně nastavení' : 'Více nastavení'}
            >
              <ChevronRight className="w-5 h-5 transition-transform" style={{ transform: brushMoreOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
            </button>

            {brushMoreOpen && (
              <>
                <div className="w-px h-7 rounded-full bg-[#c7d1e7] flex-shrink-0" />
                <div className="flex items-center gap-2 flex-shrink-0">
                  {sharedColors.map((color) => renderColorSwatch(color, brushColor === color, () => onBrushColorChange(color)))}
                </div>
                <div className="w-px h-7 rounded-full bg-[#c7d1e7] flex-shrink-0" />
                {brushSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => onBrushSizeChange(size)}
                    className="px-3 py-2 min-w-[56px]"
                    style={segmentedButtonStyle(brushSize === size)}
                  >
                    {size}
                  </button>
                ))}
                {brushKind === 'pen' && (
                  <>
                    <div className="w-px h-7 rounded-full bg-[#c7d1e7] flex-shrink-0" />
                    {(['solid', 'dashed'] as AnnotationStrokeStyle[]).map((style) => (
                      <button
                        key={style}
                        onClick={() => onBrushStrokeStyleChange(style)}
                        className="px-3 py-2 min-w-[120px]"
                        style={segmentedButtonStyle(brushStrokeStyle === style)}
                      >
                        {style === 'solid' ? 'Plný' : 'Přerušovaný'}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        ) : detailPanel === 'text' ? (
          <div
            className="pointer-events-auto rounded-[24px] border shadow-xl overflow-x-auto max-w-[calc(100vw-120px)] px-3 py-2 flex items-center gap-2"
            style={{ backgroundColor: '#dbe1f0', borderColor: '#d5ddef', borderRadius: 24 }}
          >
            <button
              onClick={() => setDetailPanel(null)}
              className={TOOL_BUTTON_BASE}
              style={iconButtonStyle(true)}
              title="Zpět do toolbaru"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-px h-7 rounded-full bg-[#c7d1e7] flex-shrink-0" />
            <div className="flex items-center gap-2 flex-shrink-0">
              {sharedColors.map((color) => renderColorSwatch(color, textColor === color, () => onTextColorChange(color)))}
            </div>
            <div className="w-px h-7 rounded-full bg-[#c7d1e7] flex-shrink-0" />
            {textSizes.map((size) => (
              <button
                key={size}
                onClick={() => onTextFontSizeChange(size)}
                className="px-3 py-2 min-w-[68px]"
                style={segmentedButtonStyle(textFontSize === size)}
              >
                {size}
              </button>
            ))}
          </div>
        ) : detailPanel === 'symbols' ? (
          <AnnotationStickerPanel
            selectedSticker={selectedSticker}
            onSelectSticker={(sticker) => {
              onSelectTool('symbols');
              onSelectSticker(sticker);
            }}
            stickerSize={stickerSize}
            onStickerSizeChange={onStickerSizeChange}
            pinnedRowId={pinnedStickerRowId}
            onPinnedRowChange={onPinnedStickerRowChange}
            onBack={() => setDetailPanel(null)}
          />
        ) : (
          <div
            className="pointer-events-auto rounded-[24px] border shadow-xl overflow-x-auto max-w-[calc(100vw-120px)] px-2.5 py-2 flex items-center gap-1.5"
            style={{ backgroundColor: '#dbe1f0', borderColor: '#d5ddef', borderRadius: 24 }}
          >
            <button
              onClick={onToggleSheet}
              className={TOOL_BUTTON_BASE}
              title={sheetEnabled ? 'Vypnout list' : 'Zapnout list'}
              style={{
                ...iconButtonStyle(sheetEnabled),
                backgroundColor: sheetEnabled ? '#ffffff' : '#e3e8f6',
                color: '#5a6583',
              }}
            >
              <SheetIcon />
            </button>
            <div className="w-px h-7 rounded-full bg-[#c7d1e7] flex-shrink-0" />
            {renderBaseToolButton('select', <CursorFilledIcon className="w-5 h-5" />, 'Výběr a přesun', () => handleToolPress('select'))}
            {renderBaseToolButton('laser', <LaserPointerIcon className="w-5 h-5" />, 'Laserové ukazovátko', () => handleToolPress('laser'))}
            {renderBaseToolButton('brush', <BrushToolIcon className="w-5 h-5" />, 'Štětec', () => handleToolPress('brush'))}
            {renderBaseToolButton('text', <Type className="w-5 h-5" />, 'Text', () => handleToolPress('text'))}
            {renderBaseToolButton(
              'symbols',
              selectedSticker ? (
                <img
                  src={selectedSticker.url}
                  alt={selectedSticker.name}
                  className="max-w-[22px] max-h-[22px] object-contain pointer-events-none"
                />
              ) : (
                <ShapesFilledIcon className="w-5 h-5" />
              ),
              'Symboly',
              () => handleToolPress('symbols'),
            )}
            {renderBaseToolButton('image', <ImageIcon className="w-5 h-5" />, 'Obrázek', () => handleToolPress('image'))}
            {renderBaseToolButton('eraser', <Eraser className="w-5 h-5" />, 'Guma', () => handleToolPress('eraser'))}
            <div className="w-px h-7 rounded-full bg-[#c7d1e7] flex-shrink-0" />
            <button onClick={onCapture} className={TOOL_BUTTON_BASE} title="Vyfotit a uložit" style={iconButtonStyle(false)}>
              <Camera className="w-5 h-5" />
            </button>
            <button onClick={onUndo} disabled={!canUndo} className={TOOL_BUTTON_BASE} title="Zpět" style={{ ...iconButtonStyle(false), opacity: canUndo ? 1 : 0.35 }}>
              <Undo2 className="w-5 h-5" />
            </button>
            <button onClick={onRedo} disabled={!canRedo} className={TOOL_BUTTON_BASE} title="Vpřed" style={{ ...iconButtonStyle(false), opacity: canRedo ? 1 : 0.35 }}>
              <Redo2 className="w-5 h-5" />
            </button>
            <button onClick={onClear} className={TOOL_BUTTON_BASE} title="Koš" style={iconButtonStyle(false)}>
              <Trash2 className="w-5 h-5" />
            </button>
            {!isScreenCornerPlacement && (
              <>
                <div className="w-px h-7 rounded-full bg-[#c7d1e7] flex-shrink-0" />
                <button onClick={onToggleOpen} className={TOOL_BUTTON_BASE} style={{ ...iconButtonStyle(false), backgroundColor: '#59637f', color: '#ffffff' }}>
                  <AnnotationLauncherIcon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {isScreenCornerPlacement && (
        <button
          onClick={onToggleOpen}
          className="fixed z-30 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-colors"
          style={{
            ...screenCornerToggleStyle,
            ...screenCornerCircleStyle,
          }}
          title="Zavřít anotace"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </>
  );
}
