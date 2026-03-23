/**
 * WorksheetEditorPro - Advanced worksheet editor for internal use
 * 
 * Features:
 * - All features from basic editor
 * - Extended block types
 * - Advanced AI assistance
 * - Template management
 * - Multi-page layouts
 * - Export to multiple formats
 * - Collaboration features (future)
 * 
 * Shares components with basic editor:
 * - EditableBlock, DraggableCanvas, PrintableWorksheet
 * - Block types, settings overlays
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { LAIOUT_BOOKSHELF_PATH, laioutBookEditorPath } from '../../utils/laiout-routes';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Loader2, Undo2, Redo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Worksheet,
  WorksheetBlock,
  BlockType,
  BlockWidth,
  BlockImage,
  GridColumns,
  GridGap,
  GlobalFontSize,
  PageFormat,
  createEmptyBlock,
  generateBlockId,
} from '../../types/worksheet';

// Shared components from basic editor
import { FreeformCanvas } from './FreeformCanvas';
import { GridCanvas } from './GridCanvas';
import { ProBlockSettingsPanel } from './ProBlockSettingsPanel';
import { PrintableWorksheet } from '../worksheet-editor/PrintableWorksheet';
import { AIChatPanel } from '../worksheet-editor/AIChatPanel';
import { ProStructurePanel } from './ProStructurePanel';
import { ProSettingsPanel } from './ProSettingsPanel';
import { ProAddContentPanel } from './ProAddContentPanel';
import { VersionHistoryPanel } from '../shared/VersionHistoryPanel';

// Pro-specific components
import { ProMiniSidebar, ProActivePanel, AppMode } from './ProMiniSidebar';
import { SheetSettingsPanel } from './SheetSettingsPanel';
import { DatasetPanel } from './DatasetPanel';
import { ModeSwitcher } from './ModeSwitcher';
import type { DesignSystem } from '../../types/design-system';
import { getGoogleFontsUrl } from '../../types/design-system';
import { TEXTBOOK_LAYOUTS } from '../../utils/textbook-layouts';
import { DebugPanel } from './DebugPanel';
import { JsonEditorPanel } from './JsonEditorPanel';
import { ProImportPanel } from './ProImportPanel';
import {
  SIDEBAR_COLORS,
  sidebarContentStyle,
  sectionTitleStyle,
  subtleCardStyle,
  buttonStyle,
  getButtonVariantStyle,
} from './block-settings/shared';

// Hooks
import { usePDFExport } from '../../hooks/usePDFExport';
import { useWorksheetHistory } from '../../hooks/useWorksheetHistory';
import { getGridGapPx } from '../../utils/page-layout';
import { useVersionHistory } from '../../hooks/useVersionHistory';
import { useWorksheetEditorRuntime } from '../../hooks/useWorksheetEditorRuntime';
import { supabase } from '../../utils/supabase/client';
import { worksheetToPresentation, PRESENTATION_THEMES } from '../../utils/worksheet-to-presentation';
import { worksheetToBoard, SubQuestionsExportMode } from '../../utils/content-converter';
import { syncWorksheetToBoard } from '../../utils/worksheet-board-sync';
import { generateWorksheetThumbnails } from '../../utils/generate-worksheet-thumbnails';
import { chatWithAIProxy } from '../../utils/ai-chat-proxy';
import { saveQuiz, getQuiz } from '../../utils/quiz-storage';
import { FreeAnswerContent } from '../../types/worksheet';
import { getCurrentUserProfile } from '../../utils/profile-storage';
import { LayoutSectionColumnId, normalizeLayoutSectionBlocks, normalizeLayoutSectionContent } from '../../utils/layout-sections';
import { persistWorksheetForEditor } from '../../utils/worksheet-editor-runtime';
import {
  duplicateWorksheetBlock,
  moveWorksheetBlock,
  removeWorksheetBlock,
  updateWorksheetBlock,
} from '../../utils/worksheet-blocks';
import {
  createTextFlowContinuation,
  hasTextFlowFrame,
  isTextFlowLinked,
  reflowTextFlowChain,
  removeTextFlowBlock,
  splitTextFlowAtChar,
  supportsTextFlow,
} from '../../utils/text-flow';

interface ProEditorLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

type LayoutDropPlacement = {
  layoutSectionId: string;
  layoutColumnId: LayoutSectionColumnId;
  insertBeforeId?: string | null;
};

// ── VividboardExportPanel ─────────────────────────────────────────────────────

/** Describes one free-answer block that has sub-questions and needs user's export-mode decision. */
interface SubqQueueItem {
  id: string;
  question: string;
  count: number;
}

interface VividboardExportPanelProps {
  worksheet: Worksheet | null;
  isLoading: boolean;
  selectedBlockId: string | null;
  /** Called with a map of blockId → mode ('single' | 'each' | 'html') after user makes decisions. */
  onExport1to1: (blockModes: Record<string, SubQuestionsExportMode | 'html'>) => void;
  onExportTest: () => void;
  onExportPisemka: () => void;
  onExportPresentation: (themeId: string) => void;
  /** Sync / create the dedicated board for this worksheet */
  onSyncBoard: () => void;
  isSyncingBoard: boolean;
  /** Re-generate page thumbnails for the linked board (fire-and-forget) */
  onRegenerateThumbnails: () => void;
  isRegeneratingThumbnails: boolean;
}

function ExportOptionButton({
  icon,
  title,
  description,
  onClick,
  disabled,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px',
        backgroundColor: hovered ? '#182235' : SIDEBAR_COLORS.panelAlt,
        border: `1px solid ${hovered ? (accent || '#3b82f6') : SIDEBAR_COLORS.panelBorder}`,
        borderRadius: '10px',
        cursor: disabled ? 'wait' : 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{
        width: '36px', height: '36px', flexShrink: 0,
        borderRadius: '8px',
        backgroundColor: accent ? `${accent}22` : '#1e40af22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent || '#60a5fa',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '2px' }}>
          {title}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
    </button>
  );
}

function VividboardExportPanel({
  worksheet,
  isLoading,
  selectedBlockId,
  onExport1to1,
  onExportTest,
  onExportPisemka,
  onExportPresentation,
  onSyncBoard,
  isSyncingBoard,
  onRegenerateThumbnails,
  isRegeneratingThumbnails,
}: VividboardExportPanelProps) {
  const [showThemePicker, setShowThemePicker] = React.useState(false);

  // Queue state: when multiple blocks need decisions, we step through them one by one
  const [queue, setQueue] = React.useState<SubqQueueItem[]>([]);
  const [queueIndex, setQueueIndex] = React.useState(0);
  const [pendingModes, setPendingModes] = React.useState<Record<string, SubQuestionsExportMode | 'html'>>({});
  const inQueue = queue.length > 0;

  const disabled = !worksheet || isLoading;
  const hasSelection = !!selectedBlockId;

  // Build list of free-answer blocks with sub-questions that need a decision
  const getSubqBlocks = (): SubqQueueItem[] => {
    if (!worksheet) return [];
    const scope = selectedBlockId
      ? worksheet.blocks.filter(b => b.id === selectedBlockId)
      : worksheet.blocks;
    return scope
      .filter(b => b.type === 'free-answer' && ((b.content as FreeAnswerContent).subQuestions?.length ?? 0) > 0)
      .map(b => ({
        id: b.id,
        question: (b.content as FreeAnswerContent).question ?? '',
        count: (b.content as FreeAnswerContent).subQuestions?.length ?? 0,
      }));
  };

  // When "Přenést 1:1" is clicked: build queue (if needed) or export directly
  const handle1to1Click = () => {
    const subqBlocks = getSubqBlocks();
    if (subqBlocks.length === 0) {
      onExport1to1({});
    } else {
      setQueue(subqBlocks);
      setQueueIndex(0);
      setPendingModes({});
    }
  };

  // User picked a mode for the current queue item
  const handleQueueChoice = (mode: SubQuestionsExportMode | 'html') => {
    const current = queue[queueIndex];
    const newModes = { ...pendingModes, [current.id]: mode };
    if (queueIndex + 1 >= queue.length) {
      // Done — fire the export
      setQueue([]);
      setQueueIndex(0);
      setPendingModes({});
      onExport1to1(newModes);
    } else {
      setPendingModes(newModes);
      setQueueIndex(i => i + 1);
    }
  };

  // Cancel the queue and return to main menu
  const cancelQueue = () => {
    setQueue([]);
    setQueueIndex(0);
    setPendingModes({});
  };

  // ── Queue step: decision for one block ─────────────────────────────────────
  if (inQueue) {
    const current = queue[queueIndex];
    const total = queue.length;
    const subqCount = current.count;
    const preview = current.question.length > 80 ? current.question.slice(0, 78) + '…' : current.question;

    return (
      <div style={{ ...sidebarContentStyle, display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: SIDEBAR_COLORS.panelAlt, minHeight: '100%' }}>
        {/* Back / Cancel */}
        <button
          type="button"
          onClick={cancelQueue}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748b', fontSize: '12px', padding: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Zrušit
        </button>

        {/* Progress & block info */}
        <div style={{ ...subtleCardStyle, backgroundColor: SIDEBAR_COLORS.panelAlt, padding: '10px 12px' }}>
          {total > 1 && (
            <div style={{ fontSize: '10px', color: '#475569', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Blok {queueIndex + 1} z {total}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4, marginBottom: '4px' }}>
            {preview || <em style={{ color: '#475569' }}>bez názvu</em>}
          </div>
          <div style={{ fontSize: '11px', color: '#475569' }}>
            {subqCount} pod-otázk{subqCount === 1 ? 'a' : subqCount < 5 ? 'y' : 'í'}
          </div>
          {/* Simple progress bar */}
          {total > 1 && (
            <div style={{ marginTop: '8px', height: '3px', backgroundColor: '#1e293b', borderRadius: '2px' }}>
              <div style={{ height: '100%', borderRadius: '2px', backgroundColor: '#3b82f6', width: `${((queueIndex) / total) * 100}%`, transition: 'width 0.3s' }} />
            </div>
          )}
        </div>

        <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>Jak exportovat tento blok?</div>

        {/* Option A: each sub-question as a separate slide */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleQueueChoice('each')}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            padding: '12px', borderRadius: '10px', cursor: disabled ? 'wait' : 'pointer',
            backgroundColor: SIDEBAR_COLORS.panelAlt, border: `1px solid ${SIDEBAR_COLORS.panelBorder}`,
            textAlign: 'left', transition: 'border-color 0.15s',
            opacity: disabled ? 0.6 : 1,
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#34d399')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}
        >
          <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, backgroundColor: '#34d39922', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="6" rx="1"/><rect x="2" y="12" width="20" height="6" rx="1"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9', marginBottom: '2px' }}>Každou pod-otázku jako slide</div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              Hlavní otázka jako text, pak {subqCount} slidů. Matematické → příklady.
            </div>
          </div>
        </button>

        {/* Option C: HTML embed */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleQueueChoice('html')}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            padding: '12px', borderRadius: '10px', cursor: disabled ? 'wait' : 'pointer',
            backgroundColor: SIDEBAR_COLORS.panelAlt, border: `1px solid ${SIDEBAR_COLORS.panelBorder}`,
            textAlign: 'left', transition: 'border-color 0.15s',
            opacity: disabled ? 0.6 : 1,
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#7c3aed')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}
        >
          <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, backgroundColor: '#7c3aed22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9', marginBottom: '2px' }}>Vložit jako HTML (1:1)</div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              Zachytí přesný vzhled bloku z editoru.
            </div>
          </div>
        </button>

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', color: '#64748b', fontSize: '11px' }}>
            <Loader2 size={14} className="animate-spin" />
            Vytvářím...
          </div>
        )}
      </div>
    );
  }

  // ── Step 1: main action menu ───────────────────────────────────────────────
  const hasDedicatedBoard = !!(worksheet?.linkedBoardId);

  return (
    <div style={{ ...sidebarContentStyle, display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: SIDEBAR_COLORS.panelAlt, minHeight: '100%' }}>

      {/* ── Dedicated board section ── */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ ...sectionTitleStyle, color: '#64748b', marginBottom: '8px' }}>
          Dedikovaný board
        </div>
        <button
          type="button"
          disabled={disabled || isSyncingBoard}
          onClick={onSyncBoard}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '11px 12px',
            backgroundColor: hasDedicatedBoard ? '#0c2a1a' : SIDEBAR_COLORS.panelAlt,
            border: `1px solid ${hasDedicatedBoard ? '#16a34a' : SIDEBAR_COLORS.panelBorder}`,
            borderRadius: '10px',
            cursor: (disabled || isSyncingBoard) ? 'wait' : 'pointer',
            textAlign: 'left', transition: 'all 0.15s',
            opacity: (disabled || isSyncingBoard) ? 0.7 : 1,
          }}
          onMouseEnter={e => { if (!disabled && !isSyncingBoard) e.currentTarget.style.borderColor = '#22c55e'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = hasDedicatedBoard ? '#16a34a' : '#1e293b'; }}
        >
          <div style={{
            width: 34, height: 34, flexShrink: 0, borderRadius: 8,
            backgroundColor: '#22c55e22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#22c55e',
          }}>
            {isSyncingBoard
              ? <Loader2 size={16} className="animate-spin" />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
            }
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9', marginBottom: '2px' }}>
              {hasDedicatedBoard ? 'Synchronizovat board' : 'Vytvořit dedikovaný board'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              {hasDedicatedBoard
                ? 'Aktualizuje propojený board bez ztráty nastavení a link odkazu.'
                : 'Vytvoří board trvale propojený s tímto pracovním listem.'}
            </div>
          </div>
        </button>

        {hasDedicatedBoard && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <a
              href={`/quiz/view/${worksheet!.linkedBoardId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 10px',
                backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px',
                fontSize: '11px', color: '#34d399', textDecoration: 'none',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#34d399')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Otevřít board
            </a>
            <button
              type="button"
              title="Přegenerovat miniatury stránek"
              disabled={isRegeneratingThumbnails}
              onClick={onRegenerateThumbnails}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                padding: '7px 10px',
                backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px',
                fontSize: '11px', color: '#94a3b8', cursor: isRegeneratingThumbnails ? 'wait' : 'pointer',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
                opacity: isRegeneratingThumbnails ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (!isRegeneratingThumbnails) { e.currentTarget.style.borderColor = '#64748b'; e.currentTarget.style.color = '#f1f5f9'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              {isRegeneratingThumbnails
                ? <Loader2 size={12} className="animate-spin" />
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              }
              Miniatury
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '4px 0' }} />

      {/* Header */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>
          Export do Vividboardu
        </div>
        <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>
          Převeďte pracovní list na interaktivní prezentaci nebo kvíz.
          Texty a obrázky zůstanou beze změny.
        </div>
      </div>

      {/* Context badge — block selected vs whole sheet */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 10px',
        backgroundColor: hasSelection ? '#1e3a5f' : '#0f172a',
        border: `1px solid ${hasSelection ? '#3b82f6' : '#1e293b'}`,
        borderRadius: '8px',
        marginBottom: '4px',
      }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: hasSelection ? '#60a5fa' : '#475569', flexShrink: 0 }} />
        <span style={{ fontSize: '11px', color: hasSelection ? '#93c5fd' : '#64748b' }}>
          {hasSelection ? 'Exportuje se vybraný blok' : 'Exportuje se celý pracovní list'}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '4px 0' }} />

      {/* Option 1: 1:1 */}
      {(() => {
        const subqBlockCount = getSubqBlocks().length;
        const desc = subqBlockCount > 0
          ? `${subqBlockCount} ${subqBlockCount === 1 ? 'blok obsahuje' : 'bloky obsahují'} pod-otázky — zvolíte způsob exportu pro každý.`
          : 'Všechny bloky se překlopí do Vividboardu přesně tak, jak jsou.';
        return (
          <ExportOptionButton
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
            title="Přenést 1 : 1"
            description={desc}
            onClick={handle1to1Click}
            disabled={disabled}
            accent="#60a5fa"
          />
        );
      })()}

      {/* Option 2: Test (ABC) */}
      <ExportOptionButton
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
        title="Vytvořit test"
        description="ABC otázky — studenti vybírají z možností A / B / C / D."
        onClick={onExportTest}
        disabled={disabled}
        accent="#34d399"
      />

      {/* Option 3: Písemka (open) */}
      <ExportOptionButton
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
        title="Vytvořit písemku"
        description="Otevřené otázky k zamyšlení nebo matematické příklady."
        onClick={onExportPisemka}
        disabled={disabled}
        accent="#f59e0b"
      />

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '4px 0' }} />

      {/* Option 4: Smart Presentation with theme */}
      <ExportOptionButton
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h20v14H2z"/><path d="M8 21h8"/><path d="M12 17v4"/><circle cx="12" cy="10" r="3"/></svg>}
        title="Vytvořit prezentaci"
        description="Chytrý algoritmus navrhne vizuální rozložení a barevné téma."
        onClick={() => setShowThemePicker(true)}
        disabled={disabled}
        accent="#a78bfa"
      />

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', color: '#64748b', fontSize: '11px' }}>
          <Loader2 size={14} className="animate-spin" />
          Vytvářím...
        </div>
      )}

      {/* Theme picker inline */}
      {showThemePicker && (
        <div style={{
          marginTop: '4px',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '12px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#c4b5fd', marginBottom: '10px' }}>
            Zvolte téma prezentace
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '10px' }}>
            {PRESENTATION_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => { setShowThemePicker(false); onExportPresentation(theme.id); }}
                disabled={disabled}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  padding: '10px 8px',
                  backgroundColor: theme.slideBg.color,
                  border: '2px solid #334155',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, transform 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#a78bfa'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%' }}>
                  <div style={{ height: '14px', borderRadius: '3px', backgroundColor: theme.titleBlock.bg }} />
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <div style={{ height: '20px', flex: 1, borderRadius: '2px', backgroundColor: theme.contentBlock.bg }} />
                    <div style={{ height: '20px', flex: 1, borderRadius: '2px', backgroundColor: theme.altBlock.bg }} />
                  </div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: theme.titleBlock.textColor, whiteSpace: 'nowrap' }}>
                  {theme.name}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowThemePicker(false)}
            style={{
              width: '100%', padding: '7px', backgroundColor: '#1e293b',
              border: 'none', borderRadius: '6px', color: '#64748b',
              fontSize: '12px', cursor: 'pointer',
            }}
          >
            Zrušit
          </button>
        </div>
      )}
    </div>
  );
}

export function ProEditorLayout({ theme, toggleTheme }: ProEditorLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get page format from URL (passed from workbook) or default to A4
  const initialPageFormat = (searchParams.get('pageFormat') as PageFormat) || 'a4';
  const initialPageNumber = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const initialPageIndex = initialPageNumber - 1;
  
  // Get workbook ID from URL for back navigation
  const workbookId = searchParams.get('workbookId');
  // Get book ID from URL (new teacher_books entity)
  const bookId = searchParams.get('bookId');
  const {
    worksheet,
    setWorksheet,
    isDirty,
    setIsDirty,
    saveStatus,
    updateWorksheet,
    handleManualSave: handleManualSaveBase,
    saveIfPendingChanges,
  } = useWorksheetEditorRuntime({
    id,
    normalizeUpdatedWorksheet: (updated) => {
      const normalizedBlocks = updated.blocks
        ? normalizeLayoutSectionBlocks(updated.blocks.map((block, index) => ({ ...block, order: index })))
        : undefined;

      return {
        ...updated,
        ...(normalizedBlocks ? { blocks: normalizedBlocks } : {}),
      };
    },
    prepareWorksheetForSave: (currentWorksheet) => {
      const pageEls = document.querySelectorAll<HTMLElement>('.worksheet-a4-page');
      const currentPageCount = pageEls.length || 1;

      return {
        ...currentWorksheet,
        updatedAt: new Date().toISOString(),
        metadata: {
          ...currentWorksheet.metadata,
          pageCount: currentPageCount,
        },
      };
    },
    persistWorksheet: (currentWorksheet) => {
      persistWorksheetForEditor(currentWorksheet, { bookId: bookId ?? undefined });
    },
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  // Dataset images — obrázky z linked datasetu (pro AssetPicker tab "Z datasetu")
  const [datasetImages, setDatasetImages] = useState<Array<{ url: string; title?: string; alt?: string }>>([]);
  const [currentPageBlockIds, setCurrentPageBlockIds] = useState<string[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  
  // Panel state - using PRO panel types
  const [activePanel, setActivePanel] = useState<ProActivePanel>('sheet-settings');
  const [appMode, setAppMode] = useState<AppMode>('chapter');
  const [showModeOverlay, setShowModeOverlay] = useState(false);

  // Design System state
  const [activeDesignSystem, setActiveDesignSystem] = useState<DesignSystem | null>(null);
  const [rightPanel, setRightPanel] = useState<'debug' | 'json' | null>(null);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true);
  const [showGridOverlay, setShowGridOverlay] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(0.83);
  const zoomIn  = () => setCanvasZoom(z => Math.min(2, Math.round((z + 0.05) * 100) / 100));
  const zoomOut = () => setCanvasZoom(z => Math.max(0.3, Math.round((z - 0.05) * 100) / 100));

  const handleSavePageAsTemplate = () => {
    // Handled inside SheetSettingsPanel (localStorage)
  };
  
  // Block settings overlay
  const [isBlockSettingsOpen, setIsBlockSettingsOpen] = useState(false);
  const [forceAIOpen, setForceAIOpen] = useState(false);
  
  // Insert mode
  const [pendingInsertType, setPendingInsertType] = useState<BlockType | null>(null);
  
  // Drag and drop from add panel
  const [isDraggingFromPanel, setIsDraggingFromPanel] = useState(false);
  const [draggingBlockType, setDraggingBlockType] = useState<BlockType | null>(null);
  
  // PDF Export
  const { printRef, handleExport, isExporting } = usePDFExport();

  // Export to Vividboard state
  const [isExportingToBoard, setIsExportingToBoard] = useState(false);
  const [isSyncingBoard, setIsSyncingBoard] = useState(false);
  const [isRegeneratingThumbnails, setIsRegeneratingThumbnails] = useState(false);
  
  // Get current user profile
  const profile = getCurrentUserProfile();
  
  // Version history
  const versionHistory = useVersionHistory({
    documentId: id || '',
    documentType: 'worksheet',
    content: worksheet ? JSON.stringify(worksheet) : '',
    title: worksheet?.title || 'Nový pracovní list',
    userId: profile?.userId,
    userType: 'teacher',
    userName: profile?.name,
    autoSave: true,
    autoSaveDelay: 60000,
    onVersionRestored: useCallback((version) => {
      try {
        const restoredWorksheet = JSON.parse(version.content);
        updateWorksheet(() => restoredWorksheet);
      } catch (e) {
        console.error('Failed to parse restored worksheet:', e);
      }
    }, [updateWorksheet]),
  });
  
  const { canUndo, canRedo, handleUndo, handleRedo } = useWorksheetHistory({
    worksheet,
    setWorksheet,
    maxHistory: 100,
  });

  const [pageNavCount, setPageNavCount] = useState(1);
  const pageFormat = (worksheet?.metadata?.pageFormat as PageFormat | undefined) || initialPageFormat;

  // Refs
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const hasAppliedInitialPageRef = useRef(false);

  useEffect(() => {
    if (!worksheet || worksheet.metadata?.pageFormat) return;
    setWorksheet((prev) => (
      prev
        ? {
            ...prev,
            metadata: { ...prev.metadata, pageFormat: initialPageFormat },
          }
        : prev
    ));
  }, [initialPageFormat, worksheet]);

  useEffect(() => {
    const mainEl = mainScrollRef.current;
    if (!mainEl) return;

    const updatePageNavCount = () => {
      const pageEls = mainEl.querySelectorAll('[data-page-index]');
      setPageNavCount(Math.max(1, pageEls.length));
    };

    updatePageNavCount();

    const observer = new MutationObserver(() => {
      updatePageNavCount();
    });

    observer.observe(mainEl, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [worksheet, activePanel, appMode, canvasZoom]);

  useEffect(() => {
    if (currentPageIndex < pageNavCount) return;
    setCurrentPageIndex(Math.max(0, pageNavCount - 1));
  }, [currentPageIndex, pageNavCount]);

  const scrollToPage = useCallback((pageIndex: number, behavior: ScrollBehavior = 'smooth') => {
    const mainEl = mainScrollRef.current;
    if (!mainEl) return;
    const pageEl = mainEl.querySelector(`[data-page-index="${pageIndex}"]`) as HTMLElement | null;
    if (!pageEl) return;
    setCurrentPageIndex(pageIndex);
    pageEl.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
  }, []);

  useEffect(() => {
    if (hasAppliedInitialPageRef.current) return;
    if (!worksheet) return;
    if (pageNavCount <= initialPageIndex) return;
    hasAppliedInitialPageRef.current = true;
    window.setTimeout(() => {
      scrollToPage(initialPageIndex, 'auto');
    }, 0);
  }, [initialPageIndex, pageNavCount, scrollToPage, worksheet]);

  // Manual save
  const handleManualSave = useCallback(() => {
    handleManualSaveBase();
    toast.success('Uloženo');
  }, [handleManualSaveBase]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey; // Ctrl na Win/Linux, Cmd na Mac
      // Ctrl/Cmd+Z for undo
      if (mod && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y for redo
      if ((mod && e.shiftKey && e.key === 'z') || (mod && e.shiftKey && e.key === 'Z') || (mod && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl/Cmd+S for save
      if (mod && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
      // Ctrl/Cmd+Shift+E for export
      if (mod && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        if (worksheet && !isExporting) {
          handleExport(worksheet);
        }
      }
      // Ctrl/Cmd+Shift+D for debug panel
      if (mod && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setRightPanel(prev => prev === 'debug' ? null : 'debug');
        setRightPanelCollapsed(false);
      }
      // Ctrl/Cmd+Shift+J for JSON editor
      if (mod && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        setRightPanel(prev => prev === 'json' ? null : 'json');
        setRightPanelCollapsed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, worksheet, isExporting, handleExport, handleManualSave]);
  
  // Inject Google Fonts when design system fonts change
  useEffect(() => {
    if (!activeDesignSystem) return;
    const { headingFont, bodyFont } = activeDesignSystem.typography;
    const url = getGoogleFontsUrl([headingFont, bodyFont]);
    if (!url) return;
    const id = 'ds-active-fonts';
    let el = document.getElementById(id) as HTMLLinkElement | null;
    if (!el) {
      el = document.createElement('link');
      el.id = id;
      el.rel = 'stylesheet';
      document.head.appendChild(el);
    }
    el.href = url;
  }, [activeDesignSystem?.typography.headingFont, activeDesignSystem?.typography.bodyFont]);

  // Fetch dataset images when worksheet is loaded and has a linked dataset
  useEffect(() => {
    const sourceDatasetId = worksheet?.metadata?.sourceDatasetId;
    if (!sourceDatasetId) return;

    supabase
      .from('topic_data_sets')
      .select('media')
      .eq('id', sourceDatasetId)
      .single()
      .then(({ data, error }) => {
        if (error || !data?.media) return;
        const media = data.media as any;
        const imgs: Array<{ url: string; title?: string; alt?: string }> = [
          ...(media.images ?? []),
          ...(media.generatedIllustrations ?? []),
          ...(media.generatedPhotos ?? []),
        ].filter((img: any) => !!img?.url);
        setDatasetImages(imgs);
      });
  }, [worksheet?.metadata?.sourceDatasetId]);
  
  // ── Template layout: apply gridSpan from a template to current page blocks ──
  const handleApplyTemplate = useCallback((templateId: string) => {
    const CUSTOM_KEY = 'vividbooks_custom_layouts';
    const customLayouts: any[] = (() => { try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch { return []; } })();
    const layout = [...TEXTBOOK_LAYOUTS, ...customLayouts].find(l => l.id === templateId);
    if (!layout) { console.warn('[Template] Layout not found:', templateId); return; }

    const fillableSlots: any[] = layout.template.filter((s: any) => !s.fixed);
    console.log('[Template] Applying:', layout.name, '—', fillableSlots.length, 'slots');

    updateWorksheet(prev => {
      const pageIds = new Set(currentPageBlockIds.length > 0 ? currentPageBlockIds : prev.blocks.map(b => b.id));
      let slotIdx = 0;
      const blocks = prev.blocks.map(block => {
        if (!pageIds.has(block.id)) return block;
        
        // Header and footer are not part of the fillable layout structure
        if (block.type === 'header-footer') return block;

        const slot = fillableSlots[slotIdx++];
        if (!slot) return block;
        
        const newSpan = slot.width === 'half' ? 6 : 12;
        console.log('[Template] Block', block.id, 'type:', block.type, '→ slot type:', slot.type, 'gridSpan:', newSpan);
        
        return { 
          ...block, 
          gridSpan: newSpan, 
          width: slot.width as 'full' | 'half', 
          ...(slot.width === 'half' ? { widthPercent: 50 } : {}) 
        };
      });

      // Zajištění, že je zapnutý grid mode a jeden sloupec (Jinak "Dva sloupce" ignoruje gridSpan)
      const existingOverrides = prev.metadata.pageOverrides ?? {};
      const newOverrides = {
        ...existingOverrides,
        [currentPageIndex]: {
          ...(existingOverrides[currentPageIndex] || {}),
          pageColumnLayout: 'single' as const,
        }
      };

      return { 
        ...prev, 
        blocks,
        metadata: {
          ...prev.metadata,
          layoutMode: 'grid',
          pageColumnLayout: 'single', // Force global to single as well to be safe
          pageOverrides: newOverrides,
        }
      };
    });
  }, [updateWorksheet, currentPageBlockIds, currentPageIndex]);

  // ── Smart Layout: AI pairs dataset images with paragraphs ──────────────────
  const [smartLayoutLoading, setSmartLayoutLoading] = useState(false);

  const handleSmartLayout = useCallback(async () => {
    if (!worksheet || datasetImages.length === 0) {
      toast.error('Žádné obrázky v datasetu — nejdřív vygeneruj ilustrace');
      return;
    }

    const pageIds = new Set(currentPageBlockIds.length > 0 ? currentPageBlockIds : worksheet.blocks.map(b => b.id));
    const pageBlocks = worksheet.blocks.filter(b => pageIds.has(b.id) && b.type !== 'header-footer' && b.type !== 'image');
    const paragraphBlocks = pageBlocks.filter(b => b.type === 'paragraph');

    if (paragraphBlocks.length === 0) {
      toast.error('Na stránce nejsou žádné odstavce');
      return;
    }

    setSmartLayoutLoading(true);
    try {
      // Deterministic pairing: distribute images evenly across paragraphs
      // Every paragraph that has a corresponding image gets paired (in order)
      const pairCount = Math.min(paragraphBlocks.length, datasetImages.length);
      const pairs: { paragraphIndex: number; imageIndex: number }[] = [];

      if (paragraphBlocks.length <= datasetImages.length) {
        // More images than paragraphs — one image per paragraph
        for (let i = 0; i < pairCount; i++) {
          pairs.push({ paragraphIndex: i, imageIndex: i });
        }
      } else {
        // More paragraphs than images — spread images across paragraphs evenly
        const step = Math.floor(paragraphBlocks.length / datasetImages.length);
        for (let imgIdx = 0; imgIdx < datasetImages.length; imgIdx++) {
          pairs.push({ paragraphIndex: imgIdx * step, imageIndex: imgIdx });
        }
      }

      // Apply: for each pair, insert image block after paragraph + set both to half width
      updateWorksheet(prev => {
        let blocks = [...prev.blocks];

        // Process pairs in reverse order so indices stay stable
        const reversedPairs = [...pairs].sort((a, b) => b.paragraphIndex - a.paragraphIndex);

        for (const pair of reversedPairs) {
          const paraBlock = paragraphBlocks[pair.paragraphIndex];
          const imgData = datasetImages[pair.imageIndex];
          if (!paraBlock || !imgData) continue;

          const paraIdx = blocks.findIndex(b => b.id === paraBlock.id);
          if (paraIdx === -1) continue;

          // Shrink paragraph to half
          blocks[paraIdx] = { ...blocks[paraIdx], gridSpan: 6, width: 'half', widthPercent: 50 };

          // Insert image block right after paragraph
          const newImageBlock: WorksheetBlock = {
            id: generateBlockId(),
            type: 'image',
            order: blocks[paraIdx].order + 0.5,
            width: 'half',
            widthPercent: 50,
            gridSpan: 6,
            content: {
              url: imgData.url,
              alt: imgData.title || '',
              caption: imgData.title || '',
              alignment: 'center',
              size: 100,
            },
          };
          blocks.splice(paraIdx + 1, 0, newImageBlock);
        }

        // Re-number orders
        blocks = blocks.map((b, i) => ({ ...b, order: i }));

        return {
          ...prev,
          blocks,
          metadata: { ...prev.metadata, layoutMode: 'grid' },
        };
      });

      toast.success(`✨ Smart layout použit — ${pairs.length} obrázků přiřazeno`);
    } catch (err) {
      console.error('[SmartLayout] Error:', err);
      toast.error('Chyba při párování obrázků');
    } finally {
      setSmartLayoutLoading(false);
    }
  }, [worksheet, datasetImages, currentPageBlockIds, updateWorksheet]);

  // ── AI Text Formatter: bold terms in paragraphs, highlight in headings ───────
  const [formatTextLoading, setFormatTextLoading] = useState(false);

  const PASTEL_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa', '#a5f3fc', '#fbcfe8'];

  const handleFormatText = useCallback(async () => {
    if (!worksheet) return;
    // Process ALL blocks in the document (not just current page)
    const textBlocks = worksheet.blocks.filter(b => b.type === 'paragraph' || b.type === 'heading');
    if (textBlocks.length === 0) { toast.error('Na stránce nejsou žádné textové bloky'); return; }

    setFormatTextLoading(true);
    try {
      // Pre-assign pastel colors to all headings across the whole document
      const usedColors: string[] = [];
      const pickColor = () => {
        const remaining = PASTEL_COLORS.filter(c => !usedColors.includes(c));
        const pool = remaining.length > 0 ? remaining : PASTEL_COLORS;
        const c = pool[Math.floor(Math.random() * pool.length)];
        usedColors.push(c);
        return c;
      };
      const headingColors: Record<string, string> = {};
      textBlocks.filter(b => b.type === 'heading').forEach(b => { headingColors[b.id] = pickColor(); });

      console.log('[FormatText] Total text blocks to format:', textBlocks.length);

      const buildPrompt = (batch: WorksheetBlock[]) => {
        const lines = batch.map(b => {
          if (b.type === 'heading') {
            const text = (b as any).content?.text || '';
            const color = headingColors[b.id] || '#fde68a';
            return `ID:${b.id} | TYPE:heading | COLOR:${color} | TEXT:${text}`;
          }
          const html = (b as any).content?.html || '';
          const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          return `ID:${b.id} | TYPE:paragraph | TEXT:${text.substring(0, 500)}`;
        }).join('\n---\n');

        return `Jsi editor učebnicových textů. Formátuj každý blok a vrať POUZE čistý JSON.

${lines}

PRAVIDLA:
- paragraph: identifikuj 3-6 klíčových odborných pojmů, obaluj je <strong>POJEM</strong>. Vrať celý text jako: <p>text s <strong>pojmy</strong></p>
- heading: identifikuj 1-2 klíčové pojmy, obaluj je <mark style="background-color:COLOR;border-radius:3px;padding:0 3px">POJEM</mark> kde COLOR je hodnota z COLOR pole výše. Vrať jen text bez <p> tagů.
- Neměň slovosled ani délku textu. Jen přidej tagy.

Vrať JSON kde každý klíč je ID bloku a hodnota je upravený text:
{
  "ID_BLOKU": "upravený text",
  "ID_BLOKU2": "upravený text"
}`;
      };

      // Process in batches of 8 blocks (smaller = more reliable JSON output)
      const BATCH_SIZE = 8;
      const contentMap: Record<string, string> = {};
      for (let i = 0; i < textBlocks.length; i += BATCH_SIZE) {
        const batch = textBlocks.slice(i, i + BATCH_SIZE);
        console.log(`[FormatText] Processing batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(textBlocks.length/BATCH_SIZE)}, blocks: ${batch.length}`);
        const prompt = buildPrompt(batch);
        const response = await chatWithAIProxy(
          [
            { role: 'system', content: 'Vrať POUZE čistý JSON objekt. Žádný markdown, žádný text mimo JSON.' },
            { role: 'user', content: prompt },
          ],
          'gemini-3-flash',
          { temperature: 0.2, max_tokens: 4096 }
        );
        console.log(`[FormatText] Batch ${Math.floor(i/BATCH_SIZE)+1} response length: ${response.length}`);
        const cleaned = response.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
        try {
          const parsed = JSON.parse(cleaned);
          console.log(`[FormatText] Batch parsed OK, keys: ${Object.keys(parsed).length}`);
          Object.assign(contentMap, parsed);
        } catch (e) {
          console.warn('[FormatText] Batch parse failed:', e, 'raw (first 200):', cleaned.substring(0, 200));
        }
      }
      console.log('[FormatText] Total formatted blocks:', Object.keys(contentMap).length);

      updateWorksheet(prev => {
        const blocks = prev.blocks.map(block => {
          const newContent = contentMap[block.id];
          if (!newContent) return block;
          if (block.type === 'heading') {
            return { ...block, content: { ...(block as any).content, text: newContent } };
          }
          if (block.type === 'paragraph') {
            const html = newContent.startsWith('<p>') ? newContent : `<p>${newContent}</p>`;
            return { ...block, content: { ...(block as any).content, html } };
          }
          return block;
        });
        return { ...prev, blocks };
      });

      const count = Object.keys(contentMap).length;
      toast.success(`✨ Formátováno ${count} bloků (celý dokument)`);
    } catch (err: any) {
      console.error('[FormatText] Error:', err);
      toast.error(`Chyba formátování: ${err?.message || err}`, { duration: 6000 });
    } finally {
      setFormatTextLoading(false);
    }
  }, [worksheet, currentPageBlockIds, updateWorksheet]);

  // ── Series SVG preview generator ──────────────────────────────────────────
  const generateSeriesSVG = (slots: SeriesSlot[]): string => {
    const W = 76; const H = 60; const PAD = 3; const GAP = 2;
    const COLORS: Record<string, string> = {
      heading: '#6366f1', paragraph: '#334155', image: '#0ea5e9', gallery: '#0284c7', infobox: '#059669',
    };
    const rects: string[] = [];
    const innerW = W - PAD * 2;

    // Check if first slot is float anchor
    const firstSlot = slots[0];
    const isFloat = !!firstSlot?.floatSide;

    if (isFloat) {
      // Float layout: anchor on one side, mainBlocks stacked on other side
      const anchor = firstSlot;
      const mainSlots = slots.slice(1, 1 + (anchor.floatSpanBlocks ?? 2));
      const anchorW = Math.round(innerW * (anchor.floatGridSpan ?? 6) / 12);
      const mainW = innerW - anchorW - GAP;
      const contentH = H - PAD * 2;
      const anchorColor = COLORS[anchor.type] || '#475569';
      const anchorX = anchor.floatSide === 'left' ? PAD : PAD + mainW + GAP;
      const mainX = anchor.floatSide === 'left' ? PAD + anchorW + GAP : PAD;

      // Rounded rect for anchor
      rects.push(`<rect x="${anchorX}" y="${PAD}" width="${anchorW}" height="${contentH}" rx="2" fill="${anchorColor}" opacity="0.85"/>`);
      if (anchor.type === 'image' || anchor.type === 'gallery') {
        if (anchor.type === 'gallery') {
          // Gallery: two stacked image placeholders
          const imgH = (contentH - GAP) / 2;
          [0, imgH + GAP].forEach(dy => {
            rects.push(`<rect x="${anchorX + 1}" y="${PAD + dy}" width="${anchorW - 2}" height="${imgH}" rx="2" fill="white" opacity="0.1"/>`);
            const cx2 = anchorX + anchorW / 2; const cy2 = PAD + dy + imgH / 2;
            rects.push(`<circle cx="${cx2}" cy="${cy2 - 2}" r="2.5" fill="white" opacity="0.2"/>`);
          });
        } else {
          const cx = anchorX + anchorW / 2; const cy = PAD + contentH / 2;
          rects.push(`<circle cx="${cx}" cy="${cy - 4}" r="4" fill="white" opacity="0.25"/>`);
          rects.push(`<path d="M${anchorX + 2} ${PAD + contentH - 6} L${anchorX + anchorW * 0.35} ${PAD + contentH / 2 + 2} L${anchorX + anchorW * 0.65} ${PAD + contentH - 10} L${anchorX + anchorW - 2} ${PAD + contentH - 4}" fill="white" opacity="0.2" stroke="none"/>`);
        }
      }

      // Stack main slots
      const eachH = mainSlots.length > 0 ? (contentH - GAP * (mainSlots.length - 1)) / mainSlots.length : contentH;
      mainSlots.forEach((slot, i) => {
        const y = PAD + i * (eachH + GAP);
        const color = COLORS[slot.type] || '#475569';
        rects.push(`<rect x="${mainX}" y="${y}" width="${mainW}" height="${eachH}" rx="2" fill="${color}" opacity="${slot.type === 'heading' ? '0.9' : '0.6'}"/>`);
        if (slot.type === 'heading') {
          rects.push(`<rect x="${mainX + 2}" y="${y + eachH / 2 - 1}" width="${mainW * 0.6}" height="2" rx="1" fill="white" opacity="0.5"/>`);
        }
      });
    } else {
      // Flow layout: group slots into rows by span
      const rows: SeriesSlot[][] = [];
      let currentRow: SeriesSlot[] = [];
      let rowSpan = 0;
      for (const slot of slots) {
        const span = slot.span || 12;
        if (rowSpan + span > 12 && currentRow.length > 0) {
          rows.push(currentRow);
          currentRow = [slot]; rowSpan = span;
        } else {
          currentRow.push(slot); rowSpan += span;
        }
      }
      if (currentRow.length > 0) rows.push(currentRow);

      const rowH = rows.length > 0 ? (H - PAD * 2 - GAP * (rows.length - 1)) / rows.length : H - PAD * 2;
      rows.forEach((row, ri) => {
        const y = PAD + ri * (rowH + GAP);
        const totalSpan = row.reduce((s, sl) => s + (sl.span || 12), 0);
        let xCursor = PAD;
        row.forEach(slot => {
          const slotW = Math.round(innerW * (slot.span || 12) / totalSpan) - (row.length > 1 ? GAP / row.length : 0);
          const color = COLORS[slot.type] || '#475569';
          const isPreset = slot.preset === 'infobox';
          rects.push(`<rect x="${xCursor}" y="${y}" width="${slotW}" height="${rowH}" rx="2" fill="${isPreset ? COLORS.infobox : color}" opacity="${slot.type === 'heading' ? '0.9' : '0.6'}"/>`);
          if (slot.type === 'heading') {
            rects.push(`<rect x="${xCursor + 2}" y="${y + rowH / 2 - 1}" width="${slotW * 0.55}" height="2" rx="1" fill="white" opacity="0.5"/>`);
          } else if (slot.type === 'gallery') {
            // Draw mini grid of image placeholders
            const cols = slot.galleryColumns ?? 2;
            const count = slot.galleryCount ?? cols;
            const rows = Math.ceil(count / cols);
            const cellW = (slotW - (cols - 1) * 1.5) / cols;
            const cellH = (rowH - (rows - 1) * 1.5) / rows;
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                if (r * cols + c >= count) break;
                const cx2 = xCursor + c * (cellW + 1.5);
                const cy2 = y + r * (cellH + 1.5);
                rects.push(`<rect x="${cx2}" y="${cy2}" width="${cellW}" height="${cellH}" rx="1.5" fill="white" opacity="0.12"/>`);
                rects.push(`<circle cx="${cx2 + cellW / 2}" cy="${cy2 + cellH / 2 - 1}" r="${Math.min(cellW, cellH) * 0.18}" fill="white" opacity="0.2"/>`);
              }
            }
          } else if (slot.type === 'image') {
            const cx = xCursor + slotW / 2; const cy = y + rowH / 2;
            rects.push(`<circle cx="${cx}" cy="${cy - 3}" r="3" fill="white" opacity="0.25"/>`);
            rects.push(`<path d="M${xCursor + 2} ${y + rowH - 3} L${xCursor + slotW * 0.4} ${y + rowH / 2 + 2} L${xCursor + slotW - 2} ${y + rowH - 3}" fill="white" opacity="0.2"/>`);
          } else {
            // paragraph lines — split into columns if specified
            const cols = slot.columns ?? 1;
            const colW = (slotW - (cols - 1) * 2) / cols;
            for (let c = 0; c < cols; c++) {
              const cx = xCursor + c * (colW + 2);
              [0.2, 0.45, 0.7].forEach(frac => {
                if (y + frac * rowH + 1 < y + rowH - 1) {
                  rects.push(`<rect x="${cx + 1}" y="${y + frac * rowH}" width="${colW * 0.85}" height="1.5" rx="0.75" fill="white" opacity="0.2"/>`);
                }
              });
            }
          }
          xCursor += slotW + GAP;
        });
      });
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="4" fill="#0f172a"/>${rects.join('')}</svg>`;
  };

  const generateLayoutSectionSVG = (columns: 2 | 3): string => {
    const W = 76;
    const H = 60;
    const PAD = 4;
    const GAP = 3;
    const innerW = W - PAD * 2;
    const innerH = H - PAD * 2;
    const columnW = (innerW - GAP * (columns - 1)) / columns;
    const columnsSvg = Array.from({ length: columns }, (_, index) => {
      const x = PAD + index * (columnW + GAP);
      return `<rect x="${x}" y="${PAD + 8}" width="${columnW}" height="${innerH - 12}" rx="4" fill="#1e293b" stroke="#475569" stroke-width="1"/>
        <rect x="${x + 3}" y="${PAD + 14}" width="${columnW - 6}" height="7" rx="2" fill="#334155"/>
        <rect x="${x + 3}" y="${PAD + 24}" width="${columnW - 6}" height="10" rx="2" fill="#475569" opacity="0.85"/>
        <rect x="${x + 3}" y="${PAD + 37}" width="${columnW - 10}" height="7" rx="2" fill="#334155" opacity="0.9"/>`;
    }).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="${W}" height="${H}" rx="6" fill="#0f172a"/>
      <rect x="${PAD}" y="${PAD}" width="${innerW}" height="7" rx="3.5" fill="#6366f1"/>
      ${columnsSvg}
    </svg>`;
  };

  // ── Block Series: named sequences of block types ──────────────────────────
  type SeriesSlot = {
    type: string;       // 'heading' | 'paragraph' | 'image' | 'gallery' | 'infobox'
    span: number;
    level?: string;
    preset?: string;
    columns?: 1 | 2 | 3;     // text columns inside paragraph block
    galleryColumns?: number;  // for gallery slots: columns in grid (1 = stacked vertically)
    galleryCount?: number;    // how many images to put in gallery (default 2)
    // Float/anchor layout: first slot can be an anchor, following slots are mainBlocks
    floatSide?: 'left' | 'right';
    floatSpanBlocks?: number;
    floatGridSpan?: number;
  };
  type SeriesGroup = 'column' | 'half' | 'twothirds';
  const BLOCK_SERIES: Record<string, { label: string; emoji: string; description: string; group: SeriesGroup; slots: SeriesSlot[] }> = {
    // ── Jeden sloupec ─────────────────────────────────────────────────────────
    C:     { group: 'column',    label: '2 sloupce',       emoji: '≡',  description: 'Nadpis + odstavec ve dvou sloupcích', slots: [
      { type: 'heading', span: 12, level: 'h2' },
      { type: 'paragraph', span: 12, columns: 2 },
    ]},
    D:     { group: 'column',    label: 'Galerie 4×',      emoji: '🏛', description: 'Nadpis + galerie celá šířka (4 sloupce, 4 obrázky)', slots: [
      { type: 'heading', span: 12, level: 'h2' },
      { type: 'gallery', span: 12, galleryColumns: 4, galleryCount: 4 },
    ]},
    G:     { group: 'column',    label: 'Odstavec',        emoji: '¶',  description: 'Jen odstavec přes celou šířku', slots: [
      { type: 'paragraph', span: 12 },
    ]},
    // ── Polovina stránky ──────────────────────────────────────────────────────
    A:     { group: 'half',      label: 'Text + Obr →',    emoji: '🖼', description: 'Nadpis (H1, Cooper), odstavec vlevo, obrázek vpravo', slots: [
      { type: 'heading', span: 12, level: 'h1' },
      { type: 'paragraph', span: 6 },
      { type: 'image', span: 6 },
    ]},
    A2:    { group: 'half',      label: '← Obr + Text',   emoji: '🖼', description: 'Nadpis (H1, Cooper), obrázek vlevo, odstavec vpravo', slots: [
      { type: 'heading', span: 12, level: 'h1' },
      { type: 'image', span: 6 },
      { type: 'paragraph', span: 6 },
    ]},
    B:     { group: 'half',      label: 'Boční obr →',     emoji: '🗂', description: 'Obrázek vlevo jako panel, H2 + odstavec vpravo', slots: [
      { type: 'image', span: 6, floatSide: 'left', floatSpanBlocks: 2, floatGridSpan: 6 },
      { type: 'heading', span: 6, level: 'h2' },
      { type: 'paragraph', span: 6 },
    ]},
    B2:    { group: 'half',      label: '← Boční obr',    emoji: '🗂', description: 'H2 + odstavec vlevo, obrázek vpravo jako panel', slots: [
      { type: 'image', span: 6, floatSide: 'right', floatSpanBlocks: 2, floatGridSpan: 6 },
      { type: 'heading', span: 6, level: 'h2' },
      { type: 'paragraph', span: 6 },
    ]},
    'B+G+I':  { group: 'twothirds', label: 'Gal + text + box →', emoji: '🖼', description: 'Galerie vlevo (2 foto), H2 + odstavec + infobox vpravo', slots: [
      { type: 'gallery', span: 5, floatSide: 'left', floatSpanBlocks: 3, floatGridSpan: 5, galleryColumns: 1, galleryCount: 2 },
      { type: 'heading', span: 7, level: 'h2' },
      { type: 'paragraph', span: 7 },
      { type: 'infobox', span: 7 },
    ]},
    'B2+G+I': { group: 'twothirds', label: '← Gal + text + box', emoji: '🖼', description: 'H2 + odstavec + infobox vlevo, galerie vpravo (2 foto)', slots: [
      { type: 'gallery', span: 5, floatSide: 'right', floatSpanBlocks: 3, floatGridSpan: 5, galleryColumns: 1, galleryCount: 2 },
      { type: 'heading', span: 7, level: 'h2' },
      { type: 'paragraph', span: 7 },
      { type: 'infobox', span: 7 },
    ]},
    // ── 2/3 stránky ───────────────────────────────────────────────────────────
    'C+I': { group: 'twothirds', label: '2/3 text + 1/3 box', emoji: '📌', description: 'Nadpis + odstavec 2/3 šířky + infobox 1/3', slots: [
      { type: 'heading', span: 12, level: 'h2' },
      { type: 'paragraph', span: 8 },
      { type: 'infobox', span: 4 },
    ]},
    'D+I': { group: 'twothirds', label: 'Gal 2× + box',     emoji: '🏛', description: 'Nadpis + galerie 2/3 (2 sloupce, 2 obrázky) + infobox 1/3', slots: [
      { type: 'heading', span: 12, level: 'h2' },
      { type: 'gallery', span: 8, galleryColumns: 2, galleryCount: 2 },
      { type: 'infobox', span: 4 },
    ]},
  };

  const handleApplySeries = useCallback((seriesKeys: string[]) => {
    if (!worksheet) return;
    const pageIds = new Set(currentPageBlockIds.length > 0 ? currentPageBlockIds : worksheet.blocks.map(b => b.id));

    // Collect content blocks from current page (skip header/footer)
    const pageBlocks = worksheet.blocks.filter(b => pageIds.has(b.id) && b.type !== 'header-footer');

    // Build slot sequence from chosen series
    const allSlots = seriesKeys.flatMap(key => BLOCK_SERIES[key]?.slots ?? []);
    if (allSlots.length === 0) return;

    updateWorksheet(prev => {
      const otherBlocks = prev.blocks.filter(b => !pageIds.has(b.id) || b.type === 'header-footer');
      const contentBlocks = [...pageBlocks];

      // Match existing blocks to slots by type (consume from contentBlocks pool)
      const pools: Record<string, WorksheetBlock[]> = {};
      for (const b of contentBlocks) {
        const key = b.type;
        if (!pools[key]) pools[key] = [];
        pools[key].push(b);
      }
      // paragraph pool for infobox slots too
      const usedIds = new Set<string>();

      // Build placeholder content for a slot
      const makePlaceholderContent = (slot: SeriesSlot): any => {
        if (slot.type === 'heading') return { text: 'Nadpis', level: slot.level || 'h2' };
        if (slot.type === 'infobox') return { title: 'Shrnutí', html: '<p>Klíčové poznatky z textu...</p>', variant: 'green' as const };
        if (slot.type === 'paragraph') return { html: '<p>Text odstavce...</p>' };
        if (slot.type === 'gallery') {
          const count = slot.galleryCount ?? 2;
          return {
            url: '',
            alt: '',
            caption: '',
            alignment: 'center' as const,
            size: 100,
            gallery: Array(count).fill(''),
            galleryLayout: 'grid' as const,
            gridColumns: slot.galleryColumns ?? 1,
          };
        }
        return { url: '', alt: '', caption: '', size: 100, alignment: 'center' as const };
      };

      const applySlot = (b: WorksheetBlock, slot: SeriesSlot, i: number): WorksheetBlock => {
        // Resolve actual block type: 'gallery' slot maps to 'image' block
        const blockType = slot.type === 'gallery' ? 'image' : slot.type;
        let updated: WorksheetBlock = {
          ...b,
          type: blockType as any,
          order: i,
          gridSpan: slot.span,
          width: slot.span < 12 ? 'half' : 'full',
          widthPercent: slot.span < 12 ? 50 : undefined,
          floatSide: slot.floatSide ?? (b as any).floatSide ?? undefined,
          floatSpanBlocks: slot.floatSpanBlocks ?? (b as any).floatSpanBlocks ?? undefined,
          floatGridSpan: slot.floatGridSpan ?? (b as any).floatGridSpan ?? undefined,
        } as WorksheetBlock;
        if (!slot.floatSide) {
          delete (updated as any).floatSide;
          delete (updated as any).floatSpanBlocks;
          delete (updated as any).floatGridSpan;
        }
        if (slot.level && updated.type === 'heading') {
          (updated as any).content = { ...(updated as any).content, level: slot.level };
        }
        if (slot.type === 'gallery') {
          const count = slot.galleryCount ?? 2;
          // First URL: preserve from existing block if it had one
          const existingUrl = (b as any).content?.url || '';
          const galleryUrls: string[] = existingUrl ? [existingUrl] : [''];
          // Fill remaining slots with dataset images not already used
          const usedUrls = new Set(galleryUrls.filter(Boolean));
          for (const img of datasetImages) {
            if (galleryUrls.length >= count) break;
            if (!usedUrls.has(img.url)) {
              galleryUrls.push(img.url);
              usedUrls.add(img.url);
            }
          }
          while (galleryUrls.length < count) galleryUrls.push('');
          (updated as any).content = {
            url: galleryUrls[0] || '',
            alt: '',
            caption: '',
            alignment: 'center' as const,
            size: 100,
            gallery: galleryUrls,
            galleryLayout: 'grid',
            gridColumns: slot.galleryColumns ?? 1,
          };
        }
        if (slot.preset === 'infobox' && updated.type === 'paragraph') {
          (updated as any).visualStyles = {
            displayPreset: 'infobox', backgroundColor: '#dbeafe', borderColor: '#3b82f6', borderRadius: 12,
          };
        }
        if (slot.columns && updated.type === 'paragraph') {
          (updated as any).content = { ...(updated as any).content, columns: slot.columns };
        }
        return updated;
      };

      const newBlocks: WorksheetBlock[] = allSlots.map((slot, i) => {
        // For gallery: try to find an existing image block to use as first photo
        const matchType = slot.type === 'gallery' ? 'image' : slot.type;
        const pool = pools[matchType] || [];
        const available = pool.filter(b => !usedIds.has(b.id));
        const block = available[0];

        if (block) {
          usedIds.add(block.id);
          return applySlot(block, slot, i);
        }
        // Heading with no match → skip (return null, filtered below)
        if (slot.type === 'heading') return null as any;
        // No matching block — create placeholder
        const placeholder: WorksheetBlock = {
          id: generateBlockId(),
          type: (slot.type === 'gallery' ? 'image' : slot.type) as any,
          order: i,
          gridSpan: slot.span,
          width: slot.span < 12 ? 'half' as const : 'full' as const,
          content: makePlaceholderContent(slot),
        } as WorksheetBlock;
        return applySlot(placeholder, slot, i);
      });

      // Append any page blocks that weren't consumed by any slot (preserve them at end)
      const unusedPageBlocks = contentBlocks
        .filter(b => !usedIds.has(b.id))
        .map((b, i) => ({ ...b, order: allSlots.length + i })); // order after series blocks
      const filteredNewBlocks = [...newBlocks.filter(Boolean), ...unusedPageBlocks];
      const newBlockIds = new Set(filteredNewBlocks.map(b => b.id));
      const allNew = [...otherBlocks, ...filteredNewBlocks].sort((a, b) => {
        const aIsOther = (!pageIds.has(a.id) && !newBlockIds.has(a.id)) || a.type === 'header-footer';
        const bIsOther = (!pageIds.has(b.id) && !newBlockIds.has(b.id)) || b.type === 'header-footer';
        if (aIsOther && !bIsOther) return -1;
        if (!aIsOther && bIsOther) return 1;
        return a.order - b.order;
      });

      return {
        ...prev,
        blocks: allNew.map((b, i) => ({ ...b, order: i })),
        metadata: { ...prev.metadata, layoutMode: 'grid' as const, gridColumns: 12 as const },
      };
    });

    toast.success(`✅ Série ${seriesKeys.join('+')} aplikována`);
  }, [worksheet, currentPageBlockIds, updateWorksheet]);

  // Insert a layout series as NEW blocks appended to current page (does not rearrange existing)
  const handleInsertLayout = useCallback((seriesKey: string) => {
    if (seriesKey === 'layout-section-2' || seriesKey === 'layout-section-3') {
      const columns = seriesKey === 'layout-section-3' ? 3 : 2;

      updateWorksheet(prev => {
        const baseOrder = prev.blocks.length;
        const layoutSection = createEmptyBlock('layout-section', baseOrder);
        const gridColumns = prev.metadata.gridColumns || 12;
        return {
          ...prev,
          blocks: [
            ...prev.blocks,
            {
              ...layoutSection,
              gridSpan: gridColumns,
              content: {
                ...(layoutSection.content as any),
                columns,
              },
            },
          ],
          metadata: {
            ...prev.metadata,
            layoutMode: 'grid' as const,
            gridColumns: 12 as const,
            pageColumnLayout: 'single' as const,
          },
        };
      });

      toast.success(`✅ Layout ${columns} sloupce vložen`);
      return;
    }

    const series = BLOCK_SERIES[seriesKey];
    if (!series || !worksheet) return;

    const makePlaceholderContent = (slot: SeriesSlot): any => {
      if (slot.type === 'heading') return { text: 'Název kapitoly nebo sekce', level: slot.level || 'h2' };
      if (slot.type === 'infobox') return { title: 'Shrnutí', html: '<p>Zde shrňte nejdůležitější poznatky z textu. Uveďte klíčové pojmy, definice nebo závěry, které si mají žáci zapamatovat. Infobox slouží jako rychlý přehled hlavního obsahu sekce.</p>', variant: 'green' as const };
      if (slot.type === 'paragraph') return { html: '<p>Sem vložte hlavní text sekce. Popište téma srozumitelně a přehledně – vysvětlete pojmy, uveďte příklady a propojte látku s tím, co již žáci znají. Text by měl být strukturovaný a přiměřeně dlouhý vzhledem k věku žáků.</p><p>Druhý odstavec může rozvíjet myšlenku dál, přinést doplňující informace nebo uvést konkrétní příklad z praxe. Dbejte na plynulé navazování vět a logickou stavbu celého textu.</p>' };
      if (slot.type === 'gallery') {
        const count = slot.galleryCount ?? 2;
        return {
          url: '', alt: '', caption: '', alignment: 'center' as const, size: 100,
          gallery: Array(count).fill(''),
          galleryLayout: 'grid' as const,
          gridColumns: slot.galleryColumns ?? 1,
        };
      }
      return { url: '', alt: '', caption: '', size: 100, alignment: 'center' as const };
    };

    updateWorksheet(prev => {
      const baseOrder = prev.blocks.length;
      const createBlockFromSlot = (slot: SeriesSlot, order: number): WorksheetBlock => {
        const blockType = (slot.type === 'gallery' ? 'image' : slot.type) as BlockType;
        const block: WorksheetBlock = {
          id: generateBlockId(),
          type: blockType,
          order,
          gridSpan: slot.span,
          width: slot.span < 12 ? 'half' as const : 'full' as const,
          content: makePlaceholderContent(slot),
        } as WorksheetBlock;
        if (slot.level && blockType === 'heading') {
          (block as any).content = { ...(block as any).content, level: slot.level };
        }
        if (slot.type === 'gallery') {
          (block as any).content = {
            url: '', alt: '', caption: '', alignment: 'center' as const, size: 100,
            gallery: Array(slot.galleryCount ?? 2).fill(''),
            galleryLayout: 'grid',
            gridColumns: slot.galleryColumns ?? 1,
          };
        }
        if (slot.columns && blockType === 'paragraph') {
          (block as any).content = { ...(block as any).content, columns: slot.columns };
        }
        return block;
      };

      let newBlocks: WorksheetBlock[];
      if (series.group === 'column') {
        newBlocks = series.slots.map((slot, i) => createBlockFromSlot(slot, baseOrder + i));
      } else {
        const prefixSlots: SeriesSlot[] = [];
        const contentSlots = [...series.slots];
        while (contentSlots.length > 0 && !contentSlots[0].floatSide && (contentSlots[0].span || 12) >= 12) {
          prefixSlots.push(contentSlots.shift()!);
        }

        const prefixBlocks = prefixSlots.map((slot, index) => createBlockFromSlot(slot, baseOrder + index));
        const layoutSection = {
          ...createEmptyBlock('layout-section', baseOrder + prefixBlocks.length),
          gridSpan: prev.metadata.gridColumns || 12,
        } as WorksheetBlock;

        let columns: 2 | 3 = 2;
        let columnRatios: number[] = [50, 50];
        let columnsSlots: SeriesSlot[][] = [[], []];

        if (contentSlots[0]?.floatSide) {
          const anchorSlot = contentSlots[0];
          const anchorSpan = anchorSlot.floatGridSpan ?? anchorSlot.span ?? 6;
          const otherSpan = Math.max(1, 12 - anchorSpan);
          columnRatios = [Math.round((anchorSpan / 12) * 1000) / 10, Math.round((otherSpan / 12) * 1000) / 10];
          if (anchorSlot.floatSide === 'left') {
            columnsSlots = [[anchorSlot], contentSlots.slice(1)];
          } else {
            columnsSlots = [contentSlots.slice(1), [anchorSlot]];
          }
        } else {
          const firstRow: SeriesSlot[] = [];
          let rowSpan = 0;
          for (const slot of contentSlots) {
            const span = slot.span || 12;
            if (rowSpan + span > 12 && firstRow.length > 0) break;
            firstRow.push(slot);
            rowSpan += span;
            if (rowSpan >= 12) break;
          }
          const validRow = firstRow.length >= 2 ? firstRow : contentSlots.slice(0, 2);
          columns = validRow.length === 3 ? 3 : 2;
          columnRatios = validRow.map((slot) => Math.round(((slot.span || 12) / validRow.reduce((sum, item) => sum + (item.span || 12), 0)) * 1000) / 10);
          columnsSlots = validRow.map((slot) => [slot]);
        }

        if (columns === 2 && columnRatios.length !== 2) columnRatios = [50, 50];
        if (columns === 3 && columnRatios.length !== 3) columnRatios = [34, 33, 33];

        const layoutSectionBlock: WorksheetBlock = {
          ...layoutSection,
          content: {
            ...(layoutSection.content as any),
            columns,
            layoutStyle: 'custom',
            columnRatios,
          },
        };

        const sectionId = layoutSectionBlock.id;
        const columnIds: LayoutSectionColumnId[] = columns === 3 ? ['col-1', 'col-2', 'col-3'] : ['col-1', 'col-2'];
        const childBlocks = columnsSlots.flatMap((columnSlots, columnIndex) => (
          columnSlots.map((slot, itemIndex) => ({
            ...createBlockFromSlot(slot, baseOrder + prefixBlocks.length + 1 + columnIndex + itemIndex),
            layoutSectionId: sectionId,
            layoutColumnId: columnIds[columnIndex],
            layoutOrder: itemIndex,
            gridSpan: prev.metadata.gridColumns || 12,
            width: 'full' as const,
            widthPercent: undefined,
            floatSide: undefined,
            floatSpanBlocks: undefined,
            floatGridSpan: undefined,
          }))
        ));

        newBlocks = [...prefixBlocks, layoutSectionBlock, ...childBlocks];
      }

      const allBlocks = [...prev.blocks, ...newBlocks].map((b, i) => ({ ...b, order: i }));
      return {
        ...prev,
        blocks: allBlocks,
        metadata: { ...prev.metadata, layoutMode: 'grid' as const, gridColumns: 12 as const },
      };
    });

    toast.success(`✅ Layout "${series.label}" vložen`);
  }, [worksheet, updateWorksheet]);

  // Block operations - same as basic editor
  const addBlock = useCallback((type: BlockType, afterBlockId?: string) => {
    updateWorksheet(prev => {
      const gridColumns = prev.metadata.gridColumns || 12;
      const defaultGridSpan = Math.ceil(gridColumns / 2); // Default to half width
      const newBlock = { ...createEmptyBlock(type, prev.blocks.length), gridSpan: defaultGridSpan };
      let newBlocks: WorksheetBlock[];
      
      if (afterBlockId) {
        const index = prev.blocks.findIndex(b => b.id === afterBlockId);
        newBlocks = [
          ...prev.blocks.slice(0, index + 1),
          newBlock,
          ...prev.blocks.slice(index + 1),
        ];
      } else {
        newBlocks = [...prev.blocks, newBlock];
      }
      
      newBlocks = newBlocks.map((b, i) => ({ ...b, order: i }));
      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  const insertBlockAtIndex = useCallback((type: BlockType, index: number) => {
    updateWorksheet(prev => {
      const gridColumns = prev.metadata.gridColumns || 12;
      const defaultGridSpan = Math.ceil(gridColumns / 2); // Default to half width
      const safeIndex = Math.max(0, Math.min(index, prev.blocks.length));
      const newBlock = { ...createEmptyBlock(type, safeIndex), gridSpan: defaultGridSpan };
      const newBlocks = [
        ...prev.blocks.slice(0, safeIndex),
        newBlock,
        ...prev.blocks.slice(safeIndex),
      ].map((b, i) => ({ ...b, order: i }));

      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  const confirmInsertBefore = useCallback((targetBlockId: string) => {
    if (!pendingInsertType) return;
    updateWorksheet(prev => {
      const targetIndex = prev.blocks.findIndex(b => b.id === targetBlockId);
      if (targetIndex === -1) return prev;
      
      const gridColumns = prev.metadata.gridColumns || 12;
      const defaultGridSpan = Math.ceil(gridColumns / 2); // Default to half width
      const safeIndex = Math.max(0, targetIndex);
      const newBlock = { ...createEmptyBlock(pendingInsertType, safeIndex), gridSpan: defaultGridSpan };
      const newBlocks = [
        ...prev.blocks.slice(0, safeIndex),
        newBlock,
        ...prev.blocks.slice(safeIndex),
      ].map((b, i) => ({ ...b, order: i }));

      return { ...prev, blocks: newBlocks };
    });
    setPendingInsertType(null);
    setActivePanel('structure');
  }, [pendingInsertType, updateWorksheet]);

  const insertAtEnd = useCallback(() => {
    if (!pendingInsertType) return;
    updateWorksheet(prev => {
      const gridColumns = prev.metadata.gridColumns || 12;
      const defaultGridSpan = Math.ceil(gridColumns / 2); // Default to half width
      const index = prev.blocks.length;
      const newBlock = { ...createEmptyBlock(pendingInsertType, index), gridSpan: defaultGridSpan };
      const newBlocks = [...prev.blocks, newBlock].map((b, i) => ({ ...b, order: i }));
      return { ...prev, blocks: newBlocks };
    });
    setPendingInsertType(null);
    setActivePanel('structure');
  }, [pendingInsertType, updateWorksheet]);

  const cancelInsert = useCallback(() => {
    setPendingInsertType(null);
  }, []);

  const commitTextFlow = useCallback((blockId: string) => {
    updateWorksheet((prev) => {
      const block = prev.blocks.find((b) => b.id === blockId);
      if (!block || !supportsTextFlow(block) || (!hasTextFlowFrame(block) && !isTextFlowLinked(block))) {
        return prev;
      }
      return {
        ...prev,
        blocks: reflowTextFlowChain(prev.blocks, blockId),
      };
    });
  }, [updateWorksheet]);

  const updateTextFlowFrameHeight = useCallback((blockId: string, height?: number, options?: { reflow?: boolean }) => {
    updateWorksheet((prev) => {
      const updatedBlocks = prev.blocks.map((block) => (
        block.id === blockId ? { ...block, textFlowFrameHeight: height } : block
      ));
      const updatedBlock = updatedBlocks.find((block) => block.id === blockId);
      const shouldReflow = options?.reflow ?? true;
      if (!updatedBlock || !supportsTextFlow(updatedBlock)) {
        return { ...prev, blocks: updatedBlocks };
      }
      if (!shouldReflow) {
        return { ...prev, blocks: updatedBlocks };
      }
      if (!height && !isTextFlowLinked(updatedBlock)) {
        return { ...prev, blocks: updatedBlocks };
      }
      return {
        ...prev,
        blocks: reflowTextFlowChain(updatedBlocks, blockId),
      };
    });
  }, [updateWorksheet]);

  const createLinkedTextFlowBlock = useCallback((blockId: string) => {
    let nextSelectedId: string | null = null;
    updateWorksheet((prev) => {
      const result = createTextFlowContinuation(prev.blocks, blockId);
      nextSelectedId = result.newBlockId;
      return { ...prev, blocks: result.blocks };
    });
    if (nextSelectedId) {
      setSelectedBlockId(nextSelectedId);
    }
  }, [updateWorksheet]);

  const splitTextFlowAtCaret = useCallback((blockId: string, charIndex: number, currentHtml?: string) => {
    updateWorksheet((prev) => ({
      ...prev,
      blocks: splitTextFlowAtChar(prev.blocks, blockId, charIndex, currentHtml),
    }));
  }, [updateWorksheet]);

  // Drag and drop handlers
  const handleDragStartFromPanel = useCallback((type: BlockType) => {
    setIsDraggingFromPanel(true);
    setDraggingBlockType(type);
  }, []);

  const handleDragEndFromPanel = useCallback(() => {
    setIsDraggingFromPanel(false);
    setDraggingBlockType(null);
  }, []);

  const handleDropBlock = useCallback((type: BlockType, insertBeforeId: string | null, placement?: LayoutDropPlacement) => {
    updateWorksheet(prev => {
      const gridColumns = prev.metadata.gridColumns || 12;
      const defaultGridSpan = Math.ceil(gridColumns / 2); // Default to half width
      let insertIndex = prev.blocks.length;
      const explicitBeforeId = placement?.insertBeforeId ?? insertBeforeId;

      if (explicitBeforeId) {
        const targetIndex = prev.blocks.findIndex(b => b.id === explicitBeforeId);
        if (targetIndex !== -1) {
          insertIndex = targetIndex;
        }
      } else if (placement?.layoutSectionId) {
        const sectionIndex = prev.blocks.findIndex((block) => block.id === placement.layoutSectionId);
        const layoutBlocks = prev.blocks
          .map((block, index) => ({ block, index }))
          .filter(({ block }) =>
            block.layoutSectionId === placement.layoutSectionId
            && (block.layoutColumnId ?? 'col-1') === placement.layoutColumnId
          );

        if (layoutBlocks.length > 0) {
          insertIndex = layoutBlocks[layoutBlocks.length - 1].index + 1;
        } else if (sectionIndex !== -1) {
          const sectionChildren = prev.blocks
            .map((block, index) => ({ block, index }))
            .filter(({ block }) => block.layoutSectionId === placement.layoutSectionId);
          insertIndex = sectionChildren.length > 0
            ? sectionChildren[sectionChildren.length - 1].index + 1
            : sectionIndex + 1;
        }
      }

      const newBlock = {
        ...createEmptyBlock(type, insertIndex),
        gridSpan: defaultGridSpan,
        ...(placement?.layoutSectionId ? {
          layoutSectionId: placement.layoutSectionId,
          layoutColumnId: placement.layoutColumnId,
        } : {}),
      };
      const newBlocks = [
        ...prev.blocks.slice(0, insertIndex),
        newBlock,
        ...prev.blocks.slice(insertIndex),
      ].map((b, i) => ({ ...b, order: i }));
      
      return { ...prev, blocks: newBlocks };
    });
    
    setIsDraggingFromPanel(false);
    setDraggingBlockType(null);
    // Switch to structure panel after successful drop
    setActivePanel('structure');
  }, [updateWorksheet]);
  
  const deleteBlock = useCallback((blockId: string) => {
    updateWorksheet(prev => {
      const target = prev.blocks.find((b) => b.id === blockId);
      const newBlocks = target && supportsTextFlow(target) && isTextFlowLinked(target)
        ? removeTextFlowBlock(prev.blocks, blockId)
        : removeWorksheetBlock(prev.blocks, blockId);
      return { ...prev, blocks: newBlocks };
    });
    
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  }, [selectedBlockId, updateWorksheet]);
  
  const updateBlock = useCallback((blockId: string, updates: Partial<WorksheetBlock>) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: updateWorksheetBlock(prev.blocks, blockId, (block) => {
        // If updates contains 'content', merge it with existing content
        if (updates.content) {
          return { 
            ...block, 
            ...updates,
            content: { ...block.content, ...updates.content }
          };
        }
        return { ...block, ...updates };
      })
    }));
  }, [updateWorksheet]);

  const applyGroupLayout = useCallback((blockId: string, mode: 'full' | 'half' | 'third') => {
    updateWorksheet((prev) => {
      const blockIndex = prev.blocks.findIndex((block) => block.id === blockId);
      if (blockIndex === -1) return prev;

      const targetBlock = prev.blocks[blockIndex];
      if (targetBlock.type === 'layout-section') return prev;

      let blocks = [...prev.blocks];

      if (mode === 'full') {
        const previousSectionId = targetBlock.layoutSectionId;
        if (!previousSectionId) return prev;
        blocks = blocks
          .filter((block) => block.id !== previousSectionId)
          .map((block) => (
            block.layoutSectionId === previousSectionId
              ? {
                  ...block,
                  layoutSectionId: undefined,
                  layoutColumnId: undefined,
                  layoutOrder: undefined,
                }
              : block
          ));
        return { ...prev, blocks };
      }

      const requestedColumns = mode === 'third' ? 3 : 2;
      const existingSection = targetBlock.layoutSectionId
        ? blocks.find((block) => block.id === targetBlock.layoutSectionId && block.type === 'layout-section')
        : null;
      const existingSectionContent = existingSection && existingSection.type === 'layout-section'
        ? normalizeLayoutSectionContent(existingSection.content)
        : null;
      let targetSectionId = targetBlock.layoutSectionId;

      if (existingSection && existingSectionContent) {
        const validColumnIds: LayoutSectionColumnId[] = requestedColumns === 3 ? ['col-1', 'col-2', 'col-3'] : ['col-1', 'col-2'];
        blocks = blocks.map((block) => {
          if (block.id === existingSection.id && block.type === 'layout-section') {
            const currentContent = normalizeLayoutSectionContent(block.content);
            return {
              ...block,
              content: {
                ...currentContent,
                columns: requestedColumns,
                layoutStyle: requestedColumns === 3
                  ? (currentContent.layoutStyle === 'sidebar-left' || currentContent.layoutStyle === 'sidebar-right' ? 'equal' : currentContent.layoutStyle)
                  : currentContent.layoutStyle,
                columnRatios: requestedColumns === 3
                  ? [34, 33, 33]
                  : currentContent.columns === 3
                    ? [50, 50]
                    : currentContent.columnRatios,
              },
            };
          }

          if (block.layoutSectionId !== existingSection.id) return block;

          const nextColumnId = validColumnIds.includes((block.layoutColumnId ?? 'col-1') as LayoutSectionColumnId)
            ? (block.layoutColumnId as LayoutSectionColumnId)
            : validColumnIds[validColumnIds.length - 1];

          return {
            ...block,
            layoutColumnId: nextColumnId,
            layoutOrder: undefined,
          };
        });
        targetSectionId = existingSection.id;
      } else if (!existingSection || !existingSectionContent || existingSectionContent.columns !== requestedColumns) {
        if (existingSection && siblingBlocks.length === 0) {
          blocks = blocks.map((block) => (
            block.id === existingSection.id && block.type === 'layout-section'
              ? {
                  ...block,
                  content: {
                    ...normalizeLayoutSectionContent(block.content),
                    columns: requestedColumns,
                    layoutStyle: requestedColumns === 3 ? 'equal' : normalizeLayoutSectionContent(block.content).layoutStyle,
                    columnRatios: requestedColumns === 3 ? [34, 33, 33] : [50, 50],
                  },
                }
              : block
          ));
          targetSectionId = existingSection.id;
        } else {
          const layoutSection = createEmptyBlock('layout-section', blockIndex);
          const sectionId = layoutSection.id;
          const gridColumns = prev.metadata.gridColumns || 12;

          blocks = [
            ...blocks.slice(0, blockIndex),
            {
              ...layoutSection,
              gridSpan: gridColumns,
              content: {
                ...(layoutSection.content as any),
                columns: requestedColumns,
                layoutStyle: requestedColumns === 3 ? 'equal' : 'equal',
                columnRatios: requestedColumns === 3 ? [34, 33, 33] : [50, 50],
              },
            },
            ...blocks.slice(blockIndex),
          ];

          targetSectionId = sectionId;
        }
      }

      blocks = blocks.map((block) => (
        block.id === blockId
          ? {
              ...block,
              layoutSectionId: targetSectionId,
              layoutColumnId: 'col-1',
              layoutOrder: 0,
              floatSide: undefined,
            }
          : block
      ));

      return { ...prev, blocks };
    });
  }, [updateWorksheet]);
  
  const updateBlockWidth = useCallback((blockId: string, width: BlockWidth, widthPercent?: number) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: updateWorksheetBlock(prev.blocks, blockId, (block) => ({
        ...block,
        width,
        ...(widthPercent !== undefined && { widthPercent }),
      }))
    }));
  }, [updateWorksheet]);

  const updateBlockMargin = useCallback((blockId: string, marginBottom: number) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: updateWorksheetBlock(prev.blocks, blockId, (block) => ({ ...block, marginBottom }))
    }));
  }, [updateWorksheet]);

  const updateBlockOrder = useCallback((blockId: string, order: number) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: updateWorksheetBlock(prev.blocks, blockId, (block) => ({ ...block, order }))
    }));
  }, [updateWorksheet]);

  const updateBlockMarginStyle = useCallback((blockId: string, marginStyle: 'empty' | 'dotted' | 'lined') => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: updateWorksheetBlock(prev.blocks, blockId, (block) => ({ ...block, marginStyle }))
    }));
  }, [updateWorksheet]);

  const updateBlockImage = useCallback((blockId: string, image: BlockImage | undefined) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: updateWorksheetBlock(prev.blocks, blockId, (block) => ({ ...block, image }))
    }));
  }, [updateWorksheet]);

  const updateBlockVisualStyles = useCallback((blockId: string, visualStyles: any) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: updateWorksheetBlock(prev.blocks, blockId, (block) => ({ ...block, visualStyles }))
    }));
  }, [updateWorksheet]);

  const duplicateBlock = useCallback((blockId: string) => {
    updateWorksheet(prev => {
      return {
        ...prev,
        blocks: duplicateWorksheetBlock(prev.blocks, blockId, {
          transformDuplicate: (block) => ({
            ...block,
            textFlowChainId: undefined,
            textFlowPrevBlockId: undefined,
            textFlowNextBlockId: undefined,
          }),
        }),
      };
    });
  }, [updateWorksheet]);

  // Move block (for drag & drop)
  const moveBlock = useCallback((activeId: string, overId: string) => {
    updateWorksheet(prev => {
      return { ...prev, blocks: moveWorksheetBlock(prev.blocks, activeId, overId) };
    });
  }, [updateWorksheet]);

  const moveBlockUp = useCallback((blockId: string) => {
    updateWorksheet(prev => {
      const currentIndex = prev.blocks.findIndex(b => b.id === blockId);
      if (currentIndex <= 0) return prev;

      const block = prev.blocks[currentIndex];
      if (!block) return prev;

      if (!block.layoutSectionId) {
        const previousBlock = prev.blocks[currentIndex - 1];
        if (previousBlock?.layoutSectionId) {
          const targetSectionId = previousBlock.layoutSectionId;
          const targetColumnId = (previousBlock.layoutColumnId as LayoutSectionColumnId) || 'col-1';
          const withoutBlock = prev.blocks.filter((item) => item.id !== blockId);
          const targetItems = withoutBlock
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.layoutSectionId === targetSectionId && (item.layoutColumnId ?? 'col-1') === targetColumnId);
          const insertIndex = targetItems.length > 0
            ? targetItems[targetItems.length - 1].index + 1
            : Math.max(0, withoutBlock.findIndex((item) => item.id === targetSectionId) + 1);

          const movedBlock: WorksheetBlock = {
            ...block,
            layoutSectionId: targetSectionId,
            layoutColumnId: targetColumnId,
            layoutOrder: undefined,
            floatSide: undefined,
          };

          const newBlocks = [
            ...withoutBlock.slice(0, insertIndex),
            movedBlock,
            ...withoutBlock.slice(insertIndex),
          ];
          return { ...prev, blocks: newBlocks };
        }
      }

      if (block.layoutSectionId) {
        const section = prev.blocks.find((item) => item.id === block.layoutSectionId && item.type === 'layout-section');
        if (!section || section.type !== 'layout-section') return prev;
        const sectionContent = normalizeLayoutSectionContent(section.content);
        const columnIds: LayoutSectionColumnId[] = sectionContent.columns === 3 ? ['col-1', 'col-2', 'col-3'] : ['col-1', 'col-2'];
        const currentColumnId = (block.layoutColumnId as LayoutSectionColumnId) || 'col-1';
        const currentColumnIndex = columnIds.indexOf(currentColumnId);
        const currentColumnItems = prev.blocks.filter((item) => item.layoutSectionId === block.layoutSectionId && (item.layoutColumnId ?? 'col-1') === currentColumnId);
        const currentItemIndex = currentColumnItems.findIndex((item) => item.id === block.id);

        if (currentItemIndex <= 0) {
          if (currentColumnIndex > 0) {
            const previousColumnId = columnIds[currentColumnIndex - 1];
            const withoutBlock = prev.blocks.filter((item) => item.id !== block.id);
            const targetItems = withoutBlock
              .map((item, index) => ({ item, index }))
              .filter(({ item }) => item.layoutSectionId === block.layoutSectionId && (item.layoutColumnId ?? 'col-1') === previousColumnId);
            const insertIndex = targetItems.length > 0
              ? targetItems[targetItems.length - 1].index + 1
              : Math.max(0, withoutBlock.findIndex((item) => item.id === block.layoutSectionId) + 1);
            const movedBlock: WorksheetBlock = { ...block, layoutColumnId: previousColumnId, layoutOrder: undefined };
            const newBlocks = [
              ...withoutBlock.slice(0, insertIndex),
              movedBlock,
              ...withoutBlock.slice(insertIndex),
            ];
            return { ...prev, blocks: newBlocks };
          }

          const withoutBlock = prev.blocks.filter((item) => item.id !== block.id);
          const sectionIndex = withoutBlock.findIndex((item) => item.id === block.layoutSectionId);
          const movedBlock: WorksheetBlock = {
            ...block,
            layoutSectionId: undefined,
            layoutColumnId: undefined,
            layoutOrder: undefined,
          };
          const insertIndex = Math.max(0, sectionIndex);
          let newBlocks = [
            ...withoutBlock.slice(0, insertIndex),
            movedBlock,
            ...withoutBlock.slice(insertIndex),
          ];
          const remainingChildren = newBlocks.filter((item) => item.layoutSectionId === block.layoutSectionId);
          if (remainingChildren.length === 0) {
            newBlocks = newBlocks.filter((item) => item.id !== block.layoutSectionId);
          }
          return { ...prev, blocks: newBlocks };
        }
      }

      const sameLane = (candidate: WorksheetBlock) => {
        if (block.layoutSectionId) {
          return candidate.layoutSectionId === block.layoutSectionId
            && (candidate.layoutColumnId ?? 'col-1') === (block.layoutColumnId ?? 'col-1');
        }
        return !candidate.layoutSectionId && (candidate.columnAssignment ?? 'A') === (block.columnAssignment ?? 'A');
      };

      // Find the nearest preceding block in the SAME column (skip blocks from other columns).
      // In single-col mode all blocks default to 'A' so behaviour is identical to before.
      let targetIndex = currentIndex - 1;
      while (targetIndex >= 0 && !sameLane(prev.blocks[targetIndex])) {
        targetIndex--;
      }
      if (targetIndex < 0) return prev;

      // Swap the two blocks in place
      const newBlocks = [...prev.blocks];
      [newBlocks[targetIndex], newBlocks[currentIndex]] = [newBlocks[currentIndex], newBlocks[targetIndex]];
      return { ...prev, blocks: newBlocks.map((b, i) => ({ ...b, order: i })) };
    });
  }, [updateWorksheet]);

  const moveBlockDown = useCallback((blockId: string) => {
    updateWorksheet(prev => {
      const currentIndex = prev.blocks.findIndex(b => b.id === blockId);
      if (currentIndex === -1 || currentIndex >= prev.blocks.length - 1) return prev;

      const block = prev.blocks[currentIndex];
      if (!block) return prev;

      if (!block.layoutSectionId) {
        const nextBlock = prev.blocks[currentIndex + 1];
        if (nextBlock?.type === 'layout-section') {
          const targetSectionId = nextBlock.id;
          const targetColumnId: LayoutSectionColumnId = 'col-1';
          const withoutBlock = prev.blocks.filter((item) => item.id !== blockId);
          const sectionIndex = withoutBlock.findIndex((item) => item.id === targetSectionId);
          const insertIndex = Math.max(0, sectionIndex + 1);
          const movedBlock: WorksheetBlock = {
            ...block,
            layoutSectionId: targetSectionId,
            layoutColumnId: targetColumnId,
            layoutOrder: undefined,
            floatSide: undefined,
          };
          const newBlocks = [
            ...withoutBlock.slice(0, insertIndex),
            movedBlock,
            ...withoutBlock.slice(insertIndex),
          ];
          return { ...prev, blocks: newBlocks };
        }
      }

      if (block.layoutSectionId) {
        const section = prev.blocks.find((item) => item.id === block.layoutSectionId && item.type === 'layout-section');
        if (!section || section.type !== 'layout-section') return prev;
        const sectionContent = normalizeLayoutSectionContent(section.content);
        const columnIds: LayoutSectionColumnId[] = sectionContent.columns === 3 ? ['col-1', 'col-2', 'col-3'] : ['col-1', 'col-2'];
        const currentColumnId = (block.layoutColumnId as LayoutSectionColumnId) || 'col-1';
        const currentColumnIndex = columnIds.indexOf(currentColumnId);
        const currentColumnItems = prev.blocks.filter((item) => item.layoutSectionId === block.layoutSectionId && (item.layoutColumnId ?? 'col-1') === currentColumnId);
        const currentItemIndex = currentColumnItems.findIndex((item) => item.id === block.id);

        if (currentItemIndex === currentColumnItems.length - 1) {
          if (currentColumnIndex < columnIds.length - 1) {
            const nextColumnId = columnIds[currentColumnIndex + 1];
            const withoutBlock = prev.blocks.filter((item) => item.id !== block.id);
            const targetItems = withoutBlock
              .map((item, index) => ({ item, index }))
              .filter(({ item }) => item.layoutSectionId === block.layoutSectionId && (item.layoutColumnId ?? 'col-1') === nextColumnId);
            const insertIndex = targetItems.length > 0
              ? targetItems[0].index
              : withoutBlock
                  .map((item, index) => ({ item, index }))
                  .filter(({ item }) => item.layoutSectionId === block.layoutSectionId)
                  .slice(-1)[0]?.index + 1 || withoutBlock.length;
            const movedBlock: WorksheetBlock = { ...block, layoutColumnId: nextColumnId, layoutOrder: undefined };
            const newBlocks = [
              ...withoutBlock.slice(0, insertIndex),
              movedBlock,
              ...withoutBlock.slice(insertIndex),
            ];
            return { ...prev, blocks: newBlocks };
          }

          const withoutBlock = prev.blocks.filter((item) => item.id !== block.id);
          const sectionChildren = withoutBlock
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.layoutSectionId === block.layoutSectionId);
          const insertIndex = (sectionChildren[sectionChildren.length - 1]?.index ?? withoutBlock.findIndex((item) => item.id === block.layoutSectionId)) + 1;
          const movedBlock: WorksheetBlock = {
            ...block,
            layoutSectionId: undefined,
            layoutColumnId: undefined,
            layoutOrder: undefined,
          };
          let newBlocks = [
            ...withoutBlock.slice(0, insertIndex),
            movedBlock,
            ...withoutBlock.slice(insertIndex),
          ];
          const remainingChildren = newBlocks.filter((item) => item.layoutSectionId === block.layoutSectionId);
          if (remainingChildren.length === 0) {
            newBlocks = newBlocks.filter((item) => item.id !== block.layoutSectionId);
          }
          return { ...prev, blocks: newBlocks };
        }
      }

      const sameLane = (candidate: WorksheetBlock) => {
        if (block.layoutSectionId) {
          return candidate.layoutSectionId === block.layoutSectionId
            && (candidate.layoutColumnId ?? 'col-1') === (block.layoutColumnId ?? 'col-1');
        }
        return !candidate.layoutSectionId && (candidate.columnAssignment ?? 'A') === (block.columnAssignment ?? 'A');
      };

      // Find the nearest following block in the SAME column.
      let targetIndex = currentIndex + 1;
      while (targetIndex < prev.blocks.length && !sameLane(prev.blocks[targetIndex])) {
        targetIndex++;
      }
      if (targetIndex >= prev.blocks.length) return prev;

      const newBlocks = [...prev.blocks];
      [newBlocks[currentIndex], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[currentIndex]];
      return { ...prev, blocks: newBlocks.map((b, i) => ({ ...b, order: i })) };
    });
  }, [updateWorksheet]);

  const moveBlockAcrossLayout = useCallback((blockId: string, direction: -1 | 1) => {
    updateWorksheet((prev) => {
      const blockIndex = prev.blocks.findIndex((item) => item.id === blockId);
      const block = blockIndex >= 0 ? prev.blocks[blockIndex] : null;
      if (!block?.layoutSectionId) return prev;

      const section = prev.blocks.find((item) => item.id === block.layoutSectionId && item.type === 'layout-section');
      if (!section || section.type !== 'layout-section') return prev;

      const sectionContent = normalizeLayoutSectionContent(section.content);
      const columnIds: LayoutSectionColumnId[] = sectionContent.columns === 3 ? ['col-1', 'col-2', 'col-3'] : ['col-1', 'col-2'];
      const currentColumnId = (block.layoutColumnId as LayoutSectionColumnId) || 'col-1';
      const currentIndex = columnIds.indexOf(currentColumnId);
      if (currentIndex === -1) return prev;

      const targetColumnId = columnIds[currentIndex + direction];
      if (!targetColumnId) return prev;

      const withoutBlock = prev.blocks.filter((item) => item.id !== blockId);
      const targetColumnItems = withoutBlock
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.layoutSectionId === block.layoutSectionId && (item.layoutColumnId ?? 'col-1') === targetColumnId);

      const insertIndex = targetColumnItems.length > 0
        ? targetColumnItems[targetColumnItems.length - 1].index + 1
        : (withoutBlock
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.layoutSectionId === block.layoutSectionId)
            .slice(-1)[0]?.index ?? withoutBlock.findIndex((item) => item.id === block.layoutSectionId)) + 1;

      const movedBlock: WorksheetBlock = {
        ...block,
        layoutColumnId: targetColumnId,
        layoutOrder: undefined,
      };

      const newBlocks = [
        ...withoutBlock.slice(0, insertIndex),
        movedBlock,
        ...withoutBlock.slice(insertIndex),
      ];

      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  // Drag & Drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      moveBlock(active.id as string, over.id as string);
    }
  }, [moveBlock]);

  // Block selection
  const handleSelectBlock = useCallback((blockId: string | null) => {
    setForceAIOpen(false);
    if (blockId === null) {
      // Click on canvas background → clear both selection and panel
      setSelectedBlockId(null);
      setIsBlockSettingsOpen(false);
    } else {
      setSelectedBlockId(blockId);
      // Re-open block settings panel (covers case where panel was closed via panel switch)
      setIsBlockSettingsOpen(true);
    }
  }, []);

  const handleCloseBlockSettings = useCallback(() => {
    // X button = explicit dismiss → clear selection entirely
    setIsBlockSettingsOpen(false);
    setSelectedBlockId(null);
    setForceAIOpen(false);
  }, []);

  // Switching panels (mini sidebar) → close block settings panel but KEEP selectedBlockId
  // so the export panel still knows which block is selected
  const handlePanelChange = useCallback((panel: ProActivePanel) => {
    setActivePanel(panel);
    setIsBlockSettingsOpen(false);
  }, []);

  // Apply design system defaults to the current worksheet (non-retroactive)
  const handleApplyDesignSystem = useCallback((ds: DesignSystem) => {
    updateWorksheet(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          pageBackgroundColor: ds.pageDefaults.pageBackgroundColor,
          gridColumns: ds.pageDefaults.gridColumns,
          gridGap: ds.pageDefaults.gridGap,
          globalFontSize: ds.typography.baseFontSize,
          designSystemId: ds.id,
          designFonts: { heading: ds.typography.headingFont, body: ds.typography.bodyFont },
        },
      }));
  }, [updateWorksheet]);

  // Export handlers
  /** Returns a worksheet scoped to just the selected block (or full worksheet if nothing selected) */
  const getExportWorksheet = useCallback(() => {
    if (!worksheet) return null;
    if (!selectedBlockId) return worksheet;
    const block = worksheet.blocks.find(b => b.id === selectedBlockId);
    if (!block) return worksheet;
    return { ...worksheet, blocks: [{ ...block, order: 0 }] };
  }, [worksheet, selectedBlockId]);

  /** Capture multiple consecutive blocks as one combined HTML string.
   *  Used for mergeWithNext groups — returns a vertical stack of all blocks. */
  const captureBlockGroupHtml = useCallback((blockIds: string[]): string | null => {
    let maxWidth = 0;
    const parts: string[] = [];

    for (const blockId of blockIds) {
      const el = document.querySelector(`[data-block-id="${blockId}"]`);
      if (!el) continue;
      const w = Math.round((el as HTMLElement).getBoundingClientRect().width);
      if (w > maxWidth) maxWidth = w;
      const clone = el.cloneNode(true) as HTMLElement;

      clone.querySelectorAll('[class*="print:"]').forEach(n => n.remove());
      clone.querySelectorAll([
        '[data-editor-only]', '[data-block-resize-handle]',
        '[class*="cursor-row-resize"]', '[class*="cursor-col-resize"]',
        '[class*="cursor-ew-resize"]', '[class*="cursor-ns-resize"]',
      ].join(', ')).forEach(n => n.remove());
      clone.querySelectorAll([
        'button', 'input', 'textarea', 'select',
        '[data-toolbar-element]', '[data-toolbar-for-block]',
        '.worksheet-text-toolbar', '[contenteditable]',
      ].join(', ')).forEach(n => n.remove());

      const selectionPatterns = [
        /^ring-\d+$/, /^ring-blue-/, /^ring-indigo-/, /^ring-offset-/,
        /^bg-blue-\d+\//, /^bg-indigo-\d+\//, /^bg-blue-50/,
        /^outline-/, /^focus:ring-/,
      ];
      [clone, ...Array.from(clone.querySelectorAll('*'))].forEach(node => {
        const el = node as HTMLElement;
        if (!el.className || typeof el.className !== 'string') return;
        const parts = el.className.split(/\s+/).filter(c => !selectionPatterns.some(p => p.test(c)));
        el.className = parts.join(' ');
      });

      if (clone.innerHTML.trim()) parts.push(clone.outerHTML);
    }

    if (parts.length === 0) return null;
    const inner = parts.join('\n');
    return `<div data-capture-width="${maxWidth}" style="width:${maxWidth}px;font-family:inherit;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;">${inner}</div>`;
  }, []);

  /** Capture and clean DOM HTML for a block — strips ALL editor-only elements.
   *  Wraps the result in a root div with data-capture-width so ScaledHtmlBlock
   *  knows the natural rendered width and can scale correctly. */
  const captureBlockHtml = useCallback((blockId: string): string | null => {
    const el = document.querySelector(`[data-block-id="${blockId}"]`);
    if (!el) return null;
    // Measure actual rendered width BEFORE cloning
    const captureWidth = Math.round((el as HTMLElement).getBoundingClientRect().width);
    const clone = el.cloneNode(true) as HTMLElement;

    // 1. Remove ALL elements that carry Tailwind's print:hidden / print:block etc.
    //    These are EXCLUSIVELY editor UI overlays (selection border, resize pills, toolbars).
    clone.querySelectorAll('[class*="print:"]').forEach(n => n.remove());

    // 2. Remove drag/resize handles by cursor class and data attribute
    clone.querySelectorAll([
      '[data-editor-only]',
      '[data-block-resize-handle]',
      '[class*="cursor-row-resize"]',
      '[class*="cursor-col-resize"]',
      '[class*="cursor-ew-resize"]',
      '[class*="cursor-ns-resize"]',
    ].join(', ')).forEach(n => n.remove());

    // 3. Remove interactive form elements and editor toolbars
    clone.querySelectorAll([
      'button', 'input', 'textarea', 'select',
      '[data-toolbar-element]', '[data-toolbar-for-block]',
      '.worksheet-text-toolbar', '[contenteditable]',
    ].join(', ')).forEach(n => n.remove());

    // 4. Strip selection state classes (ring-*, bg-blue-*) from ALL elements
    //    so no selection highlight bleeds into the snapshot
    const selectionPatterns = [
      /^ring-\d+$/, /^ring-blue-/, /^ring-indigo-/, /^ring-offset-/,
      /^bg-blue-\d+\//, /^bg-indigo-\d+\//, /^bg-blue-50/,
      /^outline-/, /^focus:ring-/,
    ];
    [clone, ...Array.from(clone.querySelectorAll('*'))].forEach(node => {
      const el = node as HTMLElement;
      if (!el.className || typeof el.className !== 'string') return;
      const parts = el.className.split(/\s+/).filter(c => !selectionPatterns.some(p => p.test(c)));
      el.className = parts.join(' ');
    });

    const innerHtml = clone.innerHTML;
    if (!innerHtml.trim()) return null;

    // Wrap with metadata: actual capture width for ScaledHtmlBlock scaling
    return `<div data-capture-width="${captureWidth}" style="width:${captureWidth}px;font-family:inherit;box-sizing:border-box;">${innerHtml}</div>`;
  }, []);

  /**
   * Main 1:1 export handler.
   * Receives a map of blockId → mode ('single' | 'each' | 'html').
   * Empty map means export everything with default 'single' mode.
   */
  const handleExport1to1 = useCallback(async (blockModes: Record<string, SubQuestionsExportMode | 'html'>) => {
    if (!worksheet || isExportingToBoard) return;
    const source = getExportWorksheet();
    if (!source) return;
    setIsExportingToBoard(true);
    try {
      // Separate html-capture blocks from subq-mode blocks
      const htmlCaptures: Record<string, string> = {};
      const blockSubqModes: Record<string, SubQuestionsExportMode> = {};

      for (const [blockId, mode] of Object.entries(blockModes)) {
        if (mode === 'html') {
          const html = captureBlockHtml(blockId);
          if (html) {
            htmlCaptures[blockId] = html;
          } else {
            toast.error(`Nepodařilo se zachytit HTML bloku. Je blok viditelný na plátně?`);
          }
        } else {
          blockSubqModes[blockId] = mode;
        }
      }

      const { quiz, blockIdToSlideIndex } = worksheetToBoard(source, { blockSubqModes, htmlCaptures });
      const suffix = selectedBlockId ? '(blok)' : '(Vividboard)';
      quiz.title = `${worksheet.title} ${suffix}`;

      // ── Build worksheetMap (Osnova) ─────────────────────────────────────────
      // Only for full-worksheet exports (not single block)
      if (!selectedBlockId) {
        try {
          const pageEls = Array.from(document.querySelectorAll<HTMLElement>('.worksheet-a4-page'));
          if (pageEls.length > 0) {
            const REGION_COLORS = [
              '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
              '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
            ];

            const mapPages: import('../../types/quiz').WorksheetMapPage[] = [];
            let colorIdx = 0;

            for (let pi = 0; pi < pageEls.length; pi++) {
              const pageEl = pageEls[pi];
              const pageRect = pageEl.getBoundingClientRect();

              const blockEls = Array.from(pageEl.querySelectorAll<HTMLElement>('[data-block-id]'));
              const regions: import('../../types/quiz').WorksheetMapRegion[] = [];

              for (const blockEl of blockEls) {
                const blockId = blockEl.getAttribute('data-block-id');
                if (!blockId) continue;
                const slideIndex = blockIdToSlideIndex[blockId];
                if (slideIndex === undefined) continue;

                const blockRect = blockEl.getBoundingClientRect();
                const xPct = ((blockRect.left - pageRect.left) / pageRect.width) * 100;
                const yPct = ((blockRect.top - pageRect.top) / pageRect.height) * 100;
                const wPct = (blockRect.width / pageRect.width) * 100;
                const hPct = (blockRect.height / pageRect.height) * 100;

                if (xPct < -5 || yPct < -5 || xPct > 105 || yPct > 105) continue;

                const color = REGION_COLORS[colorIdx % REGION_COLORS.length];
                colorIdx++;
                regions.push({
                  slideIndex,
                  xPct: Math.max(0, xPct),
                  yPct: Math.max(0, yPct),
                  wPct: Math.min(100 - Math.max(0, xPct), wPct),
                  hPct: Math.min(100 - Math.max(0, yPct), hPct),
                  color,
                });
              }

              // Thumbnails are generated async via Browserless AFTER the quiz
              // is saved — we kick it off below and update the quiz in storage.
              mapPages.push({ thumbnailUrl: '', pageNumber: String(pi + 1), regions });
            }

            if (mapPages.length > 0) {
              quiz.worksheetMap = { pages: mapPages };
            }

            // Save the quiz first so navigate doesn't race the thumbnail gen.
            saveQuiz(quiz);

            // Fire-and-forget: generate thumbnails via Browserless → Storage.
            generateWorksheetThumbnails(source, pageEls.length).then(({ thumbnailUrls }) => {
              if (!quiz.worksheetMap) return;
              quiz.worksheetMap = {
                pages: quiz.worksheetMap.pages.map((p, i) => ({
                  ...p,
                  thumbnailUrl: thumbnailUrls[i] ?? '',
                })),
              };
              saveQuiz(quiz);
            }).catch((e) => console.warn('[osnova] thumbnail upload failed', e));

            // Skip the saveQuiz call below (already done above)
            toast.success(`Vividboard "${quiz.title}" vytvořen! Otevírám editor...`);
            navigate(`/quiz/edit/${quiz.id}`);
            return;
          }
        } catch (e) {
          console.warn('[osnova] worksheetMap generation failed', e);
        }
      }

      saveQuiz(quiz);
      toast.success(`Vividboard "${quiz.title}" vytvořen! Otevírám editor...`);
      navigate(`/quiz/edit/${quiz.id}`);
    } catch (err) {
      console.error('[export 1:1]', err);
      toast.error('Nepodařilo se exportovat.');
    } finally {
      setIsExportingToBoard(false);
    }
  }, [worksheet, selectedBlockId, isExportingToBoard, navigate, getExportWorksheet, captureBlockHtml]);

  const handleExportTest = useCallback(async () => {
    if (!worksheet || isExportingToBoard) return;
    const source = getExportWorksheet();
    if (!source) return;
    setIsExportingToBoard(true);
    try {
      const { quiz } = worksheetToBoard(source);
      const suffix = selectedBlockId ? '– Test (blok)' : '– Test';
      quiz.title = `${worksheet.title} ${suffix}`;
      saveQuiz(quiz);
      toast.success(`Test "${quiz.title}" vytvořen! Otevírám editor...`);
      navigate(`/quiz/edit/${quiz.id}`);
    } catch (err) {
      console.error('[export test]', err);
      toast.error('Nepodařilo se vytvořit test.');
    } finally {
      setIsExportingToBoard(false);
    }
  }, [worksheet, selectedBlockId, isExportingToBoard, navigate, getExportWorksheet]);

  const handleExportPisemka = useCallback(async () => {
    if (!worksheet || isExportingToBoard) return;
    const source = getExportWorksheet();
    if (!source) return;
    setIsExportingToBoard(true);
    try {
      const { quiz } = worksheetToBoard(source);
      const suffix = selectedBlockId ? '– Písemka (blok)' : '– Písemka';
      quiz.title = `${worksheet.title} ${suffix}`;
      saveQuiz(quiz);
      toast.success(`Písemka "${quiz.title}" vytvořena! Otevírám editor...`);
      navigate(`/quiz/edit/${quiz.id}`);
    } catch (err) {
      console.error('[export písemka]', err);
      toast.error('Nepodařilo se vytvořit písemku.');
    } finally {
      setIsExportingToBoard(false);
    }
  }, [worksheet, selectedBlockId, isExportingToBoard, navigate, getExportWorksheet]);

  const handleCreatePresentation = useCallback(async (themeId: string) => {
    if (!worksheet || isExportingToBoard) return;
    const source = getExportWorksheet();
    if (!source) return;
    setIsExportingToBoard(true);
    try {
      const quiz = worksheetToPresentation(source, themeId);
      if (selectedBlockId) quiz.title = `${worksheet.title} – Prezentace (blok)`;
      saveQuiz(quiz);
      toast.success(`Prezentace "${quiz.title}" vytvořena! Otevírám editor...`);
      navigate(`/quiz/edit/${quiz.id}`);
    } catch (err) {
      console.error('[presentation] conversion error', err);
      toast.error('Nepodařilo se vytvořit prezentaci.');
    } finally {
      setIsExportingToBoard(false);
    }
  }, [worksheet, selectedBlockId, isExportingToBoard, navigate, getExportWorksheet]);

  // ── Dedicated board sync ────────────────────────────────────────────────────
  const handleSyncBoard = useCallback(async () => {
    if (!worksheet || isSyncingBoard) return;
    setIsSyncingBoard(true);
    try {
      const REGION_COLORS = [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
      ];

      // 1. Pre-capture HTML only for free-answer blocks with subQuestionsMode === 'html'
      //    Merge groups (mergeWithNext) are handled entirely in worksheetToBoard — no DOM needed.
      const htmlCaptures: Record<string, string> = {};
      for (const block of worksheet.blocks ?? []) {
        if (block.boardSettings?.subQuestionsMode === 'html' && !block.boardSettings?.skip) {
          const html = captureBlockHtml(block.id);
          if (html) {
            htmlCaptures[block.id] = html;
          } else {
            console.warn('[sync-board] captureBlockHtml returned null for block', block.id);
          }
        }
      }

      // 2a. Compute slide mapping — merge chains resolved inside worksheetToBoard
      const { blockIdToSlideIndex } = worksheetToBoard(worksheet, { useBoardSettings: true, htmlCaptures });

      // Load existing board to preserve thumbnail URLs during sync
      const existingBoard = worksheet.linkedBoardId ? getQuiz(worksheet.linkedBoardId) : null;

      // 2b. Build regions from the LIVE editor DOM
      const pageEls = Array.from(document.querySelectorAll<HTMLElement>('.worksheet-a4-page'));
      const mapPages: import('../../types/quiz').WorksheetMapPage[] = [];
      let colorIdx = 0;

      for (let pi = 0; pi < pageEls.length; pi++) {
        const pageEl = pageEls[pi];
        const pageRect = pageEl.getBoundingClientRect();
        const blockEls = Array.from(pageEl.querySelectorAll<HTMLElement>('[data-block-id]'));
        const regions: import('../../types/quiz').WorksheetMapRegion[] = [];

        for (const blockEl of blockEls) {
          const blockId = blockEl.getAttribute('data-block-id');
          if (!blockId) continue;
          const slideIndex = blockIdToSlideIndex[blockId];
          if (slideIndex === undefined) continue;
          const blockRect = blockEl.getBoundingClientRect();
          const xPct = ((blockRect.left - pageRect.left) / pageRect.width) * 100;
          const yPct = ((blockRect.top - pageRect.top) / pageRect.height) * 100;
          const wPct = (blockRect.width / pageRect.width) * 100;
          const hPct = (blockRect.height / pageRect.height) * 100;
          if (xPct < -5 || yPct < -5 || xPct > 105 || yPct > 105) continue;
          const color = REGION_COLORS[colorIdx % REGION_COLORS.length];
          colorIdx++;
          regions.push({
            slideIndex,
            xPct: Math.max(0, xPct), yPct: Math.max(0, yPct),
            wPct: Math.min(100 - Math.max(0, xPct), wPct),
            hPct: Math.min(100 - Math.max(0, yPct), hPct),
            color,
          });
        }
        // Preserve existing thumbnail URL so sync doesn't erase previously generated images
        const existingThumb = existingBoard?.worksheetMap?.pages[pi]?.thumbnailUrl ?? '';
        mapPages.push({ thumbnailUrl: existingThumb, pageNumber: String(pi + 1), regions });
      }

      // 3. Save board immediately → instant success feedback
      //    Pass htmlCaptures so syncWorksheetToBoard → worksheetToBoard uses them.
      const worksheetMapData = mapPages.length > 0 ? { pages: mapPages } : undefined;
      const { quiz, created } = await syncWorksheetToBoard(
        worksheet,
        (updated) => updateWorksheet(() => updated),
        worksheetMapData,
        htmlCaptures,
      );

      toast.success(
        created
          ? `Board "${quiz.title}" vytvořen! Miniatury se generují na pozadí…`
          : `Board synchronizován ✓`,
      );

      // 4. Fire-and-forget thumbnail generation — only when there are missing thumbnails
      //    (new board, or pages with no URL yet). Existing thumbnails are preserved above.
      const hasMissingThumbnails = quiz.worksheetMap?.pages?.some(p => !p.thumbnailUrl);
      if (hasMissingThumbnails) {
        generateWorksheetThumbnails(worksheet, pageEls.length || 1)
          .then(({ thumbnailUrls }) => {
            if (!quiz.worksheetMap) return;
            quiz.worksheetMap = {
              pages: quiz.worksheetMap.pages.map((p, i) => ({
                ...p,
                thumbnailUrl: thumbnailUrls[i] ?? p.thumbnailUrl,
              })),
            };
            saveQuiz(quiz);
            window.dispatchEvent(new CustomEvent('quiz-thumbnails-updated', { detail: { quizId: quiz.id } }));
            toast.success('Miniatury stránek byly vygenerovány ✓');
          })
          .catch((e) => {
            console.warn('[sync-board] thumbnail generation failed:', e);
            toast.error('Miniatury se nepodařilo vygenerovat. Zkuste tlačítko "Miniatury".');
          });
      }

    } catch (err) {
      console.error('[sync-board]', err);
      toast.error('Synchronizace se nezdařila.');
    } finally {
      setIsSyncingBoard(false);
    }
  }, [worksheet, isSyncingBoard]);

  // ── Regenerate thumbnails only ────────────────────────────────────────────
  const handleRegenerateThumbnails = useCallback(async () => {
    if (!worksheet?.linkedBoardId || isRegeneratingThumbnails) return;
    const quiz = getQuiz(worksheet.linkedBoardId);
    if (!quiz) { toast.error('Board nenalezen.'); return; }

    setIsRegeneratingThumbnails(true);
    const pageEls = document.querySelectorAll<HTMLElement>('.worksheet-a4-page');
    const pageCount = pageEls.length || 1;

    generateWorksheetThumbnails(worksheet, pageCount)
      .then(({ thumbnailUrls }) => {
        if (!quiz.worksheetMap) return;
        quiz.worksheetMap = {
          pages: quiz.worksheetMap.pages.map((p, i) => ({
            ...p,
            thumbnailUrl: thumbnailUrls[i] ?? p.thumbnailUrl,
          })),
        };
        saveQuiz(quiz);
        window.dispatchEvent(new CustomEvent('quiz-thumbnails-updated', { detail: { quizId: quiz.id } }));
        toast.success('Miniatury byly přegenerovány ✓');
      })
      .catch((e) => {
        console.error('[regenerate-thumbnails]', e);
        toast.error('Přegenerování miniatur selhalo.');
      })
      .finally(() => setIsRegeneratingThumbnails(false));
  }, [worksheet, isRegeneratingThumbnails]);

  const leaveProEditor = useCallback((destination: string, options?: { regenerateThumbnails?: boolean }) => {
    if (saveStatus === 'saving') {
      toast.warning('Počkejte, probíhá ukládání…');
      return;
    }

    const ws = saveIfPendingChanges() ?? worksheet;
    if (import.meta.env.DEV) {
      console.log('[ProEditorBack]', {
        workbookId,
        worksheetId: ws?.id ?? null,
        updatedAt: ws?.updatedAt ?? null,
        isDirty,
        pageCount: ws?.metadata?.pageCount ?? null,
      });
    }

    // Fire-and-forget thumbnail generation so the workbook view gets fresh previews
    if (ws && options?.regenerateThumbnails) {
      const pageEls = document.querySelectorAll<HTMLElement>('.worksheet-a4-page');
      const pageCount = pageEls.length || ws.metadata?.pageCount || 1;
      generateWorksheetThumbnails(ws, pageCount).catch(() => {
        // Non-critical — silently ignore thumbnail errors on back navigation
      });
    }

    navigate(destination);
  }, [saveIfPendingChanges, saveStatus, worksheet, navigate, workbookId, isDirty]);

  const handleBack = useCallback(() => {
    leaveProEditor(workbookId ? laioutBookEditorPath(workbookId) : LAIOUT_BOOKSHELF_PATH, {
      regenerateThumbnails: true,
    });
  }, [leaveProEditor, workbookId]);

  /** V kapitole uvnitř knihy: logo = zpět do knihy (jinak přepínač módů). Blokace při ukládání řeší leaveProEditor + toast. */
  const handleLogoClick = useCallback(() => {
    if (appMode === 'chapter' && workbookId) {
      leaveProEditor(laioutBookEditorPath(workbookId), { regenerateThumbnails: true });
      return;
    }
    setShowModeOverlay((o) => !o);
  }, [appMode, workbookId, leaveProEditor]);

  // Set hovered block (no scroll - scroll only from sidebar)
  const handleHoverBlock = useCallback((blockId: string | null) => {
    setHoveredBlockId(blockId);
  }, []);

  // Get selected block
  const selectedBlock = worksheet?.blocks.find(b => b.id === selectedBlockId);
  
  if (!worksheet) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }
  
  return (
    <div className="h-screen bg-slate-100 flex overflow-hidden worksheet-editor-pro">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex overflow-hidden relative worksheet-editor-main">

          {/* Mini Sidebar - always visible */}
          <ProMiniSidebar
            activePanel={activePanel}
            onPanelChange={handlePanelChange}
            saveStatus={saveStatus}
            hasUnsavedVersions={versionHistory.hasUnsavedChanges}
            workbookId={workbookId}
            onPrint={(opts) => {
              if (worksheet) handleExport(worksheet, opts);
            }}
            appMode={appMode}
            logoBackToBook={appMode === 'chapter' && Boolean(workbookId)}
            onLogoClick={handleLogoClick}
          />
          
          {/* Mode switcher — fixed overlay covering mini sidebar + panel */}
          {showModeOverlay && (
            <ModeSwitcher
              onClose={() => setShowModeOverlay(false)}
              contextLabel="Aktuální list"
              contextValue={worksheet?.title}
              options={[
                { id: 'library', emoji: '🏠', label: 'Knihovna',   desc: 'Přehled všech knih',                  isActive: false,                 onSelect: () => { leaveProEditor(LAIOUT_BOOKSHELF_PATH); setShowModeOverlay(false); } },
                { id: 'dataset', emoji: '📊', label: 'Data set',   desc: 'Zdrojové texty a obrázky pro AI',     isActive: appMode === 'dataset', onSelect: () => { setAppMode('dataset'); setShowModeOverlay(false); } },
                { id: 'book',    emoji: '📚', label: 'Celá kniha', desc: 'Přehled kapitol a stran',             isActive: false,                 onSelect: () => { leaveProEditor(workbookId ? laioutBookEditorPath(workbookId) : LAIOUT_BOOKSHELF_PATH, { regenerateThumbnails: true }); setShowModeOverlay(false); } },
                { id: 'chapter', emoji: '✏️', label: 'Kapitola',   desc: 'Editor aktuálního listu',             isActive: appMode === 'chapter', onSelect: () => { setAppMode('chapter'); setShowModeOverlay(false); } },
              ]}
            />
          )}

          {/* Main Panel - PRO panels + basic editor panels */}
          {activePanel !== 'ai' && activePanel !== 'import' && appMode !== 'dataset' && (
            <aside
              style={{ width: '300px', minWidth: '300px', maxWidth: '300px' }}
              className="flex flex-col flex-shrink-0 bg-[#1e293b] overflow-hidden min-h-0 h-full"
            >
              {/* Block Settings Panel - shows when a block is selected */}
              {isBlockSettingsOpen && selectedBlock ? (
                <ProBlockSettingsPanel
                  block={selectedBlock}
                  allBlocks={worksheet.blocks}
                  onClose={handleCloseBlockSettings}
                  onUpdateBlock={updateBlock}
                  onUpdateTextFlowFrameHeight={updateTextFlowFrameHeight}
                  onApplyGroupLayout={applyGroupLayout}
                  onDeleteBlock={deleteBlock}
                  onDuplicateBlock={duplicateBlock}
                  onMoveUp={moveBlockUp}
                  onMoveDown={moveBlockDown}
                  canMoveUp={(() => {
                    const idx = worksheet.blocks.findIndex(b => b.id === selectedBlock.id);
                    if (idx <= 0) return false;
                    if (selectedBlock.layoutSectionId) {
                      return worksheet.blocks.slice(0, idx).some((block) =>
                        block.layoutSectionId === selectedBlock.layoutSectionId
                        && (block.layoutColumnId ?? 'col-1') === (selectedBlock.layoutColumnId ?? 'col-1')
                      );
                    }
                    const assignment = selectedBlock.columnAssignment ?? 'A';
                    return worksheet.blocks.slice(0, idx).some(b => !b.layoutSectionId && (b.columnAssignment ?? 'A') === assignment);
                  })()}
                  canMoveDown={(() => {
                    const idx = worksheet.blocks.findIndex(b => b.id === selectedBlock.id);
                    if (idx === -1 || idx >= worksheet.blocks.length - 1) return false;
                    if (selectedBlock.layoutSectionId) {
                      return worksheet.blocks.slice(idx + 1).some((block) =>
                        block.layoutSectionId === selectedBlock.layoutSectionId
                        && (block.layoutColumnId ?? 'col-1') === (selectedBlock.layoutColumnId ?? 'col-1')
                      );
                    }
                    const assignment = selectedBlock.columnAssignment ?? 'A';
                    return worksheet.blocks.slice(idx + 1).some(b => !b.layoutSectionId && (b.columnAssignment ?? 'A') === assignment);
                  })()}
                  gridColumns={worksheet.metadata.gridColumns || 12}
                  pageColumnLayout={
                    worksheet.metadata.pageOverrides?.[currentPageIndex]?.pageColumnLayout
                    ?? worksheet.metadata.pageColumnLayout
                    ?? 'single'
                  }
                  twoColumnASpan={
                    worksheet.metadata.pageOverrides?.[currentPageIndex]?.twoColumnASpan
                    ?? worksheet.metadata.twoColumnASpan
                  }
                  datasetImages={datasetImages.length > 0 ? datasetImages : undefined}
                  designSystem={activeDesignSystem}
                />
              ) : (
                <>
                  {/* PRO: Sheet Settings Panel */}
                  {activePanel === 'sheet-settings' && (
                    <SheetSettingsPanel
                      gridColumns={worksheet.metadata.gridColumns || 12}
                      gridGap={worksheet.metadata.gridGap || 'medium'}
                      globalFontSize={worksheet.metadata.globalFontSize || 'small'}
                      pageFormat={pageFormat}
                      layoutMode={worksheet.metadata.layoutMode || 'grid'}
                      onGridColumnsChange={(gridColumns) => {
                        updateWorksheet(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, gridColumns },
                          // Reset all blocks to full span when changing grid
                          blocks: prev.blocks.map(block => ({
                            ...block,
                            gridSpan: gridColumns,
                          })),
                        }));
                      }}
                      onGridGapChange={(gridGap) => {
                        updateWorksheet(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, gridGap },
                        }));
                      }}
                      onGlobalFontSizeChange={(globalFontSize) => {
                        updateWorksheet(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, globalFontSize },
                        }));
                      }}
                      onPageFormatChange={(nextPageFormat) => {
                        updateWorksheet(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, pageFormat: nextPageFormat },
                        }));
                      }}
                      onLayoutModeChange={(layoutMode) => {
                        updateWorksheet(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, layoutMode },
                        }));
                      }}
                      showGridOverlay={showGridOverlay}
                      onShowGridOverlayChange={setShowGridOverlay}
                      pageBackgroundColor={worksheet.metadata.pageBackgroundColor}
                      onPageBackgroundColorChange={(pageBackgroundColor) => {
                        updateWorksheet(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, pageBackgroundColor },
                        }));
                      }}
                      pageHeader={worksheet.metadata.pageHeader}
                      pageFooter={worksheet.metadata.pageFooter}
                      onPageHeaderChange={(pageHeader) => {
                        updateWorksheet(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, pageHeader },
                        }));
                      }}
                      onPageFooterChange={(pageFooter) => {
                        updateWorksheet(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, pageFooter },
                        }));
                      }}
                      pageColumnLayout={worksheet.metadata.pageColumnLayout || 'single'}
                      twoColumnASpan={worksheet.metadata.twoColumnASpan}
                      currentPageIndex={currentPageIndex}
                      pageOverrides={worksheet.metadata.pageOverrides}
                      onPageColumnLayoutChange={(pageColumnLayout) => {
                        updateWorksheet(prev => ({ ...prev, metadata: { ...prev.metadata, pageColumnLayout } }));
                      }}
                      onTwoColumnASpanChange={(twoColumnASpan) => {
                        updateWorksheet(prev => ({ ...prev, metadata: { ...prev.metadata, twoColumnASpan } }));
                      }}
                      onPageOverrideChange={(pageIndex, override) => {
                        updateWorksheet(prev => {
                          const existing = prev.metadata.pageOverrides ?? {};
                          let updated: typeof existing;
                          if (override === null) {
                            const { [pageIndex]: _removed, ...rest } = existing;
                            updated = rest;
                          } else {
                            updated = { ...existing, [pageIndex]: override };
                          }
                          return { ...prev, metadata: { ...prev.metadata, pageOverrides: updated } };
                        });
                      }}
                      onApplyTemplate={handleApplyTemplate}
                      onSmartLayout={datasetImages.length > 0 ? handleSmartLayout : undefined}
                      smartLayoutLoading={smartLayoutLoading}
                      onFormatText={handleFormatText}
                      formatTextLoading={formatTextLoading}
                      onApplySeries={handleApplySeries}
                      blockSeriesConfig={Object.fromEntries(
                        Object.entries(BLOCK_SERIES).map(([k, v]) => [k, { label: v.label, emoji: v.emoji, description: v.description, group: v.group, svgPreview: generateSeriesSVG(v.slots) }])
                      )}
                      onSavePageAsTemplate={handleSavePageAsTemplate}
                      currentPageBlocks={
                        currentPageBlockIds.length > 0
                          ? worksheet.blocks.filter(b => currentPageBlockIds.includes(b.id))
                          : worksheet.blocks
                      }
                      designSystem={activeDesignSystem}
                      onApplyDesignSystem={handleApplyDesignSystem}
                    />
                  )}

                  {activePanel === 'settings' && (
                    <ProSettingsPanel
                      worksheet={worksheet}
                      onUpdateWorksheet={updateWorksheet}
                    />
                  )}
                  
                  {activePanel === 'structure' && (
                    <ProStructurePanel
                      worksheet={worksheet}
                      selectedBlockId={selectedBlockId}
                      onSelectBlock={handleSelectBlock}
                      onHoverBlock={handleHoverBlock}
                      onAddBlock={addBlock}
                    />
                  )}
                  
                  {activePanel === 'add' && (
                    <ProAddContentPanel
                      onAddBlock={(type) => setPendingInsertType(type)}
                      pendingInsertType={pendingInsertType}
                      onInsertAtEnd={insertAtEnd}
                      onCancelInsert={cancelInsert}
                      onDragStart={handleDragStartFromPanel}
                      onDragEnd={handleDragEndFromPanel}
                      onInsertLayout={handleInsertLayout}
                      miniAppGridSpan={worksheet.metadata.gridColumns || 12}
                      onInsertMiniAppBlocks={(blocks) => {
                        if (blocks.length === 0) return;
                        updateWorksheet((prev) => {
                          const gc = prev.metadata.gridColumns || 12;
                          const stamped = blocks.map((b) => ({
                            ...b,
                            gridSpan: b.gridSpan ?? gc,
                          }));
                          const merged = [...prev.blocks, ...stamped];
                          return { ...prev, blocks: merged.map((b, i) => ({ ...b, order: i })) };
                        });
                        const first = blocks[0];
                        if (first?.id) setSelectedBlockId(first.id);
                        toast.success('Miniaplikace vložena');
                      }}
                      preferredBlockTypes={activeDesignSystem?.blockPreferences.preferred}
                      layoutSeries={[
                        {
                          key: 'layout-section-2',
                          label: 'Layout 2 sloupce',
                          description: 'Prázdná layout sekce se dvěma stackovatelnými sloupci.',
                          group: 'column',
                          svgPreview: generateLayoutSectionSVG(2),
                        },
                        {
                          key: 'layout-section-3',
                          label: 'Layout 3 sloupce',
                          description: 'Prázdná layout sekce se třemi stackovatelnými sloupci.',
                          group: 'column',
                          svgPreview: generateLayoutSectionSVG(3),
                        },
                        ...Object.entries(BLOCK_SERIES).map(([key, v]) => ({
                          key,
                          label: v.label,
                          description: v.description,
                          group: v.group,
                          svgPreview: generateSeriesSVG(v.slots),
                        })),
                      ]}
                    />
                  )}

                  {activePanel === 'export' && (
                    <VividboardExportPanel
                      worksheet={worksheet}
                      isLoading={isExportingToBoard}
                      selectedBlockId={selectedBlockId}
                      onExport1to1={handleExport1to1}
                      onExportTest={handleExportTest}
                      onExportPisemka={handleExportPisemka}
                      onExportPresentation={handleCreatePresentation}
                      onSyncBoard={handleSyncBoard}
                      isSyncingBoard={isSyncingBoard}
                      onRegenerateThumbnails={handleRegenerateThumbnails}
                      isRegeneratingThumbnails={isRegeneratingThumbnails}
                    />
                  )}

                  {activePanel === 'history' && (
                    <div className="flex flex-1 flex-col min-h-0 min-w-0">
                      <VersionHistoryPanel
                        appearance="dark"
                        compact
                        versions={versionHistory.versions}
                        loading={versionHistory.loading}
                        error={versionHistory.error}
                        totalVersions={versionHistory.totalVersions}
                        hasMoreVersions={versionHistory.hasMoreVersions}
                        hasUnsavedChanges={versionHistory.hasUnsavedChanges}
                        autoSavePending={versionHistory.autoSavePending}
                        currentVersion={versionHistory.lastSavedVersion}
                        onSaveManual={versionHistory.saveManualVersion}
                        onRestore={versionHistory.restoreVersion}
                        onLoadMore={versionHistory.loadMoreVersions}
                        onClose={() => handlePanelChange('sheet-settings')}
                      />
                    </div>
                  )}
                </>
              )}
            </aside>
          )}
          
          {/* AI Panel - always mounted to preserve chat history, hidden via CSS when inactive */}
          {worksheet && (
            <aside
              className="flex-shrink-0 border-r border-[#334155] bg-[#1e293b] flex-col"
              style={{
                width: '300px',
                minWidth: '300px',
                maxWidth: '300px',
                display: activePanel === 'ai' ? 'flex' : 'none',
              }}
            >
              <AIChatPanel
                worksheet={worksheet}
                onAddBlocks={(blocks) => {
                  if (!worksheet) return;
                  const startOrder = worksheet.blocks.length;
                  const newBlocks = blocks.map((block, idx) => ({
                    ...block,
                    order: startOrder + idx,
                  }));
                  updateWorksheet({
                    blocks: [...worksheet.blocks, ...newBlocks],
                  });
                  if (newBlocks.length > 0) {
                    setSelectedBlockId(newBlocks[0].id);
                    setActivePanel('structure');
                  }
                }}
                onUpdateWorksheet={updateWorksheet}
                onReplaceBlocks={(blocks) => {
                  if (!worksheet) return;
                  updateWorksheet({ blocks });
                }}
                onClose={() => setActivePanel('structure')}
                selectedBlockId={selectedBlockId}
                currentPageBlocks={worksheet.blocks.filter(b => currentPageBlockIds.includes(b.id))}
              />
            </aside>
          )}

          {/* Import Agent Panel */}
          {activePanel === 'import' && (
            <aside 
              className="flex-shrink-0 border-r border-[#334155] bg-[#1e293b] flex flex-col"
              style={{ width: '300px', minWidth: '300px', maxWidth: '300px' }}
            >
              <ProImportPanel
                onAddBlocks={(blocks) => {
                  if (!worksheet) return;
                  const startOrder = worksheet.blocks.length;
                  const newBlocks = blocks.map((block, idx) => ({
                    ...block,
                    order: startOrder + idx,
                  }));
                  updateWorksheet({
                    blocks: [...worksheet.blocks, ...newBlocks],
                  });
                  if (newBlocks.length > 0) {
                    setSelectedBlockId(newBlocks[0].id);
                  }
                }}
                onReplaceBlocks={(blocks) => {
                  if (!worksheet) return;
                  updateWorksheet({ blocks });
                }}
                onClose={() => setActivePanel('structure')}
              />
            </aside>
          )}
          
          {/* Main Canvas Area */}
          {/* Dataset Panel — replaces paper when dataset mode active */}
          {appMode === 'dataset' && (
            <DatasetPanel
              scopeId={workbookId ?? id ?? 'default'}
            />
          )}

          <main 
            ref={mainScrollRef}
            className="flex-1 overflow-auto print:p-0 print:bg-white print:overflow-visible relative" 
            style={{ 
              padding: '24px', 
              backgroundColor: '#0f172a',
              color: '#e2e8f0',
              display: appMode === 'dataset' ? 'none' : undefined,
            }}
            onClick={() => handleSelectBlock(null)}
          >
            {/* Undo/Redo + Zoom – jeden panel vpravo */}
            <div style={{
              position: 'fixed', top: 12, right: 24,
              display: appMode === 'dataset' ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              zIndex: 100,
              backgroundColor: '#1e293b', padding: '4px',
              borderRadius: '8px', border: '1px solid #334155',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }} onClick={e => e.stopPropagation()}>
              {/* Zpět */}
              <button onClick={handleUndo} disabled={!canUndo} title="Zpět (Ctrl+Z)"
                style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: 4, cursor: !canUndo ? 'not-allowed' : 'pointer', color: !canUndo ? '#475569' : '#94a3b8', display: 'flex', alignItems: 'center', transition: 'all 0.1s' }}
                onMouseEnter={e => { if (canUndo) e.currentTarget.style.backgroundColor = '#334155'; }}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <Undo2 size={18} />
              </button>
              {/* Vpřed */}
              <button onClick={handleRedo} disabled={!canRedo} title="Vpřed (Ctrl+Shift+Z)"
                style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: 4, cursor: !canRedo ? 'not-allowed' : 'pointer', color: !canRedo ? '#475569' : '#94a3b8', display: 'flex', alignItems: 'center', transition: 'all 0.1s' }}
                onMouseEnter={e => { if (canRedo) e.currentTarget.style.backgroundColor = '#334155'; }}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <Redo2 size={18} />
              </button>
              {/* Oddělovač */}
              <div style={{ height: '1px', width: '60%', backgroundColor: '#334155', margin: '2px 0' }} />
              {/* Zoom + */}
              <button onClick={zoomIn} title="Přiblížit"
                style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#334155')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, minWidth: 32, textAlign: 'center' }}>
                {Math.round(canvasZoom * 100)}%
              </span>
              {/* Zoom – */}
              <button onClick={zoomOut} title="Oddálit"
                style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#334155')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
              <div style={{ height: '1px', width: '60%', backgroundColor: '#334155', margin: '2px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                {Array.from({ length: pageNavCount }).map((_, pageIndex) => {
                  const isActive = pageIndex === currentPageIndex;
                  return (
                    <button
                      key={pageIndex}
                      onClick={() => scrollToPage(pageIndex)}
                      title={`Přejít na stránku ${pageIndex + 1}`}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: isActive ? '1px solid #60a5fa' : '1px solid #334155',
                        background: isActive ? '#dbeafe' : '#f8fafc',
                        color: isActive ? '#1d4ed8' : '#64748b',
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: 1,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.12s ease',
                        boxShadow: isActive ? '0 0 0 1px rgba(96,165,250,0.18)' : 'none',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = '#e2e8f0';
                          e.currentTarget.style.borderColor = '#475569';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                          e.currentTarget.style.borderColor = '#334155';
                        }
                      }}
                    >
                      {pageIndex + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Canvas wrapper with zoom */}
            <div 
              style={{ 
                transform: `scale(${canvasZoom})`,
                transformOrigin: 'top center',
                marginBottom: canvasZoom < 1 ? `-${(1 - canvasZoom) * 100}%` : 0,
              }}
            >
            {/* Conditional rendering based on layout mode */}
            {worksheet.metadata.layoutMode === 'freeform' ? (
              /* FREEFORM MODE - for manual creative editing */
              <FreeformCanvas
                blocks={worksheet.blocks}
                selectedBlockId={selectedBlockId}
                hoveredBlockId={hoveredBlockId}
                onSelectBlock={handleSelectBlock}
                onUpdateBlock={updateBlock}
                onUpdateBlockMargin={updateBlockMargin}
                onUpdateBlockOrder={updateBlockOrder}
                onDeleteBlock={deleteBlock}
                onDuplicateBlock={duplicateBlock}
                onAddBlock={addBlock}
                onSwitchToAI={() => setActivePanel('ai')}
                onOpenAddPanel={() => setActivePanel('add')}
                onOpenAI={() => setForceAIOpen(true)}
                globalFontSize={worksheet.metadata.globalFontSize}
                pageFormat={pageFormat}
                showGridOverlay={showGridOverlay}
                gridColumns={worksheet.metadata.gridColumns || 12}
                gridGapPx={getGridGapPx(worksheet.metadata.gridGap)}
                onUpdateBlockPosition={(blockId, x, y, pageIndex) => {
                  updateWorksheet(prev => ({
                    ...prev,
                    blocks: prev.blocks.map(b =>
                      b.id === blockId ? { ...b, posX: x, posY: y, pageIndex } : b
                    ),
                  }));
                }}
                onUpdateBlockSize={(blockId, width, height) => {
                  updateWorksheet(prev => ({
                    ...prev,
                    blocks: prev.blocks.map(b =>
                      b.id === blockId ? { ...b, blockWidth: width, blockHeight: height } : b
                    ),
                  }));
                }}
                pageBackgroundColor={worksheet.metadata.pageBackgroundColor}
                pageHeader={worksheet.metadata.pageHeader}
                pageFooter={worksheet.metadata.pageFooter}
              />
            ) : (
              /* GRID MODE (default) - for AI generation */
              <GridCanvas
                blocks={worksheet.blocks}
                selectedBlockId={selectedBlockId}
                hoveredBlockId={hoveredBlockId}
                onSelectBlock={handleSelectBlock}
                onHoverBlock={handleHoverBlock}
                onUpdateBlock={updateBlock}
                onUpdateBlockMargin={updateBlockMargin}
                onUpdateBlockGridSpan={(blockId, gridSpan, gridStart) => {
                  updateWorksheet(prev => {
                    const updatedBlocks = prev.blocks.map(b =>
                      b.id === blockId ? { ...b, gridSpan, gridStart } : b
                    );
                    const updatedBlock = updatedBlocks.find((b) => b.id === blockId);
                    return {
                      ...prev,
                      blocks: updatedBlock && supportsTextFlow(updatedBlock) && (hasTextFlowFrame(updatedBlock) || isTextFlowLinked(updatedBlock))
                        ? reflowTextFlowChain(updatedBlocks, blockId)
                        : updatedBlocks,
                    };
                  });
                }}
                onUpdateTextFlowFrameHeight={updateTextFlowFrameHeight}
                onCreateTextFlowContinuation={createLinkedTextFlowBlock}
                onSplitTextFlowAtCaret={splitTextFlowAtCaret}
                onCommitTextFlow={commitTextFlow}
                onDeleteBlock={deleteBlock}
                onDuplicateBlock={duplicateBlock}
                onMoveBlockLeft={(blockId) => moveBlockAcrossLayout(blockId, -1)}
                onMoveBlockRight={(blockId) => moveBlockAcrossLayout(blockId, 1)}
                onMoveBlockUp={moveBlockUp}
                onMoveBlockDown={moveBlockDown}
                onAddBlock={addBlock}
                onSwitchToAI={() => setActivePanel('ai')}
                onOpenAddPanel={() => setActivePanel('add')}
                onOpenAI={() => setForceAIOpen(true)}
                globalFontSize={worksheet.metadata.globalFontSize}
                pageFormat={pageFormat}
                gridColumns={worksheet.metadata.gridColumns || 12}
                gridGapPx={getGridGapPx(worksheet.metadata.gridGap)}
                showGridOverlay={showGridOverlay}
                pendingInsertType={pendingInsertType}
                onInsertBefore={confirmInsertBefore}
                isDraggingFromPanel={isDraggingFromPanel}
                onDropBlock={handleDropBlock}
                pageBackgroundColor={worksheet.metadata.pageBackgroundColor}
                pageHeader={worksheet.metadata.pageHeader}
                pageFooter={worksheet.metadata.pageFooter}
                onPageChange={(pageIdx, blockIds) => {
                  setCurrentPageIndex(pageIdx);
                  setCurrentPageBlockIds(blockIds);
                }}
                pageColumnLayout={worksheet.metadata.pageColumnLayout || 'single'}
                twoColumnASpan={worksheet.metadata.twoColumnASpan}
                pageOverrides={worksheet.metadata.pageOverrides}
              />
            )}
            </div>{/* End zoom wrapper */}
          </main>
          
        </div>
        
        {/* Right Panel - Debug/JSON (Pro features) */}
        {!rightPanelCollapsed && rightPanel && (
          <aside style={{ width: '300px', minWidth: '300px', maxWidth: '300px' }} className="flex-shrink-0 border-l border-[#334155] bg-[#1e293b] overflow-hidden">
            {rightPanel === 'debug' && (
              <DebugPanel
                worksheet={worksheet}
                selectedBlockId={selectedBlockId}
                onClose={() => setRightPanelCollapsed(true)}
              />
            )}
            
            {rightPanel === 'json' && (
              <JsonEditorPanel
                worksheet={worksheet}
                onUpdateWorksheet={(updated) => {
                  updateWorksheet(() => updated);
                }}
                onClose={() => setRightPanelCollapsed(true)}
              />
            )}
          </aside>
        )}
      </DndContext>
      
      {/* Hidden printable worksheet */}
      {worksheet && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0, opacity: 0, pointerEvents: 'none' }}>
          <PrintableWorksheet ref={printRef} worksheet={worksheet} />
        </div>
      )}
      
    </div>
  );
}
