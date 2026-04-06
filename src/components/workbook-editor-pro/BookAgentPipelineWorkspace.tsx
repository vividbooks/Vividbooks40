/**
 * Pipeline agentů (V2) — sloupce jako v curriculum factory (Design systém 2):
 * nahoře bílá karta „agent“ (název + role), pod ní bílá karta „dataset“ (náhled výstupu).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  BookOpen,
  Book,
  Workflow,
  Copy,
  Play,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { InfiniteCanvas } from './InfiniteCanvas';
import { AgentWorkflowLibraryMenuList } from './AgentWorkflowLibraryMenuList';
import {
  type BookAgentDatasetOutputMode,
  type BookAgentPipelineStep,
  type BookAgentWorkspaceState,
  BOOK_AGENT_PIPELINE_MODEL_OPTIONS,
  type BookAgentPipelineModelId,
  bookAgentWorkflowWithTouch,
  cloneBookAgentPipelineSteps,
  createBookAgentPipelineStep,
  createBookAgentWorkflow,
  createEmptyBookAgentWorkspace,
  migrateBookAgentPipelineV1ToWorkspace,
  parseBookAgentPipelineState,
  parseBookAgentWorkspaceState,
} from '../../types/book-agent-pipeline';
import { createWorkflowFromPreset, CURRICULUM_FACTORY_PRESET } from '../../data/book-agent-workflow-presets';
import { runBookAgentPipelineStep } from '../../utils/ai/book-agent-pipeline-run';
import { buildDesignSystemPipelineContext } from '../../utils/design-system-pipeline-context';
import type { DesignSystem } from '../../types/design-system';
import { tryParseFolderRowsFromDatasetPreview } from '../../utils/book-agent-dataset-folder-preview';

const STORAGE_KEY_V2 = 'bookAgentWorkflows:v2:';
const STORAGE_KEY_LEGACY = 'bookAgentPipeline:v1:';

/** Stejné rozložení jako sloupec typografie na DS plátně */
const COLUMN_W = 440;
const CANVAS_STACK_GAP = 20;

function storageKeyV2(bookId: string): string {
  return `${STORAGE_KEY_V2}${bookId}`;
}

function loadWorkspace(bookId: string): BookAgentWorkspaceState {
  try {
    const v2raw = localStorage.getItem(storageKeyV2(bookId));
    if (v2raw) {
      const ws = parseBookAgentWorkspaceState(JSON.parse(v2raw) as unknown);
      if (ws) return ws;
    }
    const legacy = localStorage.getItem(`${STORAGE_KEY_LEGACY}${bookId}`);
    if (legacy) {
      const v1 = parseBookAgentPipelineState(JSON.parse(legacy) as unknown);
      if (v1) {
        const migrated = migrateBookAgentPipelineV1ToWorkspace(v1);
        saveWorkspace(bookId, migrated);
        return migrated;
      }
    }
  } catch {
    /* ignore */
  }
  return createEmptyBookAgentWorkspace();
}

function saveWorkspace(bookId: string, state: BookAgentWorkspaceState): void {
  try {
    localStorage.setItem(storageKeyV2(bookId), JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

/** Bílá karta jako BARVY / TYPOGRAFIE v DesignSystemCanvasWorkspace */
const cardPaper: CSSProperties = {
  width: '100%',
  padding: 16,
  borderRadius: 16,
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 24px rgba(15, 23, 42, 0.07)',
  boxSizing: 'border-box',
};

/** Jako `labelCap` v DesignSystemCanvasWorkspace */
const labelCap: CSSProperties = {
  fontSize: 14.3,
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: '0.06em',
  marginBottom: 10,
};

const C = {
  canvasBg: '#0b1120',
  muted: '#64748b',
  text: '#0f172a',
  arrow: '#94a3b8',
};

function ArrowBetween() {
  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        alignSelf: 'center',
        padding: '0 8px',
        color: C.arrow,
        opacity: 0.9,
      }}
      aria-hidden
    >
      <ChevronRight size={22} strokeWidth={2} />
    </div>
  );
}

function DatasetNestedPlaceholder() {
  return (
    <div
      style={{
        borderRadius: 10,
        padding: '12px 12px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Struktura výstupu</div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#0f172a',
          lineHeight: 1.35,
          marginBottom: 4,
        }}
      >
        Zatím prázdné
      </div>
      <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4 }}>
        Po spuštění agenta se zde zobrazí strukturovaný dataset (JSON) pro další krok.
      </div>
    </div>
  );
}

function datasetSegmentStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 10,
    border: `1px solid ${active ? '#c7d2fe' : '#e2e8f0'}`,
    backgroundColor: active ? '#eef2ff' : '#f8fafc',
    color: active ? '#3730a3' : '#64748b',
    fontWeight: 600,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.3,
  };
}

function formatDetailJson(detail: unknown): string {
  if (detail === undefined) return '';
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}

function DatasetPreviewBlock({
  preview,
  outputMode,
}: {
  preview: string;
  outputMode: BookAgentDatasetOutputMode;
}) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const trimmed = preview.trim();
  const folderRows =
    outputMode === 'folders' && trimmed ? tryParseFolderRowsFromDatasetPreview(trimmed) : null;
  const showFolderList = Boolean(folderRows && folderRows.length > 0);
  const showPre = outputMode === 'single' || !showFolderList || showRawJson;

  useEffect(() => {
    setExpandedRows({});
  }, [trimmed]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {showFolderList ? (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              padding: '0 2px',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', letterSpacing: '0.04em' }}>
              Struktura
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{folderRows!.length}</span>
          </div>
          <div
            style={{
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
            }}
          >
            {folderRows!.map((row, i) => {
              const open = Boolean(expandedRows[i]);
              return (
                <div
                  key={`${row.label}-${i}`}
                  style={{
                    borderBottom: i < folderRows!.length - 1 ? '1px solid #f1f5f9' : undefined,
                  }}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setExpandedRows((prev) => ({
                        ...prev,
                        [i]: !prev[i],
                      }))
                    }
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      border: 'none',
                      background: open ? '#f8fafc' : '#ffffff',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    <Book size={18} style={{ color: '#3b82f6', flexShrink: 0 }} strokeWidth={2} aria-hidden />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#0f172a',
                          lineHeight: 1.25,
                        }}
                      >
                        {row.label}
                      </div>
                      {row.sub ? (
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{row.sub}</div>
                      ) : null}
                    </div>
                    {row.count > 0 ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#64748b',
                          backgroundColor: '#f1f5f9',
                          padding: '2px 8px',
                          borderRadius: 999,
                          flexShrink: 0,
                        }}
                      >
                        {row.count}
                      </span>
                    ) : null}
                    {open ? (
                      <ChevronDown size={16} style={{ color: '#64748b', flexShrink: 0 }} aria-hidden />
                    ) : (
                      <ChevronRight size={16} style={{ color: '#cbd5e1', flexShrink: 0 }} aria-hidden />
                    )}
                  </button>
                  {open ? (
                    <div
                      style={{
                        padding: '0 12px 12px 12px',
                        backgroundColor: '#f8fafc',
                        borderTop: '1px solid #f1f5f9',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: '#64748b',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          marginBottom: 8,
                          paddingLeft: 28,
                        }}
                      >
                        Obsah položky (JSON)
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: '10px 10px 10px 12px',
                          marginLeft: 28,
                          fontSize: 10,
                          lineHeight: 1.45,
                          color: '#334155',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          maxHeight: 240,
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          backgroundColor: '#ffffff',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {formatDetailJson(row.detail)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowRawJson((v) => !v)}
            style={{
              alignSelf: 'flex-start',
              padding: 0,
              border: 'none',
              background: 'none',
              color: '#6366f1',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {showRawJson ? 'Skrýt celý JSON' : 'Zobrazit celý JSON'}
          </button>
        </>
      ) : null}
      {outputMode === 'folders' && trimmed && !showFolderList ? (
        <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
          Nepodařilo se rozparsovat jako seznam složek — zobrazen celý výstup.
        </p>
      ) : null}
      {showPre ? (
        <div
          style={{
            borderRadius: 10,
            padding: 0,
            border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            overflow: 'hidden',
          }}
        >
          <pre
            style={{
              margin: 0,
              padding: 12,
              fontSize: 11,
              lineHeight: 1.45,
              color: '#334155',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              maxHeight: 280,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {trimmed}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function AgentColumnCard({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onRun,
  running,
}: {
  step: BookAgentPipelineStep;
  index: number;
  total: number;
  onChange: (patch: Partial<BookAgentPipelineStep>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRun: () => void;
  running: boolean;
}) {
  const hasDataset = Boolean(step.datasetPreview?.trim());

  return (
    <div
      style={{
        width: COLUMN_W,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: CANVAS_STACK_GAP,
      }}
    >
      {/* Horní karta = identita agenta (jako „BARVY“) */}
      <div style={cardPaper}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 2,
          }}
        >
          <div style={{ ...labelCap, marginBottom: 0, flex: 1, minWidth: 0 }}>AGENT</div>
          <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginTop: -2 }}>
            <button
              type="button"
              title="Dříve v řetězci"
              disabled={index <= 0}
              onClick={onMoveUp}
              style={iconBtnStyle(index <= 0)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              title="Později v řetězci"
              disabled={index >= total - 1}
              onClick={onMoveDown}
              style={iconBtnStyle(index >= total - 1)}
            >
              <ChevronRight size={16} />
            </button>
            <button type="button" title="Odebrat agenta" onClick={onRemove} style={iconBtnDangerStyle}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Workflow size={18} style={{ color: '#6366f1', flexShrink: 0 }} aria-hidden />
          <input
            type="text"
            value={step.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Jméno agenta"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 15,
              fontWeight: 700,
              color: C.text,
              border: 'none',
              borderBottom: '1px solid #e2e8f0',
              padding: '6px 0',
              outline: 'none',
              background: 'transparent',
            }}
          />
        </div>

        <div style={{ fontSize: 9, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', marginBottom: 6 }}>
          Model
        </div>
        <select
          value={step.modelId}
          onChange={(e) => onChange({ modelId: e.target.value as BookAgentPipelineModelId })}
          style={{
            width: '100%',
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            color: C.text,
            fontSize: 12,
            fontWeight: 600,
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        >
          {BOOK_AGENT_PIPELINE_MODEL_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.35, marginTop: -8, marginBottom: 12 }}>
          {BOOK_AGENT_PIPELINE_MODEL_OPTIONS.find((o) => o.id === step.modelId)?.hint ?? ''}
        </div>

        <div style={{ fontSize: 9, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', marginBottom: 6 }}>
          Výstup datasetu
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => onChange({ datasetOutputMode: 'single' })}
            style={datasetSegmentStyle(step.datasetOutputMode === 'single')}
          >
            Jeden soubor
          </button>
          <button
            type="button"
            onClick={() => onChange({ datasetOutputMode: 'folders' })}
            style={datasetSegmentStyle(step.datasetOutputMode === 'folders')}
          >
            Složky a soubory
          </button>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.35, marginTop: -4, marginBottom: 12 }}>
          {step.datasetOutputMode === 'folders'
            ? 'JSON s více kapitolami / složkami (jako Curriculum Factory — struktura, soubory, podkapitoly).'
            : 'Jeden JSON objekt nebo pole jako jeden výstupní blok pro další krok.'}
        </div>

        <div style={{ fontSize: 9, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', marginBottom: 6 }}>
          Role — co dělá
        </div>
        <textarea
          value={step.rolePrompt}
          onChange={(e) => onChange({ rolePrompt: e.target.value })}
          placeholder="Popiš úkol: vstup z předchozího kroku zpracuješ tak, že…"
          rows={5}
          style={{
            width: '100%',
            resize: 'vertical',
            minHeight: 88,
            padding: '12px 12px',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            color: C.text,
            fontSize: 12,
            lineHeight: 1.45,
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          aria-busy={running}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 12,
            border: 'none',
            backgroundColor: running ? '#4f46e5' : '#6366f1',
            color: '#f8fafc',
            fontSize: 13,
            fontWeight: 600,
            cursor: running ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxSizing: 'border-box',
            opacity: running ? 0.92 : 1,
          }}
        >
          {running ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <Play size={16} strokeWidth={2.5} aria-hidden />
          )}
          {running ? 'Generuji…' : 'Spustit'}
        </button>
        <div style={{ marginTop: 10, fontSize: 11, color: '#64748b' }}>
          Sloupec {index + 1} z {total} · výstup předáš jako dataset níže
        </div>
      </div>

      {/* Spodní karta = dataset (jako „TYPOGRAFIE“ / vnořené styly) */}
      <div style={cardPaper}>
        <div style={{ ...labelCap, color: '#64748b' }}>DATASET</div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 10, lineHeight: 1.35 }}>
          {step.datasetOutputMode === 'folders'
            ? 'Přehled položek jako ve Factory (složky, soubory, počty); celý JSON lze rozbalit níže.'
            : 'Jeden předaný blok dat pro dalšího agenta (jako jeden styl pod paletou v design systému).'}
        </div>

        <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ ...labelCap, fontSize: 11, marginBottom: 6, letterSpacing: '0.05em' }}>NÁHLED VÝSTUPU</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hasDataset ? (
              <DatasetPreviewBlock preview={step.datasetPreview!} outputMode={step.datasetOutputMode} />
            ) : (
              <DatasetNestedPlaceholder />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function iconBtnStyle(disabled: boolean): CSSProperties {
  return {
    padding: 6,
    borderRadius: 8,
    border: 'none',
    background: disabled ? 'transparent' : '#f1f5f9',
    color: disabled ? '#cbd5e1' : '#64748b',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

const iconBtnDangerStyle: CSSProperties = {
  padding: 6,
  borderRadius: 8,
  border: 'none',
  background: '#fef2f2',
  color: '#dc2626',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function AddColumnCard({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      style={{
        width: COLUMN_W,
        flexShrink: 0,
        minHeight: 200,
        padding: 20,
        borderRadius: 16,
        border: '2px dashed #cbd5e1',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        boxSizing: 'border-box',
      }}
    >
      <Plus size={28} strokeWidth={2} style={{ color: '#818cf8' }} />
      Přidat agenta
    </button>
  );
}

function BookSinkStack({
  agentCount,
  lastDatasetPreview,
  lastOutputMode,
  onApplyToBook,
  applyingBook,
}: {
  agentCount: number;
  lastDatasetPreview?: string;
  lastOutputMode: BookAgentDatasetOutputMode;
  onApplyToBook?: () => void | Promise<void>;
  applyingBook: boolean;
}) {
  const hasLast = Boolean(lastDatasetPreview?.trim());

  return (
    <div
      style={{
        width: COLUMN_W,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: CANVAS_STACK_GAP,
      }}
    >
      <div style={cardPaper}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <BookOpen size={20} style={{ color: '#6366f1', flexShrink: 0 }} aria-hidden />
          <div style={{ ...labelCap, marginBottom: 0 }}>KNIHA</div>
        </div>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#64748b' }}>
          Z posledního datasetu posledního agenta vytvoříš stránky knihy (nová kapitola „Z pipeline“). Obsah jde
          upravit v editoru listu.
        </p>
        <button
          type="button"
          disabled={!hasLast || !onApplyToBook || applyingBook}
          onClick={() => void onApplyToBook?.()}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 12,
            border: 'none',
            backgroundColor: !hasLast || applyingBook ? '#94a3b8' : '#0d9488',
            color: '#f8fafc',
            fontSize: 13,
            fontWeight: 600,
            cursor: !hasLast || applyingBook ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxSizing: 'border-box',
          }}
        >
          {applyingBook ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <BookOpen size={16} aria-hidden />
          )}
          {applyingBook ? 'Vkládám stránky…' : 'Vytvořit stránky knihy z datasetu'}
        </button>
      </div>
      <div style={cardPaper}>
        <div style={{ ...labelCap, color: '#64748b' }}>VSTUP Z PIPELINE</div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 10, lineHeight: 1.35 }}>
          Náhled posledního datasetu (stejný jako u posledního agenta).
        </div>
        {agentCount === 0 ? (
          <p style={{ margin: 0, fontSize: 11, color: '#f59e0b', lineHeight: 1.45 }}>
            Přidej alespoň jednoho agenta — kniha bere vstup z posledního sloupce.
          </p>
        ) : hasLast ? (
          <DatasetPreviewBlock preview={lastDatasetPreview!} outputMode={lastOutputMode} />
        ) : (
          <DatasetNestedPlaceholder />
        )}
      </div>
    </div>
  );
}

export type BookAgentPipelineWorkspaceProps = {
  bookId: string;
  /** Aktivní design systém knihy — promítne se do promptů agentů a do vložených stránek (WorkbookProLayout). */
  bookDesignSystem?: DesignSystem | null;
  /** Vytvoří stránky knihy z JSON posledního agenta (WorkbookProLayout) */
  onApplyPipelineDatasetToBook?: (datasetJson: string) => void | Promise<void>;
};

const btnDarkMini: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid rgba(71, 85, 105, 0.95)',
  backgroundColor: 'rgba(30, 41, 59, 0.96)',
  color: '#e2e8f0',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

function clipText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export function BookAgentPipelineWorkspace({
  bookId,
  bookDesignSystem,
  onApplyPipelineDatasetToBook,
}: BookAgentPipelineWorkspaceProps) {
  const [workspace, setWorkspace] = useState<BookAgentWorkspaceState>(() => loadWorkspace(bookId));
  const [libraryDropdownOpen, setLibraryDropdownOpen] = useState(false);
  const [runningStepId, setRunningStepId] = useState<string | null>(null);
  const [applyingBook, setApplyingBook] = useState(false);
  const workflowDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWorkspace(loadWorkspace(bookId));
  }, [bookId]);

  useEffect(() => {
    saveWorkspace(bookId, workspace);
  }, [bookId, workspace]);

  useEffect(() => {
    if (!libraryDropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (workflowDropdownRef.current?.contains(t)) return;
      setLibraryDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [libraryDropdownOpen]);

  const activeWorkflow = useMemo(() => {
    const w = workspace.workflows.find((x) => x.id === workspace.activeWorkflowId);
    return w ?? workspace.workflows[0];
  }, [workspace]);

  const steps = activeWorkflow?.steps ?? [];

  const setActiveSteps = useCallback((updater: (prev: BookAgentPipelineStep[]) => BookAgentPipelineStep[]) => {
    setWorkspace((prev) => ({
      ...prev,
      workflows: prev.workflows.map((w) =>
        w.id === prev.activeWorkflowId
          ? bookAgentWorkflowWithTouch({ ...w, steps: updater(w.steps) })
          : w,
      ),
    }));
  }, []);

  const updateStep = useCallback((id: string, patch: Partial<BookAgentPipelineStep>) => {
    setActiveSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, [setActiveSteps]);

  const removeStep = useCallback((id: string) => {
    setActiveSteps((prev) => prev.filter((s) => s.id !== id));
  }, [setActiveSteps]);

  const addStep = useCallback(() => {
    setActiveSteps((prev) => [...prev, createBookAgentPipelineStep()]);
  }, [setActiveSteps]);

  const moveStep = useCallback((index: number, dir: -1 | 1) => {
    setActiveSteps((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }, [setActiveSteps]);

  const switchWorkflow = useCallback((id: string) => {
    setWorkspace((prev) => ({ ...prev, activeWorkflowId: id }));
    setLibraryDropdownOpen(false);
  }, []);

  const renameActiveWorkflow = useCallback((name: string) => {
    setWorkspace((prev) => ({
      ...prev,
      workflows: prev.workflows.map((w) =>
        w.id === prev.activeWorkflowId
          ? bookAgentWorkflowWithTouch({ ...w, name: name.trim() || w.name })
          : w,
      ),
    }));
  }, []);

  const addEmptyWorkflow = useCallback(() => {
    const nw = createBookAgentWorkflow({ name: 'Nový workflow', steps: [] });
    setWorkspace((prev) => ({
      ...prev,
      workflows: [...prev.workflows, nw],
      activeWorkflowId: nw.id,
    }));
    setLibraryDropdownOpen(false);
    toast.success('Nové prázdné workflow');
  }, []);

  const duplicateActiveWorkflow = useCallback(() => {
    setWorkspace((prev) => {
      const wf = prev.workflows.find((w) => w.id === prev.activeWorkflowId);
      if (!wf) return prev;
      const dup = createBookAgentWorkflow({
        name: `Kopie: ${wf.name}`,
        steps: cloneBookAgentPipelineSteps(wf.steps),
        ...(wf.presetId ? { presetId: wf.presetId } : {}),
      });
      return {
        ...prev,
        workflows: [...prev.workflows, dup],
        activeWorkflowId: dup.id,
      };
    });
    toast.success('Workflow zduplikováno');
    setLibraryDropdownOpen(false);
  }, []);

  const deleteActiveWorkflow = useCallback(() => {
    if (workspace.workflows.length <= 1) return;
    if (!window.confirm('Opravdu smazat toto workflow? Agenti v něm budou odstraněni.')) return;
    setWorkspace((prev) => {
      if (prev.workflows.length <= 1) return prev;
      const rest = prev.workflows.filter((w) => w.id !== prev.activeWorkflowId);
      const activeWorkflowId = rest[0]?.id ?? prev.activeWorkflowId;
      return { ...prev, workflows: rest, activeWorkflowId };
    });
    toast.success('Workflow smazáno');
  }, [workspace.workflows.length]);

  const addCurriculumFactoryWorkflow = useCallback(() => {
    const nw = createWorkflowFromPreset(CURRICULUM_FACTORY_PRESET);
    setWorkspace((prev) => ({
      ...prev,
      workflows: [...prev.workflows, nw],
      activeWorkflowId: nw.id,
    }));
    setLibraryDropdownOpen(false);
    toast.success('Přidáno workflow Curriculum Factory');
  }, []);

  const dsBrief = useMemo(() => buildDesignSystemPipelineContext(bookDesignSystem ?? null), [bookDesignSystem]);

  const header = useMemo(
    () => (
      <div style={{ marginBottom: 16, maxWidth: 720 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#f8fafc',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Pipeline agentů
        </h1>
        {bookDesignSystem ? (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>
            Styl knihy:{' '}
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{bookDesignSystem.name}</span>
            {' — '}
            agenti dostanou paletu a typografii do promptu; stránky vkládané do knihy použijí ten samý design.
          </p>
        ) : (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#f59e0b', lineHeight: 1.45 }}>
            Není nastavená knižní design systém — v záložce Design systém (plátno) zvol styl a klepni „Aplikovat na
            knihu“, aby se pipeline a nové stránky sladily s barvami a fonty.
          </p>
        )}
      </div>
    ),
    [bookDesignSystem],
  );

  const handleRunAgent = useCallback(
    async (stepId: string) => {
      const step = steps.find((s) => s.id === stepId);
      if (!step) return;
      if (!step.rolePrompt.trim()) {
        toast.error('Vyplň úkol agenta (pole Role).');
        return;
      }
      const idx = steps.findIndex((s) => s.id === stepId);
      const previousDatasetPreview = idx > 0 ? steps[idx - 1]?.datasetPreview : undefined;

      setRunningStepId(stepId);
      try {
        const { text, usedImageFallback } = await runBookAgentPipelineStep({
          rolePrompt: step.rolePrompt,
          modelId: step.modelId,
          datasetOutputMode: step.datasetOutputMode,
          previousDatasetPreview,
          designSystemContext: dsBrief || undefined,
        });
        if (usedImageFallback) {
          toast.info('Vybraný model je pro obrázky — pro text se použil Gemini Flash.');
        }
        if (!text.trim()) {
          toast.warning('Model vrátil prázdný text — zkuste upravit roli nebo znovu spustit.');
        }
        updateStep(stepId, { datasetPreview: text.trim() ? text : undefined });
        if (text.trim()) {
          toast.success('Hotovo — náhled datasetu je uložen v tomto sloupci.');
        }
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : 'Neznámá chyba';
        toast.error(`AI: ${msg}`);
      } finally {
        setRunningStepId(null);
      }
    },
    [dsBrief, steps, updateStep],
  );

  const handleApplyBookFromPipeline = useCallback(async () => {
    const last = steps[steps.length - 1];
    const raw = last?.datasetPreview?.trim();
    if (!raw || !onApplyPipelineDatasetToBook) return;
    setApplyingBook(true);
    try {
      await Promise.resolve(onApplyPipelineDatasetToBook(raw));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Nepodařilo se vložit stránky do knihy');
    } finally {
      setApplyingBook(false);
    }
  }, [steps, onApplyPipelineDatasetToBook]);

  if (!activeWorkflow) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: C.canvasBg, color: '#94a3b8' }}>
        Chybí workflow — obnov stránku.
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden" style={{ backgroundColor: C.canvasBg }}>
      {/* Jako `DesignSystemCanvasWorkspace`: plovoucí knihovna nad plátnem vlevo nahoře */}
      <div
        ref={workflowDropdownRef}
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 220,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'flex-start',
          maxWidth: 'min(100%, calc(100vw - 24px))',
        }}
      >
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            aria-expanded={libraryDropdownOpen}
            aria-haspopup="listbox"
            onClick={() => setLibraryDropdownOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 200,
              maxWidth: 'min(320px, calc(100vw - 100px))',
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid rgba(71, 85, 105, 0.95)',
              backgroundColor: 'rgba(30, 41, 59, 0.96)',
              color: '#f1f5f9',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'left',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {clipText(activeWorkflow.name, 36)}
            </span>
            <ChevronDown
              size={16}
              style={{
                flexShrink: 0,
                color: '#94a3b8',
                transform: libraryDropdownOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>
          {libraryDropdownOpen ? (
            <AgentWorkflowLibraryMenuList
              workflows={workspace.workflows}
              activeWorkflowId={workspace.activeWorkflowId}
              onSelectWorkflow={switchWorkflow}
              onSelectNewEmpty={addEmptyWorkflow}
              onSelectCurriculumFactory={addCurriculumFactoryWorkflow}
            />
          ) : null}
        </div>
        <input
          type="text"
          value={activeWorkflow.name}
          onChange={(e) => renameActiveWorkflow(e.target.value)}
          aria-label="Název workflow"
          style={{
            minWidth: 160,
            maxWidth: 280,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid rgba(71, 85, 105, 0.95)',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            color: '#f1f5f9',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button type="button" onClick={duplicateActiveWorkflow} style={btnDarkMini} title="Duplikovat workflow">
          <Copy size={14} />
          Duplikovat
        </button>
        <button
          type="button"
          onClick={deleteActiveWorkflow}
          disabled={workspace.workflows.length <= 1}
          style={{
            ...btnDarkMini,
            opacity: workspace.workflows.length <= 1 ? 0.45 : 1,
            cursor: workspace.workflows.length <= 1 ? 'not-allowed' : 'pointer',
            color: '#fecaca',
            borderColor: 'rgba(248, 113, 113, 0.35)',
          }}
          title="Smazat workflow"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <InfiniteCanvas initialZoom={0.85} minZoom={0.35} maxZoom={2} showDotGrid dotGridSize={22} showGrid={false}>
          <div
            style={{
              position: 'absolute',
              left: 12,
              top: 56,
              right: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'flex-start',
              maxWidth: 'min(3400px, calc(100vw - 24px))',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ maxWidth: 640 }}>{header}</div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 0,
                flexWrap: 'nowrap',
              }}
            >
            {steps.map((step, index) => (
              <div key={step.id} style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
                {index > 0 && <ArrowBetween />}
                <AgentColumnCard
                  step={step}
                  index={index}
                  total={steps.length}
                  onChange={(patch) => updateStep(step.id, patch)}
                  onRemove={() => removeStep(step.id)}
                  onMoveUp={() => moveStep(index, -1)}
                  onMoveDown={() => moveStep(index, 1)}
                  running={runningStepId === step.id}
                  onRun={() => void handleRunAgent(step.id)}
                />
              </div>
            ))}
            {steps.length > 0 && <ArrowBetween />}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
              <AddColumnCard onAdd={addStep} />
            </div>
            <ArrowBetween />
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
              <BookSinkStack
                agentCount={steps.length}
                lastDatasetPreview={steps[steps.length - 1]?.datasetPreview}
                lastOutputMode={steps[steps.length - 1]?.datasetOutputMode ?? 'single'}
                onApplyToBook={onApplyPipelineDatasetToBook ? handleApplyBookFromPipeline : undefined}
                applyingBook={applyingBook}
              />
            </div>
            </div>
          </div>
        </InfiniteCanvas>
      </div>
    </div>
  );
}
