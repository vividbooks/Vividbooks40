/**
 * Curriculum Factory V2
 * 
 * Přepracovaný design se sloupcovým layoutem jako admin knihovna.
 * Konzole | Nastavení + Agenti | Výstup agenta | Detail | Sub-detail
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Calendar,
  Layers,
  Sparkles,
  Package,
  Settings,
  Terminal,
  Eye,
  Save,
  Trash2,
  Image as ImageIcon,
  FileText,
  BookOpen,
  GraduationCap,
  Database,
  FolderOpen,
  Folder,
  X,
  Check,
  AlertCircle,
  Info,
  BarChart2,
  Plus,
  Table,
  TrendingUp,
  Map as MapIcon,
  RefreshCw,
  MapPin,
  Navigation,
  Flag,
  ClipboardList,
  ClipboardCheck,
  Award,
  ImagePlus,
  Wand2,
  Headphones,
  Mic,
  Pencil,
  BookMarked,
  Monitor,
  MessageCircle,
  ClipboardEdit,
} from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { ILLUSTRATION_STYLE } from '../../utils/dataset/material-generators';
import { stripBase64FromObject } from '../../utils/supabase/upload-image';
import { toast } from 'sonner';
import { playSuccessSound, playFanfareSound } from '../../utils/sounds';
import { syncWorksheetToBoard } from '../../utils/worksheet-board-sync';
import { generateWorksheetThumbnails } from '../../utils/generate-worksheet-thumbnails';
import type { Worksheet } from '../../types/worksheet';
import type { ImageGroup, ImageGroupSubject } from '../../types/topic-dataset';
import { addWorksheetToRag } from '../../utils/worksheet-rag';
import {
  runAgent1,
  runAgent2,
  runAgent3DataSet,
  runAgent4DataSet,
  runAgent6DataSet,
  runMilestonesOnly
} from '../../utils/curriculum/agents';
import {
  SubjectCode,
  Grade,
  SUBJECT_NAMES,
  GRADE_NAMES
} from '../../types/curriculum';
import type { TopicDataSet, MapSuggestion, SavedMap, MapRegionId, MapStyle, MapExerciseType } from '../../types/topic-dataset';
import { VividMap } from '../shared/VividMap';
import { MapEditorModal } from './MapEditorModal';
import { translateImageCaptions } from '../../utils/dataset/translate-captions';

// =====================================================
// ILLUSTRATION STYLES
// =====================================================

export interface IllustrationStyle {
  id: string;
  name: string;
  emoji: string;
  color: string;
  prompt: string;
}

export const DEFAULT_ILLUSTRATION_STYLES: IllustrationStyle[] = [
  {
    id: 'simple',
    name: 'Jednoduchá / dětská',
    emoji: '🎈',
    color: '#f59e0b',
    prompt: 'Flat vector illustration, children\'s book style, bold outlines, bright primary colors, simple shapes, friendly and playful, minimal detail, large clear elements, no text, white background.',
  },
  {
    id: 'detailed',
    name: 'Podrobná ilustrace',
    emoji: '🖼️',
    color: '#8b5cf6',
    prompt: 'Educational illustration, semi-realistic style, clear labels areas, rich colors, medium detail level, textbook quality, professional finish, clean composition, no text overlays, white background.',
  },
  {
    id: 'verydetailed',
    name: 'Velice podrobná',
    emoji: '🔬',
    color: '#6366f1',
    prompt: 'Highly detailed scientific illustration, cross-section or cutaway view, fine linework, accurate anatomy or structure, rich shading and color gradients, encyclopedic quality, technical precision, no text labels, white background.',
  },
  {
    id: 'bw',
    name: 'Černobílá kresba',
    emoji: '✏️',
    color: '#374151',
    prompt: 'Black and white ink drawing, clean linework, hatching and cross-hatching for shading, pen and ink style, high contrast, no color, suitable for printing, clear outlines, white background.',
  },
  {
    id: 'schema',
    name: 'Schéma / diagram',
    emoji: '📐',
    color: '#0ea5e9',
    prompt: 'Educational diagram or schema, clean vector style, geometric shapes and arrows, blue and grey color palette, clear structure hierarchy, technical drawing style, minimal decoration, white background, no text.',
  },
  {
    id: 'map',
    name: 'Mapa',
    emoji: '🗺️',
    color: '#10b981',
    prompt: 'Illustrated map style, geographic or conceptual map, soft watercolor or flat vector fill, clear borders and regions, muted earth tones, decorative cartographic style, no text labels, white background.',
  },
];

// =====================================================
// IMAGE GROUP HELPERS
// =====================================================

/** Rozřeže jeden široký obrázek horizontálně na N stejně velkých dílů.
 *  Funguje čistě na straně prohlížeče přes Canvas API. */
async function splitImageHorizontally(imageUrl: string, count: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const panelW = Math.floor(img.width / count);
      const results: string[] = [];
      for (let i = 0; i < count; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = panelW;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
        ctx.drawImage(img, i * panelW, 0, panelW, img.height, 0, 0, panelW, img.height);
        results.push(canvas.toDataURL('image/png'));
      }
      resolve(results);
    };
    img.onerror = () => reject(new Error('Nelze načíst obrázek pro rozřezání'));
    img.src = imageUrl;
  });
}

/** Sestaví prompt pro batch N panelů vedle sebe.
 *  Používá STEJNOU strukturu jako jednotlivé ilustrace:
 *  ${illustrationStyle}\n\nSUBJECT: ...\n\nNO TEXT: ...
 *  illustrationStyle (vybraný uživatelem) má vždy prioritu nad vším ostatním.
 */
function buildBatchPrompt(
  subjects: { name: string; extraPrompt?: string }[],
  groupCompositionHint: string,
  illustrationStyle: string
): string {
  const n = subjects.length;
  const panelDescriptions = subjects.map((s, i) => {
    const desc = s.extraPrompt ? `${s.name} — ${s.extraPrompt}` : s.name;
    return `Panel ${i + 1}: ${desc}`;
  }).join('. ');

  return `${illustrationStyle}

SUBJECT: Create exactly ${n} equal panels arranged horizontally side by side in ONE single wide image. All ${n} panels must share perfectly identical visual style, color palette, line weight, scale, lighting and white background — this is one coherent illustration series. Each panel is separated by a thin white vertical dividing line. ${panelDescriptions}. Series context: ${groupCompositionHint}

NO TEXT: Do not include any text, words, letters, numbers or labels anywhere in the image.

Style requirements:
${ILLUSTRATION_STYLE}`;
}

/**
 * Vrátí nejlepší aspect ratio a imageSize pro batch N panelů.
 * Imagen podporuje POUZE: 1:1, 4:3, 3:4, 16:9, 9:16
 * imageSize: '1K' | '2K' | '4K'
 *
 * 1 panel:  1:1  @ 2K  → 2048×2048 px per panel
 * 2 panely: 16:9 @ 2K  → 2048×1152 → ~1024×1152 per panel
 * 3 panely: 16:9 @ 4K  → 4096×2304 → ~1365×2304 per panel (max šířka)
 * 4+ pan.:  16:9 @ 4K  → 4096×2304 → ~1024×2304 per panel
 */
function batchAspectAndSize(panelCount: number): { aspectRatio: string; imageSize: '1K' | '2K' | '4K' } {
  if (panelCount === 1) return { aspectRatio: '1:1', imageSize: '2K' };
  return { aspectRatio: '16:9', imageSize: '2K' };  // 4K způsobuje 546 (payload too large) v edge function
}

/**
 * Generuje skupinu obrázků v dávkách.
 * Batch size je dynamický dle celkového počtu pro maximální konzistenci stylu:
 *   ≤3 subjektů → 1 dávka (všechny dohromady, stejný styl garantován)
 *   4 subjektů  → 2 dávky po 2 (stejný aspect ratio v každé dávce)
 *   5–6         → dávky po 3 (4:1, stejný aspect)
 *   7+          → dávky po 3
 */
function groupBatchSize(totalCount: number): number {
  if (totalCount <= 3) return totalCount; // 1 dávka = garantovaný stejný styl
  if (totalCount === 4) return 2;         // 2 dávky po 2 (16:9 každá)
  return 3;                               // dávky po 3 (4:1 každá)
}

async function generateGroupInBatches(
  group: ImageGroup,
  illustrationStyle: string,
  generateFn: (prompt: string, options: { aspectRatio: string; numberOfImages: number; model: 'pro' | 'flash'; imageSize?: '512px' | '1K' | '2K' | '4K' }) => Promise<any>,
  processImageUrlFn: (url: string, id: string, folder: string) => Promise<string | null>,
  dataSetId: string,
  folder: 'illustrations' | 'photos',
  onProgress: (updatedSubjects: ImageGroupSubject[]) => void,
  onLog: (msg: string) => void,
  model: 'pro' | 'flash' = 'flash',
): Promise<ImageGroupSubject[]> {
  const subjects = group.subjects;
  const updatedSubjects: ImageGroupSubject[] = subjects.map(s => ({ ...s }));
  const batchSize = groupBatchSize(subjects.length);
  onLog(`📋 Skupina "${group.title}": ${subjects.length} subjektů → dávky po ${batchSize}`);

  for (let batchStart = 0; batchStart < subjects.length; batchStart += batchSize) {
    const batchSubjects = subjects.slice(batchStart, batchStart + batchSize);
    const batchEnd = Math.min(batchStart + batchSize, subjects.length);
    const { aspectRatio, imageSize } = batchAspectAndSize(batchSubjects.length);
    onLog(`📐 Dávka ${Math.floor(batchStart / batchSize) + 1}: ${batchSubjects.length} panely · ${aspectRatio} · ${imageSize}`);

    const prompt = buildBatchPrompt(batchSubjects, group.stylePrompt, illustrationStyle);

    console.group(`🖼️ GROUP BATCH — "${group.title}" | dávka ${Math.floor(batchStart / batchSize) + 1}`);
    console.log('📐 Aspect:', aspectRatio, '| Size:', imageSize, '| Model:', model);
    console.log('🎨 illustrationStyle (první 200 znaků):', illustrationStyle.slice(0, 200));
    console.log('📝 FULL PROMPT:\n', prompt);
    console.groupEnd();

    try {
      const result = await generateFn(prompt, { aspectRatio, numberOfImages: 1, model, imageSize });
      if (!result.success && !result.url && !result.images?.[0]?.base64) {
        throw new Error(result.error || 'Generování selhalo');
      }
      const rawUrl = result.url || `data:${result.images?.[0]?.mimeType || 'image/png'};base64,${result.images?.[0]?.base64}`;

      let panels: string[];
      if (batchSubjects.length === 1) {
        panels = [rawUrl];
      } else {
        onLog(`✂️ Rozřezávám na ${batchSubjects.length} dílů...`);
        panels = await splitImageHorizontally(rawUrl, batchSubjects.length);
      }

      for (let i = 0; i < batchSubjects.length; i++) {
        const globalIdx = batchStart + i;
        const subj = updatedSubjects[globalIdx];
        const imageUrl = await processImageUrlFn(panels[i], `${dataSetId}-grp-${group.id}-${subj.id}`, folder);
        updatedSubjects[globalIdx] = { ...subj, status: 'done', imageUrl: imageUrl || panels[i] };
      }
    } catch (e: any) {
      onLog(`⚠️ Dávka ${batchStart + 1}–${batchEnd}: ${String(e).slice(0, 60)}`);
      for (let i = batchStart; i < batchEnd; i++) {
        updatedSubjects[i] = { ...updatedSubjects[i], status: 'error', error: String(e) };
      }
    }

    onProgress([...updatedSubjects]);
  }

  return updatedSubjects;
}

// =====================================================
// HELPERS
// =====================================================

/** AI někdy vrátí objekt místo stringu – normalizujeme na string */
function toStr(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    // Nejčastější klíče které AI vrátí
    for (const key of ['fact', 'text', 'value', 'content', 'name', 'term', 'definition', 'description', 'label']) {
      if (typeof obj[key] === 'string') return obj[key] as string;
    }
    return JSON.stringify(val);
  }
  return String(val);
}

/** Normalizuje pole na pole stringů */
function toStrArr(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(toStr).filter(Boolean);
}

// =====================================================
// TYPES
// =====================================================

interface Agent {
  id: number;
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  outputType: 'rvp' | 'plans' | 'datasets' | 'materials' | 'published';
}

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface ColumnItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  type: 'folder' | 'item' | 'header';
  data?: any;
  children?: ColumnItem[];
  badge?: string | number;
  style?: React.CSSProperties;
  variant?: 'default' | 'milestone';
}

// =====================================================
// CONSTANTS
// =====================================================

const AGENTS: Agent[] = [
  {
    id: 1,
    name: 'RVP Scout',
    icon: <Search className="w-4 h-4" />,
    description: 'Stáhne RVP témata a kompetence',
    color: '#3B82F6',
    status: 'idle',
    outputType: 'rvp'
  },
  {
    id: 2,
    name: 'Planner',
    icon: <Calendar className="w-4 h-4" />,
    description: 'Rozloží učivo do týdenních plánů',
    color: '#8B5CF6',
    status: 'idle',
    outputType: 'plans'
  },
  {
    id: 3,
    name: 'Data Collector',
    icon: <Layers className="w-4 h-4" />,
    description: 'Vytvoří DataSety (pojmy, fakta, obrázky)',
    color: '#EC4899',
    status: 'idle',
    outputType: 'datasets'
  },
  {
    id: 4,
    name: 'Creator',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'Generuje materiály z DataSetů',
    color: '#F59E0B',
    status: 'idle',
    outputType: 'materials'
  },
  {
    id: 5,
    name: 'Publisher',
    icon: <Package className="w-4 h-4" />,
    description: 'Ukládá do admin knihovny',
    color: '#10B981',
    status: 'idle',
    outputType: 'published'
  }
];

// =====================================================
// COLUMN COMPONENT
// =====================================================

interface ColumnProps {
  title: string;
  items: ColumnItem[];
  selectedId: string | null;
  onSelect: (item: ColumnItem) => void;
  loading?: boolean;
  emptyMessage?: string;
  actions?: React.ReactNode;
  badge?: string | number;
}

function Column({ 
  title, 
  items, 
  selectedId, 
  onSelect, 
  loading, 
  emptyMessage = 'Žádné položky',
  actions,
  badge
}: ColumnProps) {
  return (
    <div className="flex flex-col h-full border-r border-slate-200 bg-white flex-shrink-0" style={{ width: 330 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 text-sm uppercase tracking-wide">{title}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {actions}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <FolderOpen className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-sm">{emptyMessage}</span>
          </div>
        ) : (
          <div className="py-1">
            {items.map((item) => {
              if (item.type === 'header') {
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-3 pt-3 pb-1"
                  >
                    {item.icon}
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">{item.label}</span>
                  </div>
                );
              }
              const isMilestone = item.variant === 'milestone';
              const isSelected = selectedId === item.id;
              const selectedClass = isMilestone
                ? 'bg-amber-50 text-amber-800 border-r-2 border-amber-500'
                : 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500';
              const unselectedClass = 'hover:bg-slate-50 text-slate-700';
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  style={isSelected ? undefined : item.style}
                  className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 text-left transition-colors ${isSelected ? selectedClass : unselectedClass}`}
                >
                  {item.icon || (item.type === 'folder' ? (
                    <Folder className="w-4 h-4 text-amber-500" />
                  ) : (
                    <FileText className="w-4 h-4 text-slate-400" />
                  ))}
                  <span className="flex-1 text-sm font-medium truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${isMilestone ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// CONSOLE COMPONENT
// =====================================================

interface ConsoleProps {
  logs: LogEntry[];
  isOpen: boolean;
  onToggle: () => void;
}

function Console({ logs, isOpen, onToggle }: ConsoleProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const errorCount = logs.filter(l => l.type === 'error').length;

  // Zavřená – úzký proužek vpravo
  if (!isOpen) {
    return (
      <div
        onClick={onToggle}
        title="Otevřít konzoli"
        style={{
          width: 36, flexShrink: 0,
          backgroundColor: '#0f172a',
          borderLeft: '1px solid #1e293b',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 12, gap: 8,
          cursor: 'pointer',
        }}
      >
        <Terminal style={{ width: 14, height: 14, color: '#4ade80' }} />
        {errorCount > 0 && (
          <span style={{ fontSize: 9, padding: '1px 5px', backgroundColor: '#ef4444', borderRadius: 99, color: 'white', fontWeight: 700 }}>
            {errorCount}
          </span>
        )}
        {errorCount === 0 && logs.length > 0 && (
          <span style={{ fontSize: 9, padding: '1px 5px', backgroundColor: '#334155', borderRadius: 99, color: '#94a3b8' }}>
            {logs.length}
          </span>
        )}
      </div>
    );
  }

  // Otevřená – pravý sloupec
  return (
    <div style={{
      width: 380, flexShrink: 0,
      backgroundColor: '#0f172a',
      borderLeft: '1px solid #1e293b',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid #1e293b', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Terminal style={{ width: 13, height: 13, color: '#4ade80' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>Konzole</span>
          {errorCount > 0 && (
            <span style={{ fontSize: 10, padding: '1px 6px', backgroundColor: '#ef4444', borderRadius: 99, color: 'white' }}>
              {errorCount} chyb
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          title="Skrýt konzoli"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#64748b' }}
        >
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* Logs */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6 }}>
        {logs.length === 0 && (
          <p style={{ color: '#475569', marginTop: 12 }}>Zatím žádné záznamy.</p>
        )}
        {logs.map((log) => (
          <div
            key={log.id}
            style={{
              display: 'flex', gap: 8, padding: '1px 0',
              color: log.type === 'error' ? '#f87171'
                : log.type === 'success' ? '#4ade80'
                : log.type === 'warning' ? '#fbbf24'
                : '#94a3b8',
            }}
          >
            <span style={{ color: '#334155', flexShrink: 0 }}>
              {log.timestamp.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span style={{ wordBreak: 'break-word' }}>{log.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

// =====================================================
// SETTINGS COLUMN COMPONENT
// =====================================================

interface SettingsColumnProps {
  selectedSubject: SubjectCode | null;
  selectedGrade: Grade | null;
  onSubjectChange: (subject: SubjectCode) => void;
  onGradeChange: (grade: Grade) => void;
  agents: Agent[];
  selectedAgentId: number | null;
  onAgentSelect: (agent: Agent) => void;
  onRunPipeline: () => void;
  isRunning: boolean;
}

function SettingsColumn({
  selectedSubject,
  selectedGrade,
  onSubjectChange,
  onGradeChange,
  agents,
  selectedAgentId,
  onAgentSelect,
  onRunPipeline,
  isRunning
}: SettingsColumnProps) {
  return (
    <div className="flex flex-col h-full border-r border-slate-200 bg-white flex-shrink-0" style={{ width: 330 }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <span className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Nastavení</span>
      </div>
      
      {/* Subject & Grade Selection */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Předmět</label>
          <select
            value={selectedSubject || ''}
            onChange={(e) => onSubjectChange(e.target.value as SubjectCode)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Vyberte předmět</option>
            {Object.entries(SUBJECT_NAMES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Ročník</label>
          <select
            value={selectedGrade || ''}
            onChange={(e) => onGradeChange(Number(e.target.value) as Grade)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Vyberte ročník</option>
            {Object.entries(GRADE_NAMES).map(([grade, name]) => (
              <option key={grade} value={grade}>{name}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Agents List */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-100">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Agenti</span>
        </div>
        
        <div className="py-1">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onAgentSelect(agent)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                ${selectedAgentId === agent.id 
                  ? 'bg-indigo-50 border-r-2 border-indigo-500' 
                  : 'hover:bg-slate-50'
                }
              `}
            >
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
              >
                {agent.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700">{agent.name}</div>
                <div className="text-xs text-slate-400 truncate">{agent.description}</div>
              </div>
              {agent.status === 'running' && (
                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
              )}
              {agent.status === 'completed' && (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
              {agent.status === 'error' && (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* Run Button */}
      <div className="p-4 border-t border-slate-200">
        <button
          onClick={onRunPipeline}
          disabled={!selectedSubject || !selectedGrade || isRunning}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: '12px',
            fontWeight: 500,
            border: 'none',
            cursor: (!selectedSubject || !selectedGrade || isRunning) ? 'not-allowed' : 'pointer',
            backgroundColor: isRunning ? '#475569' : ((!selectedSubject || !selectedGrade) ? '#94a3b8' : '#22c55e'),
            color: 'white',
            opacity: (!selectedSubject || !selectedGrade) ? 0.5 : 1,
          }}
          className={`
            ${isRunning
              ? 'bg-amber-500 text-white'
              : !selectedSubject || !selectedGrade
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/25'
            }
          `}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Běží...</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              <span>Spustit pipeline</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// =====================================================
// MILESTONE DETAIL PANEL
// =====================================================

interface MilestoneDetailPanelProps {
  dataSet: any;
  onUpdate: () => void;
}

function MilestoneDetailPanel({ dataSet, onUpdate }: MilestoneDetailPanelProps) {
  const [activeTab, setActiveTab] = React.useState<'test' | 'pisemka' | 'hodnoceni'>('test');
  const [generating, setGenerating] = React.useState(false);
  const [expandedSchool, setExpandedSchool] = React.useState<string | null>(null);
  const [previewQuestion, setPreviewQuestion] = React.useState<any | null>(null);

  const md = dataSet.milestone_data || {};
  const test = md.test;
  const pisemka = md.pisemka;
  const hodnoceni = md.hodnoceni;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { buildMilestoneData } = await import('../../utils/curriculum/milestone-generator');
      const subjectMap: Record<string, string> = {
        dejepis: 'Dějepis', zemepis: 'Zeměpis', cestina: 'Český jazyk',
        anglictina: 'Anglický jazyk', matematika: 'Matematika', prirodopis: 'Přírodopis',
        fyzika: 'Fyzika', chemie: 'Chemie', prvouka: 'Prvouka', prirodoveda: 'Přírodověda',
        vlastiveda: 'Vlastivěda',
      };
      const subjectName = subjectMap[dataSet.subject_code] || dataSet.subject_code;
      const milestoneData = await buildMilestoneData({
        topicGroupName: md.topicGroupName || dataSet.topic.replace('Uzavření: ', ''),
        coveredTopics: md.coveredTopics || [],
        coveredWeekNumbers: md.coveredWeekNumbers || [],
        rvpOutcomes: dataSet.rvp?.expectedOutcomes || [],
        subjectName,
        grade: dataSet.grade,
      });
      const { supabase } = await import('../../utils/supabase/client');
      await supabase.from('topic_data_sets').update({ milestone_data: milestoneData }).eq('id', dataSet.id);
      onUpdate();
      toast.success('Uzlový bod vygenerován');
    } catch (err: any) {
      toast.error(`Chyba: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const typeLabel: Record<string, string> = {
    'multiple-choice': 'Výběr', 'true-false': 'P/N', open: 'Otevřená',
    'fill-blank': 'Doplňovačka', matching: 'Přiřazení',
  };

  const tabStyle = (tab: string) => ({
    padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    borderBottom: activeTab === tab ? '2px solid #f59e0b' : '2px solid transparent',
    color: activeTab === tab ? '#92400e' : '#64748b',
    background: 'transparent', transition: 'all 0.15s',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fffbeb', borderLeft: '1px solid #fde68a', minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #fde68a', background: '#fef3c7', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Flag className="w-5 h-5 text-amber-600" />
          <span style={{ fontWeight: 800, fontSize: 15, color: '#92400e' }}>{dataSet.topic}</span>
        </div>
        {md.coveredTopics?.length > 0 && (
          <div style={{ fontSize: 11, color: '#b45309', marginBottom: 4 }}>
            Témata: {md.coveredTopics.slice(0, 3).join(', ')}{md.coveredTopics.length > 3 ? ` +${md.coveredTopics.length - 3}` : ''}
          </div>
        )}
        {md.coveredWeekNumbers?.length > 0 && (
          <div style={{ fontSize: 11, color: '#b45309' }}>
            Týdny: {md.coveredWeekNumbers[0]}–{md.coveredWeekNumbers[md.coveredWeekNumbers.length - 1]}
          </div>
        )}
        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{ marginTop: 10, padding: '7px 14px', borderRadius: 8, border: 'none', background: generating ? '#d97706' : '#f59e0b', color: 'white', fontSize: 12, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {generating ? 'Generuji...' : (test ? 'Přegenerovat' : 'Vygenerovat obsah')}
        </button>
      </div>

      {!test && !generating && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32, color: '#92400e', opacity: 0.6 }}>
          <Flag className="w-10 h-10" />
          <p style={{ textAlign: 'center', fontSize: 13 }}>Obsah uzlového bodu ještě nebyl vygenerován.<br />Klikni na „Vygenerovat obsah" výše.</p>
        </div>
      )}

      {(test || pisemka || hodnoceni) && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #fde68a', background: 'white', flexShrink: 0 }}>
            <button style={tabStyle('test')} onClick={() => setActiveTab('test')}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <ClipboardList className="w-3.5 h-3.5" /> Test {test ? `(${test.questions?.length || 0})` : ''}
              </span>
            </button>
            <button style={tabStyle('pisemka')} onClick={() => setActiveTab('pisemka')}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <FileText className="w-3.5 h-3.5" /> Písemka {pisemka ? `(${pisemka.tasks?.length || 0})` : ''}
              </span>
            </button>
            <button style={tabStyle('hodnoceni')} onClick={() => setActiveTab('hodnoceni')}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Award className="w-3.5 h-3.5" /> Hodnocení
              </span>
            </button>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

            {/* ── TEST tab ─────────────────────────── */}
            {activeTab === 'test' && test && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 99, background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700 }}>
                    {test.totalPoints} bodů
                  </span>
                  <span style={{ padding: '3px 10px', borderRadius: 99, background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700 }}>
                    {test.timeMinutes} min
                  </span>
                  <span style={{ padding: '3px 10px', borderRadius: 99, background: '#f0fdf4', color: '#166534', fontSize: 11, fontWeight: 700 }}>
                    {test.questions?.length || 0} otázek
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(test.questions || []).map((q: any, i: number) => (
                    <div key={q.id || i}
                      style={{ background: 'white', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
                      onClick={() => setPreviewQuestion(previewQuestion?.id === q.id ? null : q)}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#e0f2fe', color: '#0369a1', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                          {typeLabel[q.type] || q.type}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', lineHeight: 1.4 }}>{i + 1}. {q.text}</div>
                          {previewQuestion?.id === q.id && (
                            <div style={{ marginTop: 8 }}>
                              {q.options && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                                  {q.options.map((opt: string, oi: number) => (
                                    <div key={oi} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: opt === q.correctAnswer ? '#dcfce7' : '#f8fafc', color: opt === q.correctAnswer ? '#166534' : '#475569', border: `1px solid ${opt === q.correctAnswer ? '#bbf7d0' : '#e2e8f0'}`, fontWeight: opt === q.correctAnswer ? 700 : 400 }}>
                                      {opt}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {q.matchPairs && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                                  {q.matchPairs.map((p: any, pi: number) => (
                                    <div key={pi} style={{ fontSize: 11, color: '#475569', display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <span style={{ fontWeight: 700, color: '#0369a1' }}>{p.left}</span>
                                      <ChevronRight className="w-3 h-3 text-slate-400" />
                                      <span>{p.right}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {q.correctAnswer && !q.options && !q.matchPairs && (
                                <div style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontWeight: 600 }}>
                                  ✓ {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{q.points}b</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── PÍSEMKA tab ───────────────────────── */}
            {activeTab === 'pisemka' && pisemka && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 99, background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700 }}>
                    {pisemka.totalPoints} bodů
                  </span>
                  <span style={{ padding: '3px 10px', borderRadius: 99, background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700 }}>
                    {pisemka.timeMinutes} min
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(pisemka.tasks || []).map((task: any, i: number) => (
                    <div key={task.id || i} style={{ background: 'white', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{i + 1}. {task.title}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#fef3c7', color: '#92400e', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{task.points}b</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, margin: 0 }}>{task.instruction}</p>
                      {task.hint && (
                        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 11, color: '#92400e' }}>
                          💡 {task.hint}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── HODNOCENÍ tab ─────────────────────── */}
            {activeTab === 'hodnoceni' && hodnoceni && (
              <div>
                {hodnoceni.outcomes?.length > 0 && (
                  <div style={{ marginBottom: 16, padding: '10px 12px', background: 'white', borderRadius: 10, border: '1px solid #fde68a' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Očekávané výstupy RVP</p>
                    <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {hodnoceni.outcomes.map((o: string, i: number) => (
                        <li key={i} style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{o}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(hodnoceni.levels || []).map((level: any) => (
                    <div key={level.schoolType} style={{ background: 'white', border: '1px solid #fde68a', borderRadius: 10, overflow: 'hidden' }}>
                      {/* School type header */}
                      <button
                        onClick={() => setExpandedSchool(expandedSchool === level.schoolType ? null : level.schoolType)}
                        style={{ width: '100%', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', background: '#fef3c7', cursor: 'pointer' }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>{level.schoolType}</span>
                        <ChevronDown className={`w-4 h-4 text-amber-600 transition-transform ${expandedSchool === level.schoolType ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedSchool === level.schoolType && (
                        <div style={{ padding: '8px 14px 12px' }}>
                          {(level.grades || []).map((g: any) => {
                            const gradeColors: Record<number, { bg: string; border: string; text: string }> = {
                              1: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
                              2: { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
                              3: { bg: '#fefce8', border: '#fef08a', text: '#854d0e' },
                              4: { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
                              5: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
                            };
                            const c = gradeColors[g.grade] || gradeColors[3];
                            return (
                              <div key={g.grade} style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: c.bg, border: `1px solid ${c.border}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                  <span style={{ fontSize: 16, fontWeight: 900, color: c.text }}>{g.grade}</span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{g.label}</span>
                                </div>
                                <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  {(g.criteria || []).map((criterion: string, ci: number) => (
                                    <li key={ci} style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{criterion}</li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


// =====================================================
// MAIN COMPONENT
// =====================================================

export function CurriculumFactoryV2() {
  const navigate = useNavigate();
  
  // State
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Selection state
  const [selectedSubject, setSelectedSubject] = useState<SubjectCode | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  
  // Data state
  const [dataSets, setDataSets] = useState<any[]>([]);
  const [dataSetsLoading, setDataSetsLoading] = useState(false);
  const [selectedDataSet, setSelectedDataSet] = useState<any | null>(null);
  const [selectedDataSetSection, setSelectedDataSetSection] = useState<string | null>(null);

  // Ref that always holds the current dataset id — used to guard against race conditions
  // when async operations (image gen, media load) complete after the user has switched datasets
  const selectedDataSetIdRef = useRef<string | null>(null);
  useEffect(() => { selectedDataSetIdRef.current = selectedDataSet?.id ?? null; }, [selectedDataSet?.id]);

  /** Safe updater: only applies if user is still on the same dataset */
  const updateSelectedDataSetIfCurrent = useCallback((dataSetId: string, updater: (prev: any) => any) => {
    setSelectedDataSet((prev: any) => {
      if (!prev || prev.id !== dataSetId) return prev;
      return updater(prev);
    });
  }, []);

  // RVP Scout & Planner výsledky
  const [rvpItems, setRvpItems] = useState<any[]>([]);
  const [weeklyPlanItems, setWeeklyPlanItems] = useState<any[]>([]);
  const [selectedRvpId, setSelectedRvpId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  
  // Pipeline state
  const [isRunning, setIsRunning] = useState(false);
  const [isMilestonesRunning, setIsMilestonesRunning] = useState(false);
  // dsGroupMap: datasetId → thematicArea (skupina dle RVP)
  const [dsGroupMap, setDsGroupMap] = useState<Map<string, string>>(new Map());
  // groupMilestoneMap: thematicArea → milestoneId
  const [groupMilestoneMap, setGroupMilestoneMap] = useState<Map<string, string>>(new Map());
  // Vybraná skupina (thematicArea) v Data Collectoru
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Generation state (for illustrations/photos)
  const [generatingPromptId, setGeneratingPromptId] = useState<string | null>(null);
  const [generatingGroupIds, setGeneratingGroupIds] = useState<Set<string>>(new Set());
  const [generatingIllustrationPrompts, setGeneratingIllustrationPrompts] = useState(false);
  const [generatingPhotoPrompts, setGeneratingPhotoPrompts] = useState(false);
  const [suggestedImageGroups, setSuggestedImageGroups] = useState<import('../../types/topic-dataset').ImageGroup[]>([]);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [searchingMoreImages, setSearchingMoreImages] = useState(false);
  const [translatingCaptions, setTranslatingCaptions] = useState(false);
  const [promptLabels, setPromptLabels] = useState<Set<string>>(new Set());

  // Gantt & review features
  const [dataCollectorView, setDataCollectorView] = useState<'list' | 'gantt'>('list');
  const [teacherNote, setTeacherNote] = useState('');
  const [regeneratingFromNote, setRegeneratingFromNote] = useState(false);
  const [regeneratingFullDataset, setRegeneratingFullDataset] = useState(false);
  const [qualityChecking, setQualityChecking] = useState(false);
  const [editingFactIdx, setEditingFactIdx] = useState<number | null>(null);
  const [editingTermIdx, setEditingTermIdx] = useState<number | null>(null);
  const [editingFactValue, setEditingFactValue] = useState('');
  const [editingTermValue, setEditingTermValue] = useState({ term: '', definition: '' });
  // Material quality check
  const [matQualityChecking, setMatQualityChecking] = useState(false);
  const [matQualityResults, setMatQualityResults] = useState<Record<string, any>>({});
  // Custom image/illustration generation
  const [customIllustrationDesc, setCustomIllustrationDesc] = useState('');
  const [customIllustrationGenerating, setCustomIllustrationGenerating] = useState(false);
  const [customPhotoDesc, setCustomPhotoDesc] = useState('');
  const [customPhotoGenerating, setCustomPhotoGenerating] = useState(false);
  // Model pro generování obrázků: 'pro' = kvalita, 'flash' = rychlost/cena
  const [imageGenModel, setImageGenModel] = useState<'pro' | 'flash'>('flash');
  // Styly ilustrací — editovatelný seznam + aktivní výběr
  const [illustrationStyles, setIllustrationStyles] = useState<IllustrationStyle[]>(DEFAULT_ILLUSTRATION_STYLES);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('simple');
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  // Galerie — vyhledávání existujících vygenerovaných obrázků
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryImages, setGalleryImages] = useState<Array<{ url: string; name: string; type: 'illustration' | 'photo'; topic: string; dataSetId: string }>>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryTypeFilter, setGalleryTypeFilter] = useState<'all' | 'illustration' | 'photo'>('all');
  // Regen picker – zobrazuje se inline na kartě ilustrace/fotky
  const [regenPicker, setRegenPicker] = useState<{ id: string; type: 'illustration' | 'photo' } | null>(null);
  const [regenPickerModel, setRegenPickerModel] = useState<'pro' | 'flash'>('flash');
  const [regenPickerPrompt, setRegenPickerPrompt] = useState<string>('');
  const [regenGeneratingId, setRegenGeneratingId] = useState<string | null>(null);
  // Karousel index: { illId -> index } — 0 = originál, 1+ = varianty
  const [variantIndex, setVariantIndex] = useState<Record<string, number>>({});
  // Lightbox
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  // Charts
  const [chartSuggestions, setChartSuggestions] = useState<any[]>([]);
  const [chartSuggestionsLoading, setChartSuggestionsLoading] = useState(false);
  const [chartCustomDesc, setChartCustomDesc] = useState('');
  const [chartData, setChartData] = useState<{ columns: string[]; rows: string[][] } | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'area' | 'radar'>('bar');
  const [chartTitle, setChartTitle] = useState('');
  const [chartGeneratingData, setChartGeneratingData] = useState(false);
  const [chartSaving, setChartSaving] = useState(false);
  const chartPreviewRef = useRef<HTMLDivElement>(null);
  // Maps
  const [mapSuggestions, setMapSuggestions] = useState<any[]>([]);
  const [mapSuggestionsLoading, setMapSuggestionsLoading] = useState(false);
  const [mapGeneratingId, setMapGeneratingId] = useState<string | null>(null);
  const [mapSaving, setMapSaving] = useState(false);
  const [mapPreview, setMapPreview] = useState<SavedMap | null>(null);
  const [mapEdit,    setMapEdit]    = useState<SavedMap | null>(null);

  const saveMediaToDB = useCallback(async (dataSetId: string, mediaUpdates: Record<string, any>) => {
    const { data, error: readError } = await supabase
      .from('topic_data_sets')
      .select('media')
      .eq('id', dataSetId)
      .single();
    if (readError) {
      console.error('[saveMediaToDB] Read error:', readError);
      throw readError;
    }
    const currentMedia = data?.media || {};
    const rawMerged = { ...currentMedia, ...mediaUpdates };

    // GUARD: strip any base64 before saving — base64 in DB = Disk IO death
    const mergedMedia = stripBase64FromObject(rawMerged) as Record<string, any>;

    const { error: writeError } = await supabase
      .from('topic_data_sets')
      .update({ media: mergedMedia })
      .eq('id', dataSetId);
    if (writeError) {
      console.error('[saveMediaToDB] Write error:', writeError);
      throw writeError;
    }
    return mergedMedia;
  }, []);

  const handleSaveEditedMap = useCallback(async (updated: SavedMap) => {
    if (!selectedDataSet) return;
    const existing: SavedMap[] = selectedDataSet.media?.savedMaps || [];
    const newList = existing.map((m: SavedMap) => m.id === updated.id ? updated : m);
    await saveMediaToDB(selectedDataSet.id, { savedMaps: newList });
    setSelectedDataSet((prev: any) => ({
      ...prev,
      media: { ...prev.media, savedMaps: newList }
    }));
    setMapEdit(null);
    toast.success(`Mapa "${updated.title}" uložena`);
  }, [selectedDataSet, saveMediaToDB]);

  // Material regeneration state
  const [regeneratingMaterialId, setRegeneratingMaterialId] = useState<string | null>(null);
  const [materialFeedback, setMaterialFeedback] = useState<string>('');
  const [showFeedbackFor, setShowFeedbackFor] = useState<string | null>(null);
  const [savingMaterials, setSavingMaterials] = useState(false);

  // Dvoustupňové generování worksheetu
  const [worksheetContentPlan, setWorksheetContentPlan] = useState<any | null>(null);
  const [worksheetPlanDataSet, setWorksheetPlanDataSet] = useState<any | null>(null);
  const [worksheetPlanStep, setWorksheetPlanStep] = useState<'idle' | 'planning' | 'review' | 'designing' | 'done'>('idle');

  // Dvoustupňové generování listu učebnice
  const [textbookContentPlan, setTextbookContentPlan] = useState<any | null>(null);
  const [textbookPlanDataSet, setTextbookPlanDataSet] = useState<any | null>(null);
  const [textbookPlanStep, setTextbookPlanStep] = useState<'idle' | 'planning' | 'review' | 'designing' | 'done'>('idle');

  // RAG debug info — ukáže co bylo nalezeno a jak se to použilo v promptu
  // const [ragDebugInfo, setRagDebugInfo] = useState<{ examples: any[]; ragSection: string } | null>(null);
  // const [ragDebugOpen, setRagDebugOpen] = useState(false);

  // Agent 2 debug — prompt + raw výstup
  // const [agent2Debug, setAgent2Debug] = useState<{ prompt?: string; raw?: string } | null>(null);
  // const [agent2DebugTab, setAgent2DebugTab] = useState<'prompt' | 'raw'>('prompt');

  // Výběr layout typů pro generování listu učebnice

  // Vlastní výběr obrázků uživatelem (přepíše výběr Agenta 1)
  // Klíč = url obrázku, hodnota = { selected, placement }
  const [userImageSelection, setUserImageSelection] = useState<Record<string, { selected: boolean; placement: string }>>({});
  // Klik na materiál = další sloupec s detailem + chat
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState<number | null>(null);
  // RAG přidávání – trackuje ID materiálů právě přidávaných do RAG
  const [addingToRag, setAddingToRag] = useState<Set<string>>(new Set());
  const [inRag, setInRag] = useState<Set<string>>(new Set());
  // Lekce: wizard s návrhem témat + chat pro popis
  const [lessonWizardOpen, setLessonWizardOpen] = useState(false);
  const [lessonSuggestedTopics, setLessonSuggestedTopics] = useState<string[]>([]);
  const [lessonSelectedTopics, setLessonSelectedTopics] = useState<Set<string>>(new Set());
  const [lessonSelectedCompetencies, setLessonSelectedCompetencies] = useState<Set<number>>(new Set());
  const [lessonSelectedFacts, setLessonSelectedFacts] = useState<Set<number>>(new Set());
  const [lessonDescription, setLessonDescription] = useState('');
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [lessonJustGenerated, setLessonJustGenerated] = useState(false);
  
  // =====================================================
  // LOGGING
  // =====================================================
  
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      message,
      type
    }]);
  }, []);
  
  // =====================================================
  // DATA LOADING
  // =====================================================
  
  const loadDataSets = useCallback(async () => {
    if (!selectedSubject || !selectedGrade) return;
    
    setDataSetsLoading(true);
    addLog(`Načítám DataSety pro ${SUBJECT_NAMES[selectedSubject]} ${selectedGrade}. ročník...`);
    
    try {
      // Načítáme jen metadata + generated_materials (bez content/rvp — ty jsou velké a lazy-loadují se při výběru)
      const { data, error } = await supabase
        .from('topic_data_sets')
        .select('id, topic, status, grade, subject_code, generated_materials, bloom_level, context_summary, learning_unit_id, quality_score, quality_flags, teacher_note, created_at, updated_at, milestone, milestone_data')
        .eq('subject_code', selectedSubject)
        .eq('grade', selectedGrade)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setDataSets(data || []);
      addLog(`Načteno ${data?.length || 0} DataSetů`, 'success');
    } catch (err: any) {
      addLog(`Chyba načítání: ${err.message}`, 'error');
    } finally {
      setDataSetsLoading(false);
    }
  }, [selectedSubject, selectedGrade, addLog]);
  
  // Načíst RVP data a týdenní plány z DB
  const loadRvpAndPlans = useCallback(async () => {
    if (!selectedSubject || !selectedGrade) return;
    try {
      const [rvpRes, plansRes] = await Promise.all([
        supabase
          .from('curriculum_rvp_data')
          .select('id, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, grade')
          .eq('subject_code', selectedSubject)
          .eq('grade', selectedGrade)
          .order('order_index'),
        supabase
          .from('curriculum_weekly_plans')
          .select(`
            id, week_number, month_name, topic_title, hours_allocated, learning_goals, rvp_data_id,
            learning_unit:learning_unit_id (
              id, title, bloom_level, material_types, weeks, hours,
              new_concepts, prerequisite_concepts, already_covered_summary,
              learning_goals, order_in_topic, order_global
            )
          `)
          .eq('subject_code', selectedSubject)
          .eq('grade', selectedGrade)
          .order('week_number'),
      ]);
      console.log('[CurriculumFactory] loadRvpAndPlans:', {
        subject: selectedSubject, grade: selectedGrade,
        rvpCount: rvpRes.data?.length, rvpError: rvpRes.error,
        plansCount: plansRes.data?.length, plansError: plansRes.error,
      });
      setRvpItems(rvpRes.data || []);
      setWeeklyPlanItems(plansRes.data || []);
    } catch (err) {
      console.error('[CurriculumFactory] loadRvpAndPlans error:', err);
    }
  }, [selectedSubject, selectedGrade]);

  // Load data when subject/grade changes
  useEffect(() => {
    if (selectedSubject && selectedGrade) {
      loadDataSets();
      loadRvpAndPlans();
    }
  }, [selectedSubject, selectedGrade, loadDataSets, loadRvpAndPlans]);
  
  
  // Lazy load heavy fields (media, content, rvp) when DataSet is selected
  const loadMediaForDataSet = useCallback(async (dataSetId: string) => {
    try {
      const { data, error } = await supabase
        .from('topic_data_sets')
        .select('media, content, rvp')
        .eq('id', dataSetId)
        .single();
      
      if (error) throw error;
      
      // Guard against race condition: only apply if the user is still on the same dataset
      setSelectedDataSet((prev: any) => {
        if (!prev || prev.id !== dataSetId) return prev;
        return {
          ...prev,
          media: data?.media || {},
          content: data?.content || prev.content || {},
          rvp: data?.rvp || prev.rvp || {},
        };
      });
      
      // Also update in the list for AI generation context
      setDataSets(prev => prev.map(ds => 
        ds.id === dataSetId
          ? { ...ds, media: data?.media || {}, content: data?.content || ds.content || {}, rvp: data?.rvp || ds.rvp || {} }
          : ds
      ));
    } catch (err: any) {
      addLog(`Chyba načítání detailu: ${err.message}`, 'error');
    }
  }, [addLog]);
  
  // Load media when DataSet is selected — always reload to avoid stale data
  useEffect(() => {
    if (selectedDataSet?.id) {
      loadMediaForDataSet(selectedDataSet.id);
    }
  }, [selectedDataSet?.id]); // intentionally only depend on id change, not on loadMediaForDataSet
  
  // Při přepnutí ze sekce Materiály zrušit výběr materiálu a lekce wizard
  useEffect(() => {
    if (selectedDataSetSection !== 'materials') {
      setSelectedMaterialIndex(null);
      setLessonWizardOpen(false);
    }
    // Při přepnutí na galerii automaticky načíst obrázky
    if (selectedDataSetSection === 'gallery' && galleryImages.length === 0) {
      (async () => {
        if (!selectedDataSet) return;
        setGalleryLoading(true);
        try {
          const { data } = await supabase
            .from('topic_data_sets')
            .select('id, topic, subject_code, grade, media')
            .not('media', 'is', null)
            .neq('id', selectedDataSet.id)
            .order('updated_at', { ascending: false })
            .limit(50);
          const result: typeof galleryImages = [];
          for (const ds of data || []) {
            const media = ds.media as any;
            if (!media) continue;
            for (const ill of (media.generatedIllustrations || [])) {
              if (ill?.url) result.push({ url: ill.url, name: ill.name || 'Ilustrace', type: 'illustration', topic: ds.topic, dataSetId: ds.id });
            }
            for (const photo of (media.generatedPhotos || [])) {
              if (photo?.url) result.push({ url: photo.url, name: photo.name || 'Fotka', type: 'photo', topic: ds.topic, dataSetId: ds.id });
            }
          }
          setGalleryImages(result);
        } finally {
          setGalleryLoading(false);
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDataSetSection]);
  
  // =====================================================
  // MILESTONES – ruční přidání
  // =====================================================

  const handleAddMilestones = useCallback(async () => {
    if (!selectedSubject || !selectedGrade || isMilestonesRunning) return;
    setIsMilestonesRunning(true);
    addLog('🏁 Spouštím generování uzlových bodů...');
    try {
      const result = await runMilestonesOnly(
        selectedSubject,
        selectedGrade,
        rvpItems as any,
        (msg) => addLog(msg)
      );
      await loadDataSets();
      if (result.created > 0) {
        toast.success(`Přidáno ${result.created} uzlových bodů`);
      } else {
        toast.info('Žádné nové uzlové body — všechny už existují');
      }
    } catch (err: any) {
      addLog(`❌ Chyba: ${err.message}`, 'error');
      toast.error(`Chyba: ${err.message}`);
    } finally {
      setIsMilestonesRunning(false);
    }
  }, [selectedSubject, selectedGrade, isMilestonesRunning, rvpItems, addLog, loadDataSets]);

  // Rozdělí datasety mezi skupiny dle RVP Scout (klientsky, bez DB)
  const handleGroupDatasets = useCallback(() => {
    const milestones = dataSets.filter(ds => ds.milestone);
    const regular = dataSets.filter(ds => !ds.milestone);
    if (regular.length === 0) return;

    // === PRIMÁRNÍ LOOKUP: learning_unit_id → rvpTopic ===
    // Každý dataset má learning_unit_id, každý weekly plan má learning_unit.id + rvp_data_id
    const luToRvpTopic = new Map<string, string>(); // learningUnitId → rvpTopic
    for (const plan of weeklyPlanItems) {
      const luId = plan.learning_unit?.id;
      if (!luId || !plan.rvp_data_id) continue;
      const rvpItem = rvpItems.find(r => r.id === plan.rvp_data_id);
      if (rvpItem) {
        luToRvpTopic.set(luId, rvpItem.topic || rvpItem.thematic_area || plan.topic_title || '');
      }
    }

    // === ZÁLOŽNÍ LOOKUP: topic_title (přesný název) → rvpTopic ===
    const topicToRvpTopic = new Map<string, string>();
    for (const plan of weeklyPlanItems) {
      const planTopic = plan.topic_title || plan.topic || '';
      if (!planTopic) continue;
      const rvpItem = rvpItems.find(r => r.id === plan.rvp_data_id);
      if (rvpItem) {
        topicToRvpTopic.set(planTopic, rvpItem.topic || rvpItem.thematic_area || planTopic);
      }
    }

    const dsMap = new Map<string, string>(); // datasetId → rvpTopic
    const areaDatasets = new Map<string, TopicDataSet[]>(); // rvpTopic → datasets

    for (const ds of regular) {
      // 1. Přes learning_unit_id (nejspolehlivější — cizí klíč)
      // 2. Přes přesný název topic_title
      // 3. Přes rvp.thematicArea uložené v datasetu
      // 4. Fallback: Ostatní
      const group =
        (ds.learning_unit_id && luToRvpTopic.get(ds.learning_unit_id)) ||
        topicToRvpTopic.get(ds.topic) ||
        ds.rvp?.thematicArea ||
        'Ostatní';
      dsMap.set(ds.id, group);
      if (!areaDatasets.has(group)) areaDatasets.set(group, []);
      areaDatasets.get(group)!.push(ds);
    }

    // Přiřadit milestone ke každé skupině
    const msMap = new Map<string, string>(); // group → milestoneId
    for (const [group, aDs] of areaDatasets) {
      const topicsInGroup = new Set(aDs.map(d => d.topic));
      const ms = milestones.find(m => {
        const md = (m as any).milestone_data || m.milestoneData || {};
        // 1. Shoda přes coveredTopics
        if ((md.coveredTopics ?? []).some((t: string) => topicsInGroup.has(t))) return true;
        // 2. Shoda přes název milestonu: "Uzavření: Rozmanitost přírody" → "Rozmanitost přírody"
        const msTopic = (m.topic || '').replace(/^Uzavř[eě]n[íi]:\s*/i, '').trim();
        if (msTopic && msTopic === group) return true;
        // 3. Shoda přes topicGroupName
        const groupName = md.topicGroupName || '';
        if (groupName && groupName === group) return true;
        return false;
      });
      if (ms) { msMap.set(group, ms.id); }
    }

    setDsGroupMap(dsMap);
    setGroupMilestoneMap(msMap);
    // Zachovat selectedGroupId pokud je stále validní skupina, jinak reset
    setSelectedGroupId(prev => (prev && dsMap.size > 0 && [...dsMap.values()].includes(prev)) ? prev : null);
  }, [dataSets, weeklyPlanItems, rvpItems]);

  // Auto-seskupení: spustí se jen jednou když jsou k dispozici všechna data
  // a groupování ještě neproběhlo (dsGroupMap.size === 0)
  useEffect(() => {
    if (dsGroupMap.size > 0) return; // Už seskupeno — neresetovat výběr uživatele
    const hasDatasets = dataSets.some(ds => !ds.milestone);
    const hasRvp = rvpItems.length > 0;
    const hasPlans = weeklyPlanItems.length > 0;
    if (hasDatasets && hasRvp && hasPlans) {
      handleGroupDatasets();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSets.length, rvpItems.length, weeklyPlanItems.length]);

  // =====================================================
  // PIPELINE
  // =====================================================
  
  const runPipeline = async () => {
    if (!selectedSubject || !selectedGrade) return;
    
    setIsRunning(true);
    setConsoleOpen(true);
    addLog(`🚀 Spouštím pipeline pro ${SUBJECT_NAMES[selectedSubject]} ${selectedGrade}. ročník`);
    
    try {
      const agentProgress = (msg: string) => addLog(msg);

      // ── Agent 1: RVP Scout ──────────────────────────────────────────────
      setAgents(prev => prev.map(a => a.id === 1 ? { ...a, status: 'running' } : a));
      addLog('▶️ RVP Scout: Spouštím...');
      const agent1Result = await runAgent1(selectedSubject, selectedGrade, agentProgress);
      setAgents(prev => prev.map(a => a.id === 1 ? { ...a, status: 'completed' } : a));
      addLog(`✅ RVP Scout: Dokončeno – ${agent1Result.topicsFound} témat`, 'success');

      // Načíst a zobrazit RVP data okamžitě
      await loadRvpAndPlans();

      // Načíst RVP data pro agenta 2 a mapovat snake_case → camelCase
      const { data: rvpRaw } = await supabase
        .from('curriculum_rvp_data')
        .select('*')
        .eq('subject_code', selectedSubject)
        .eq('grade', selectedGrade)
        .order('order_index');
      const rvpData = (rvpRaw || []).map((r: any) => ({
        id: r.id,
        subjectCode: r.subject_code,
        grade: r.grade,
        thematicArea: r.thematic_area,
        topic: r.topic,
        expectedOutcomes: r.expected_outcomes || [],
        keyCompetencies: r.key_competencies || [],
        recommendedHours: r.recommended_hours,
        orderIndex: r.order_index,
        rvpRevision: r.rvp_revision,
        difficultyLevel: r.difficulty_level || 'medium',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      // ── Agent 2: Planner ────────────────────────────────────────────────
      setAgents(prev => prev.map(a => a.id === 2 ? { ...a, status: 'running' } : a));
      addLog('▶️ Planner: Spouštím...');
      const agent2Result = await runAgent2(selectedSubject, selectedGrade, rvpData, agentProgress);
      setAgents(prev => prev.map(a => a.id === 2 ? { ...a, status: 'completed' } : a));
      addLog(`✅ Planner: Dokončeno – ${agent2Result.learningUnitsCreated ?? agent2Result.weeklyPlansCreated} learning units, ${agent2Result.weeklyPlansCreated} týdnů`, 'success');

      // Načíst a zobrazit týdenní plány okamžitě
      await loadRvpAndPlans();

      // Načíst týdenní plány pro agenta 3 a mapovat snake_case → camelCase
      const { data: plansRaw } = await supabase
        .from('curriculum_weekly_plans')
        .select('*')
        .eq('subject_code', selectedSubject)
        .eq('grade', selectedGrade)
        .order('week_number');
      const weeklyPlans = (plansRaw || []).map((p: any) => ({
        id: p.id,
        subjectCode: p.subject_code,
        grade: p.grade,
        weekNumber: p.week_number,
        monthName: p.month,
        topicTitle: p.topic,
        topicDescription: p.topic_description,
        rvpDataId: p.rvp_data_id,
        learningGoals: p.learning_objectives || [],
        hoursAllocated: p.hours_allocated,
        status: p.status || 'draft',
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      // ── Agent 3: Data Collector ────────────────────────────────────────────
      setAgents(prev => prev.map(a => a.id === 3 ? { ...a, status: 'running' } : a));
      addLog('▶️ Data Collector: Spouštím...');

      // Refresh UI po každém datasetu — Creator a Publisher se nespouštějí automaticky
      const onDataSetCreated = async (_dataSetId: string, _topic: string) => {
        await loadDataSets();
      };

      const agent3Result = await runAgent3DataSet(
        selectedSubject, selectedGrade,
        weeklyPlans, rvpData,
        agentProgress,
        false,
        onDataSetCreated
      );
      setAgents(prev => prev.map(a => a.id === 3 ? { ...a, status: 'completed' } : a));
      addLog(`✅ Data Collector: Dokončeno – ${agent3Result.dataSetsCreated} DataSetů`, 'success');

      addLog('🎉 Datasety jsou připraveny. Materiály a publikování spusť ručně přes Creator / Publisher.', 'success');
      toast.success('Datasety vytvořeny!');

      // Reload data
      await loadDataSets();
      await loadRvpAndPlans();
      
    } catch (err: any) {
      addLog(`❌ Chyba: ${err.message}`, 'error');
      toast.error(`Chyba: ${err.message}`);
      setAgents(prev => prev.map(a => a.status === 'running' ? { ...a, status: 'error' } : a));
    } finally {
      setIsRunning(false);
    }
  };
  
  // =====================================================
  // BUILD COLUMN ITEMS
  // =====================================================
  
  const getAgentOutputItems = (): ColumnItem[] => {
    if (!selectedAgentId) return [];
    
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) return [];
    
    if (agent.outputType === 'rvp') {
      // Agent 1 – RVP témata
      return rvpItems.map(r => ({
        id: r.id,
        label: r.topic || r.thematic_area,
        type: 'item' as const,
        icon: <BookOpen className="w-4 h-4 text-blue-500" />,
        badge: (r.expected_outcomes || []).length,
        data: r,
      }));
    }

    if (agent.outputType === 'plans') {
      // Agent 2 – týdenní plány
      return weeklyPlanItems.map(p => ({
        id: p.id,
        label: `Týden ${p.week_number}${p.month_name ? ` – ${p.month_name}` : ''}: ${p.topic_title || p.topic}`,
        type: 'item' as const,
        icon: <Calendar className="w-4 h-4 text-violet-500" />,
        badge: p.hours_allocated,
        data: p,
      }));
    }

    if (agent.outputType === 'datasets') {
      const milestones = dataSets.filter(ds => ds.milestone);
      const regular = dataSets.filter(ds => !ds.milestone);

      // Ve skupinovém módu agent column skryjeme (vrátíme prázdné — sloupce Groups+Datasets to nahradí)
      if (dsGroupMap.size > 0) return [];

      // Pokud nejsou milestony, vrátíme flat list
      if (milestones.length === 0) {
        return regular.map(ds => ({
          id: ds.id,
          label: ds.topic,
          type: 'folder' as const,
          icon: <Database className="w-4 h-4 text-pink-500" />,
          badge: (ds.generated_materials || []).length,
          data: ds,
        }));
      }

      // Seřadit milestony chronologicky
      const sortedMilestones = [...milestones].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const sortedRegular = [...regular].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Použij dsGroupMap pokud je k dispozici, jinak chronologické pořadí
      const getGroupId = (ds: TopicDataSet): string | null => {
        if (dsGroupMap.size > 0) return dsGroupMap.get(ds.id) ?? null;
        return null;
      };

      const result: ColumnItem[] = [];

      if (dsGroupMap.size > 0) {
        // Skupinové zobrazení dle dsGroupMap
        for (const ms of sortedMilestones) {
          const groupDs = sortedRegular.filter(d => getGroupId(d) === ms.id);
          const groupLabel = ms.milestoneData?.topicGroupName ?? ms.topic.replace(/^Uzavření:\s*/i, '');
          result.push({
            id: `group-${ms.id}`,
            label: groupLabel,
            type: 'header' as const,
            icon: <Folder className="w-3.5 h-3.5 text-slate-400" />,
          });
          for (const d of groupDs) {
            result.push({
              id: d.id,
              label: d.topic,
              type: 'folder' as const,
              icon: <Database className="w-4 h-4 text-pink-500" />,
              badge: (d.generated_materials || []).length,
              data: d,
            });
          }
          result.push({
            id: ms.id,
            label: ms.topic,
            type: 'folder' as const,
            icon: <Flag className="w-4 h-4 text-amber-500" />,
            badge: '🏁',
            data: ms,
            variant: 'milestone' as const,
            style: { background: '#fffbeb', borderLeft: '3px solid #f59e0b' },
          });
        }
        // Datasety bez skupiny
        const orphans = sortedRegular.filter(d => !dsGroupMap.has(d.id));
        if (orphans.length > 0) {
          result.push({ id: 'group-orphans', label: 'Ostatní', type: 'header' as const, icon: <Folder className="w-3.5 h-3.5 text-slate-400" /> });
          for (const d of orphans) {
            result.push({ id: d.id, label: d.topic, type: 'folder' as const, icon: <Database className="w-4 h-4 text-pink-500" />, badge: (d.generated_materials || []).length, data: d });
          }
        }
      } else {
        // Flat list — bez seskupení (dokud uživatel neklikne Rozmístit)
        for (const d of sortedRegular) {
          result.push({
            id: d.id,
            label: d.topic,
            type: 'folder' as const,
            icon: <Database className="w-4 h-4 text-pink-500" />,
            badge: (d.generated_materials || []).length,
            data: d,
          });
        }
        for (const ms of sortedMilestones) {
          result.push({
            id: ms.id,
            label: ms.topic,
            type: 'folder' as const,
            icon: <Flag className="w-4 h-4 text-amber-500" />,
            badge: '🏁',
            data: ms,
            variant: 'milestone' as const,
            style: { background: '#fffbeb', borderLeft: '3px solid #f59e0b' },
          });
        }
      }

      return result;
    }
    
    return [];
  };
  
  /** Vrátí složky (skupiny) pro Data Collector seřazené dle pořadí RVP Scout */
  const getGroupItems = (): ColumnItem[] => {
    if (dsGroupMap.size === 0) return [];
    const regular = dataSets.filter(ds => !ds.milestone);

    // Počty datasetů v každé skupině
    const areas = new Map<string, number>(); // area → count
    for (const ds of regular) {
      const area = dsGroupMap.get(ds.id) ?? 'Ostatní';
      areas.set(area, (areas.get(area) ?? 0) + 1);
    }

    // Pořadí skupin dle RVP Scout (rvpItems jsou seřazeny dle order_index)
    const rvpOrder = new Map<string, number>();
    rvpItems.forEach((r, i) => {
      const key = r.topic || r.thematic_area || '';
      if (key && !rvpOrder.has(key)) rvpOrder.set(key, i);
    });

    return [...areas.entries()]
      .sort(([a], [b]) => {
        const orderA = rvpOrder.get(a) ?? 9999;
        const orderB = rvpOrder.get(b) ?? 9999;
        return orderA - orderB;
      })
      .map(([area, count]) => ({
      id: area,
      label: area,
      type: 'folder' as const,
      icon: <Folder className="w-4 h-4 text-slate-500" />,
      badge: count,
    }));
  };

  /** Vrátí datasety ve vybrané thematic area skupině + milestone na konci */
  const getDatasetsInGroup = (): ColumnItem[] => {
    if (!selectedGroupId) return [];

    // Pořadí dle learning unit (order_global z weeklyPlanItems)
    const luOrder = new Map<string, number>();
    weeklyPlanItems.forEach((p, i) => {
      const luId = p.learning_unit?.id;
      if (luId && !luOrder.has(luId)) luOrder.set(luId, p.learning_unit?.order_global ?? i);
    });

    const regular = dataSets
      .filter(ds => !ds.milestone)
      .sort((a, b) => {
        const oA = (a.learning_unit_id && luOrder.get(a.learning_unit_id)) ?? 9999;
        const oB = (b.learning_unit_id && luOrder.get(b.learning_unit_id)) ?? 9999;
        return oA !== oB ? oA - oB : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    const groupDs = regular.filter(d => (dsGroupMap.get(d.id) ?? 'Ostatní') === selectedGroupId);

    const items: ColumnItem[] = groupDs.map(d => ({
      id: d.id,
      label: d.topic,
      type: 'folder' as const,
      icon: <Database className="w-4 h-4 text-pink-500" />,
      badge: (d.generated_materials || []).length,
      data: d,
    }));

    // Milestone na konci skupiny
    const msId = groupMilestoneMap.get(selectedGroupId);
    const ms = msId ? dataSets.find(d => d.id === msId) : undefined;
    if (ms) {
      // Použij název skupiny (RVP téma) místo generického "Obecné"
      const msLabel = ms.topic.toLowerCase().includes('obecné') || ms.topic.toLowerCase().includes('obecne')
        ? `Uzavření: ${selectedGroupId}`
        : ms.topic;
      items.push({
        id: ms.id,
        label: msLabel,
        type: 'folder' as const,
        icon: <Flag className="w-4 h-4 text-amber-500" />,
        badge: '🏁',
        data: ms,
        variant: 'milestone' as const,
        style: { background: '#fffbeb', borderLeft: '3px solid #f59e0b' },
      });
    }
    return items;
  };

  /** Pro milestone vrátí datasety patřící do jeho skupiny */
  const getGroupDatasetsForMilestone = (milestoneId: string): TopicDataSet[] => {
    const regular = dataSets.filter(ds => !ds.milestone);
    if (dsGroupMap.size > 0) {
      // Najdi thematic area tohoto milestonu
      const area = [...groupMilestoneMap.entries()].find(([, id]) => id === milestoneId)?.[0];
      if (area) return regular.filter(d => dsGroupMap.get(d.id) === area);
    }
    // fallback: dle coveredTopics nebo shody tématu
    const ms = dataSets.find(d => d.id === milestoneId);
    const md = (ms as any)?.milestone_data || ms?.milestoneData || {};
    const covered = new Set(md.coveredTopics ?? []);
    if (covered.size > 0) return regular.filter(d => covered.has(d.topic));
    // fallback přes název: "Uzavření: Rozmanitost přírody" → filtruj dle dsGroupMap skupiny
    const msTopic = (ms?.topic || '').replace(/^Uzavř[eě]n[íi]:\s*/i, '').trim();
    return msTopic ? regular.filter(d => (dsGroupMap.get(d.id) ?? '') === msTopic) : [];
  };

  /** Vrátí "efektivní" dataset pro zobrazení sekcí.
   *  Pro milestone: agregruje data ze všech datasetů skupiny + přidá vlastní milestoneData. */
  const getEffectiveDataSet = (): TopicDataSet | null => {
    if (!selectedDataSet) return null;
    if (!selectedDataSet.milestone) return selectedDataSet;

    const groupDs = getGroupDatasetsForMilestone(selectedDataSet.id);
    if (groupDs.length === 0) return selectedDataSet;

    const merge = <T,>(arr: T[][] ) => arr.flat().filter(Boolean);

    const aggregated: TopicDataSet = {
      ...selectedDataSet,
      content: {
        ...selectedDataSet.content,
        keyTerms: merge(groupDs.map(d => d.content?.keyTerms ?? [])),
        keyFacts: merge(groupDs.map(d => d.content?.keyFacts ?? [])),
        keyPersons: merge(groupDs.map(d => d.content?.keyPersons ?? [])),
        timeline: merge(groupDs.map(d => d.content?.timeline ?? [])),
        exampleTasks: merge(groupDs.map(d => d.content?.exampleTasks ?? [])),
      },
      rvp: {
        ...selectedDataSet.rvp,
        expectedOutcomes: merge(groupDs.map(d => d.rvp?.expectedOutcomes ?? [])),
        competencies: merge(groupDs.map(d => d.rvp?.competencies ?? [])),
      },
      media: {
        ...selectedDataSet.media,
        images: merge(groupDs.map(d => d.media?.images ?? [])),
        generatedIllustrations: merge(groupDs.map(d => d.media?.generatedIllustrations ?? [])),
        generatedPhotos: merge(groupDs.map(d => d.media?.generatedPhotos ?? [])),
        charts: merge(groupDs.map(d => d.media?.charts ?? [])),
        savedMaps: merge(groupDs.map(d => d.media?.savedMaps ?? [])),
        galleryImages: merge(groupDs.map(d => d.media?.galleryImages ?? [])),
      },
      generated_materials: merge(groupDs.map(d => d.generated_materials ?? [])),
    };
    return aggregated;
  };

  const getDataSetSections = (): ColumnItem[] => {
    if (!selectedDataSet) return [];
    // Vždy zobrazuj data selectedDataSetu — pro milestone NECHCEME agregaci skupiny
    const ds = selectedDataSet;
    
    const isMilestone = !!selectedDataSet.milestone;
    const totalMediaCount = (ds.media?.images?.length || 0) +
      (ds.media?.generatedIllustrations?.length || 0) +
      (ds.media?.generatedPhotos?.length || 0) +
      (ds.media?.charts?.length || 0) +
      (ds.media?.savedMaps?.length || 0) +
      (ds.media?.galleryImages?.length || 0);

    const sections: ColumnItem[] = [
      {
        id: 'data',
        label: 'Podklady',
        type: 'folder',
        icon: <Database className="w-4 h-4 text-blue-500" />,
        badge: (ds.content?.keyTerms?.length || 0) + 
               (ds.content?.keyFacts?.length || 0) +
               (ds.rvp?.expectedOutcomes?.length || 0)
      },
      ...(isMilestone ? [
        {
          id: 'all-media',
          label: 'Média',
          type: 'folder' as const,
          icon: <ImageIcon className="w-4 h-4 text-violet-500" />,
          badge: totalMediaCount,
        },
      ] : [
        {
          id: 'images',
          label: 'Obrázky z webu',
          type: 'folder' as const,
          icon: <ImageIcon className="w-4 h-4 text-emerald-500" />,
          badge: (ds.media?.images?.length || 0)
        },
        {
          id: 'illustrations',
          label: 'Ilustrace',
          type: 'folder' as const,
          icon: <Sparkles className="w-4 h-4 text-purple-500" />,
          badge: (ds.media?.generatedIllustrations?.length || 0)
        },
        {
          id: 'photos',
          label: 'Fotky',
          type: 'folder' as const,
          icon: <ImageIcon className="w-4 h-4 text-amber-500" />,
          badge: (ds.media?.generatedPhotos?.length || 0)
        },
        // image-groups skryto — skupiny jsou inline v sekci Ilustrace / Fotky
        {
          id: 'charts',
          label: 'Grafy',
          type: 'folder' as const,
          icon: <BarChart2 className="w-4 h-4 text-cyan-500" />,
          badge: (ds.media?.charts?.length || 0)
        },
        {
          id: 'maps',
          label: 'Mapy',
          type: 'folder' as const,
          icon: <MapIcon className="w-4 h-4 text-green-600" />,
          badge: (ds.media?.savedMaps?.length || 0)
        },
        {
          id: 'gallery',
          label: 'Z galerie',
          type: 'folder' as const,
          icon: <Sparkles className="w-4 h-4 text-fuchsia-500" />,
          badge: (ds.media?.galleryImages?.length || 0)
        },
      ]),
      {
        id: 'materials',
        label: 'Materiály',
        type: 'folder',
        icon: <FileText className="w-4 h-4 text-indigo-500" />,
        badge: (ds.generated_materials?.length || 0)
      }
    ];
    
    return sections;
  };
  
  // ── Custom illustration / photo generation ───────────────────────────────
  const handleCustomIllustration = async () => {
    if (!customIllustrationDesc.trim() || !selectedDataSet) return;
    const capturedId = selectedDataSet.id; // capture before any await
    setCustomIllustrationGenerating(true);
    addLog(`🎨 Generuji vlastní ilustraci: "${customIllustrationDesc}"...`);
    try {
      const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');
      const activeStyle = illustrationStyles.find(s => s.id === selectedStyleId) || illustrationStyles[0];
      // AI rozšíří popis na plnohodnotný prompt ve zvoleném stylu
      const enhancePrompt = `Jsi expert na tvorbu promptů pro AI generátor obrazů (Imagen).
Učitel chce ilustraci pro vzdělávací materiál (${selectedDataSet.grade}. třída ZŠ, předmět: ${selectedDataSet.subject_code}, téma: "${selectedDataSet.topic}").

Učitelův popis: "${customIllustrationDesc}"

Styl ilustrace: ${activeStyle.name}
Stylový prompt: "${activeStyle.prompt}"

Vytvoř krátký, konkrétní anglický prompt pro Imagen (max 250 znaků) kombinující popis a styl. Vrať POUZE prompt, žádný komentář.`;
      const enhancedPrompt = (await chatWithAIProxy([{ role: 'user', content: enhancePrompt }], 'gemini-3-flash')).trim();
      addLog(`📝 [${activeStyle.emoji} ${activeStyle.name}] Prompt: ${enhancedPrompt}`);

      const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
      const { processImageUrl } = await import('../../utils/supabase/upload-image');
      const result = await generateImageWithImagen(
        enhancedPrompt + '\n\nNO TEXT: Do not include any text, words, letters or labels.',
        { aspectRatio: '4:3', model: imageGenModel }
      );
      const rawIllUrl = result?.url || (result?.images?.[0] ? `data:${result.images[0].mimeType || 'image/png'};base64,${result.images[0].base64}` : null);
      if (!rawIllUrl) throw new Error('Generování selhalo – žádný obrázek nebyl vrácen');
      const finalUrl = await processImageUrl(rawIllUrl, `custom-ill-${Date.now()}`);
      const newIll = { id: `custom-${Date.now()}`, name: customIllustrationDesc, url: finalUrl, custom: true, style: activeStyle.id };
      const current = selectedDataSet.media?.generatedIllustrations || [];
      const mergedMedia = await saveMediaToDB(capturedId, { generatedIllustrations: [...current, newIll] });
      updateSelectedDataSetIfCurrent(capturedId, prev => ({ ...prev, media: mergedMedia }));
      setCustomIllustrationDesc('');
      addLog(`✅ Vlastní ilustrace vygenerována`, 'success');
      playSuccessSound();
      toast.success('Ilustrace vygenerována!');
    } catch (err: any) {
      addLog(`❌ Chyba: ${err.message}`, 'error');
      toast.error('Generování selhalo');
    } finally {
      setCustomIllustrationGenerating(false);
    }
  };

  const handleCustomPhoto = async () => {
    if (!customPhotoDesc.trim() || !selectedDataSet) return;
    const capturedId = selectedDataSet.id; // capture before any await
    setCustomPhotoGenerating(true);
    addLog(`📷 Generuji vlastní fotku: "${customPhotoDesc}"...`);
    try {
      const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');
      const enhancePrompt = `Jsi expert na tvorbu promptů pro AI generátor obrazů (Imagen).
Učitel chce fotorealistický snímek pro vzdělávací materiál (${selectedDataSet.grade}. třída ZŠ, předmět: ${selectedDataSet.subject_code}, téma: "${selectedDataSet.topic}").

Učitelův popis: "${customPhotoDesc}"

Vytvoř krátký, konkrétní anglický prompt pro Imagen (max 200 znaků). Styl: photorealistic, high quality, educational, natural lighting, no text, no people unless specifically requested. Vrať POUZE prompt, žádný komentář.`;
      const enhancedPrompt = (await chatWithAIProxy([{ role: 'user', content: enhancePrompt }], 'gemini-3-flash')).trim();
      addLog(`📝 Prompt: ${enhancedPrompt}`);

      const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
      const { processImageUrl } = await import('../../utils/supabase/upload-image');
      const result = await generateImageWithImagen(
        enhancedPrompt + '\n\nNO TEXT: Do not include any text, words, or labels.',
        { aspectRatio: '4:3', model: imageGenModel }
      );
      const rawPhotoUrl = result?.url || (result?.images?.[0] ? `data:${result.images[0].mimeType || 'image/png'};base64,${result.images[0].base64}` : null);
      if (!rawPhotoUrl) throw new Error('Generování selhalo – žádný obrázek nebyl vrácen');
      const finalUrl = await processImageUrl(rawPhotoUrl, `custom-photo-${Date.now()}`);
      const newPhoto = { id: `custom-${Date.now()}`, name: customPhotoDesc, url: finalUrl, custom: true };
      const current = selectedDataSet.media?.generatedPhotos || [];
      const mergedMedia = await saveMediaToDB(capturedId, { generatedPhotos: [...current, newPhoto] });
      updateSelectedDataSetIfCurrent(capturedId, prev => ({ ...prev, media: mergedMedia }));
      setCustomPhotoDesc('');
      addLog(`✅ Vlastní fotka vygenerována`, 'success');
      playSuccessSound();
      toast.success('Fotka vygenerována!');
    } catch (err: any) {
      addLog(`❌ Chyba: ${err.message}`, 'error');
      toast.error('Generování selhalo');
    } finally {
      setCustomPhotoGenerating(false);
    }
  };

  // ── Gantt view ──────────────────────────────────────────────────────────
  const renderGanttView = () => {
    const BLOOM_COLORS: Record<string, string> = {
      remember:  '#818cf8', understand: '#60a5fa', apply: '#34d399',
      analyze:   '#facc15', evaluate:   '#f97316', create:     '#f43f5e',
    };
    const BLOOM_LABELS: Record<string, string> = {
      remember: 'Zapamatovat', understand: 'Pochopit', apply: 'Aplikovat',
      analyze: 'Analyzovat', evaluate: 'Hodnotit', create: 'Tvořit',
    };
    const TOTAL_WEEKS = 40;
    const MONTH_NAMES = ['', 'Září', 'Říjen', 'Listopad', 'Prosinec', 'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen'];
    const weekToMonth = (w: number) => {
      if (w <= 4) return 1; if (w <= 8) return 2; if (w <= 12) return 3;
      if (w <= 14) return 4; if (w <= 18) return 5; if (w <= 22) return 6;
      if (w <= 26) return 7; if (w <= 30) return 8; if (w <= 35) return 9;
      return 10;
    };

    // Seřadit datasety – pokud mají week info přes weeklyPlanItems, jinak jen pořadí dle order
    const plansByTopic: Record<string, any[]> = {};
    weeklyPlanItems.forEach(p => {
      const key = p.topic_title || p.topic || 'Ostatní';
      if (!plansByTopic[key]) plansByTopic[key] = [];
      plansByTopic[key].push(p);
    });

    // Každý dataset → startWeek + endWeek z plánů
    const rows = dataSets.map((ds, dsIdx) => {
      const topicKey = ds.topic;
      const plans = plansByTopic[topicKey] || [];
      const weeks = plans.map((p: any) => p.week_number).filter(Boolean).sort((a: number, b: number) => a - b);
      const startWeek = weeks[0] || (dsIdx * 4 + 1);
      const endWeek = weeks[weeks.length - 1] || (startWeek + 3);
      return { ds, startWeek, endWeek };
    }).sort((a, b) => a.startWeek - b.startWeek);

    const colW = 18; // px per week
    const rowH = 40;
    const labelW = 170;
    const totalW = labelW + TOTAL_WEEKS * colW;

    // Group months for header
    const months: { label: string; startW: number; endW: number }[] = [];
    let curMonth = weekToMonth(1);
    let mStart = 1;
    for (let w = 2; w <= TOTAL_WEEKS + 1; w++) {
      const m = w <= TOTAL_WEEKS ? weekToMonth(w) : curMonth + 1;
      if (m !== curMonth) {
        months.push({ label: MONTH_NAMES[curMonth] || '', startW: mStart, endW: w - 1 });
        curMonth = m; mStart = w;
      }
    }

    const qualityColor = (score?: number) =>
      !score ? '#94a3b8' : score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

    return (
      <div style={{ flex: 1, overflow: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        {/* Legend */}
        <div style={{ padding: '10px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', background: 'white', flexShrink: 0 }}>
          {Object.entries(BLOOM_LABELS).map(([k, label]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: BLOOM_COLORS[k] }} />
              <span style={{ color: '#475569' }}>{label}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, fontSize: 11, color: '#64748b', alignItems: 'center' }}>
            <span>Skóre:</span>
            <span style={{ color: '#22c55e' }}>■ 80%+</span>
            <span style={{ color: '#f59e0b' }}>■ 60%+</span>
            <span style={{ color: '#ef4444' }}>■ &lt;60%</span>
          </div>
        </div>

        {/* Gantt table */}
        <div style={{ overflow: 'auto', flex: 1, padding: 16 }}>
          <div style={{ minWidth: totalW, userSelect: 'none' }}>
            {/* Month header */}
            <div style={{ display: 'flex', marginLeft: labelW, marginBottom: 2 }}>
              {months.map(m => (
                <div key={m.label} style={{ width: (m.endW - m.startW + 1) * colW, fontSize: 10, fontWeight: 600, color: '#64748b', textAlign: 'center', borderRight: '1px solid #e2e8f0', paddingBottom: 2 }}>
                  {m.label}
                </div>
              ))}
            </div>
            {/* Week numbers */}
            <div style={{ display: 'flex', marginLeft: labelW, marginBottom: 4 }}>
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(w => (
                <div key={w} style={{ width: colW, fontSize: 9, color: '#94a3b8', textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                  {w % 5 === 0 ? w : ''}
                </div>
              ))}
            </div>
            {/* Rows */}
            {rows.map(({ ds, startWeek, endWeek }) => {
              const bloom = ds.bloom_level || 'remember';
              const color = BLOOM_COLORS[bloom] || '#818cf8';
              const score = ds.quality_score;
              const flags = ds.quality_flags || [];
              const left = (startWeek - 1) * colW;
              const width = Math.max((endWeek - startWeek + 1) * colW, colW);
              const isSelected = selectedDataSet?.id === ds.id;
              return (
                <div key={ds.id} style={{ display: 'flex', alignItems: 'center', height: rowH, borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Label */}
                  <div style={{ width: labelW, flexShrink: 0, paddingRight: 8, overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ds.topic}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 2, alignItems: 'center' }}>
                      {score !== undefined && score !== null && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: qualityColor(score) }}>{score}%</span>
                      )}
                      {flags.length > 0 && (
                        <span style={{ fontSize: 9, color: '#ef4444' }} title={flags.join(', ')}>⚠️ {flags.length}</span>
                      )}
                    </div>
                  </div>
                  {/* Timeline area */}
                  <div style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
                    {/* Grid lines */}
                    {Array.from({ length: TOTAL_WEEKS }, (_, i) => (
                      <div key={i} style={{ position: 'absolute', left: i * colW, top: 0, bottom: 0, borderRight: `1px solid ${i % 4 === 3 ? '#e2e8f0' : '#f8fafc'}`, width: 0 }} />
                    ))}
                    {/* Bar */}
                    <div
                      onClick={() => {
                        // Strip media so we always fetch fresh — prevents stale data from previous dataset
                        setSelectedDataSet({ ...ds, media: undefined });
                        setSelectedDataSetSection(null);
                        setChartSuggestions([]);
                        setMapSuggestions([]);
                      }}
                      style={{
                        position: 'absolute',
                        left, width,
                        height: 26,
                        borderRadius: 6,
                        backgroundColor: color,
                        opacity: isSelected ? 1 : 0.75,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', paddingLeft: 6,
                        boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none',
                        transition: 'all 0.15s',
                        overflow: 'hidden',
                      }}
                      title={`${ds.topic} · Týden ${startWeek}–${endWeek} · ${BLOOM_LABELS[bloom] || bloom}`}
                    >
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ds.topic}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderGroupGanttView = () => {
    const TOTAL_WEEKS = 40;
    const MONTH_NAMES = ['', 'Září', 'Říjen', 'Listopad', 'Prosinec', 'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen'];
    const weekToMonth = (w: number) => {
      if (w <= 4) return 1; if (w <= 8) return 2; if (w <= 12) return 3;
      if (w <= 14) return 4; if (w <= 18) return 5; if (w <= 22) return 6;
      if (w <= 26) return 7; if (w <= 30) return 8; if (w <= 35) return 9;
      return 10;
    };
    const colW = 18;
    const rowH = 44;
    const labelW = 200;

    const GROUP_COLORS = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ec4899','#8b5cf6','#14b8a6','#f97316','#06b6d4'];

    const regular = dataSets.filter(ds => !ds.milestone);

    const months: { label: string; startW: number; endW: number }[] = [];
    let curMonth = weekToMonth(1);
    let mStart = 1;
    for (let w = 2; w <= TOTAL_WEEKS + 1; w++) {
      const m = w <= TOTAL_WEEKS ? weekToMonth(w) : curMonth + 1;
      if (m !== curMonth) {
        months.push({ label: MONTH_NAMES[curMonth] || '', startW: mStart, endW: w - 1 });
        curMonth = m; mStart = w;
      }
    }

    // Sestavit řádky ze skupin (dsGroupMap: datasetId → group label)
    const groupLabels = getGroupItems().map(g => g.id); // zachovat pořadí
    const rows = groupLabels.map((group, idx) => {
      const groupDs = regular.filter(d => (dsGroupMap.get(d.id) ?? 'Ostatní') === group);
      // Týdny z weeklyPlanItems pro témata v této skupině
      const topics = new Set(groupDs.map(d => d.topic));
      const weekNums = weeklyPlanItems
        .filter(p => topics.has(p.topic_title || p.topic || ''))
        .map(p => p.week_number)
        .filter(Boolean)
        .sort((a, b) => a - b);
      const startWeek = weekNums[0] || (idx * 5 + 1);
      const endWeek = weekNums[weekNums.length - 1] || (startWeek + Math.max(groupDs.length - 1, 3));
      // Najít milestone skupiny
      const msId = groupMilestoneMap.get(group);
      const ms = msId ? dataSets.find(d => d.id === msId) : undefined;
      return { group, label: group, startWeek, endWeek, count: groupDs.length, ms };
    });

    return (
      <div style={{ flex: 1, overflow: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflow: 'auto', flex: 1, padding: 16 }}>
          <div style={{ minWidth: labelW + TOTAL_WEEKS * colW, userSelect: 'none' }}>
            {/* Month header */}
            <div style={{ display: 'flex', marginLeft: labelW, marginBottom: 2 }}>
              {months.map(m => (
                <div key={m.label} style={{ width: (m.endW - m.startW + 1) * colW, fontSize: 10, fontWeight: 600, color: '#64748b', textAlign: 'center', borderRight: '1px solid #e2e8f0', paddingBottom: 2 }}>
                  {m.label}
                </div>
              ))}
            </div>
            {/* Week numbers */}
            <div style={{ display: 'flex', marginLeft: labelW, marginBottom: 4 }}>
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(w => (
                <div key={w} style={{ width: colW, fontSize: 9, color: '#94a3b8', textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                  {w % 5 === 0 ? w : ''}
                </div>
              ))}
            </div>
            {/* Rows */}
            {rows.map(({ group, label, startWeek, endWeek, count }, idx) => {
              const color = GROUP_COLORS[idx % GROUP_COLORS.length];
              const left = (startWeek - 1) * colW;
              const width = Math.max((endWeek - startWeek + 1) * colW, colW * 2);
              const isSelected = selectedGroupId === group;
              return (
                <div key={group}
                  style={{ display: 'flex', alignItems: 'center', height: rowH, borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: isSelected ? '#f0f9ff' : 'transparent' }}
                  onClick={() => { setSelectedGroupId(group); setDataCollectorView('list'); }}
                >
                  <div style={{ width: labelW, flexShrink: 0, paddingRight: 10, overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{count} datasetů · týdny {startWeek}–{endWeek}</div>
                  </div>
                  <div style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
                    {Array.from({ length: TOTAL_WEEKS }, (_, i) => (
                      <div key={i} style={{ position: 'absolute', left: i * colW, top: 0, bottom: 0, borderRight: `1px solid ${i % 4 === 3 ? '#e2e8f0' : '#f8fafc'}`, width: 0 }} />
                    ))}
                    <div style={{ position: 'absolute', left, width, height: 30, borderRadius: 6, backgroundColor: color, opacity: isSelected ? 1 : 0.7, display: 'flex', alignItems: 'center', paddingLeft: 8, overflow: 'hidden', boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 3px ${color}` : 'none' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Read-only media views for milestone aggregated view ──────────────────

  const MediaReadOnlyGrid = ({ items, getUrl, getLabel, emptyLabel }: { items: any[]; getUrl: (i: any) => string; getLabel: (i: any) => string; emptyLabel: string }) => (
    <div className="p-4">
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item: any, idx: number) => (
            <div key={idx} className="rounded-lg overflow-hidden border border-slate-200 bg-white">
              {getUrl(item) ? (
                <img src={getUrl(item)} alt={getLabel(item)} className="w-full h-28 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-full h-28 bg-slate-100 flex items-center justify-center"><ImageIcon className="w-8 h-8 text-slate-300" /></div>
              )}
              {getLabel(item) && <p className="text-xs text-slate-500 p-1.5 truncate">{getLabel(item)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const ChartReadOnlyList = ({ charts }: { charts: any[] }) => (
    <div className="p-4 space-y-2">
      {charts.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Žádné grafy</p>
      ) : charts.map((c: any, i: number) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
          <BarChart2 className="w-5 h-5 text-cyan-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{c.title || c.type || 'Graf'}</p>
            {c.description && <p className="text-xs text-slate-400 truncate">{c.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );

  const MapsReadOnlyList = ({ maps }: { maps: SavedMap[] }) => (
    <div className="p-4 space-y-2">
      {maps.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Žádné mapy</p>
      ) : maps.map((m: any, i: number) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
          <MapIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{m.title || m.regionId || 'Mapa'}</p>
            {m.exerciseType && <p className="text-xs text-slate-400">{m.exerciseType}</p>}
          </div>
        </div>
      ))}
    </div>
  );

  // ── Milestone Materials Panel ─────────────────────────────────────────────

  const MilestoneMaterialsPanel = ({ dataSet, onRegenerate }: { dataSet: TopicDataSet; onRegenerate: () => Promise<void> }) => {
    const md = dataSet.milestone_data || dataSet.milestoneData;
    const [activeDoc, setActiveDoc] = React.useState<'test' | 'pisemka' | 'vystup' | null>(null);
    const [testLevel, setTestLevel] = React.useState<0 | 1 | 2>(1); // 0=základní, 1=standardní, 2=rozšiřující
    const [pisemkaLevel, setPisemkaLevel] = React.useState<0 | 1 | 2>(1);
    const [generating, setGenerating] = React.useState(false);

    const LEVEL_LABELS = ['Základní', 'Standardní', 'Rozšiřující'];
    const SCHOOL_TYPES = ['ZŠ praktická/speciální', 'ZŠ standardní', 'Gymnázium'];
    const GRADE_COLORS: Record<number, string> = { 1: '#22c55e', 2: '#84cc16', 3: '#f59e0b', 4: '#f97316', 5: '#ef4444' };

    // Filtruj otázky dle úrovně
    const getTestQuestions = (level: number) => {
      const qs = md?.test?.questions ?? [];
      if (level === 0) return qs.filter((q: any) => q.type === 'multiple-choice' || q.type === 'true-false');
      if (level === 2) return qs;
      return qs.filter((q: any) => q.type !== 'matching');
    };

    const handleRegen = async () => {
      setGenerating(true);
      try { await onRegenerate(); } finally { setGenerating(false); }
    };

    if (activeDoc === 'test') {
      const questions = getTestQuestions(testLevel);
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 p-3 border-b border-slate-200 bg-slate-50">
            <button onClick={() => setActiveDoc(null)} className="text-xs text-slate-500 hover:text-slate-700">← Zpět</button>
            <span className="text-sm font-semibold flex-1 truncate">{md?.test?.title ?? 'Souhrnný test'}</span>
            <span className="text-xs text-slate-400">{md?.test?.timeMinutes} min · {md?.test?.totalPoints} b</span>
          </div>
          <div className="flex gap-1 p-2 border-b border-slate-200">
            {LEVEL_LABELS.map((l, i) => (
              <button key={i} onClick={() => setTestLevel(i as 0|1|2)}
                className={`flex-1 text-xs py-1 rounded-md font-medium transition-colors ${testLevel === i ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {questions.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Nejsou otázky — klikni Přegenerovat</p> :
              questions.map((q: any, i: number) => (
                <div key={q.id ?? i} className="p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm text-slate-800 font-medium">{i + 1}. {q.text}</p>
                    <span className="text-xs text-slate-400 flex-shrink-0">{q.points}b</span>
                  </div>
                  {q.options && <ul className="mt-1 space-y-0.5">{q.options.map((o: string, oi: number) => <li key={oi} className={`text-xs px-2 py-0.5 rounded ${o === q.correctAnswer ? 'bg-green-50 text-green-700 font-medium' : 'text-slate-600'}`}>{o}</li>)}</ul>}
                  {q.type === 'true-false' && <p className="text-xs mt-1 text-green-600 font-medium">Správně: {q.correctAnswer === 'true' ? 'Pravda' : 'Nepravda'}</p>}
                  {q.type === 'open' && q.correctAnswer && <p className="text-xs mt-1 text-slate-400 italic">Vzor: {q.correctAnswer}</p>}
                  {q.type === 'fill-blank' && q.correctAnswer && <p className="text-xs mt-1 text-green-600">Odpověď: {q.correctAnswer}</p>}
                  {q.matchPairs && <div className="mt-1 space-y-0.5">{q.matchPairs.map((p: any, pi: number) => <div key={pi} className="text-xs text-slate-600 flex gap-2"><span className="font-medium">{p.left}</span><span className="text-slate-400">→</span><span>{p.right}</span></div>)}</div>}
                  <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{q.type}</span>
                </div>
              ))}
          </div>
        </div>
      );
    }

    if (activeDoc === 'pisemka') {
      const tasks = md?.pisemka?.tasks ?? [];
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 p-3 border-b border-slate-200 bg-slate-50">
            <button onClick={() => setActiveDoc(null)} className="text-xs text-slate-500 hover:text-slate-700">← Zpět</button>
            <span className="text-sm font-semibold flex-1 truncate">{md?.pisemka?.title ?? 'Souhrnná písemka'}</span>
            <span className="text-xs text-slate-400">{md?.pisemka?.timeMinutes} min · {md?.pisemka?.totalPoints} b</span>
          </div>
          <div className="flex gap-1 p-2 border-b border-slate-200">
            {LEVEL_LABELS.map((l, i) => (
              <button key={i} onClick={() => setPisemkaLevel(i as 0|1|2)}
                className={`flex-1 text-xs py-1 rounded-md font-medium transition-colors ${pisemkaLevel === i ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {tasks.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Není obsah — klikni Přegenerovat</p> :
              tasks.slice(0, pisemkaLevel === 0 ? 2 : pisemkaLevel === 1 ? 3 : tasks.length).map((t: any, i: number) => (
                <div key={t.id ?? i} className="p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{i + 1}. {t.title}</p>
                    <span className="text-xs text-slate-400 flex-shrink-0">{t.points}b</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{t.instruction}</p>
                  {t.hint && <p className="text-xs text-amber-600 mt-1 italic">💡 {t.hint}</p>}
                </div>
              ))}
          </div>
        </div>
      );
    }

    if (activeDoc === 'vystup') {
      const hodnoceni = md?.hodnoceni;
      const topics = md?.coveredTopics ?? [];
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 p-3 border-b border-slate-200 bg-slate-50">
            <button onClick={() => setActiveDoc(null)} className="text-xs text-slate-500 hover:text-slate-700">← Zpět</button>
            <span className="text-sm font-semibold flex-1">Výstupní dokument</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {topics.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Žáci znají:</p>
                <ul className="space-y-1">
                  {topics.map((t, i) => <li key={i} className="flex gap-2 text-sm text-slate-700"><span className="text-indigo-400 mt-0.5">•</span>{t}</li>)}
                </ul>
              </div>
            )}
            {hodnoceni?.outcomes && hodnoceni.outcomes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Očekávané výstupy (RVP):</p>
                <ul className="space-y-1">
                  {hodnoceni.outcomes.map((o: string, i: number) => <li key={i} className="flex gap-2 text-sm text-slate-700"><span className="text-green-500 mt-0.5">✓</span>{o}</li>)}
                </ul>
              </div>
            )}
            {hodnoceni?.levels && SCHOOL_TYPES.map(schoolType => {
              const level = hodnoceni.levels.find((l: any) => l.schoolType === schoolType);
              if (!level) return null;
              return (
                <div key={schoolType}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{schoolType}</p>
                  <div className="space-y-1.5">
                    {level.grades?.map((g: any) => (
                      <div key={g.grade} className="flex gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${GRADE_COLORS[g.grade]}20`, color: GRADE_COLORS[g.grade] }}>
                          {g.grade} – {g.label}
                        </span>
                        <ul className="space-y-0.5 min-w-0">
                          {(g.criteria ?? []).map((c: string, ci: number) => <li key={ci} className="text-xs text-slate-600">{c}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {!hodnoceni && <p className="text-sm text-slate-400 text-center py-8">Chybí hodnocení — klikni Přegenerovat</p>}
          </div>
        </div>
      );
    }

    // Overview
    const hasTest = !!md?.test?.questions?.length;
    const hasPisemka = !!md?.pisemka?.tasks?.length;
    const hasHodnoceni = !!md?.hodnoceni?.levels?.length;
    return (
      <div className="p-4 space-y-3">
        <button onClick={handleRegen} disabled={generating}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {generating ? 'Generuji...' : 'Přegenerovat vše'}
        </button>
        {[
          { id: 'test', label: 'Souhrnný test', desc: hasTest ? `${md?.test?.questions?.length} otázek · ${md?.test?.totalPoints} b · ${md?.test?.timeMinutes} min` : 'Nevygenerováno', icon: <ClipboardList className="w-5 h-5 text-indigo-500" />, ok: hasTest },
          { id: 'pisemka', label: 'Souhrnná písemka', desc: hasPisemka ? `${md?.pisemka?.tasks?.length} úloh · ${md?.pisemka?.totalPoints} b · ${md?.pisemka?.timeMinutes} min` : 'Nevygenerováno', icon: <FileText className="w-5 h-5 text-violet-500" />, ok: hasPisemka },
          { id: 'vystup', label: 'Výstupní dokument', desc: hasHodnoceni ? `Hodnocení pro ${md?.hodnoceni?.levels?.length} typy škol + přehled témat` : 'Nevygenerováno', icon: <Award className="w-5 h-5 text-amber-500" />, ok: hasHodnoceni },
        ].map(card => (
          <button key={card.id} onClick={() => setActiveDoc(card.id as any)}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${card.ok ? 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50' : 'border-dashed border-slate-300 bg-slate-50 opacity-70'}`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${card.ok ? 'bg-slate-50' : 'bg-slate-100'}`}>{card.icon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">{card.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{card.desc}</p>
              <p className="text-xs text-slate-300 mt-0.5">3 úrovně obtížnosti</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    );
  };

  const getSectionDetail = (): React.ReactNode => {
    if (!selectedDataSet || !selectedDataSetSection) return null;
    
    const section = selectedDataSetSection;
    // Pro zobrazení (Podklady, Média) VŽDY používej selectedDataSet přímo.
    // getEffectiveDataSet() (agregace skupiny) se používá jen při GENEROVÁNÍ (buildDataSetObject),
    // ne pro zobrazení — datasety skupiny mohou mít špatná/nerelevantní data.
    const effectiveDs = selectedDataSet;

    if (section === 'all-media') {
      const media = effectiveDs.media || {};
      const images = media.images || [];
      const illustrations = media.generatedIllustrations || [];
      const photos = media.generatedPhotos || [];
      const charts = media.charts || [];
      const maps = media.savedMaps || [];
      const gallery = media.galleryImages || [];
      return (
        <div className="p-4 space-y-5 overflow-y-auto">
          {images.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Obrázky z webu ({images.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {images.map((item: any, i: number) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-slate-200">
                    {item.url && <img src={item.url} alt={item.query || ''} className="w-full h-24 object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />}
                    {item.query && <p className="text-xs text-slate-400 p-1 truncate">{item.query}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {illustrations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ilustrace ({illustrations.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {illustrations.map((item: any, i: number) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-slate-200">
                    {item.url && <img src={item.url} alt={item.prompt || ''} className="w-full h-24 object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />}
                    {item.prompt && <p className="text-xs text-slate-400 p-1 truncate">{item.prompt}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {photos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fotky ({photos.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {photos.map((item: any, i: number) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-slate-200">
                    {item.url && <img src={item.url} alt={item.prompt || ''} className="w-full h-24 object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />}
                    {item.prompt && <p className="text-xs text-slate-400 p-1 truncate">{item.prompt}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {charts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Grafy ({charts.length})</p>
              <div className="space-y-1.5">
                {charts.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <BarChart2 className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                    <span className="text-sm text-slate-700 truncate">{c.title || c.type || 'Graf'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {maps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Mapy ({maps.length})</p>
              <div className="space-y-1.5">
                {maps.map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <MapIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-slate-700 truncate">{m.title || m.regionId || 'Mapa'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {gallery.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Z galerie ({gallery.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {gallery.map((item: any, i: number) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-slate-200">
                    {item.url && <img src={item.url} alt={item.title || ''} className="w-full h-24 object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />}
                    {item.title && <p className="text-xs text-slate-400 p-1 truncate">{item.title}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {images.length + illustrations.length + photos.length + charts.length + maps.length + gallery.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-12">Žádná média v tomto bloku</p>
          )}
        </div>
      );
    }

    if (section === 'data') {
      const rvp = effectiveDs.rvp || {};
      const content = effectiveDs.content || {};
      const terms = (content.keyTerms || []).map((t: any) =>
        typeof t === 'object' && t !== null
          ? { term: toStr(t.term || t.name || t), definition: toStr(t.definition || t.desc || '') }
          : { term: toStr(t), definition: '' }
      );
      const facts = toStrArr(content.keyFacts);
      const personalities = (content.personalities || []).map((p: any) =>
        typeof p === 'object' && p !== null ? p : { name: toStr(p), description: '' }
      );
      
      // ── Teacher note regeneration ────────────────────────────────────
      const handleRegenerateFromNote = async () => {
        if (!teacherNote.trim()) return;
        setRegeneratingFromNote(true);
        addLog(`📝 Přegeneruji dataset dle poznámky učitele...`);
        try {
          const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');
          const existing = selectedDataSet.content || {};
          const prompt = `Jsi expert na tvorbu vzdělávacích materiálů pro ZŠ v ČR.
Téma: "${selectedDataSet.topic}", ${selectedDataSet.grade}. třída, předmět: ${selectedDataSet.subject_code}.

Stávající obsah datasetu:
${JSON.stringify(existing, null, 2)}

INSTRUKCE UČITELE (aplikuj je při přegenerování):
"${teacherNote}"

Přegeneruj dataset s ohledem na instrukce učitele. Zachovej formát:
{
  "keyTerms": [{"term": "...", "definition": "..."}],
  "keyFacts": ["fakt1", "fakt2"],
  "facts": ["doplňující fakt"],
  "timeline": [{"year": "rok", "event": "událost"}],
  "personalities": [{"name": "jméno", "role": "role", "significance": "význam"}],
  "modernConnections": ["vazba na dnešek"],
  "funFacts": ["zajímavost"],
  "sources": ["zdroj"]
}
Vrať POUZE JSON.`;
          const response = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3-flash');
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('AI nevrátilo platný JSON');
          const newContent = JSON.parse(jsonMatch[0]);
          const { error } = await supabase.from('topic_data_sets')
            .update({ content: newContent, teacher_note: teacherNote })
            .eq('id', selectedDataSet.id);
          if (error) throw error;
          setSelectedDataSet((prev: any) => ({ ...prev, content: newContent, teacher_note: teacherNote }));
          setDataSets(prev => prev.map(ds => ds.id === selectedDataSet.id ? { ...ds, content: newContent, teacher_note: teacherNote } : ds));
          addLog('✅ Dataset přegenerován dle poznámky', 'success');
          toast.success('Dataset přegenerován!');
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Přegenerování selhalo');
        } finally {
          setRegeneratingFromNote(false);
        }
      };

      // ── Přegenerovat celý dataset ─────────────────────────────────────
      const handleRegenerateFullDataset = async () => {
        if (!window.confirm(`Opravdu chceš přegenerovat celý dataset "${selectedDataSet.topic}"?\nStávající obsah (podklady, pojmy, fakta...) bude nahrazen novým.`)) return;
        setRegeneratingFullDataset(true);
        addLog(`🔄 Přegeneruji celý dataset "${selectedDataSet.topic}"...`);
        try {
          const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');

          // Načti kontext z RVP / learning unit
          const contextSummary = selectedDataSet.context_summary || '';
          const rvpData = selectedDataSet.rvp || {};
          const bloomLevel = selectedDataSet.bloom_level || 'remember';
          const note = teacherNote.trim() || selectedDataSet.teacher_note || '';

          const prompt = `Jsi expert na tvorbu vzdělávacích materiálů pro ZŠ v ČR.
Téma: "${selectedDataSet.topic}"
Ročník: ${selectedDataSet.grade}. třída
Předmět: ${selectedDataSet.subject_code}
Bloom úroveň: ${bloomLevel}
${contextSummary ? `Kontext (co bylo probráno dříve): ${contextSummary}` : ''}
${rvpData.expectedOutputs ? `RVP výstupy: ${JSON.stringify(rvpData.expectedOutputs)}` : ''}
${note ? `\nPoznámka učitele: "${note}"` : ''}

Vygeneruj kompletní vzdělávací dataset pro toto téma. Obsah musí být věkově přiměřený, fakticky správný a přitažlivý pro žáky.

Vrať POUZE JSON v tomto formátu:
{
  "keyTerms": [{"term": "pojem", "definition": "definice (1-2 věty, srozumitelně pro ${selectedDataSet.grade}. třídu)"}],
  "keyFacts": ["klíčový fakt 1", "klíčový fakt 2", "..."],
  "facts": ["doplňující fakt"],
  "timeline": [{"year": "rok nebo období", "event": "stručný popis události"}],
  "personalities": [{"name": "jméno", "role": "role/povolání", "significance": "proč je důležitý"}],
  "modernConnections": ["jak téma souvisí s dneškem"],
  "funFacts": ["zajímavost nebo kuriozita"],
  "sources": ["doporučený zdroj nebo učebnice"]
}

Požadavky:
- keyTerms: 8–12 pojmů
- keyFacts: 8–15 faktů
- facts: 3–8 doplňujících faktů
- timeline: pokud téma má časový rozměr, 4–8 položek (jinak prázdné pole)
- personalities: 0–5 osobností (jen pokud jsou relevantní)
- modernConnections: 2–4 vazby
- funFacts: 2–4 zajímavosti
Vrať POUZE JSON.`;

          addLog('  🤖 AI generuje obsah...');
          const response = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3-pro');
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('AI nevrátilo platný JSON');
          const newContent = JSON.parse(jsonMatch[0]);

          // Ulož nový obsah
          const { error } = await supabase.from('topic_data_sets')
            .update({ content: newContent, teacher_note: note || null })
            .eq('id', selectedDataSet.id);
          if (error) throw error;

          setSelectedDataSet((prev: any) => ({ ...prev, content: newContent }));
          setDataSets(prev => prev.map(ds => ds.id === selectedDataSet.id ? { ...ds, content: newContent } : ds));
          addLog(`✅ Dataset přegenerován: ${(newContent.keyTerms || []).length} pojmů, ${(newContent.keyFacts || []).length} faktů`, 'success');
          toast.success('Dataset úspěšně přegenerován!');

          // Automaticky přegeneruj i media prompty
          try {
            addLog('  🎨 Přegeneruji média prompty...');
            const { generateIllustrationPrompts, generatePhotoPrompts } = await import('../../utils/dataset/material-generators');
            const dataSetObj = {
              id: selectedDataSet.id, topic: selectedDataSet.topic,
              subjectCode: selectedDataSet.subject_code, grade: selectedDataSet.grade,
              status: 'ready' as const, rvp: rvpData, targetGroup: {},
              content: newContent, media: selectedDataSet.media || {},
              generatedMaterials: [], createdAt: '', updatedAt: '',
            };
            const { searchImagesForTopic } = await import('../../utils/dataset/data-collector');
            const [illPrompts, photoPrompts, webImages] = await Promise.all([
              generateIllustrationPrompts(dataSetObj, false).catch(() => []),
              generatePhotoPrompts(dataSetObj).catch(() => []),
              searchImagesForTopic(selectedDataSet.topic, 12).catch(() => []),
            ]);
            addLog(`  🖼️ Nalezeno ${webImages.length} obrázků z webu`);
            const chartPrompt = `Navrhni 5 konkrétních grafů pro vzdělávací téma "${selectedDataSet.topic}" (${selectedDataSet.grade}. třída ZŠ, ${selectedDataSet.subject_code}). Vrať JSON pole: [{"title":"...","description":"...","chartType":"bar|line|pie|area|timeline","dataHint":"..."}]. POUZE JSON.`;
            const chartResp = await chatWithAIProxy([{ role: 'user', content: chartPrompt }], 'gemini-3-flash');
            let newChartSuggestions: any[] = [];
            const cm = chartResp.match(/\[[\s\S]*\]/);
            if (cm) newChartSuggestions = JSON.parse(cm[0]);

            const mapPrompt = `Jsi pedagog a kartograf. Pro vzdělávací téma "${selectedDataSet.topic}" (${selectedDataSet.grade}. třída ZŠ, ${selectedDataSet.subject_code}) navrhni 3–5 map. Vrať JSON pole (POUZE JSON): [{"id":"map1","title":"...","description":"...","region":"world|europe|central-europe|mediterranean|middle-east|africa|asia|americas|czech-republic|italy|greece|france|germany","style":"political|physical|blank|historical","exerciseType":"info|identify|label|color|route","dataHint":"..."}]`;
            const mapResp = await chatWithAIProxy([{ role: 'user', content: mapPrompt }], 'gemini-3-flash');
            let newMapSuggestions: any[] = [];
            const mm2 = mapResp.match(/\[[\s\S]*\]/);
            if (mm2) newMapSuggestions = JSON.parse(mm2[0]).map((s: any, i: number) => ({ ...s, id: s.id || `map_${i}_${Date.now()}` }));

            const newMedia = stripBase64FromObject({
              ...(selectedDataSet.media || {}),
              illustrationPrompts: illPrompts,
              photoPrompts,
              chartSuggestions: newChartSuggestions,
              mapSuggestions: newMapSuggestions,
              images: webImages,
            }) as Record<string, any>;
            await supabase.from('topic_data_sets').update({ media: newMedia }).eq('id', selectedDataSet.id);
            setSelectedDataSet((prev: any) => ({ ...prev, media: newMedia }));
            setChartSuggestions(newChartSuggestions);
            setMapSuggestions(newMapSuggestions);
            addLog(`  ✅ Média: ${illPrompts.length} ilustrací, ${photoPrompts.length} fotek, ${webImages.length} web obrázků, ${newChartSuggestions.length} grafů, ${newMapSuggestions.length} map`, 'success');
          } catch (mediaErr) {
            addLog(`  ⚠️ Média prompty se nepodařilo přegenerovat`, 'warning');
          }
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Přegenerování selhalo');
        } finally {
          setRegeneratingFullDataset(false);
        }
      };

      // ── AI Quality Check ─────────────────────────────────────────────
      const handleQualityCheck = async () => {
        setQualityChecking(true);
        addLog('🔍 Spouštím AI Quality Check...');
        try {
          const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');
          const content = selectedDataSet.content || {};
          const bloomLevel = selectedDataSet.bloom_level || 'remember';
          const prompt = `Jsi pedagog kontrolující kvalitu vzdělávacích materiálů pro ${selectedDataSet.grade}. třídu ZŠ.

Téma: "${selectedDataSet.topic}", Bloom úroveň: ${bloomLevel}

Obsah datasetu:
- Klíčové pojmy: ${JSON.stringify(content.keyTerms?.slice(0, 10))}
- Klíčová fakta: ${JSON.stringify(content.keyFacts?.slice(0, 10))}
- Osobnosti: ${JSON.stringify(content.personalities?.slice(0, 5))}

Proveď kontrolu kvality. Odpověz jako JSON:
{
  "score": 0-100,
  "flags": ["problém1", "problém2"],
  "positives": ["silná stránka 1"],
  "ageAppropriateness": 0-100,
  "bloomAlignment": 0-100,
  "contentDiversity": 0-100
}

Kontroluj:
- Je obsah přiměřený věku (${selectedDataSet.grade}. třída)?
- Odpovídají pojmy a fakta Bloom úrovni "${bloomLevel}"?
- Je obsah rozmanitý a nezopakuje se?
- Jsou fakta konkrétní a věcná (ne vágní)?
Vrať POUZE JSON.`;
          const response = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3-flash');
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('Neplatný JSON');
          const quality = JSON.parse(jsonMatch[0]);
          const { error } = await supabase.from('topic_data_sets')
            .update({ quality_score: quality.score, quality_flags: quality.flags })
            .eq('id', selectedDataSet.id);
          if (error) throw error;
          setSelectedDataSet((prev: any) => ({ ...prev, quality_score: quality.score, quality_flags: quality.flags, quality_detail: quality }));
          setDataSets(prev => prev.map(ds => ds.id === selectedDataSet.id ? { ...ds, quality_score: quality.score, quality_flags: quality.flags } : ds));
          addLog(`✅ Quality Check: ${quality.score}% ${quality.flags?.length ? `(${quality.flags.length} upozornění)` : '(bez problémů)'}`, quality.score >= 70 ? 'success' : 'warning');
          toast.success(`Skóre: ${quality.score}%`);
        } catch (err: any) {
          addLog(`❌ QC chyba: ${err.message}`, 'error');
          toast.error('Quality Check selhal');
        } finally {
          setQualityChecking(false);
        }
      };

      // ── Inline save helpers ──────────────────────────────────────────
      const saveContent = async (newContent: any) => {
        await supabase.from('topic_data_sets').update({ content: newContent }).eq('id', selectedDataSet.id);
        setSelectedDataSet((prev: any) => ({ ...prev, content: newContent }));
        setDataSets(prev => prev.map(ds => ds.id === selectedDataSet.id ? { ...ds, content: newContent } : ds));
      };

      const qualityDetail = selectedDataSet.quality_detail;
      const qualityScore = selectedDataSet.quality_score;
      const qualityFlags = selectedDataSet.quality_flags || [];
      const qualityColor = !qualityScore ? '#94a3b8' : qualityScore >= 80 ? '#22c55e' : qualityScore >= 60 ? '#f59e0b' : '#ef4444';

      return (
        <div className="p-4 space-y-6 overflow-y-auto">

          {/* ── Teacher Note ── */}
          <div style={{ padding: '12px 14px', background: '#fefce8', borderRadius: 12, border: '1px solid #fde68a' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📝</span> Instrukce pro přegenerování
            </div>
            <textarea
              value={teacherNote || selectedDataSet.teacher_note || ''}
              onChange={e => setTeacherNote(e.target.value)}
              placeholder="Napiš pokyny pro AI – napr. Zaměř se více na každodenní život lidí, vynech války. nebo Přidej příklady z moderního světa."
              style={{ width: '100%', minHeight: 72, padding: '8px 10px', borderRadius: 8, border: '1px solid #fcd34d', fontSize: 12, resize: 'vertical', outline: 'none', background: 'white', color: '#1e293b', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                onClick={handleRegenerateFromNote}
                disabled={regeneratingFromNote || regeneratingFullDataset || !teacherNote.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none', backgroundColor: teacherNote.trim() ? '#d97706' : '#e5e7eb', color: teacherNote.trim() ? 'white' : '#9ca3af', fontSize: 12, fontWeight: 600, cursor: teacherNote.trim() && !regeneratingFromNote ? 'pointer' : 'not-allowed', opacity: (regeneratingFromNote || regeneratingFullDataset) ? 0.6 : 1 }}
              >
                {regeneratingFromNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                Přegenerovat dle instrukce
              </button>
              <button
                onClick={handleRegenerateFullDataset}
                disabled={regeneratingFromNote || regeneratingFullDataset}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #dc2626', backgroundColor: 'white', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: (regeneratingFromNote || regeneratingFullDataset) ? 'not-allowed' : 'pointer', opacity: (regeneratingFromNote || regeneratingFullDataset) ? 0.5 : 1 }}
              >
                {regeneratingFullDataset ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                {regeneratingFullDataset ? 'Přegeneruji...' : '🔄 Přegenerovat celý dataset'}
              </button>
            </div>
          </div>

          {/* ── Quality Check ── */}
          <div style={{ padding: '12px 14px', background: qualityScore ? (qualityScore >= 80 ? '#f0fdf4' : qualityScore >= 60 ? '#fffbeb' : '#fef2f2') : '#f8fafc', borderRadius: 12, border: `1px solid ${qualityColor}33` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: qualityScore ? 8 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>🔍 AI Quality Check</span>
                {qualityScore !== undefined && qualityScore !== null && (
                  <span style={{ fontSize: 22, fontWeight: 800, color: qualityColor, lineHeight: 1 }}>{qualityScore}%</span>
                )}
              </div>
              <button
                onClick={handleQualityCheck}
                disabled={qualityChecking}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: 'none', backgroundColor: '#0f172a', color: 'white', fontSize: 11, fontWeight: 600, cursor: qualityChecking ? 'not-allowed' : 'pointer', opacity: qualityChecking ? 0.6 : 1 }}
              >
                {qualityChecking ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertCircle className="w-3 h-3" />}
                {qualityScore !== undefined ? 'Zkontrolovat znovu' : 'Zkontrolovat'}
              </button>
            </div>
            {qualityFlags.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {qualityFlags.map((f: string, i: number) => (
                  <div key={i} style={{ fontSize: 11, color: '#dc2626', display: 'flex', gap: 5, marginBottom: 2 }}>
                    <span>⚠️</span><span>{f}</span>
                  </div>
                ))}
              </div>
            )}
            {qualityDetail?.positives?.length > 0 && (
              <div style={{ marginTop: 4 }}>
                {qualityDetail.positives.map((p: string, i: number) => (
                  <div key={i} style={{ fontSize: 11, color: '#16a34a', display: 'flex', gap: 5, marginBottom: 2 }}>
                    <span>✓</span><span>{p}</span>
                  </div>
                ))}
              </div>
            )}
            {qualityDetail && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {[
                  { label: 'Věk', val: qualityDetail.ageAppropriateness },
                  { label: 'Bloom', val: qualityDetail.bloomAlignment },
                  { label: 'Rozmanitost', val: qualityDetail.contentDiversity },
                ].map(({ label, val }) => val !== undefined && (
                  <div key={label} style={{ flex: 1, background: 'white', borderRadius: 6, padding: '4px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: !val ? '#94a3b8' : val >= 80 ? '#22c55e' : val >= 60 ? '#f59e0b' : '#ef4444' }}>{val}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RVP Info */}
          {rvp.thematicArea && (
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
              <h3 className="font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                RVP - Rámcový vzdělávací program
              </h3>
              
              {rvp.thematicArea && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-1">Tematický okruh</div>
                  <div className="text-sm text-slate-700">{rvp.thematicArea}</div>
                </div>
              )}
              
              {rvp.expectedOutcomes?.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-1">
                    Očekávané výstupy ({rvp.expectedOutcomes.length})
                  </div>
                  <ul className="text-sm text-slate-700 space-y-1">
                    {rvp.expectedOutcomes.map((outcome: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-400 mt-0.5">•</span>
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {rvp.competencies?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-1">
                    Klíčové kompetence ({rvp.competencies.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rvp.competencies.map((comp: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-white text-indigo-600 text-xs rounded-full border border-indigo-200">
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Klíčové pojmy – s inline editací */}
          {terms.length > 0 && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <h3 className="font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Klíčové pojmy ({terms.length})
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6b7280', fontWeight: 400 }}>klikni pro úpravu</span>
              </h3>
              <div className="space-y-2">
                {terms.map((term: any, idx: number) => (
                  editingTermIdx === idx ? (
                    <div key={idx} style={{ background: 'white', borderRadius: 8, border: '2px solid #10b981', padding: '6px 8px' }}>
                      <input
                        autoFocus
                        value={editingTermValue.term}
                        onChange={e => setEditingTermValue(prev => ({ ...prev, term: e.target.value }))}
                        placeholder="Pojem"
                        style={{ width: '100%', fontSize: 13, fontWeight: 600, border: 'none', outline: 'none', marginBottom: 4, color: '#1e293b' }}
                      />
                      <input
                        value={editingTermValue.definition}
                        onChange={e => setEditingTermValue(prev => ({ ...prev, definition: e.target.value }))}
                        placeholder="Definice"
                        style={{ width: '100%', fontSize: 11, border: 'none', outline: 'none', color: '#64748b' }}
                      />
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button
                          onClick={async () => {
                            const newTerms = terms.map((t: any, i: number) => i === idx ? editingTermValue : t);
                            await saveContent({ ...content, keyTerms: newTerms });
                            setEditingTermIdx(null);
                          }}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', backgroundColor: '#10b981', color: 'white', cursor: 'pointer' }}
                        >Uložit</button>
                        <button
                          onClick={async () => {
                            const newTerms = terms.filter((_: any, i: number) => i !== idx);
                            await saveContent({ ...content, keyTerms: newTerms });
                            setEditingTermIdx(null);
                          }}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', backgroundColor: '#fee2e2', color: '#dc2626', cursor: 'pointer' }}
                        >Smazat</button>
                        <button onClick={() => setEditingTermIdx(null)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'pointer' }}>Zrušit</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={idx}
                      onClick={() => { setEditingTermIdx(idx); setEditingTermValue({ term: typeof term === 'string' ? term : term.term, definition: term.definition || '' }); }}
                      className="p-2 bg-white rounded-lg border border-emerald-100 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                    >
                      <div className="font-medium text-slate-700 text-sm">{typeof term === 'string' ? term : term.term}</div>
                      {term.definition && <div className="text-xs text-slate-500 mt-1">{term.definition}</div>}
                    </div>
                  )
                ))}
                {/* Přidat pojem */}
                <button
                  onClick={() => { const newTerms = [...terms, { term: 'Nový pojem', definition: '' }]; saveContent({ ...content, keyTerms: newTerms }).then(() => { setEditingTermIdx(terms.length); setEditingTermValue({ term: 'Nový pojem', definition: '' }); }); }}
                  style={{ width: '100%', padding: '5px', borderRadius: 8, border: '1px dashed #10b981', background: 'transparent', color: '#10b981', fontSize: 11, cursor: 'pointer', marginTop: 4 }}
                >+ Přidat pojem</button>
              </div>
            </div>
          )}
          
          {/* Fakta – s inline editací */}
          {facts.length > 0 && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <h3 className="font-semibold text-amber-700 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Klíčová fakta ({facts.length})
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6b7280', fontWeight: 400 }}>klikni pro úpravu</span>
              </h3>
              <ul className="space-y-2">
                {facts.map((fact: string, idx: number) => (
                  editingFactIdx === idx ? (
                    <li key={idx} style={{ background: 'white', borderRadius: 8, border: '2px solid #f59e0b', padding: '6px 8px' }}>
                      <textarea
                        autoFocus
                        value={editingFactValue}
                        onChange={e => setEditingFactValue(e.target.value)}
                        style={{ width: '100%', fontSize: 12, border: 'none', outline: 'none', resize: 'vertical', minHeight: 48, fontFamily: 'inherit', color: '#1e293b' }}
                      />
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button
                          onClick={async () => {
                            const newFacts = facts.map((f: string, i: number) => i === idx ? editingFactValue : f);
                            await saveContent({ ...content, keyFacts: newFacts });
                            setEditingFactIdx(null);
                          }}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', backgroundColor: '#f59e0b', color: 'white', cursor: 'pointer' }}
                        >Uložit</button>
                        <button
                          onClick={async () => {
                            const newFacts = facts.filter((_: string, i: number) => i !== idx);
                            await saveContent({ ...content, keyFacts: newFacts });
                            setEditingFactIdx(null);
                          }}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', backgroundColor: '#fee2e2', color: '#dc2626', cursor: 'pointer' }}
                        >Smazat</button>
                        <button onClick={() => setEditingFactIdx(null)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'pointer' }}>Zrušit</button>
                      </div>
                    </li>
                  ) : (
                    <li
                      key={idx}
                      onClick={() => { setEditingFactIdx(idx); setEditingFactValue(fact); }}
                      className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer hover:bg-amber-100 rounded-lg px-2 py-1 transition-colors"
                    >
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">💡</span>
                      <span>{fact}</span>
                    </li>
                  )
                ))}
                <button
                  onClick={() => { const newFacts = [...facts, 'Nové faktum']; saveContent({ ...content, keyFacts: newFacts }).then(() => { setEditingFactIdx(facts.length); setEditingFactValue('Nové faktum'); }); }}
                  style={{ width: '100%', padding: '5px', borderRadius: 8, border: '1px dashed #f59e0b', background: 'transparent', color: '#d97706', fontSize: 11, cursor: 'pointer', marginTop: 4 }}
                >+ Přidat faktum</button>
              </ul>
            </div>
          )}
          
          {/* Osobnosti */}
          {personalities.length > 0 && (
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
              <h3 className="font-semibold text-purple-700 mb-3 flex items-center gap-2">
                👤 Osobnosti ({personalities.length})
              </h3>
              <div className="space-y-2">
                {personalities.map((person: any, idx: number) => (
                  <div key={idx} className="p-2 bg-white rounded-lg border border-purple-100">
                    <div className="font-medium text-slate-700 text-sm">{person.name}</div>
                    {person.description && (
                      <div className="text-xs text-slate-500 mt-1">{person.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Prázdný stav */}
          {!rvp.thematicArea && terms.length === 0 && facts.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Žádné podklady</p>
              <p className="text-sm">Spusťte agenta "Data Collector"</p>
            </div>
          )}
        </div>
      );
    }
    
    if (section === 'images') {
      const images = effectiveDs.media?.images || [];
      const activeCount = images.filter((img: any) => !img.excluded).length;

      if (selectedDataSet.milestone) return <MediaReadOnlyGrid items={images} getUrl={(i: any) => i.url} getLabel={(i: any) => i.query || i.alt || ''} emptyLabel="Žádné obrázky z webu" />;

      
      const toggleImageExclusion = async (idx: number) => {
        const updatedImages = images.map((i: any, iIdx: number) => 
          iIdx === idx ? { ...i, excluded: !i.excluded } : i
        );
        
        // Update local state
        setDataSets(prev => prev.map(ds => 
          ds.id === selectedDataSet.id 
            ? { ...ds, media: { ...ds.media, images: updatedImages } }
            : ds
        ));
        setSelectedDataSet((prev: any) => ({
          ...prev,
          media: { ...prev.media, images: updatedImages }
        }));
        
        // Save to DB – strip base64 před uložením
        await supabase
          .from('topic_data_sets')
          .update({ media: stripBase64FromObject({ ...selectedDataSet.media, images: updatedImages }) })
          .eq('id', selectedDataSet.id);
      };
      
      const handleSearchMore = async () => {
        const q = imageSearchQuery.trim() || selectedDataSet.topic;
        if (!q) return;
        setSearchingMoreImages(true);
        addLog(`🔍 Hledám další obrázky: "${q}"...`);
        try {
          const { searchImagesForTopic } = await import('../../utils/dataset/data-collector');
          const found = await searchImagesForTopic(q, 8);
          if (found.length === 0) {
            toast('Žádné nové obrázky nenalezeny');
          } else {
            const currentImages: any[] = selectedDataSet.media?.images || [];
            const existingUrls = new Set(currentImages.map((i: any) => i.url));
            const fresh = found.filter(f => !existingUrls.has(f.url));
            const merged = [...currentImages, ...fresh];
            const mergedMedia = await saveMediaToDB(selectedDataSet.id, { images: merged });
            setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
            addLog(`✅ Přidáno ${fresh.length} nových obrázků`, 'success');
            toast.success(`${fresh.length} nových obrázků`);
          }
        } catch (err: any) {
          addLog(`❌ Chyba hledání: ${err.message}`, 'error');
          toast.error('Hledání selhalo');
        } finally {
          setSearchingMoreImages(false);
        }
      };

      return (
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">
              🖼️ Obrázky z webu
            </h3>
            <span className="text-xs text-slate-400">{activeCount}/{images.length} aktivních</span>
          </div>

          {/* Search more bar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={imageSearchQuery}
              onChange={e => setImageSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchMore()}
              placeholder={selectedDataSet.topic || 'Hledat obrázky...'}
              style={{
                flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 8,
                border: '1px solid #e2e8f0', outline: 'none', background: 'white',
              }}
            />
            <button
              onClick={handleSearchMore}
              disabled={searchingMoreImages}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 8, border: 'none',
                backgroundColor: '#10b981', color: 'white',
                fontSize: 12, fontWeight: 500,
                cursor: searchingMoreImages ? 'not-allowed' : 'pointer',
                opacity: searchingMoreImages ? 0.6 : 1, flexShrink: 0,
              }}
            >
              {searchingMoreImages ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              Hledat
            </button>
          </div>

          {/* Translate captions button */}
          {images.length > 0 && (
            <button
              disabled={translatingCaptions}
              onClick={async () => {
                console.log('[TRANSLATE] 1 – onClick fired, images:', images?.length);
                setTranslatingCaptions(true);
                console.log('[TRANSLATE] 2 – setTranslatingCaptions(true) done');
                addLog(`🌐 Překládám popisky ${images?.length ?? 0} obrázků do češtiny...`);
                console.log('[TRANSLATE] 3 – addLog called');
                try {
                  console.log('[TRANSLATE] 4 – volám translateImageCaptions...');
                  const translated = await translateImageCaptions(images);
                  console.log('[TRANSLATE] 5 – přeloženo:', translated?.length);
                  addLog('💾 Ukládám přeložené popisky...');
                  const { data: current } = await supabase
                    .from('topic_data_sets')
                    .select('media')
                    .eq('id', selectedDataSet.id)
                    .single();
                  const currentMedia = (current as any)?.media || {};
                  await supabase
                    .from('topic_data_sets')
                    .update({ media: { ...currentMedia, images: translated } })
                    .eq('id', selectedDataSet.id);
                  setSelectedDataSet((prev: any) => prev ? { ...prev, media: { ...prev.media, images: translated } } : prev);
                  addLog(`✅ Přeloženo ${translated.length} popisků`, 'success');
                  console.log('[TRANSLATE] 6 – hotovo');
                } catch (e: any) {
                  console.error('[TRANSLATE] ERROR:', e);
                  addLog(`❌ Chyba překladu: ${e.message}`, 'error');
                } finally {
                  setTranslatingCaptions(false);
                }
              }}
              style={{
                width: '100%', padding: '6px 12px', borderRadius: 8,
                border: '1px solid #e0e7ff', backgroundColor: '#eef2ff',
                color: '#4f46e5', fontSize: 12, fontWeight: 500,
                cursor: translatingCaptions ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: translatingCaptions ? 0.7 : 1,
              }}
            >
              {translatingCaptions ? '⏳ Překládám popisky...' : '🌐 Přeložit popisky do češtiny'}
            </button>
          )}

          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {images.map((img: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    borderRadius: 12,
                    border: `2px solid ${img.excluded ? '#fca5a5' : img.priority ? '#fcd34d' : '#86efac'}`,
                    backgroundColor: 'white',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    overflow: 'hidden',
                    opacity: img.excluded ? 0.65 : 1,
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  {/* Image area */}
                  <div style={{ position: 'relative', height: 110, overflow: 'hidden', flexShrink: 0 }}>
                    <img
                      src={img.thumbnailUrl || img.url}
                      alt={img.title || `Obrázek ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: img.excluded ? 'grayscale(80%)' : 'none' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23e2e8f0" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="24">⚠️</text></svg>';
                      }}
                    />
                    {/* Status badge */}
                    <div style={{
                      position: 'absolute', top: 6, left: 6,
                      padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                      color: 'white', backdropFilter: 'blur(4px)',
                      backgroundColor: img.excluded ? '#ef444499' : img.priority ? '#f59e0b' : '#22c55e',
                    }}>
                      {img.excluded ? '❌ Vyloučeno' : img.priority ? '⭐ Prioritní' : '✅ Aktivní'}
                    </div>
                  </div>
                  {/* Title */}
                  <div style={{ padding: '4px 8px', fontSize: 11, color: '#475569', fontWeight: 500, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
                    {img.title || `Obrázek ${idx + 1}`}
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, padding: '6px 6px', background: 'white', flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        setSelectedDataSet((prev: any) => {
                          const upd = (prev.media?.images || []).map((i: any, iIdx: number) =>
                            iIdx === idx ? { ...i, priority: !i.priority } : i
                          );
                          supabase.from('topic_data_sets').update({ media: stripBase64FromObject({ ...prev.media, images: upd }) }).eq('id', prev.id);
                          return { ...prev, media: { ...prev.media, images: upd } };
                        });
                      }}
                      title="Prioritní"
                      style={{ padding: '5px 7px', borderRadius: 6, fontSize: 13, border: 'none', cursor: 'pointer', flexShrink: 0, backgroundColor: img.priority ? '#fef3c7' : '#f1f5f9', color: img.priority ? '#d97706' : '#94a3b8' }}
                    >⭐</button>
                    <button
                      onClick={() => toggleImageExclusion(idx)}
                      style={{ flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: img.excluded ? '#dcfce7' : '#fee2e2', color: img.excluded ? '#16a34a' : '#dc2626' }}
                    >{img.excluded ? '↩ Obnovit' : '✕ Vyloučit'}</button>
                    <button
                      onClick={() => window.open(img.url, '_blank')}
                      style={{ padding: '5px 7px', borderRadius: 6, fontSize: 13, border: 'none', cursor: 'pointer', flexShrink: 0, backgroundColor: '#eff6ff', color: '#3b82f6' }}
                    >👁️</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Žádné obrázky</p>
              <p className="text-sm">Spusťte agenta "Data Collector"</p>
            </div>
          )}
        </div>
      );
    }
    
    if (section === 'illustrations') {
      const illustrations = effectiveDs.media?.generatedIllustrations || [];
      if (selectedDataSet.milestone) return <MediaReadOnlyGrid items={illustrations} getUrl={(i: any) => i.url} getLabel={(i: any) => i.prompt || i.description || ''} emptyLabel="Žádné ilustrace" />;
      const prompts = selectedDataSet.media?.illustrationPrompts || [];
      
      const handleGeneratePrompts = async () => {
        setGeneratingIllustrationPrompts(true);
        setGeneratingSuggestions(true);
        addLog('🎨 Generuji prompty pro ilustrace a navrhuji skupiny...');

        const dataSetObj = {
          id: selectedDataSet.id,
          topic: selectedDataSet.topic,
          subjectCode: selectedDataSet.subject_code,
          grade: selectedDataSet.grade,
          status: selectedDataSet.status,
          rvp: selectedDataSet.rvp || {},
          targetGroup: {},
          content: selectedDataSet.content || {},
          media: selectedDataSet.media || {},
          generatedMaterials: selectedDataSet.generated_materials || [],
          createdAt: selectedDataSet.created_at,
          updatedAt: selectedDataSet.updated_at,
        };
        
        try {
          const { generateIllustrationPrompts, suggestImageGroups } = await import('../../utils/dataset/material-generators');
          addLog('🔍 Analyzuji téma pro skupiny obrázků...');
          const [newPrompts, groups] = await Promise.all([
            generateIllustrationPrompts(dataSetObj),
            suggestImageGroups(dataSetObj).catch((e) => {
              addLog(`⚠️ Skupiny: ${String(e).slice(0, 80)}`, 'error');
              return [] as import('../../types/topic-dataset').ImageGroup[];
            }),
          ]);

          addLog(`🔍 Skupiny vráceny: ${groups.length}`);
          if (groups.length > 0) {
            setSuggestedImageGroups(groups);
            addLog(`💡 Navrženo ${groups.length} skupin obrázků`, 'success');
          } else {
            addLog('⚠️ AI nenavrhla žádné skupiny');
          }
          setGeneratingSuggestions(false);
          
          const mergedMedia = await saveMediaToDB(selectedDataSet.id, { illustrationPrompts: newPrompts });
          
          setSelectedDataSet((prev: any) => ({
            ...prev,
            media: mergedMedia
          }));
          
          addLog(`✅ Vygenerováno ${newPrompts.length} promptů`, 'success');
          toast.success(`${newPrompts.length} promptů připraveno`);
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Generování selhalo');
          setGeneratingSuggestions(false);
        } finally {
          setGeneratingIllustrationPrompts(false);
        }
      };
      
      const handleGenerateSingleIllustration = async (prompt: any, withLabels?: boolean) => {
        const useLabels = withLabels ?? promptLabels.has(prompt.id);
        const activeStyle = illustrationStyles.find(s => s.id === selectedStyleId) || illustrationStyles[0];
        setGeneratingPromptId(prompt.id);
        addLog(`🎨 [${activeStyle.emoji} ${activeStyle.name}] Generuji: ${prompt.name}${useLabels ? ' (s popiskem)' : ''}...`);

        const labelInstruction = useLabels
          ? `\n\nTEXT LABEL: Add a clean, short Czech label directly on the illustration. Use simple sans-serif font, bold, dark color, placed at the bottom or beside the main element. Label text: "${prompt.name}"`
          : `\n\nNO TEXT: Do not include any text, words, letters or labels in the illustration.`;

        // Styl ilustrace se přidá na začátek jako stylový prefix
        const stylePrefix = activeStyle.prompt;
        const basePrompt = prompt.prompt.includes('NO TEXT') || prompt.prompt.includes('TEXT LABEL')
          ? prompt.prompt
          : prompt.prompt + labelInstruction;
        const finalPrompt = `${stylePrefix}\n\nSUBJECT: ${basePrompt}`;

        console.group(`🖼️ INDIVIDUAL ILLUSTRATION — "${prompt.name}"`);
        console.log('📐 Model:', imageGenModel);
        console.log('🎨 Style:', activeStyle.name, '|', activeStyle.emoji);
        console.log('📝 FULL PROMPT:\n', finalPrompt);
        console.groupEnd();

        try {
          const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
          const { processImageUrl } = await import('../../utils/supabase/upload-image');
          
          const result = await generateImageWithImagen(finalPrompt, {
            aspectRatio: '1:1',
            numberOfImages: 1,
            model: imageGenModel,
          });
          
          if (result.success && (result.url || result.images?.[0]?.base64)) {
            let rawUrl = result.url || `data:${result.images?.[0]?.mimeType || 'image/png'};base64,${result.images?.[0]?.base64}`;
            const imageUrl = await processImageUrl(rawUrl, `${selectedDataSet.id}-${prompt.id}`, 'illustrations');
            
            if (imageUrl) {
              const newIllustration = {
                id: prompt.id,
                name: prompt.name,
                url: imageUrl,
                category: prompt.category,
                style: activeStyle.id,
              };
              
              const { data: freshData } = await supabase
                .from('topic_data_sets')
                .select('media')
                .eq('id', selectedDataSet.id)
                .single();
              const freshMedia = freshData?.media || {};
              
              const currentIllustrations = freshMedia.generatedIllustrations || [];
              const currentPrompts = freshMedia.illustrationPrompts || [];
              
              const alreadyExists = currentIllustrations.some((ill: any) => ill.id === prompt.id);
              const updatedIllustrations = alreadyExists 
                ? currentIllustrations.map((ill: any) => ill.id === prompt.id ? newIllustration : ill)
                : [...currentIllustrations, newIllustration];
              
              const updatedPrompts = currentPrompts.map((p: any) => 
                p.id === prompt.id ? { ...p, status: 'completed' } : p
              );
              
              const mergedMedia = stripBase64FromObject({
                ...freshMedia,
                generatedIllustrations: updatedIllustrations,
                illustrationPrompts: updatedPrompts
              }) as Record<string, any>;
              
              const { error: saveErr } = await supabase
                .from('topic_data_sets')
                .update({ media: mergedMedia })
                .eq('id', selectedDataSet.id);
              
              if (saveErr) {
                console.error('[Illustrations] Save error:', saveErr);
                toast.error('Uložení do DB selhalo');
              }
              
              setSelectedDataSet((prev: any) => ({
                ...prev,
                media: mergedMedia
              }));
              
              addLog(`✅ Vygenerováno: ${prompt.name}`, 'success');
              playSuccessSound();
              toast.success('Ilustrace vygenerována!');
            }
          } else {
            throw new Error(result.error || 'Generování selhalo');
          }
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Generování selhalo');
        } finally {
          setGeneratingPromptId(null);
        }
      };

      // Přegenerovat jako variantu (duplikát pro srovnání)
      const handleRegenerateAsVariant = async (illId: string, model: 'pro' | 'flash', customPrompt?: string) => {
        const prompts = selectedDataSet.media?.illustrationPrompts || [];
        const prompt = prompts.find((p: any) => p.id === illId);
        if (!prompt) return;

        setRegenPicker(null);
        setRegenGeneratingId(illId);
        addLog(`🔄 Generuji variantu (${model === 'flash' ? 'Flash 3.1' : 'Pro 3.0'}): ${prompt.name}...`);

        try {
          const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
          const { processImageUrl } = await import('../../utils/supabase/upload-image');

          // Použij vlastní prompt z pickeru, nebo originální prompt
          const basePrompt = customPrompt?.trim() || prompt.prompt;
          const finalPrompt = basePrompt.includes('NO TEXT') || basePrompt.includes('TEXT LABEL')
            ? basePrompt
            : basePrompt + '\n\nNO TEXT: Do not include any text, words, letters or labels in the illustration.';

          const result = await generateImageWithImagen(finalPrompt, {
            aspectRatio: '1:1', numberOfImages: 1, model,
          });

          if (result.success && (result.url || result.images?.[0]?.base64)) {
            let rawUrl = result.url || `data:${result.images?.[0]?.mimeType || 'image/png'};base64,${result.images?.[0]?.base64}`;
            const variantUrl = await processImageUrl(rawUrl, `${selectedDataSet.id}-${illId}-v${Date.now()}`, 'illustrations');

            if (variantUrl) {
              const { data: freshData } = await supabase.from('topic_data_sets').select('media').eq('id', selectedDataSet.id).single();
              const freshMedia = freshData?.media || {};
              const currentIlls = freshMedia.generatedIllustrations || [];
              const updatedIlls = currentIlls.map((ill: any) => {
                if (ill.id !== illId) return ill;
                const existingVariants = ill.variants || [];
                return {
                  ...ill,
                  variants: [...existingVariants, { url: variantUrl, model, generatedAt: new Date().toISOString() }],
                };
              });

              const mergedMedia = stripBase64FromObject({ ...freshMedia, generatedIllustrations: updatedIlls }) as Record<string, any>;
              await supabase.from('topic_data_sets').update({ media: mergedMedia }).eq('id', selectedDataSet.id);
              setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
              addLog(`✅ Varianta vygenerována: ${prompt.name}`, 'success');
              playSuccessSound();
              toast.success('Varianta přidána — porovnej a vyber lepší!');
            }
          } else {
            throw new Error(result.error || 'Generování selhalo');
          }
        } catch (err: any) {
          addLog(`❌ Chyba varianty: ${err.message}`, 'error');
          toast.error('Generování varianty selhalo');
        } finally {
          setRegenGeneratingId(null);
        }
      };

      // Použít variantu jako hlavní obrázek
      const handleUseVariant = async (illId: string, variantUrl: string) => {
        const { data: freshData } = await supabase.from('topic_data_sets').select('media').eq('id', selectedDataSet.id).single();
        const freshMedia = freshData?.media || {};
        const updatedIlls = (freshMedia.generatedIllustrations || []).map((ill: any) => {
          if (ill.id !== illId) return ill;
          return { ...ill, url: variantUrl, variants: [] }; // swap + clear variants
        });
        const mergedMedia = stripBase64FromObject({ ...freshMedia, generatedIllustrations: updatedIlls }) as Record<string, any>;
        await supabase.from('topic_data_sets').update({ media: mergedMedia }).eq('id', selectedDataSet.id);
        setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
        toast.success('Varianta nastavena jako hlavní!');
      };

      // Zahodit variantu
      const handleDiscardVariant = async (illId: string, variantUrl: string) => {
        const { data: freshData } = await supabase.from('topic_data_sets').select('media').eq('id', selectedDataSet.id).single();
        const freshMedia = freshData?.media || {};
        const updatedIlls = (freshMedia.generatedIllustrations || []).map((ill: any) => {
          if (ill.id !== illId) return ill;
          return { ...ill, variants: (ill.variants || []).filter((v: any) => v.url !== variantUrl) };
        });
        const mergedMedia = stripBase64FromObject({ ...freshMedia, generatedIllustrations: updatedIlls }) as Record<string, any>;
        await supabase.from('topic_data_sets').update({ media: mergedMedia }).eq('id', selectedDataSet.id);
        setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
        toast.success('Varianta zahozena');
      };

      return (
        <>
        {/* ── Lightbox ── */}
        {lightbox && (
          <div
            onClick={() => setLightbox(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
          >
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 10, fontWeight: 600 }}>{lightbox.label}</div>
            <img src={lightbox.url} alt={lightbox.label} onClick={e => e.stopPropagation()}
              style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', cursor: 'default' }} />
            <button onClick={() => setLightbox(null)} style={{ marginTop: 16, padding: '6px 20px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>✕ Zavřít</button>
          </div>
        )}
        <div className="p-4 space-y-4 overflow-y-auto">

          {/* ── Styl ilustrací ── */}
          <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: '12px 14px', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#7e22ce' }}>🎨 Styl ilustrací</span>
              <button
                onClick={() => {
                  const newId = `custom-${Date.now()}`;
                  setIllustrationStyles(prev => [...prev, {
                    id: newId, name: 'Nový styl', emoji: '✨', color: '#64748b',
                    prompt: 'Describe the illustration style here...',
                  }]);
                  setSelectedStyleId(newId);
                  setEditingStyleId(newId);
                }}
                style={{ fontSize: 11, color: '#9333ea', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
              >
                <span style={{ fontSize: 14 }}>+</span> Přidat styl
              </button>
            </div>

            {/* Kartičky stylů */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {illustrationStyles.map(style => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyleId(style.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 8, border: '2px solid',
                    borderColor: selectedStyleId === style.id ? style.color : 'transparent',
                    background: selectedStyleId === style.id ? style.color + '18' : '#f1f5f9',
                    cursor: 'pointer', fontSize: 11, fontWeight: selectedStyleId === style.id ? 700 : 500,
                    color: selectedStyleId === style.id ? style.color : '#475569',
                    transition: 'all .12s',
                  }}
                >
                  <span>{style.emoji}</span>
                  <span>{style.name}</span>
                </button>
              ))}
            </div>

            {/* Detail vybraného stylu */}
            {(() => {
              const activeStyle = illustrationStyles.find(s => s.id === selectedStyleId);
              if (!activeStyle) return null;
              const isEditing = editingStyleId === activeStyle.id;
              return (
                <div style={{ background: 'white', borderRadius: 8, border: `1px solid ${activeStyle.color}40`, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isEditing ? (
                        <input
                          value={activeStyle.emoji}
                          onChange={e => setIllustrationStyles(prev => prev.map(s => s.id === activeStyle.id ? { ...s, emoji: e.target.value } : s))}
                          style={{ width: 32, fontSize: 16, textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 2px' }}
                        />
                      ) : (
                        <span style={{ fontSize: 16 }}>{activeStyle.emoji}</span>
                      )}
                      {isEditing ? (
                        <input
                          value={activeStyle.name}
                          onChange={e => setIllustrationStyles(prev => prev.map(s => s.id === activeStyle.id ? { ...s, name: e.target.value } : s))}
                          style={{ fontSize: 12, fontWeight: 700, color: activeStyle.color, border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 6px', flex: 1 }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: activeStyle.color }}>{activeStyle.name}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => setEditingStyleId(isEditing ? null : activeStyle.id)}
                        style={{ fontSize: 10, color: isEditing ? '#22c55e' : '#9333ea', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {isEditing ? '✓ Uložit' : '✏️ Upravit'}
                      </button>
                      {illustrationStyles.length > 1 && (
                        <button
                          onClick={() => {
                            setIllustrationStyles(prev => prev.filter(s => s.id !== activeStyle.id));
                            setSelectedStyleId(illustrationStyles.find(s => s.id !== activeStyle.id)?.id || 'simple');
                            setEditingStyleId(null);
                          }}
                          style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <textarea
                      value={activeStyle.prompt}
                      onChange={e => setIllustrationStyles(prev => prev.map(s => s.id === activeStyle.id ? { ...s, prompt: e.target.value } : s))}
                      rows={4}
                      style={{ width: '100%', fontSize: 11, color: '#475569', lineHeight: 1.5, border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  ) : (
                    <p style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{activeStyle.prompt}</p>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-slate-700">
              🎨 Ilustrace ({illustrations.length})
            </h3>
            <button
              onClick={handleGeneratePrompts}
              disabled={generatingIllustrationPrompts}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 12px', backgroundColor: '#9333ea', color: 'white',
                fontSize: '12px', fontWeight: 500, borderRadius: '8px', border: 'none',
                cursor: generatingIllustrationPrompts ? 'not-allowed' : 'pointer',
                opacity: generatingIllustrationPrompts ? 0.5 : 1,
              }}
            >
              {generatingIllustrationPrompts ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Generovat prompty
            </button>
          </div>

          {/* Navrhované skupiny obrázků */}
          {generatingSuggestions && (
            <div style={{ margin: '10px 0', padding: '10px 14px', borderRadius: 10, background: '#faf5ff', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#a855f7' }} />
              <span style={{ fontSize: 12, color: '#7c3aed' }}>AI analyzuje téma a navrhuje skupiny obrázků…</span>
            </div>
          )}
          {!generatingSuggestions && suggestedImageGroups.length > 0 && (
            <SuggestedImageGroupsPanel
              groups={suggestedImageGroups}
              generatingIds={generatingGroupIds}
              onGenerateGroup={async (group) => {
                setGeneratingGroupIds(prev => new Set([...prev, group.id]));
                addLog(`🎨 Generuji navrhovanou skupinu "${group.title}"...`);
                try {
                  const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
                  const { processImageUrl } = await import('../../utils/supabase/upload-image');
                  const activeStyle = illustrationStyles.find(s => s.id === selectedStyleId) || illustrationStyles[0];
                  const updatedSubjects = await generateGroupInBatches(
                    group, activeStyle.prompt, generateImageWithImagen, processImageUrl,
                    selectedDataSet.id, 'illustrations',
                    (subs) => {
                      setSelectedDataSet((p: any) => {
                        const existing = p.media?.imageGroups || [];
                        const has = existing.some((ig: ImageGroup) => ig.id === group.id);
                        const updated = has
                          ? existing.map((ig: ImageGroup) => ig.id === group.id ? { ...ig, subjects: subs } : ig)
                          : [...existing, { ...group, subjects: subs }];
                        return { ...p, media: { ...p.media, imageGroups: updated } };
                      });
                    },
                    addLog,
                    imageGenModel,
                  );
                  const finalGroup = { ...group, subjects: updatedSubjects, updatedAt: new Date().toISOString() };
                  const existing = selectedDataSet.media?.imageGroups || [];
                  const has = existing.some((ig: ImageGroup) => ig.id === group.id);
                  const finalGroups = has
                    ? existing.map((ig: ImageGroup) => ig.id === group.id ? finalGroup : ig)
                    : [...existing, finalGroup];
                  const mergedMedia = await saveMediaToDB(selectedDataSet.id, { imageGroups: finalGroups });
                  setSelectedDataSet((p: any) => ({ ...p, media: mergedMedia }));
                  setSuggestedImageGroups(prev => prev.filter(g => g.id !== group.id));
                  addLog(`✅ Skupina "${group.title}" vygenerována`, 'success');
                } catch (e: any) {
                  addLog(`❌ ${String(e).slice(0, 80)}`, 'error');
                } finally {
                  setGeneratingGroupIds(prev => { const s = new Set(prev); s.delete(group.id); return s; });
                }
              }}
              onDismissGroup={(groupId) => setSuggestedImageGroups(prev => prev.filter(g => g.id !== groupId))}
              onDismissAll={() => setSuggestedImageGroups([])}
            />
          )}

          {/* Vygenerované ilustrace */}
          {illustrations.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {illustrations.map((ill: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    borderRadius: 12, border: `2px solid ${ill.excluded ? '#fca5a5' : ill.priority ? '#fcd34d' : '#d8b4fe'}`,
                    backgroundColor: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    overflow: 'hidden', opacity: ill.excluded ? 0.65 : 1,
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  <div style={{ position: 'relative', height: 120, overflow: 'hidden', flexShrink: 0 }}>
                    <img
                      src={ill.url}
                      alt={ill.name || 'Ilustrace'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: ill.excluded ? 'grayscale(80%)' : 'none' }}
                    />
                    <div style={{
                      position: 'absolute', top: 6, left: 6,
                      padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                      color: 'white', backgroundColor: ill.excluded ? '#ef444499' : ill.priority ? '#f59e0b' : '#a855f7',
                    }}>
                      {ill.excluded ? '❌ Vyřazeno' : ill.priority ? '⭐ Prioritní' : '✅ Aktivní'}
                    </div>
                  </div>
                  <div style={{ padding: '4px 8px', fontSize: 11, color: '#475569', fontWeight: 500, background: '#faf5ff', borderBottom: '1px solid #f3e8ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
                    {ill.name || 'Ilustrace'}
                  </div>
                  {/* Tlačítka akcí */}
                  <div style={{ display: 'flex', gap: 4, padding: '6px 6px', background: 'white', flexShrink: 0 }}>
                    <button
                      onClick={async () => {
                        const illId = ill.id;
                        const upd = (selectedDataSet.media?.generatedIllustrations || []).map((i: any) => i.id === illId ? { ...i, priority: !i.priority } : i);
                        try { const m = await saveMediaToDB(selectedDataSet.id, { generatedIllustrations: upd }); setSelectedDataSet((p: any) => ({ ...p, media: m })); } catch { toast.error('Uložení selhalo'); }
                      }}
                      title="Prioritní"
                      style={{ padding: '5px 7px', borderRadius: 6, fontSize: 13, border: 'none', cursor: 'pointer', flexShrink: 0, backgroundColor: ill.priority ? '#fef3c7' : '#f1f5f9', color: ill.priority ? '#d97706' : '#94a3b8' }}
                    >⭐</button>
                    <button
                      onClick={async () => {
                        const illId = ill.id;
                        const upd = (selectedDataSet.media?.generatedIllustrations || []).map((i: any) => i.id === illId ? { ...i, excluded: !i.excluded } : i);
                        try { const m = await saveMediaToDB(selectedDataSet.id, { generatedIllustrations: upd }); setSelectedDataSet((p: any) => ({ ...p, media: m })); } catch { toast.error('Uložení selhalo'); }
                      }}
                      style={{ flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: ill.excluded ? '#dcfce7' : '#fee2e2', color: ill.excluded ? '#16a34a' : '#dc2626' }}
                    >{ill.excluded ? '↩ Obnovit' : '✕ Vyřadit'}</button>
                    <button
                      onClick={() => window.open(ill.url, '_blank')}
                      style={{ padding: '5px 7px', borderRadius: 6, fontSize: 13, border: 'none', cursor: 'pointer', flexShrink: 0, backgroundColor: '#eff6ff', color: '#3b82f6' }}
                    >👁️</button>
                    <button
                      onClick={() => {
                        const p = (selectedDataSet.media?.illustrationPrompts || []).find((p: any) => p.id === ill.id);
                        setRegenPickerPrompt(p?.prompt || '');
                        setRegenPicker({ id: ill.id, type: 'illustration' });
                        setRegenPickerModel('flash');
                      }}
                      disabled={regenGeneratingId === ill.id}
                      title="Srovnat varianty"
                      style={{ padding: '5px 7px', borderRadius: 6, fontSize: 13, border: 'none', cursor: 'pointer', flexShrink: 0, backgroundColor: regenPicker?.id === ill.id ? '#e9d5ff' : '#f5f3ff', color: '#9333ea', opacity: regenGeneratingId === ill.id ? 0.5 : 1 }}
                    >
                      {regenGeneratingId === ill.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Model picker — vlastní řádek pod tlačítky */}
                  {regenPicker?.id === ill.id && (
                    <div style={{ padding: '8px', background: '#faf5ff', borderTop: '1px solid #f3e8ff', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Prompt — editovatelný */}
                      <textarea
                        value={regenPickerPrompt}
                        onChange={e => setRegenPickerPrompt(e.target.value)}
                        rows={3}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: 7, border: '1px solid #e9d5ff', fontSize: 10, resize: 'vertical', color: '#1e293b', background: 'white', fontFamily: 'inherit' }}
                        placeholder="Prompt pro generování..."
                      />
                      {/* Model + akce */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#7e22ce', fontWeight: 700 }}>Model:</span>
                        {(['flash', 'pro'] as const).map(m => (
                          <button key={m} onClick={() => setRegenPickerModel(m)} style={{
                            padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: regenPickerModel === m ? (m === 'flash' ? '#0ea5e9' : '#9333ea') : '#e2e8f0',
                            color: regenPickerModel === m ? 'white' : '#64748b',
                          }}>
                            {m === 'flash' ? '⚡ Flash' : '⭐ Pro'}
                          </button>
                        ))}
                        <button
                          onClick={() => handleRegenerateAsVariant(ill.id, regenPickerModel, regenPickerPrompt)}
                          disabled={regenGeneratingId === ill.id || !regenPickerPrompt.trim()}
                          style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer', background: '#9333ea', color: 'white', marginLeft: 'auto' }}
                        >
                          {regenGeneratingId === ill.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '+ Srovnej'}
                        </button>
                        <button onClick={() => setRegenPicker(null)} style={{ padding: '3px 6px', borderRadius: 5, fontSize: 11, border: 'none', cursor: 'pointer', background: 'transparent', color: '#94a3b8' }}>✕</button>
                      </div>
                    </div>
                  )}

                  {/* ── Comparison karousel ── */}
                  {(ill.variants || []).length > 0 && (() => {
                    const variants = ill.variants || [];
                    // slides: [originál, ...varianty]
                    const slides = [
                      { url: ill.url, label: 'Aktuální', model: null as null | string, isOriginal: true },
                      ...variants.map((v: any, vi: number) => ({
                        url: v.url, label: `Varianta ${vi + 1}`, model: v.model, isOriginal: false,
                      })),
                    ];
                    const idx = variantIndex[ill.id] ?? 0;
                    const slide = slides[Math.min(idx, slides.length - 1)];
                    const modelLabel = slide.model === 'flash' ? '⚡ Flash 3.1' : slide.model === 'pro' ? '⭐ Pro 3.0' : '';

                    return (
                      <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px' }}>
                        {/* Header: název + tečky */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Srovnání {idx + 1}/{slides.length}
                          </span>
                          <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
                            {slides.map((_, i) => (
                              <button key={i} onClick={() => setVariantIndex(prev => ({ ...prev, [ill.id]: i }))} style={{
                                width: i === idx ? 16 : 8, height: 8, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0,
                                background: i === idx ? '#9333ea' : '#e2e8f0', transition: 'all .15s',
                              }} />
                            ))}
                          </div>
                        </div>

                        {/* Obrázek */}
                        <div style={{ position: 'relative' }}>
                          <img
                            src={slide.url}
                            alt={slide.label}
                            onClick={() => setLightbox({ url: slide.url, label: `${slide.label}${modelLabel ? ' · ' + modelLabel : ''}` })}
                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in',
                              border: `2px solid ${slide.isOriginal ? '#6366f1' : '#9333ea'}` }}
                          />
                          {/* Štítek + náhled ikona */}
                          <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '2px 7px', fontSize: 9, color: 'white', fontWeight: 700 }}>
                            {slide.label}{modelLabel ? ` · ${modelLabel}` : ''}
                          </div>
                          <button onClick={() => setLightbox({ url: slide.url, label: `${slide.label}${modelLabel ? ' · ' + modelLabel : ''}` })}
                            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: 6, padding: '3px 6px', cursor: 'pointer', fontSize: 13, color: 'white' }}
                            title="Zobrazit náhled">🔍</button>
                          {/* Šipky */}
                          {idx > 0 && (
                            <button onClick={() => setVariantIndex(p => ({ ...p, [ill.id]: idx - 1 }))}
                              style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontSize: 14, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                          )}
                          {idx < slides.length - 1 && (
                            <button onClick={() => setVariantIndex(p => ({ ...p, [ill.id]: idx + 1 }))}
                              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontSize: 14, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                          )}
                        </div>

                        {/* Akce pro variantu */}
                        {!slide.isOriginal && (
                          <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                            <button onClick={() => handleUseVariant(ill.id, slide.url)} style={{
                              flex: 1, padding: '5px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: '#22c55e', color: 'white',
                            }}>✓ Použít tuto</button>
                            <button onClick={() => { handleDiscardVariant(ill.id, slide.url); setVariantIndex(p => ({ ...p, [ill.id]: 0 })); }} style={{
                              padding: '5px 10px', borderRadius: 7, fontSize: 11, border: 'none', cursor: 'pointer', background: '#fee2e2', color: '#dc2626', fontWeight: 700,
                            }}>✕ Zahodit</button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {/* Skupiny ilustrací — pod vygenerovanými ilustracemi */}
          {(selectedDataSet.media?.imageGroups || []).some((g: ImageGroup) => g.type === 'illustration' || g.type === 'diagram') && (
            <div className="mb-2">
              <div className="grid grid-cols-2 gap-3">
              {(selectedDataSet.media?.imageGroups || [])
                .filter((g: ImageGroup) => g.type === 'illustration' || g.type === 'diagram')
                .map((group: ImageGroup) => (
                  <ImageGroupTile
                    key={group.id}
                    group={group}
                    generating={generatingGroupIds.has(group.id)}
                    onGenerateAll={async (g) => {
                      setGeneratingGroupIds(prev => new Set([...prev, g.id]));
                      addLog(`🎨 Generuji skupinu "${g.title}"...`);
                      const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
                      const { processImageUrl } = await import('../../utils/supabase/upload-image');
                      const activeStyle = illustrationStyles.find(s => s.id === selectedStyleId) || illustrationStyles[0];
                      let updatedSubjects = [...g.subjects];
                      for (let i = 0; i < updatedSubjects.length; i++) {
                        const s = updatedSubjects[i];
                        if (s.status === 'done' && s.imageUrl) continue;
                        addLog(`🎨 [${i + 1}/${updatedSubjects.length}] ${s.name}...`);
                        try {
                          const subjectPrompt = `${activeStyle.prompt}\n\nSUBJECT: ${s.extraPrompt ? s.name + ' — ' + s.extraPrompt : s.name}. Context: ${g.stylePrompt}\n\nNO TEXT: Do not include any text, words or labels.\n\nStyle requirements:\n${ILLUSTRATION_STYLE}`;
                          console.group(`🖼️ GROUP INDIVIDUAL — "${g.title}" [${i+1}/${updatedSubjects.length}] "${s.name}"`);
                          console.log('📐 Aspect: 1:1 | Model:', imageGenModel);
                          console.log('🎨 Style:', activeStyle.name, '|', activeStyle.emoji);
                          console.log('📝 FULL PROMPT:\n', subjectPrompt);
                          console.groupEnd();
                          const result = await generateImageWithImagen(subjectPrompt, { aspectRatio: '1:1', numberOfImages: 1, model: imageGenModel });
                          if (result.success && (result.url || result.images?.[0]?.base64)) {
                            const rawUrl = result.url || `data:${result.images?.[0]?.mimeType || 'image/png'};base64,${result.images?.[0]?.base64}`;
                            const imageUrl = await processImageUrl(rawUrl, `${selectedDataSet.id}-grp-${g.id}-${s.id}`, 'illustrations');
                            updatedSubjects[i] = { ...s, status: 'done', imageUrl: imageUrl || rawUrl };
                          } else {
                            throw new Error(result.error || 'Generování selhalo');
                          }
                        } catch (e: any) {
                          addLog(`⚠️ ${s.name}: ${String(e).slice(0, 60)}`, 'error');
                          updatedSubjects[i] = { ...s, status: 'error', error: String(e) };
                        }
                        const inProg = (selectedDataSet.media?.imageGroups || []).map((ig: ImageGroup) =>
                          ig.id === g.id ? { ...ig, subjects: [...updatedSubjects] } : ig
                        );
                        setSelectedDataSet((p: any) => ({ ...p, media: { ...p.media, imageGroups: inProg } }));
                      }
                      const finalGroups = (selectedDataSet.media?.imageGroups || []).map((ig: ImageGroup) =>
                        ig.id === g.id ? { ...ig, subjects: updatedSubjects, updatedAt: new Date().toISOString() } : ig
                      );
                      const mergedMedia = await saveMediaToDB(selectedDataSet.id, { imageGroups: finalGroups });
                      setSelectedDataSet((p: any) => ({ ...p, media: mergedMedia }));
                      setGeneratingGroupIds(prev => { const s = new Set(prev); s.delete(g.id); return s; });
                      playSuccessSound();
                      addLog(`✅ Skupina "${g.title}" vygenerována`, 'success');
                    }}
                    onGenerateWide={async (g) => {
                      setGeneratingGroupIds(prev => new Set([...prev, g.id]));
                      const activeStyle = illustrationStyles.find(s => s.id === selectedStyleId) || illustrationStyles[0];
                      addLog(`🎨 [${activeStyle.emoji} ${activeStyle.name}] Skupina "${g.title}" — wide batch`);
                      try {
                        const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
                        const { processImageUrl } = await import('../../utils/supabase/upload-image');
                        const updatedSubjects = await generateGroupInBatches(
                          g, activeStyle.prompt,
                          generateImageWithImagen,
                          processImageUrl,
                          selectedDataSet.id,
                          'illustrations',
                          (subs) => {
                            const inProg = (selectedDataSet.media?.imageGroups || []).map((ig: ImageGroup) =>
                              ig.id === g.id ? { ...ig, subjects: subs } : ig
                            );
                            setSelectedDataSet((p: any) => ({ ...p, media: { ...p.media, imageGroups: inProg } }));
                          },
                          addLog,
                          imageGenModel,
                        );
                        const finalGroups = (selectedDataSet.media?.imageGroups || []).map((ig: ImageGroup) =>
                          ig.id === g.id ? { ...ig, subjects: updatedSubjects, updatedAt: new Date().toISOString() } : ig
                        );
                        const mergedMedia = await saveMediaToDB(selectedDataSet.id, { imageGroups: finalGroups });
                        setSelectedDataSet((p: any) => ({ ...p, media: mergedMedia }));
                        playSuccessSound();
                        addLog(`✅ Skupina "${g.title}" hotova`, 'success');
                      } catch (e: any) {
                        addLog(`❌ Generování skupiny selhalo: ${String(e).slice(0, 80)}`, 'error');
                      } finally {
                        setGeneratingGroupIds(prev => { const s = new Set(prev); s.delete(g.id); return s; });
                      }
                    }}
                    onDelete={async (groupId) => {
                      const updated = (selectedDataSet.media?.imageGroups || []).filter((ig: ImageGroup) => ig.id !== groupId);
                      const mergedMedia = await saveMediaToDB(selectedDataSet.id, { imageGroups: updated });
                      setSelectedDataSet((p: any) => ({ ...p, media: mergedMedia }));
                    }}
                    onPreview={(url, label) => setLightbox({ url, label })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Prompty k vygenerování */}
          {prompts.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-600">
                Prompty ({prompts.filter((p: any) => p.status !== 'completed').length} k vygenerování)
              </div>
              {prompts.filter((p: any) => p.status !== 'completed').map((prompt: any) => {
                const hasLabel = promptLabels.has(prompt.id);
                return (
                  <div
                    key={prompt.id}
                    className="p-3 bg-purple-50 rounded-xl border border-purple-200"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="font-medium text-purple-700 text-sm">{prompt.name}</div>
                      <button
                        onClick={() => handleGenerateSingleIllustration(prompt)}
                        disabled={generatingPromptId === prompt.id}
                        style={{
                          flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '4px 8px', backgroundColor: '#9333ea', color: 'white',
                          fontSize: '12px', fontWeight: 500, borderRadius: '4px', border: 'none',
                          cursor: generatingPromptId === prompt.id ? 'not-allowed' : 'pointer',
                          opacity: generatingPromptId === prompt.id ? 0.5 : 1,
                        }}
                      >
                        {generatingPromptId === prompt.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        Generovat
                      </button>
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-2 mb-2">{prompt.prompt}</div>
                    {/* Popisek toggle */}
                    <button
                      onClick={() => setPromptLabels(prev => {
                        const next = new Set(prev);
                        if (next.has(prompt.id)) next.delete(prompt.id);
                        else next.add(prompt.id);
                        return next;
                      })}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500,
                        border: `1px solid ${hasLabel ? '#9333ea' : '#d1d5db'}`,
                        backgroundColor: hasLabel ? '#f3e8ff' : '#f9fafb',
                        color: hasLabel ? '#7e22ce' : '#9ca3af',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ width: 20, height: 12, borderRadius: 99, backgroundColor: hasLabel ? '#9333ea' : '#d1d5db', display: 'inline-block', position: 'relative', transition: 'all 0.15s', flexShrink: 0 }}>
                        <span style={{ position: 'absolute', top: 2, left: hasLabel ? 10 : 2, width: 8, height: 8, borderRadius: '50%', backgroundColor: 'white', transition: 'all 0.15s' }} />
                      </span>
                      Popisek
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* ── Model info (Flash výchozí, Pro dostupné v přegenerování) ── */}
          <div style={{ padding: '7px 14px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#0ea5e9' }}>⚡ Flash 3.1</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>— výchozí model · Pro dostupné v přegenerování</span>
          </div>

          {/* ── Vlastní ilustrace ── */}
          <div style={{ padding: '12px 14px', background: '#faf5ff', borderRadius: 12, border: '1px solid #e9d5ff' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7e22ce', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles className="w-3.5 h-3.5" /> Vlastní ilustrace
            </div>
            <input
              type="text"
              value={customIllustrationDesc}
              onChange={e => setCustomIllustrationDesc(e.target.value)}
              onKeyDown={async e => { if (e.key === 'Enter' && customIllustrationDesc.trim()) { e.preventDefault(); await handleCustomIllustration(); } }}
              placeholder={`Popiš co chceš – např. "mapa starověkého Řecka s městy"`}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d8b4fe', fontSize: 12, outline: 'none', background: 'white', color: '#1e293b', marginBottom: 8 }}
            />
            <button
              onClick={handleCustomIllustration}
              disabled={customIllustrationGenerating || !customIllustrationDesc.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none', backgroundColor: customIllustrationDesc.trim() ? '#9333ea' : '#e5e7eb', color: customIllustrationDesc.trim() ? 'white' : '#9ca3af', fontSize: 12, fontWeight: 600, cursor: customIllustrationDesc.trim() && !customIllustrationGenerating ? 'pointer' : 'not-allowed', opacity: customIllustrationGenerating ? 0.6 : 1 }}
            >
              {customIllustrationGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {customIllustrationGenerating ? 'Generuji...' : 'Generovat'}
            </button>
          </div>

          {/* Prázdný stav */}
          {illustrations.length === 0 && prompts.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Žádné ilustrace</p>
              <p className="text-sm">Klikni na "Generovat prompty"</p>
            </div>
          )}
        </div>
        </>
      );
    }
    
    if (section === 'photos') {
      const photos = effectiveDs.media?.generatedPhotos || [];
      if (selectedDataSet.milestone) return <MediaReadOnlyGrid items={photos} getUrl={(i: any) => i.url} getLabel={(i: any) => i.prompt || i.description || ''} emptyLabel="Žádné fotky" />;
      const prompts = selectedDataSet.media?.photoPrompts || [];
      
      const handleGeneratePrompts = async () => {
        setGeneratingPhotoPrompts(true);
        setGeneratingSuggestions(true);
        addLog('📷 Generuji prompty pro fotky a navrhuji skupiny...');

        const dataSetObj = {
          id: selectedDataSet.id,
          topic: selectedDataSet.topic,
          subjectCode: selectedDataSet.subject_code,
          grade: selectedDataSet.grade,
          status: selectedDataSet.status,
          rvp: selectedDataSet.rvp || {},
          targetGroup: {},
          content: selectedDataSet.content || {},
          media: selectedDataSet.media || {},
          generatedMaterials: selectedDataSet.generated_materials || [],
          createdAt: selectedDataSet.created_at,
          updatedAt: selectedDataSet.updated_at,
        };
        
        try {
          const { generatePhotoPrompts, suggestImageGroups } = await import('../../utils/dataset/material-generators');
          addLog('🔍 Analyzuji téma pro skupiny obrázků...');
          const [newPrompts, groups] = await Promise.all([
            generatePhotoPrompts(dataSetObj),
            suggestImageGroups(dataSetObj).catch((e) => {
              addLog(`⚠️ Skupiny: ${String(e).slice(0, 80)}`, 'error');
              return [] as import('../../types/topic-dataset').ImageGroup[];
            }),
          ]);

          addLog(`🔍 Skupiny vráceny: ${groups.length}`);
          if (groups.length > 0) {
            setSuggestedImageGroups(groups);
            addLog(`💡 Navrženo ${groups.length} skupin obrázků`, 'success');
          } else {
            addLog('⚠️ AI nenavrhla žádné skupiny');
          }
          setGeneratingSuggestions(false);
          
          const mergedMedia = await saveMediaToDB(selectedDataSet.id, { photoPrompts: newPrompts });
          
          setSelectedDataSet((prev: any) => ({
            ...prev,
            media: mergedMedia
          }));
          
          addLog(`✅ Vygenerováno ${newPrompts.length} promptů`, 'success');
          toast.success(`${newPrompts.length} promptů připraveno`);
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Generování selhalo');
          setGeneratingSuggestions(false);
        } finally {
          setGeneratingPhotoPrompts(false);
        }
      };
      
      const handleGenerateSinglePhoto = async (prompt: any) => {
        setGeneratingPromptId(prompt.id);
        addLog(`📷 Generuji: ${prompt.name}...`);
        
        try {
          const { generatePhoto } = await import('../../utils/dataset/material-generators');
          
          // Zachytit potřebné hodnoty z selectedDataSet před async operací
          const dataSetSnapshot = {
            id: selectedDataSet.id,
            topic: selectedDataSet.topic,
            subjectCode: selectedDataSet.subject_code,
            grade: selectedDataSet.grade,
            status: selectedDataSet.status,
            rvp: selectedDataSet.rvp || {},
            targetGroup: {},
            content: selectedDataSet.content || {},
            media: selectedDataSet.media || {},
            generatedMaterials: selectedDataSet.generated_materials || [],
            createdAt: selectedDataSet.created_at,
            updatedAt: selectedDataSet.updated_at,
          };
          
          const imageUrl = await generatePhoto(prompt, dataSetSnapshot, imageGenModel);
          
          if (imageUrl) {
            const newPhoto = {
              id: prompt.id,
              name: prompt.name,
              url: imageUrl,
              category: prompt.category,
            };
            
            const { data: freshData } = await supabase
              .from('topic_data_sets')
              .select('media')
              .eq('id', selectedDataSet.id)
              .single();
            const freshMedia = freshData?.media || {};
            
            const currentPhotos = freshMedia.generatedPhotos || [];
            const currentPrompts = freshMedia.photoPrompts || [];
            
            const alreadyExists = currentPhotos.some((p: any) => p.id === prompt.id);
            const updatedPhotos = alreadyExists 
              ? currentPhotos.map((p: any) => p.id === prompt.id ? newPhoto : p)
              : [...currentPhotos, newPhoto];
            
            const updatedPrompts = currentPrompts.map((p: any) => 
              p.id === prompt.id ? { ...p, status: 'completed' } : p
            );
            
            const mergedMedia = stripBase64FromObject({
              ...freshMedia,
              generatedPhotos: updatedPhotos,
              photoPrompts: updatedPrompts
            }) as Record<string, any>;
            
            const { error: saveErr } = await supabase
              .from('topic_data_sets')
              .update({ media: mergedMedia })
              .eq('id', selectedDataSet.id);
            
            if (saveErr) {
              console.error('[Photos] Save error:', saveErr);
              toast.error('Uložení do DB selhalo');
            }
            
            setSelectedDataSet((prev: any) => ({
              ...prev,
              media: mergedMedia
            }));
            
            addLog(`✅ Vygenerováno: ${prompt.name}`, 'success');
            toast.success('Fotka vygenerována!');
          } else {
            throw new Error('Generování selhalo');
          }
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Generování selhalo');
        } finally {
          setGeneratingPromptId(null);
        }
      };
      
      return (
        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-700">
              📷 Fotorealistické fotky ({photos.length})
            </h3>
            <button
              onClick={handleGeneratePrompts}
              disabled={generatingPhotoPrompts}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: '#d97706',
                color: 'white',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '8px',
                border: 'none',
                cursor: generatingPhotoPrompts ? 'not-allowed' : 'pointer',
                opacity: generatingPhotoPrompts ? 0.5 : 1,
              }}
            >
              {generatingPhotoPrompts ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ImageIcon className="w-3 h-3" />
              )}
              Generovat prompty
            </button>
          </div>

          {/* Navrhované skupiny obrázků */}
          {generatingSuggestions && (
            <div style={{ margin: '10px 0', padding: '10px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#d97706' }} />
              <span style={{ fontSize: 12, color: '#92400e' }}>AI analyzuje téma a navrhuje skupiny obrázků…</span>
            </div>
          )}
          {!generatingSuggestions && suggestedImageGroups.length > 0 && (
            <SuggestedImageGroupsPanel
              groups={suggestedImageGroups}
              generatingIds={generatingGroupIds}
              onGenerateGroup={async (group) => {
                setGeneratingGroupIds(prev => new Set([...prev, group.id]));
                addLog(`📷 Generuji navrhovanou skupinu "${group.title}"...`);
                try {
                  const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
                  const { processImageUrl } = await import('../../utils/supabase/upload-image');
                  const photoStyle = 'Authentic candid photograph, natural ambient lighting, real textures, slight grain, 35-50mm lens, rule-of-thirds composition, warm natural colors, no studio lighting, no illustration.';
                  const updatedSubjects = await generateGroupInBatches(
                    group, photoStyle, generateImageWithImagen, processImageUrl,
                    selectedDataSet.id, 'photos',
                    (subs) => {
                      setSelectedDataSet((p: any) => {
                        const existing = p.media?.imageGroups || [];
                        const has = existing.some((ig: ImageGroup) => ig.id === group.id);
                        const updated = has
                          ? existing.map((ig: ImageGroup) => ig.id === group.id ? { ...ig, subjects: subs } : ig)
                          : [...existing, { ...group, subjects: subs }];
                        return { ...p, media: { ...p.media, imageGroups: updated } };
                      });
                    },
                    addLog,
                    imageGenModel,
                  );
                  const finalGroup = { ...group, subjects: updatedSubjects, updatedAt: new Date().toISOString() };
                  const existing = selectedDataSet.media?.imageGroups || [];
                  const has = existing.some((ig: ImageGroup) => ig.id === group.id);
                  const finalGroups = has
                    ? existing.map((ig: ImageGroup) => ig.id === group.id ? finalGroup : ig)
                    : [...existing, finalGroup];
                  const mergedMedia = await saveMediaToDB(selectedDataSet.id, { imageGroups: finalGroups });
                  setSelectedDataSet((p: any) => ({ ...p, media: mergedMedia }));
                  setSuggestedImageGroups(prev => prev.filter(g => g.id !== group.id));
                  addLog(`✅ Skupina "${group.title}" vygenerována`, 'success');
                } catch (e: any) {
                  addLog(`❌ ${String(e).slice(0, 80)}`, 'error');
                } finally {
                  setGeneratingGroupIds(prev => { const s = new Set(prev); s.delete(group.id); return s; });
                }
              }}
              onDismissGroup={(groupId) => setSuggestedImageGroups(prev => prev.filter(g => g.id !== groupId))}
              onDismissAll={() => setSuggestedImageGroups([])}
            />
          )}
          
          {/* Vygenerované fotky */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {photos.map((photo: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    borderRadius: 12, border: `2px solid ${photo.excluded ? '#fca5a5' : photo.priority ? '#fcd34d' : '#fde68a'}`,
                    backgroundColor: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    overflow: 'hidden', opacity: photo.excluded ? 0.65 : 1,
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  <div style={{ position: 'relative', height: 120, overflow: 'hidden', flexShrink: 0 }}>
                    <img
                      src={photo.url}
                      alt={photo.name || 'Fotka'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: photo.excluded ? 'grayscale(80%)' : 'none' }}
                    />
                    <div style={{
                      position: 'absolute', top: 6, left: 6,
                      padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                      color: 'white', backgroundColor: photo.excluded ? '#ef444499' : photo.priority ? '#f59e0b' : '#22c55e',
                    }}>
                      {photo.excluded ? '❌ Vyřazeno' : photo.priority ? '⭐ Prioritní' : '✅ Aktivní'}
                    </div>
                  </div>
                  <div style={{ padding: '4px 8px', fontSize: 11, color: '#475569', fontWeight: 500, background: '#fffbeb', borderBottom: '1px solid #fef3c7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
                    {photo.name || 'Fotka'}
                  </div>
                  <div style={{ display: 'flex', gap: 4, padding: '6px 6px', background: 'white', flexShrink: 0 }}>
                    <button
                      onClick={async () => {
                        const photoId = photo.id;
                        const upd = (selectedDataSet.media?.generatedPhotos || []).map((p: any) => p.id === photoId ? { ...p, priority: !p.priority } : p);
                        try { const m = await saveMediaToDB(selectedDataSet.id, { generatedPhotos: upd }); setSelectedDataSet((p: any) => ({ ...p, media: m })); } catch { toast.error('Uložení selhalo'); }
                      }}
                      title="Prioritní"
                      style={{ padding: '5px 7px', borderRadius: 6, fontSize: 13, border: 'none', cursor: 'pointer', flexShrink: 0, backgroundColor: photo.priority ? '#fef3c7' : '#f1f5f9', color: photo.priority ? '#d97706' : '#94a3b8' }}
                    >⭐</button>
                    <button
                      onClick={async () => {
                        const photoId = photo.id;
                        const upd = (selectedDataSet.media?.generatedPhotos || []).map((p: any) => p.id === photoId ? { ...p, excluded: !p.excluded } : p);
                        try { const m = await saveMediaToDB(selectedDataSet.id, { generatedPhotos: upd }); setSelectedDataSet((p: any) => ({ ...p, media: m })); } catch { toast.error('Uložení selhalo'); }
                      }}
                      style={{ flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: photo.excluded ? '#dcfce7' : '#fee2e2', color: photo.excluded ? '#16a34a' : '#dc2626' }}
                    >{photo.excluded ? '↩ Obnovit' : '✕ Vyřadit'}</button>
                    <button
                      onClick={() => window.open(photo.url, '_blank')}
                      style={{ padding: '5px 7px', borderRadius: 6, fontSize: 13, border: 'none', cursor: 'pointer', flexShrink: 0, backgroundColor: '#eff6ff', color: '#3b82f6' }}
                    >👁️</button>
                    {/* Regen picker trigger */}
                    <button
                      onClick={() => {
                        const p = prompts.find((p: any) => p.id === photo.id);
                        setRegenPickerPrompt(p?.description ? `${p.name}. ${p.description}` : (p?.name || photo.name || ''));
                        setRegenPicker({ id: photo.id, type: 'photo' });
                        setRegenPickerModel('flash');
                      }}
                      disabled={regenGeneratingId === photo.id}
                      title="Přegenerovat / porovnat varianty"
                      style={{ padding: '5px 7px', borderRadius: 6, fontSize: 13, border: 'none', cursor: 'pointer', flexShrink: 0, backgroundColor: regenPicker?.id === photo.id ? '#fef3c7' : '#fffbeb', color: '#d97706', opacity: regenGeneratingId === photo.id ? 0.5 : 1 }}
                    >
                      {regenGeneratingId === photo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Regen picker — model + prompt + akce */}
                  {regenPicker?.id === photo.id && regenPicker.type === 'photo' && (
                    <div style={{ padding: '8px', background: '#fffbeb', borderTop: '1px solid #fef3c7', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <textarea
                        value={regenPickerPrompt}
                        onChange={e => setRegenPickerPrompt(e.target.value)}
                        rows={3}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: 7, border: '1px solid #fde68a', fontSize: 10, resize: 'vertical', color: '#1e293b', background: 'white', fontFamily: 'inherit' }}
                        placeholder="Popis fotky pro přegenerování..."
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#d97706', fontWeight: 700 }}>Model:</span>
                        {(['flash', 'pro'] as const).map(m => (
                          <button key={m} onClick={() => setRegenPickerModel(m)} style={{
                            padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: regenPickerModel === m ? (m === 'flash' ? '#0ea5e9' : '#9333ea') : '#e2e8f0',
                            color: regenPickerModel === m ? 'white' : '#64748b',
                          }}>
                            {m === 'flash' ? '⚡ Flash' : '⭐ Pro'}
                          </button>
                        ))}
                        <button
                          onClick={async () => {
                            if (!regenPickerPrompt.trim()) return;
                            setRegenGeneratingId(photo.id);
                            setRegenPicker(null);
                            const model = regenPickerModel;
                            addLog(`🔄 Generuji variantu fotky (${model === 'flash' ? 'Flash 3.1' : 'Pro 3.0'}): ${photo.name}...`);
                            try {
                              const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
                              const { processImageUrl } = await import('../../utils/supabase/upload-image');
                              const PHOTO_STYLE = 'Ultra-realistic photography style, high resolution, natural lighting, documentary quality, no text:';
                              const fullPrompt = `${PHOTO_STYLE}\n\nSUBJECT: ${regenPickerPrompt}\n\nNO TEXT: Do not include any text, words, or labels.`;
                              const result = await generateImageWithImagen(fullPrompt, { aspectRatio: '1:1', numberOfImages: 1, model });
                              if (result.success && (result.url || result.images?.[0]?.base64)) {
                                const rawUrl = result.url || `data:${result.images?.[0]?.mimeType || 'image/png'};base64,${result.images?.[0]?.base64}`;
                                const variantUrl = await processImageUrl(rawUrl, `${selectedDataSet.id}-${photo.id}-v${Date.now()}`, 'photos');
                                if (variantUrl) {
                                  const { data: freshData } = await supabase.from('topic_data_sets').select('media').eq('id', selectedDataSet.id).single();
                                  const freshMedia = freshData?.media || {};
                                  const currentPhotos = freshMedia.generatedPhotos || [];
                                  const updatedPhotos = currentPhotos.map((p: any) => {
                                    if (p.id !== photo.id) return p;
                                    const existingVariants = p.variants || [];
                                    return { ...p, variants: [...existingVariants, { url: variantUrl, model, generatedAt: new Date().toISOString() }] };
                                  });
                                  const mergedMedia = stripBase64FromObject({ ...freshMedia, generatedPhotos: updatedPhotos }) as Record<string, any>;
                                  await supabase.from('topic_data_sets').update({ media: mergedMedia }).eq('id', selectedDataSet.id);
                                  setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
                                  addLog(`✅ Varianta fotky vygenerována: ${photo.name}`, 'success');
                                  toast.success('Varianta přidána — porovnej a vyber lepší!');
                                }
                              } else {
                                throw new Error(result.error || 'Generování selhalo');
                              }
                            } catch (err: any) {
                              addLog(`❌ Chyba varianty fotky: ${err.message}`, 'error');
                              toast.error('Generování varianty selhalo');
                            } finally {
                              setRegenGeneratingId(null);
                            }
                          }}
                          disabled={regenGeneratingId === photo.id || !regenPickerPrompt.trim()}
                          style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer', background: '#d97706', color: 'white', marginLeft: 'auto' }}
                        >
                          {regenGeneratingId === photo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '+ Srovnej'}
                        </button>
                        <button onClick={() => setRegenPicker(null)} style={{ padding: '3px 6px', borderRadius: 5, fontSize: 11, border: 'none', cursor: 'pointer', background: 'transparent', color: '#94a3b8' }}>✕</button>
                      </div>
                    </div>
                  )}

                  {/* Varianty karousel */}
                  {(photo.variants || []).length > 0 && (() => {
                    const variants = photo.variants || [];
                    const photoIdx = variantIndex[photo.id] ?? 0;
                    const slides = [
                      { url: photo.url, label: 'Originál', isOriginal: true, model: undefined as string | undefined },
                      ...variants.map((v: any, i: number) => ({ url: v.url, label: `Varianta ${i + 1}`, isOriginal: false, model: v.model })),
                    ];
                    const slide = slides[photoIdx] || slides[0];
                    const modelLabel = slide.model === 'flash' ? '⚡ Flash' : slide.model === 'pro' ? '⭐ Pro' : '';
                    return (
                      <div style={{ padding: '8px', background: '#fffbeb', borderTop: '1px solid #fef3c7' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Srovnání {photoIdx + 1}/{slides.length}
                          </span>
                          <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
                            {slides.map((_, i) => (
                              <button key={i} onClick={() => setVariantIndex(prev => ({ ...prev, [photo.id]: i }))} style={{
                                width: i === photoIdx ? 16 : 8, height: 8, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0,
                                background: i === photoIdx ? '#d97706' : '#e2e8f0', transition: 'all .15s',
                              }} />
                            ))}
                          </div>
                        </div>
                        <div style={{ position: 'relative' }}>
                          <img
                            src={slide.url}
                            alt={slide.label}
                            onClick={() => setLightbox({ url: slide.url, label: `${slide.label}${modelLabel ? ' · ' + modelLabel : ''}` })}
                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in',
                              border: `2px solid ${slide.isOriginal ? '#f59e0b' : '#d97706'}` }}
                          />
                          <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '2px 7px', fontSize: 9, color: 'white', fontWeight: 700 }}>
                            {slide.label}{modelLabel ? ` · ${modelLabel}` : ''}
                          </div>
                          <button onClick={() => setLightbox({ url: slide.url, label: slide.label })}
                            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: 6, padding: '3px 6px', cursor: 'pointer', fontSize: 13, color: 'white' }}
                            title="Náhled">🔍</button>
                          {photoIdx > 0 && (
                            <button onClick={() => setVariantIndex(p => ({ ...p, [photo.id]: photoIdx - 1 }))}
                              style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontSize: 14, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                          )}
                          {photoIdx < slides.length - 1 && (
                            <button onClick={() => setVariantIndex(p => ({ ...p, [photo.id]: photoIdx + 1 }))}
                              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontSize: 14, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                          )}
                        </div>
                        {/* Akce pro variantu */}
                        {!slide.isOriginal && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <button
                              onClick={async () => {
                                const { data: freshData } = await supabase.from('topic_data_sets').select('media').eq('id', selectedDataSet.id).single();
                                const freshMedia = freshData?.media || {};
                                const updatedPhotos = (freshMedia.generatedPhotos || []).map((p: any) => {
                                  if (p.id !== photo.id) return p;
                                  return { ...p, url: slide.url, variants: [] };
                                });
                                const mergedMedia = stripBase64FromObject({ ...freshMedia, generatedPhotos: updatedPhotos }) as Record<string, any>;
                                await supabase.from('topic_data_sets').update({ media: mergedMedia }).eq('id', selectedDataSet.id);
                                setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
                                setVariantIndex(p => ({ ...p, [photo.id]: 0 }));
                                toast.success('Varianta nastavena jako hlavní!');
                              }}
                              style={{ flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer', background: '#d97706', color: 'white' }}
                            >✓ Použít tuto</button>
                            <button
                              onClick={async () => {
                                const { data: freshData } = await supabase.from('topic_data_sets').select('media').eq('id', selectedDataSet.id).single();
                                const freshMedia = freshData?.media || {};
                                const updatedPhotos = (freshMedia.generatedPhotos || []).map((p: any) => {
                                  if (p.id !== photo.id) return p;
                                  return { ...p, variants: (p.variants || []).filter((v: any) => v.url !== slide.url) };
                                });
                                const mergedMedia = stripBase64FromObject({ ...freshMedia, generatedPhotos: updatedPhotos }) as Record<string, any>;
                                await supabase.from('topic_data_sets').update({ media: mergedMedia }).eq('id', selectedDataSet.id);
                                setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
                                setVariantIndex(p => ({ ...p, [photo.id]: Math.max(0, photoIdx - 1) }));
                                toast.success('Varianta zahozena');
                              }}
                              style={{ flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer', background: '#fee2e2', color: '#dc2626' }}
                            >✕ Zahodit</button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {/* Skupiny fotek — pod vygenerovanými fotkami */}
          {(selectedDataSet.media?.imageGroups || []).some((g: ImageGroup) => g.type === 'photo') && (
            <div className="mb-2">
              <div className="grid grid-cols-2 gap-3">
              {(selectedDataSet.media?.imageGroups || [])
                .filter((g: ImageGroup) => g.type === 'photo')
                .map((group: ImageGroup) => (
                  <ImageGroupTile
                    key={group.id}
                    group={group}
                    generating={generatingGroupIds.has(group.id)}
                    onGenerateAll={async (g) => {
                      setGeneratingGroupIds(prev => new Set([...prev, g.id]));
                      addLog(`📷 Generuji skupinu "${g.title}"...`);
                      const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
                      const { processImageUrl } = await import('../../utils/supabase/upload-image');
                      let updatedSubjects = [...g.subjects];
                      for (let i = 0; i < updatedSubjects.length; i++) {
                        const s = updatedSubjects[i];
                        if (s.status === 'done' && s.imageUrl) continue;
                        addLog(`📷 [${i + 1}/${updatedSubjects.length}] ${s.name}...`);
                        try {
                          const photoPrompt = `Authentic candid photograph, natural ambient lighting, real textures, slight grain, 35-50mm lens, rule-of-thirds composition, warm natural colors, no studio lighting, no illustration.\n\nSUBJECT: ${s.extraPrompt ? s.name + ' — ' + s.extraPrompt : s.name}. Context: ${g.stylePrompt}\n\nNO TEXT: Do not include any text, words or labels.`;
                          const result = await generateImageWithImagen(photoPrompt, { aspectRatio: '4:3', numberOfImages: 1, model: imageGenModel });
                          if (result.success && (result.url || result.images?.[0]?.base64)) {
                            const rawUrl = result.url || `data:${result.images?.[0]?.mimeType || 'image/png'};base64,${result.images?.[0]?.base64}`;
                            const imageUrl = await processImageUrl(rawUrl, `${selectedDataSet.id}-grp-${g.id}-${s.id}`, 'photos');
                            updatedSubjects[i] = { ...s, status: 'done', imageUrl: imageUrl || rawUrl };
                          } else {
                            throw new Error(result.error || 'Generování selhalo');
                          }
                        } catch (e: any) {
                          addLog(`⚠️ ${s.name}: ${String(e).slice(0, 60)}`, 'error');
                          updatedSubjects[i] = { ...s, status: 'error', error: String(e) };
                        }
                        const inProg = (selectedDataSet.media?.imageGroups || []).map((ig: ImageGroup) =>
                          ig.id === g.id ? { ...ig, subjects: [...updatedSubjects] } : ig
                        );
                        setSelectedDataSet((p: any) => ({ ...p, media: { ...p.media, imageGroups: inProg } }));
                      }
                      const finalGroups = (selectedDataSet.media?.imageGroups || []).map((ig: ImageGroup) =>
                        ig.id === g.id ? { ...ig, subjects: updatedSubjects, updatedAt: new Date().toISOString() } : ig
                      );
                      const mergedMedia = await saveMediaToDB(selectedDataSet.id, { imageGroups: finalGroups });
                      setSelectedDataSet((p: any) => ({ ...p, media: mergedMedia }));
                      setGeneratingGroupIds(prev => { const s = new Set(prev); s.delete(g.id); return s; });
                      addLog(`✅ Skupina "${g.title}" vygenerována`, 'success');
                    }}
                    onGenerateWide={async (g) => {
                      setGeneratingGroupIds(prev => new Set([...prev, g.id]));
                      addLog(`📷 Skupina "${g.title}" — wide batch`);
                      try {
                        const { generateImageWithImagen } = await import('../../utils/ai-chat-proxy');
                        const { processImageUrl } = await import('../../utils/supabase/upload-image');
                        const photoStyle = 'Authentic candid photograph, natural ambient lighting, real textures, slight grain, 35-50mm lens, rule-of-thirds composition, warm natural colors, no studio lighting, no illustration.';
                        const updatedSubjects = await generateGroupInBatches(
                          g, photoStyle,
                          generateImageWithImagen,
                          processImageUrl,
                          selectedDataSet.id,
                          'photos',
                          (subs) => {
                            const inProg = (selectedDataSet.media?.imageGroups || []).map((ig: ImageGroup) =>
                              ig.id === g.id ? { ...ig, subjects: subs } : ig
                            );
                            setSelectedDataSet((p: any) => ({ ...p, media: { ...p.media, imageGroups: inProg } }));
                          },
                          addLog,
                          imageGenModel,
                        );
                        const finalGroups = (selectedDataSet.media?.imageGroups || []).map((ig: ImageGroup) =>
                          ig.id === g.id ? { ...ig, subjects: updatedSubjects, updatedAt: new Date().toISOString() } : ig
                        );
                        const mergedMedia = await saveMediaToDB(selectedDataSet.id, { imageGroups: finalGroups });
                        setSelectedDataSet((p: any) => ({ ...p, media: mergedMedia }));
                        playSuccessSound();
                        addLog(`✅ Skupina "${g.title}" hotova`, 'success');
                      } catch (e: any) {
                        addLog(`❌ Wide generování selhalo: ${String(e).slice(0, 80)}`, 'error');
                      } finally {
                        setGeneratingGroupIds(prev => { const s = new Set(prev); s.delete(g.id); return s; });
                      }
                    }}
                    onDelete={async (groupId) => {
                      const updated = (selectedDataSet.media?.imageGroups || []).filter((ig: ImageGroup) => ig.id !== groupId);
                      const mergedMedia = await saveMediaToDB(selectedDataSet.id, { imageGroups: updated });
                      setSelectedDataSet((p: any) => ({ ...p, media: mergedMedia }));
                    }}
                    onPreview={(url, label) => setLightbox({ url, label })}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Prompty k vygenerování */}
          {prompts.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-600">
                Prompty ({prompts.filter((p: any) => p.status !== 'completed').length} k vygenerování)
              </div>
              {prompts.filter((p: any) => p.status !== 'completed').map((prompt: any) => (
                <div 
                  key={prompt.id}
                  className="p-3 bg-amber-50 rounded-xl border border-amber-200"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-medium text-amber-700 text-sm">{prompt.name}</div>
                    <button
                      onClick={() => handleGenerateSinglePhoto(prompt)}
                      disabled={generatingPromptId === prompt.id}
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        backgroundColor: '#d97706',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: generatingPromptId === prompt.id ? 'not-allowed' : 'pointer',
                        opacity: generatingPromptId === prompt.id ? 0.5 : 1,
                      }}
                    >
                      {generatingPromptId === prompt.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ImageIcon className="w-3 h-3" />
                      )}
                      Generovat
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-2">{prompt.description}</div>
                  <div className="mt-1 text-xs text-amber-600">
                    {prompt.category === 'selfie' ? '📱 Selfie' : `📷 ${prompt.category}`}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* ── Vlastní fotka ── */}
          <div style={{ padding: '12px 14px', background: '#fffbeb', borderRadius: 12, border: '1px solid #fde68a' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ImageIcon className="w-3.5 h-3.5" /> Vlastní fotka
            </div>
            <input
              type="text"
              value={customPhotoDesc}
              onChange={e => setCustomPhotoDesc(e.target.value)}
              onKeyDown={async e => { if (e.key === 'Enter' && customPhotoDesc.trim()) { e.preventDefault(); await handleCustomPhoto(); } }}
              placeholder={`Popiš motiv – např. "terasy rýžových polí v jihovýchodní Asii"`}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #fcd34d', fontSize: 12, outline: 'none', background: 'white', color: '#1e293b', marginBottom: 8 }}
            />
            <button
              onClick={handleCustomPhoto}
              disabled={customPhotoGenerating || !customPhotoDesc.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none', backgroundColor: customPhotoDesc.trim() ? '#d97706' : '#e5e7eb', color: customPhotoDesc.trim() ? 'white' : '#9ca3af', fontSize: 12, fontWeight: 600, cursor: customPhotoDesc.trim() && !customPhotoGenerating ? 'pointer' : 'not-allowed', opacity: customPhotoGenerating ? 0.6 : 1 }}
            >
              {customPhotoGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
              {customPhotoGenerating ? 'Generuji...' : 'Generovat'}
            </button>
          </div>

          {/* Prázdný stav */}
          {photos.length === 0 && prompts.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Žádné fotky</p>
              <p className="text-sm">Klikni na "Generovat prompty"</p>
            </div>
          )}
        </div>
      );
    }
    
    if (section === 'image-groups') {
      return <ImageGroupsSection dataSet={selectedDataSet} onUpdate={(groups) => {
        saveMediaToDB(selectedDataSet.id, { imageGroups: groups });
        setSelectedDataSet((prev: any) => prev ? { ...prev, media: { ...prev.media, imageGroups: groups } } : prev);
      }} />;
    }

    if (section === 'charts') {
      const savedCharts: any[] = effectiveDs.media?.charts || [];
      if (selectedDataSet.milestone) return <ChartReadOnlyList charts={savedCharts} />;

      const CHART_PALETTE = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa', '#34d399', '#fb923c'];

      const loadSuggestions = async () => {
        setChartSuggestionsLoading(true);
        try {
          const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');
          const prompt = `Jsi pedagog. Pro vzdělávací dataset na téma "${selectedDataSet.topic}" (${selectedDataSet.grade}. třída ZŠ, předmět: ${selectedDataSet.subject_code}) navrhni 4–6 konkrétních grafů, které by pomohly žákům pochopit látku.

Fakta z datasetu: ${JSON.stringify((selectedDataSet.content?.keyFacts || []).slice(0, 6))}
Pojmy: ${JSON.stringify((selectedDataSet.content?.keyTerms || []).slice(0, 5).map((t: any) => t.term || t))}

Vrať JSON pole:
[
  {
    "title": "Název grafu",
    "description": "Krátký popis co graf ukazuje",
    "chartType": "bar|line|pie|area|radar|timeline",
    "dataHint": "Stručný popis osy X a Y nebo kategorií"
  }
]
Vrať POUZE JSON.`;
          const resp = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3-flash');
          const m = resp.match(/\[[\s\S]*\]/);
          if (m) {
            const suggestions = JSON.parse(m[0]);
            setChartSuggestions(suggestions);
            // Uložit do DB
            await saveMediaToDB(selectedDataSet.id, { chartSuggestions: suggestions });
            setSelectedDataSet((prev: any) => ({
              ...prev,
              media: { ...prev.media, chartSuggestions: suggestions }
            }));
          }
        } catch (e) { /* silent */ }
        finally { setChartSuggestionsLoading(false); }
      };

      // Načíst uložené návrhy z DB nebo vygenerovat nové
      const savedSuggestions = selectedDataSet.media?.chartSuggestions;
      if (chartSuggestions.length === 0 && !chartSuggestionsLoading) {
        if (savedSuggestions?.length > 0) {
          setChartSuggestions(savedSuggestions);
        } else {
          loadSuggestions();
        }
      }

          const generateChartData = async (desc: string, type: string) => {
        setChartGeneratingData(true);
        setChartData(null);
        addLog(`📊 Generuji data pro graf: "${desc}"...`);
        try {
          const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');

          const isTimeline = type === 'timeline';
          const prompt = isTimeline
            ? `Jsi historik a pedagog. Vygeneruj chronologická data pro časovou osu na téma: "${desc}".
Kontext: ${selectedDataSet.topic}, ${selectedDataSet.grade}. třída ZŠ, ${selectedDataSet.subject_code}.

Vrať JSON:
{
  "title": "Název časové osy",
  "columns": ["Rok/Období", "Událost", "Kategorie"],
  "rows": [
    ["rok nebo rozsah (např. 753 př.n.l.)", "Stručný popis události", "kategorie (válka|politika|kultura|ekonomika|věda)"],
    ...
  ],
  "source": "zdroj"
}

Pravidla:
- 6–12 klíčových událostí chronologicky seřazených
- Rok jako string (může být "753 př.n.l.", "14. stol.", "1618–1648")
- Kategorie vybírej z: válka, politika, kultura, ekonomika, věda, náboženství
- Reálné historické události
Vrať POUZE JSON.`
            : `Jsi expert na vzdělávací data. Vygeneruj konkrétní reálná data pro graf na téma: "${desc}".
Kontext: ${selectedDataSet.topic}, ${selectedDataSet.grade}. třída ZŠ, ${selectedDataSet.subject_code}.
Typ grafu: ${type}.

Vrať JSON:
{
  "title": "Název grafu",
  "columns": ["Kategorie/X", "Hodnota1", "Hodnota2?"],
  "rows": [
    ["Řádek 1", "hodnota", "hodnota?"],
    ["Řádek 2", "hodnota", "hodnota?"]
  ],
  "unit": "jednotka (km², mil., %...)",
  "source": "zdroj dat"
}

Pravidla:
- 5–10 řádků dat
- Reálná, přesná čísla (ne vymyšlená)
- Maximálně 3 sloupce hodnot
- Hodnoty jako čísla (string v JSON)
Vrať POUZE JSON.`;
          const resp = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3-pro');
          const m = resp.match(/\{[\s\S]*\}/);
          if (!m) throw new Error('Neplatná odpověď');
          const parsed = JSON.parse(m[0]);
          setChartTitle(parsed.title || desc);
          setChartData({ columns: parsed.columns, rows: parsed.rows });
          setChartType(type as any);
          addLog(`✅ Data vygenerována (${parsed.rows.length} řádků)`, 'success');
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Generování dat selhalo');
        } finally {
          setChartGeneratingData(false);
        }
      };

      const saveChartData = async () => {
        if (!chartData) return;
        setChartSaving(true);
        addLog(`💾 Ukládám data grafu "${chartTitle || 'Graf'}"...`);
        try {
          const newChart = {
            id: `chart-${Date.now()}`,
            title: chartTitle || 'Graf',
            chartType,
            columns: chartData.columns,
            rows: chartData.rows,
            createdAt: new Date().toISOString(),
          };
          const currentCharts = selectedDataSet.media?.charts || [];
          const mergedMedia = await saveMediaToDB(selectedDataSet.id, {
            charts: [...currentCharts, newChart],
          });
          setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
          setChartData(null);
          setChartTitle('');
          setChartCustomDesc('');
          addLog(`✅ Graf uložen: "${newChart.title}"`, 'success');
          toast.success('Graf uložen do datasetu!');
        } catch (err: any) {
          addLog(`❌ Chyba uložení: ${err.message}`, 'error');
          toast.error('Uložení selhalo');
        } finally {
          setChartSaving(false);
        }
      };

      // Připravit data pro Recharts
      const rechartsData = chartData ? chartData.rows.map(row => {
        const obj: any = { name: row[0] };
        chartData.columns.slice(1).forEach((col, i) => { obj[col] = parseFloat(row[i + 1]) || 0; });
        return obj;
      }) : [];
      const dataKeys = chartData ? chartData.columns.slice(1) : [];

      const CHART_TYPES = [
        { id: 'bar', label: 'Sloupcový', icon: '▬' },
        { id: 'line', label: 'Spojnicový', icon: '📈' },
        { id: 'area', label: 'Plošný', icon: '🔺' },
        { id: 'pie', label: 'Koláčový', icon: '🥧' },
        { id: 'radar', label: 'Paprskový', icon: '🕸️' },
        { id: 'timeline', label: 'Časová osa', icon: '📅' },
      ] as const;

      return (
        <div className="p-4 space-y-5 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-cyan-600" /> Grafy a mapy
            </h3>
            <span className="text-xs text-slate-400">{savedCharts.length} uložených</span>
          </div>

          {/* Uložené grafy – jako data, ne PNG */}
          {savedCharts.length > 0 && (
            <div className="space-y-2">
              {savedCharts.map((ch: any, idx: number) => {
                // Podpora staré i nové struktury
                const isDataChart = !!ch.columns;
                const chartTypeEmoji: Record<string, string> = { bar: '📊', line: '📈', area: '🌊', pie: '🥧', radar: '🕸️', timeline: '⏳' };
                return (
                  <div key={idx} style={{ borderRadius: 10, border: '1px solid #e0f2fe', background: 'white', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{chartTypeEmoji[ch.chartType || ch.type] || '📊'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title || ch.name || 'Graf'}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        {isDataChart ? `${ch.columns?.length - 1 || 1} řada · ${ch.rows?.length || 0} řádků · ${ch.chartType || 'bar'}` : 'PNG obrázek'}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const upd = savedCharts.filter((_: any, i: number) => i !== idx);
                        const m = await saveMediaToDB(selectedDataSet.id, { charts: upd });
                        setSelectedDataSet((p: any) => ({ ...p, media: m }));
                      }}
                      style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, border: 'none', cursor: 'pointer', backgroundColor: '#fee2e2', color: '#dc2626' }}
                    >✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI návrhy */}
          <div style={{ background: '#f0fdfa', borderRadius: 12, border: '1px solid #99f6e4', padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f766e', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp className="w-3.5 h-3.5" /> Návrhy grafů od AI</span>
              <button
                onClick={() => { setChartSuggestions([]); loadSuggestions(); }}
                disabled={chartSuggestionsLoading}
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: '1px solid #99f6e4', background: 'white', color: '#0f766e', cursor: 'pointer', opacity: chartSuggestionsLoading ? 0.5 : 1 }}
              >↺ Obnovit</button>
            </div>
            {chartSuggestionsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
                <Loader2 className="w-4 h-4 animate-spin" /> Analyzuji téma...
              </div>
            ) : (
              <div className="space-y-2">
                {chartSuggestions.map((s: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => generateChartData(s.title, s.chartType)}
                    disabled={chartGeneratingData}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid #99f6e4', background: 'white', cursor: chartGeneratingData ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdfa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>
                        {s.chartType === 'pie' ? '🥧' : s.chartType === 'line' ? '📈' : s.chartType === 'radar' ? '🕸️' : s.chartType === 'area' ? '🔺' : s.chartType === 'timeline' ? '📅' : '▬'}
                      </span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{s.title}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{s.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Vlastní zadání */}
          <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus className="w-3.5 h-3.5" /> Vlastní graf
            </div>
            <input
              type="text"
              value={chartCustomDesc}
              onChange={e => setChartCustomDesc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && chartCustomDesc.trim()) generateChartData(chartCustomDesc, chartType); }}
              placeholder="Popiš graf – např. rozloha kontinentů km2"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', background: 'white', color: '#1e293b', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {CHART_TYPES.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => setChartType(ct.id as any)}
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: chartType === ct.id ? 700 : 400, border: `1px solid ${chartType === ct.id ? '#6366f1' : '#e2e8f0'}`, background: chartType === ct.id ? '#eef2ff' : 'white', color: chartType === ct.id ? '#4f46e5' : '#64748b', cursor: 'pointer' }}
                >
                  {ct.icon} {ct.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => generateChartData(chartCustomDesc, chartType)}
              disabled={chartGeneratingData || !chartCustomDesc.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none', backgroundColor: chartCustomDesc.trim() ? '#6366f1' : '#e5e7eb', color: chartCustomDesc.trim() ? 'white' : '#9ca3af', fontSize: 12, fontWeight: 600, cursor: chartCustomDesc.trim() && !chartGeneratingData ? 'pointer' : 'not-allowed', opacity: chartGeneratingData ? 0.6 : 1 }}
            >
              {chartGeneratingData ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart2 className="w-3 h-3" />}
              {chartGeneratingData ? 'Generuji data...' : 'Vygenerovat data'}
            </button>
          </div>

          {/* Editor dat + preview */}
          {chartData && (
            <div style={{ background: 'white', borderRadius: 12, border: '2px solid #6366f1', padding: '14px', space: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <input
                  value={chartTitle}
                  onChange={e => setChartTitle(e.target.value)}
                  style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', border: 'none', outline: 'none', flex: 1, background: 'transparent' }}
                />
                <button onClick={() => setChartData(null)} style={{ fontSize: 13, color: '#94a3b8', border: 'none', background: 'none', cursor: 'pointer', padding: '2px 6px' }}>✕</button>
              </div>

              {/* Typ grafu */}
              <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
                {CHART_TYPES.map(ct => (
                  <button key={ct.id} onClick={() => setChartType(ct.id as any)}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: chartType === ct.id ? 700 : 400, border: `1px solid ${chartType === ct.id ? '#6366f1' : '#e2e8f0'}`, background: chartType === ct.id ? '#eef2ff' : '#f8fafc', color: chartType === ct.id ? '#4f46e5' : '#64748b', cursor: 'pointer' }}
                  >{ct.icon} {ct.label}</button>
                ))}
              </div>

              {/* Editovatelná tabulka */}
              <div style={{ marginBottom: 12, overflowX: 'auto' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Table className="w-3 h-3" /> Data (klikni pro úpravu)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {chartData.columns.map((col, ci) => (
                        <th key={ci} style={{ padding: '5px 8px', background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                      <th style={{ width: 28, background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.rows.map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ padding: '3px 4px' }}>
                            <input
                              value={cell}
                              onChange={e => {
                                const newRows = chartData.rows.map((r, rIdx) => rIdx === ri ? r.map((c, cIdx) => cIdx === ci ? e.target.value : c) : r);
                                setChartData({ ...chartData, rows: newRows });
                              }}
                              style={{ width: '100%', padding: '3px 6px', border: '1px solid transparent', borderRadius: 4, fontSize: 11, outline: 'none', background: 'transparent', color: '#1e293b' }}
                              onFocus={e => (e.target.style.border = '1px solid #6366f1')}
                              onBlur={e => (e.target.style.border = '1px solid transparent')}
                            />
                          </td>
                        ))}
                        <td style={{ padding: '3px 4px' }}>
                          <button onClick={() => setChartData({ ...chartData, rows: chartData.rows.filter((_, i) => i !== ri) })} style={{ padding: '2px 5px', borderRadius: 4, border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 10 }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={() => setChartData({ ...chartData, rows: [...chartData.rows, chartData.columns.map(() => '')] })}
                  style={{ marginTop: 5, padding: '3px 10px', borderRadius: 6, border: '1px dashed #94a3b8', background: 'transparent', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}
                >+ Přidat řádek</button>
              </div>

              {/* Chart Preview */}
              <div ref={chartPreviewRef} style={{ background: 'white', borderRadius: 10, padding: '16px 8px 8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10, textAlign: 'center', paddingLeft: 8 }}>{chartTitle}</div>
                {(() => {
                  const commonProps = { data: rechartsData };
                  const tooltipStyle = { borderRadius: 8, fontSize: 11, border: '1px solid #e2e8f0' };

                  if (chartType === 'pie') {
                    const pieData = rechartsData.map((d: any) => ({ name: d.name, value: parseFloat(d[dataKeys[0]]) || 0 }));
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" outerRadius={85} innerRadius={35} paddingAngle={3} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {pieData.map((_: any, i: number) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  }
                  if (chartType === 'radar') {
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <RadarChart data={rechartsData}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                          {dataKeys.map((k: string, i: number) => (
                            <Radar key={k} name={k} dataKey={k} stroke={CHART_PALETTE[i]} fill={CHART_PALETTE[i]} fillOpacity={0.25} />
                          ))}
                          <Tooltip contentStyle={tooltipStyle} />
                          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                        </RadarChart>
                      </ResponsiveContainer>
                    );
                  }
                  if (chartType === 'line') {
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart {...commonProps} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={35} />
                          <Tooltip contentStyle={tooltipStyle} />
                          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                          {dataKeys.map((k: string, i: number) => (
                            <Line key={k} type="monotone" dataKey={k} stroke={CHART_PALETTE[i]} strokeWidth={2.5} dot={{ r: 4, fill: CHART_PALETTE[i] }} activeDot={{ r: 6 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    );
                  }
                  if (chartType === 'area') {
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart {...commonProps} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <defs>
                            {dataKeys.map((k: string, i: number) => (
                              <linearGradient key={k} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_PALETTE[i]} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={CHART_PALETTE[i]} stopOpacity={0.02} />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={35} />
                          <Tooltip contentStyle={tooltipStyle} />
                          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                          {dataKeys.map((k: string, i: number) => (
                            <Area key={k} type="monotone" dataKey={k} stroke={CHART_PALETTE[i]} strokeWidth={2.5} fill={`url(#grad${i})`} />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    );
                  }
                  if (chartType === 'timeline') {
                    const CAT_COLORS: Record<string, string> = {
                      válka: '#ef4444', politika: '#6366f1', kultura: '#f59e0b',
                      ekonomika: '#10b981', věda: '#22d3ee', náboženství: '#a78bfa', default: '#94a3b8',
                    };
                    return (
                      <div style={{ padding: '8px 4px', overflowY: 'auto', maxHeight: 340 }}>
                        <div style={{ position: 'relative', paddingLeft: 28 }}>
                          {/* Vertical line */}
                          <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom, #6366f1, #22d3ee)', borderRadius: 99 }} />
                          {chartData!.rows.map((row, i) => {
                            const year = row[0] || '';
                            const event = row[1] || '';
                            const cat = (row[2] || 'default').toLowerCase();
                            const color = CAT_COLORS[cat] || CAT_COLORS.default;
                            const isLeft = i % 2 === 0;
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, position: 'relative' }}>
                                {/* Dot */}
                                <div style={{ position: 'absolute', left: -22, top: 4, width: 14, height: 14, borderRadius: '50%', backgroundColor: color, border: '2px solid white', boxShadow: `0 0 0 2px ${color}44`, flexShrink: 0 }} />
                                {/* Card */}
                                <div style={{ background: 'white', borderRadius: 10, padding: '8px 12px', border: `1px solid ${color}44`, borderLeft: `3px solid ${color}`, flex: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, color, whiteSpace: 'nowrap' }}>{year}</span>
                                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, backgroundColor: `${color}22`, color, fontWeight: 600, textTransform: 'uppercase' }}>{cat}</span>
                                  </div>
                                  <div style={{ fontSize: 12, color: '#1e293b', lineHeight: 1.4 }}>{event}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  // default: bar
                  return (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart {...commonProps} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barCategoryGap="8%" barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={35} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                        {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                        {dataKeys.map((k: string, i: number) => (
                          <Bar key={k} dataKey={k} fill={CHART_PALETTE[i]} radius={[6, 6, 0, 0]}>
                            {dataKeys.length === 1 && rechartsData.map((_: any, idx: number) => (
                              <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                            ))}
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>

              {/* Uložit data grafu */}
              <button
                onClick={saveChartData}
                disabled={chartSaving}
                style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6366f1, #22d3ee)', color: 'white', fontSize: 13, fontWeight: 700, cursor: chartSaving ? 'not-allowed' : 'pointer', opacity: chartSaving ? 0.7 : 1 }}
              >
                {chartSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {chartSaving ? 'Ukládám...' : '💾 Uložit data grafu'}
              </button>
            </div>
          )}
        </div>
      );
    }

    if (section === 'maps') {
      const savedMaps: SavedMap[] = effectiveDs.media?.savedMaps || [];
      if (selectedDataSet.milestone) return <MapsReadOnlyList maps={savedMaps} />;

      const loadMapSuggestions = async () => {
        setMapSuggestionsLoading(true);
        try {
          const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');
          const topicData = selectedDataSet;
          const keyFacts = (topicData.content?.keyFacts || []).slice(0, 6);
          const keyTerms = (topicData.content?.keyTerms || []).slice(0, 5).map((t: any) => t.term || t);

          const prompt = `Jsi pedagog a kartograf. Pro vzdělávací dataset na téma "${topicData.topic}" (${topicData.grade}. třída ZŠ, předmět: ${topicData.subject_code}) navrhni 4–6 konkrétních map, které by pomohly žákům pochopit látku.

Fakta z datasetu: ${JSON.stringify(keyFacts)}
Pojmy: ${JSON.stringify(keyTerms)}

Pro každou mapu navrhni:
- Zda je informativní (info) nebo cvičení (identify = klikni na správné místo, label = přetáhni název, color = obarvi region, route = zakresli trasu)
- Jaký region mapy zobrazit: world, europe, central-europe, mediterranean, middle-east, africa, asia, americas, czech-republic, italy, greece, france, germany
- Styl mapy: political (barevné státy), physical (terén), blank (slepá mapa – pro kvízy), historical (historické hranice)

Vrať JSON pole (POUZE JSON):
[
  {
    "id": "map1",
    "title": "Název mapy",
    "description": "Co mapa ukazuje nebo zadání cvičení",
    "region": "mediterranean",
    "style": "historical",
    "exerciseType": "identify",
    "dataHint": "Co by mělo být na mapě zobrazeno – markery, oblasti, trasy"
  }
]`;
          const resp = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3-flash');
          const m = resp.match(/\[[\s\S]*\]/);
          if (m) {
            const suggestions: MapSuggestion[] = JSON.parse(m[0]).map((s: any, i: number) => ({
              ...s,
              id: s.id || `map_${i}_${Date.now()}`,
            }));
            setMapSuggestions(suggestions);
            await saveMediaToDB(topicData.id, { mapSuggestions: suggestions });
            setSelectedDataSet((prev: any) => ({
              ...prev,
              media: { ...prev.media, mapSuggestions: suggestions }
            }));
          }
        } catch (e) { /* silent */ }
        finally { setMapSuggestionsLoading(false); }
      };

      // Načíst uložené návrhy nebo vygenerovat
      if (mapSuggestions.length === 0 && !mapSuggestionsLoading) {
        const saved = selectedDataSet.media?.mapSuggestions;
        if (saved?.length > 0) {
          setMapSuggestions(saved);
        } else {
          loadMapSuggestions();
        }
      }

      // Opraví oříznutý JSON od AI – uzavře otevřené závorky a odstraní neúplnou poslední property
      const repairTruncatedJson = (s: string): string => {
        // Odstraní poslední neúplný token (nekončí " nebo číslicí nebo true/false/null)
        let t = s.trimEnd();
        // Odstraň trailing čárku nebo neúplný řetězec na konci
        t = t.replace(/,\s*$/, '');
        t = t.replace(/"[^"]*$/, '');        // nekončený string
        t = t.replace(/:\s*$/, '');          // property bez hodnoty
        t = t.replace(/,\s*"[^"]*$/, '');    // nekončený klíč
        t = t.replace(/,\s*([}\]])/g, '$1'); // trailing commas
        // Spočítáme otevřené závorky a uzavřeme je
        const opens: string[] = [];
        let inStr = false, escape = false;
        for (const ch of t) {
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inStr) { escape = true; continue; }
          if (ch === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (ch === '{') opens.push('}');
          else if (ch === '[') opens.push(']');
          else if (ch === '}' || ch === ']') opens.pop();
        }
        // Uzavřeme v opačném pořadí
        return t + opens.reverse().join('');
      };

      const generateMapData = async (suggestion: MapSuggestion) => {
        setMapGeneratingId(suggestion.id);
        addLog(`🗺️ Generuji mapu "${suggestion.title}" (2 agenti paralelně)...`);

        const parseJson = (resp: string, label: string): any | null => {
          const m = resp.match(/\{[\s\S]*\}/) || resp.match(/\[[\s\S]*\]/);
          if (!m) { addLog(`⚠️ Agent ${label}: nenalezen JSON`); return null; }
          let s = m[0].replace(/,\s*([}\]])/g, '$1').replace(/\/\/[^\n]*/g, '');
          try { return JSON.parse(s); }
          catch { try { return JSON.parse(repairTruncatedJson(s)); } catch { addLog(`⚠️ Agent ${label}: nelze parsovat JSON`); return null; } }
        };

        try {
          const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');
          const ctx = `Téma: "${selectedDataSet.topic}" | Mapa: "${suggestion.title}" | ${suggestion.description} | Region: ${suggestion.region} | Cvičení: ${suggestion.exerciseType} | Co zobrazit: ${suggestion.dataHint}`;

          // ── Agent A: Markery + popis ───────────────────────────────────────
          const promptA = `Jsi kartograf. Vygeneruj body zájmu pro vzdělávací mapu.
${ctx}

Vrať POUZE JSON pole markerů (max 10):
[{"id":"m1","name":"Název","lat":0.0,"lng":0.0,"type":"city|battle|landmark|capital|river|mountain|custom","color":"#6366f1","icon":"🏛️","description":"1-2 věty","year":"rok"}]

Pravidla: reálné souřadnice, pro "identify" přidej pole correctAnswers:["m1",...], pro "info" 6-10 markerů s popisem.`;

          // ── Agent B: Tematická vrstva / choropleth / areas ─────────────────
          const promptB = `Jsi kartograf. Vygeneruj tematickou vrstvu pro vzdělávací mapu.
${ctx}

MOŽNOSTI (vyber JEDNU nejlepší):

1. thematicLayer – pro přírodní zóny (pouště, pohoří, roviny…) – PREFERUJ tuto možnost
   Dostupné NAME_EN: Sahara, Gobi Desert, Kalahari Desert, Namib, Nubian Desert, Libyan Desert, Thar Desert, Syrian Desert, Rub' al Khali, Sahel, Indo-Gangetic Plain, North China Plain, Kazakh Steppe, North European Plain, Great Plains, Gran Chaco, Pampas, Himalayas, Alps, Andes, Rocky Mountains, Ural Mountains, Caucasus Mountains, Tian Shan, Tibetan Plateau, Brazilian Highlands, Deccan Plateau, Amazon basin, Congo basin, Siberia, Mesopotamia, Patagonia, Arabian Peninsula, Indian subcontinent, Nile Delta, Ganges Delta, Pantanal, Barren Grounds

2. choropleth – pro politická data (forma vlády, jazyk, HDP…)
   ISO A3 kódy: DEU, CZE, ITA, FRA, GBR, USA, RUS, CHN, IND, BRA, ESP, POL…

3. areas – POUZE pro historické hranice / sféry vlivu (polygon coords [lng,lat])

4. null – pokud žádná vrstva není vhodná

Vrať POUZE JSON objekt:
{"type":"thematicLayer","data":{"title":"Název","dataset":"ne_regions","categories":[{"color":"#f59e0b","label":"Horké pouště","featureNames":["Sahara","Libyan Desert"]}]}}
nebo
{"type":"choropleth","data":{"title":"Forma vlády","type":"category","categories":[{"id":"c1","label":"Republika","color":"#3b82f6","isoCodes":["DEU","FRA"]}]}}
nebo
{"type":"areas","data":[{"id":"a1","name":"Oblast","color":"#f59e0b","opacity":0.4,"label":"Popis","era":"500 př.n.l.","coords":[[lng,lat],...(min 30 bodů, sleduj reálné geografické hranice oblasti)]}]}
nebo
{"type":"none","data":null}`;

          addLog(`⏳ Agent A (markery) + Agent B (vrstvy) spuštěny paralelně...`);
          const [respA, respB] = await Promise.all([
            chatWithAIProxy([{ role: 'user', content: promptA }], 'gemini-3-flash'),
            chatWithAIProxy([{ role: 'user', content: promptB }], 'gemini-3-pro'),
          ]);

          addLog(`✅ Agent A: ${respA.length} znaků | Agent B: ${respB.length} znaků`);

          // Parsování Agent A (markery)
          const markersRaw = parseJson(respA, 'A');
          const markers: any[] = Array.isArray(markersRaw) ? markersRaw : (markersRaw?.markers || []);
          const correctAnswers: string[] = markersRaw?.correctAnswers || [];

          // Parsování Agent B (vrstva)
          const layerRaw = parseJson(respB, 'B');
          let thematicLayer = undefined as any;
          let choropleth    = undefined as any;
          let areas: any[]  = [];

          if (layerRaw?.type === 'thematicLayer' && layerRaw.data) {
            thematicLayer = layerRaw.data;
            addLog(`✅ Agent B: thematicLayer (${layerRaw.data.categories?.length} kategorií)`);
          } else if (layerRaw?.type === 'choropleth' && layerRaw.data) {
            choropleth = layerRaw.data;
            addLog(`✅ Agent B: choropleth (${layerRaw.data.categories?.length} kategorií)`);
          } else if (layerRaw?.type === 'areas' && Array.isArray(layerRaw.data)) {
            areas = layerRaw.data;
            addLog(`✅ Agent B: areas (${areas.length} polygonů)`);
          } else {
            addLog(`ℹ️ Agent B: žádná vrstva`);
          }

          // ── Sestavení výsledné mapy ────────────────────────────────────────
          const mapData: SavedMap = {
            id:           suggestion.id,
            title:        suggestion.title,
            region:       suggestion.region,
            style:        suggestion.style,
            exerciseType: suggestion.exerciseType,
            description:  suggestion.description,
            markers,
            highlights:   [],
            routes:       [],
            areas,
            ...(thematicLayer && { thematicLayer }),
            ...(choropleth    && { choropleth }),
            ...(correctAnswers.length && { correctAnswers }),
            createdAt: new Date().toISOString(),
          };

          const updated = [...savedMaps, mapData];
          await saveMediaToDB(selectedDataSet.id, { savedMaps: updated });
          setSelectedDataSet((prev: any) => ({
            ...prev,
            media: { ...prev.media, savedMaps: updated }
          }));
          addLog(`✅ Mapa "${mapData.title}" uložena (${markers.length} markerů, vrstva: ${thematicLayer ? 'thematic' : choropleth ? 'choropleth' : areas.length ? 'areas' : 'žádná'})`);
          toast.success(`Mapa "${mapData.title}" uložena!`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          addLog(`❌ Chyba při generování mapy: ${msg}`);
          toast.error(`Chyba: ${msg.slice(0, 100)}`);
        } finally {
          setMapGeneratingId(null);
        }
      };

      const deleteMap = async (mapId: string) => {
        const updated = savedMaps.filter(m => m.id !== mapId);
        await saveMediaToDB(selectedDataSet.id, { savedMaps: updated });
        setSelectedDataSet((prev: any) => ({
          ...prev,
          media: { ...prev.media, savedMaps: updated }
        }));
        toast.success('Mapa odstraněna');
      };

      const REGION_LABELS: Record<string, string> = {
        'world': '🌍 Svět', 'europe': '🗺️ Evropa', 'central-europe': '🗺️ Střední Evropa',
        'mediterranean': '🌊 Středomoří', 'middle-east': '🏜️ Blízký východ',
        'africa': '🌍 Afrika', 'asia': '🌏 Asie', 'americas': '🌎 Amerika',
        'czech-republic': '🇨🇿 Česko', 'italy': '🇮🇹 Itálie', 'greece': '🇬🇷 Řecko',
        'france': '🇫🇷 Francie', 'germany': '🇩🇪 Německo', 'custom': '📍 Vlastní',
      };
      const EXERCISE_LABELS: Record<string, string> = {
        'info': 'Informativní', 'identify': '🎯 Kvíz – klikni', 'label': '✍️ Označování',
        'color': '🎨 Barvení', 'route': '🗺️ Trasa',
      };

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 4px' }}>
          {/* Uložené mapy */}
          {savedMaps.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                Uložené mapy ({savedMaps.length})
              </div>
              {savedMaps.map(savedMap => (
                <div key={savedMap.id} style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 12, background: 'white' }}>
                  <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>🗺️ {savedMap.title}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                        {REGION_LABELS[savedMap.region] || savedMap.region} · {EXERCISE_LABELS[savedMap.exerciseType] || savedMap.exerciseType} · {(savedMap.markers || []).length} bodů · {(savedMap.areas || []).length} polygonů · {(savedMap.choropleth?.categories || []).length} kategorií
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setMapEdit(savedMap)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#6366f1', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        ✏️ Upravit
                      </button>
                      <button onClick={() => deleteMap(savedMap.id)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: 8, position: 'relative', cursor: 'pointer' }} onClick={() => setMapEdit(savedMap)}>
                    <VividMap map={savedMap} height={220} overlays={savedMap.overlays} />
                    <div style={{ position: 'absolute', inset: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                    >
                      <div style={{ background: 'rgba(99,102,241,0.75)', color: 'white', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 700, backdropFilter: 'blur(4px)' }}>
                        ✏️ Otevřít editor
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Návrhy AI */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                🤖 Návrhy AI
              </div>
              <button
                onClick={() => { setMapSuggestions([]); loadMapSuggestions(); }}
                disabled={mapSuggestionsLoading}
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: '1px solid #bbf7d0', background: 'white', color: '#15803d', cursor: 'pointer', opacity: mapSuggestionsLoading ? 0.5 : 1 }}
              >
                🔄 Přegenerovat
              </button>
            </div>

            {mapSuggestionsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px', color: '#64748b', justifyContent: 'center' }}>
                <Loader2 className="w-4 h-4 animate-spin" /> Generuji návrhy map...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mapSuggestions.map(sug => {
                  const isGenerating = mapGeneratingId === sug.id;
                  const alreadySaved = savedMaps.some(m => m.title === sug.title);
                  return (
                    <div key={sug.id} style={{ borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 12px', background: alreadySaved ? '#f0fdf4' : 'white', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>
                        {sug.exerciseType === 'info' ? '🗺️' : sug.exerciseType === 'identify' ? '🎯' : sug.exerciseType === 'label' ? '✍️' : sug.exerciseType === 'color' ? '🎨' : '📍'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{sug.title}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{sug.description}</div>
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, background: '#e0f2fe', color: '#0369a1' }}>
                            {REGION_LABELS[sug.region] || sug.region}
                          </span>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, background: '#ede9fe', color: '#6d28d9' }}>
                            {EXERCISE_LABELS[sug.exerciseType] || sug.exerciseType}
                          </span>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, background: '#fef9c3', color: '#854d0e' }}>
                            styl: {sug.style}
                          </span>
                        </div>
                        {sug.dataHint && (
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>
                            💡 {sug.dataHint}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => generateMapData(sug)}
                        disabled={isGenerating || !!mapGeneratingId}
                        style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 8, border: 'none', background: alreadySaved ? '#dcfce7' : 'linear-gradient(135deg, #22c55e, #16a34a)', color: alreadySaved ? '#15803d' : 'white', fontSize: 11, fontWeight: 700, cursor: (isGenerating || !!mapGeneratingId) ? 'not-allowed' : 'pointer', opacity: (isGenerating || !!mapGeneratingId) ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        {isGenerating ? <><Loader2 className="w-3 h-3 animate-spin" /> Generuji...</> : alreadySaved ? '✅ Uloženo' : '✨ Vytvořit'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (section === 'materials') {
      // Pro milestone: čti POUZE z vlastního selectedDataSet.generated_materials (ne z effectiveDs, který agreguje celou skupinu)
      // Navíc filtruj na milestone typy — odstraní případné historické znečištění
      const milestoneTypeSet = new Set(['board-easy', 'board-hard', 'hodnoceni']);
      const materials = selectedDataSet?.milestone
        ? (selectedDataSet.generated_materials || []).filter((m: any) => milestoneTypeSet.has(m.type))
        : effectiveDs.generated_materials || [];
      const selectedMat = selectedMaterialIndex !== null ? materials[selectedMaterialIndex] : null;
      
      const handleAddToRag = async (mat: any) => {
        if (!mat.id) { toast.error('List ještě není uložen'); return; }
        const matId = mat.id as string;
        setAddingToRag(prev => new Set(prev).add(matId));
        try {
          // Načíst worksheet z localStorage (ID má formát "worksheet-TIMESTAMP")
          const { getWorksheet } = await import('../../utils/worksheet-storage');
          const wsLocal = getWorksheet(matId);

          const result = await addWorksheetToRag({
            worksheetId: matId,
            title: wsLocal?.title || mat.title || 'Pracovní list',
            subject: wsLocal?.metadata?.subject || selectedSubject || '',
            grade: wsLocal?.metadata?.grade || selectedGrade || 0,
            topic: selectedDataSet?.topic || mat.title || '',
            blocksJson: wsLocal?.blocks || [],
            styleNotes: `Vygenerováno Curriculum Factory – téma: ${selectedDataSet?.topic || ''}`,
            qualityScore: 0.8,
          });

          if (result.success) {
            setInRag(prev => new Set(prev).add(matId));
            toast.success('List přidán do RAG databáze');
          } else {
            toast.error('Chyba přidání do RAG: ' + result.error);
          }
        } catch (err: any) {
          toast.error('Chyba: ' + err.message);
        } finally {
          setAddingToRag(prev => { const s = new Set(prev); s.delete(matId); return s; });
        }
      };

      const handleOpenMaterial = (mat: any) => {
        const matId = mat.id;
        if (!matId) {
          toast.error('Materiál nemá ID');
          return;
        }
        
        // Open based on type
        const QUIZ_TYPES = ['board-easy', 'board-hard', 'test', 'vocabulary-set', 'language-quiz',
                            'grammar-lesson-board', 'reading-activity-board', 'listening-activity-board',
                            'writing-activity-board', 'speaking-activity-board'];
        const DOC_TYPES  = ['text', 'methodology', 'hodnoceni', 'unit-plan'];
        const WORKSHEET_TYPES = ['worksheet', 'textbook-page',
                                 'grammar-lesson', 'reading-activity',
                                 'listening-activity', 'writing-activity', 'speaking-activity'];
        const BOARD_EDIT_TYPES = ['lesson', 'lessons'];

        if (QUIZ_TYPES.includes(mat.type)) {
          window.open(`/quiz/view/${matId}`, '_blank');
        } else if (WORKSHEET_TYPES.includes(mat.type)) {
          window.open(`/admin/worksheet-pro/${matId}`, '_blank');
        } else if (DOC_TYPES.includes(mat.type)) {
          window.open(`/library/my-content/view/${matId}`, '_blank');
        } else if (BOARD_EDIT_TYPES.includes(mat.type)) {
          window.open(`/quiz/edit/${matId}`, '_blank');
        } else {
          toast.info(`Typ "${mat.type}" - náhled zatím není dostupný`);
        }
      };
      
      // Najde nebo vytvoří složku teacher_folders pro tento dataset (ročník → téma)
      const ensureDatasetFolder = async (): Promise<string | null> => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return null;

          const grade = selectedDataSet?.grade ?? selectedGrade;
          const gradeName = `${grade}. ročník`;
          const topicName = selectedDataSet?.topic;
          if (!topicName) return null;

          // 1. Najít nebo vytvořit složku ročníku
          const { data: gradeFolders } = await supabase
            .from('teacher_folders')
            .select('id')
            .eq('teacher_id', user.id)
            .eq('name', gradeName)
            .is('parent_id', null)
            .limit(1);

          let gradeFolderId: string;
          if (gradeFolders && gradeFolders.length > 0) {
            gradeFolderId = gradeFolders[0].id;
          } else {
            gradeFolderId = `folder-grade${grade}-${Date.now()}`;
            await supabase.from('teacher_folders').insert({
              id: gradeFolderId,
              teacher_id: user.id,
              name: gradeName,
              parent_id: null,
              position: grade,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }

          // 2. Najít nebo vytvořit složku tématu pod ročníkem
          const { data: topicFolders } = await supabase
            .from('teacher_folders')
            .select('id')
            .eq('teacher_id', user.id)
            .eq('name', topicName)
            .eq('parent_id', gradeFolderId)
            .limit(1);

          let topicFolderId: string;
          if (topicFolders && topicFolders.length > 0) {
            topicFolderId = topicFolders[0].id;
          } else {
            topicFolderId = `folder-topic-${selectedDataSet.id}-${Date.now()}`;
            await supabase.from('teacher_folders').insert({
              id: topicFolderId,
              teacher_id: user.id,
              name: topicName,
              parent_id: gradeFolderId,
              position: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }

          console.log('[CurriculumFactory] Dataset folder:', topicFolderId, `(${gradeName} → ${topicName})`);
          return topicFolderId;
        } catch (err) {
          console.warn('[CurriculumFactory] ensureDatasetFolder failed:', err);
          return null;
        }
      };

      // Save to admin library menu structure
      const handleSaveToLibrary = async () => {
        setSavingMaterials(true);
        addLog('📚 Ukládám do admin knihovny...');
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error('Nejste přihlášeni');
          
          const category = selectedSubject;
          
          // 1. Load current menu structure
          addLog('📂 Načítám strukturu knihovny...');
          const menuResp = await fetch(
            `https://njbtqmsxbyvpwigfceke.supabase.co/functions/v1/make-server-46c8107b/menu?category=${category}`,
            { headers: { 'Authorization': `Bearer ${session.access_token}` } },
          );
          
          let menuStructure: any[] = [];
          if (menuResp.ok) {
            const data = await menuResp.json();
            menuStructure = data.menu || [];
          } else {
            addLog(`⚠️ Nepodařilo se načíst existující strukturu knihovny (${menuResp.status}), začínám od prázdné`, 'error');
          }
          
          // 2. Find or create grade folder
          const gradeName = `${selectedGrade}. ročník`;
          let gradeFolder = menuStructure.find((f: any) => f.label === gradeName);
          
          if (!gradeFolder) {
            gradeFolder = {
              id: `folder-${Date.now()}-grade${selectedGrade}`,
              label: gradeName,
              slug: `${selectedGrade}-rocnik`,
              type: 'folder',
              icon: 'folder',
              children: [],
            };
            menuStructure.push(gradeFolder);
            addLog(`📁 Vytvořena složka "${gradeName}"`);
          }
          
          // 3. Find or create "obsahový blok" folder under grade
          const obsahovyBlokName =
            dsGroupMap.get(selectedDataSet.id) ||
            selectedDataSet.rvp?.thematicArea ||
            'Ostatní';

          let obsahovyBlokFolder = (gradeFolder.children || []).find(
            (f: any) => f.label === obsahovyBlokName && f.type === 'folder',
          );

          if (!obsahovyBlokFolder) {
            obsahovyBlokFolder = {
              id: `folder-${Date.now()}-block-${obsahovyBlokName.toLowerCase().replace(/\s+/g, '-')}`,
              label: obsahovyBlokName,
              slug: obsahovyBlokName.toLowerCase().replace(/\s+/g, '-'),
              type: 'folder',
              icon: 'folder',
              children: [],
            };
            gradeFolder.children = gradeFolder.children || [];
            gradeFolder.children.push(obsahovyBlokFolder);
            addLog(`📁 Vytvořena složka obsahového bloku "${obsahovyBlokName}"`);
          }

          // 4. Find or create topic (dataset) folder under obsahový blok
          let topicFolder = (obsahovyBlokFolder.children || []).find(
            (f: any) => f.label === selectedDataSet.topic,
          );
          
          if (!topicFolder) {
            topicFolder = {
              id: `folder-${Date.now()}-${selectedDataSet.topic.toLowerCase().replace(/\s+/g, '-')}`,
              label: selectedDataSet.topic,
              slug: selectedDataSet.topic.toLowerCase().replace(/\s+/g, '-'),
              type: 'folder',
              icon: 'folder',
              children: [],
            };
            obsahovyBlokFolder.children = obsahovyBlokFolder.children || [];
            obsahovyBlokFolder.children.push(topicFolder);
            addLog(`📁 Vytvořena složka datasetu "${selectedDataSet.topic}"`);
          }
          
          // 5. Add materials to topic folder
          topicFolder.children = topicFolder.children || [];
          let added = 0;
          
          const getDisplayName = (type: string, topic: string): string => {
            switch (type) {
              case 'text': return `${topic} - Učební text`;
              case 'board-easy': return `${topic} - Procvičování (úroveň 1)`;
              case 'board-hard': return `${topic} - Procvičování (úroveň 2)`;
              case 'worksheet': return `${topic} - Pracovní list`;
              case 'textbook-page': return `${topic} - List učebnice`;
              case 'test': return `${topic} - Písemka`;
              case 'lesson': return `${topic} - Interaktivní lekce`;
              case 'lessons': return `${topic} - E-U-R lekce`;
              case 'methodology': return `${topic} - Metodická inspirace`;
              // Language types
              case 'vocabulary-set':     return `${topic} - Slovní zásoba (kartičky)`;
              case 'language-quiz':      return `${topic} - Jazykový kvíz`;
              case 'grammar-lesson':     return `${topic} - Gramatická lekce`;
              case 'reading-activity':   return `${topic} - Čtení s porozuměním`;
              case 'listening-activity': return `${topic} - Poslechová aktivita`;
              case 'writing-activity':   return `${topic} - Psaní`;
              case 'speaking-activity':  return `${topic} - Mluvení`;
              case 'unit-plan':          return `${topic} - Plán lekce`;
              default: return `${topic} - ${type}`;
            }
          };
          
          const getMenuType = (matType: string): string => {
            if (matType === 'worksheet') return 'worksheet';
            if (matType === 'textbook-page') return 'worksheet';
            if (matType === 'test') return 'test';
            if (matType === 'methodology') return 'ucebni-text';
            if (matType === 'lesson' || matType === 'lessons') return 'interactive';
            if (matType.includes('board')) return 'practice';
            if (matType === 'text') return 'ucebni-text';
            // Language types
            if (matType === 'vocabulary-set' || matType === 'language-quiz') return 'practice';
            if (['grammar-lesson', 'reading-activity', 'listening-activity',
                 'writing-activity', 'speaking-activity', 'unit-plan'].includes(matType)) return 'ucebni-text';
            return 'practice';
          };
          
          for (const mat of materials) {
            if (!mat.id) continue;
            
            const menuType = getMenuType(mat.type);
            const displayName = getDisplayName(mat.type, selectedDataSet.topic);
            
            const menuItem: Record<string, any> = {
              id: mat.id,
              label: displayName,
              slug: mat.id,
              type: menuType,
              icon: menuType,
            };
            
            // ── Worksheet enrichment: sync board + generate thumbnail ──────────
            if (menuType === 'worksheet') {
              try {
                const { data: wsRow } = await supabase
                  .from('teacher_worksheets')
                  .select('id, name, content')
                  .eq('id', mat.id)
                  .single();

                if (wsRow?.content) {
                  const worksheet = wsRow.content as Worksheet;

                  // 1. Preserve existing coverImage from menu if available
                  const existingCover = (topicFolder.children as any[]).find(
                    (item: any) => item.id === mat.id
                  )?.coverImage;
                  if (existingCover) menuItem.coverImage = existingCover;

                  // 2. Sync linked board (create or reuse)
                  let linkedBoardId: string | undefined = worksheet.linkedBoardId;
                  if (!linkedBoardId) {
                    addLog(`🔗 Synchronizuji board pro "${displayName}"...`);
                    try {
                      const syncResult = await syncWorksheetToBoard(
                        worksheet,
                        (updated: Worksheet) => {
                          supabase
                            .from('teacher_worksheets')
                            .update({
                              content: stripBase64FromObject(updated) as any,
                              updated_at: new Date().toISOString(),
                            })
                            .eq('id', mat.id)
                            .then(() => {});
                        },
                      );
                      linkedBoardId = syncResult.quiz.id;
                    } catch (syncErr) {
                      addLog(`⚠️ Sync board selhal pro "${displayName}": ${syncErr}`, 'error');
                    }
                  }
                  if (linkedBoardId) {
                    menuItem.externalUrl = `board://${linkedBoardId}`;
                  }

                  // 3. Generate thumbnail (only if none exists yet)
                  const hasCover = menuItem.coverImage || worksheet.thumbnailUrl;
                  if (!hasCover) {
                    addLog(`🖼 Generuji náhled pro "${displayName}"...`);
                    try {
                      const { thumbnailUrls } = await generateWorksheetThumbnails(worksheet, 1);
                      if (thumbnailUrls[0]) {
                        menuItem.coverImage = thumbnailUrls[0];
                        // Persist thumbnailUrl back to the worksheet record (strip base64 to avoid DB bloat)
                        const updatedContent = stripBase64FromObject({
                          ...worksheet,
                          thumbnailUrl: thumbnailUrls[0],
                        } as Record<string, unknown>);
                        supabase
                          .from('teacher_worksheets')
                          .update({ content: updatedContent as any, updated_at: new Date().toISOString() })
                          .eq('id', mat.id)
                          .then(() => {});
                      }
                    } catch (thumbErr) {
                      addLog(`⚠️ Generování náhledu selhalo pro "${displayName}": ${thumbErr}`, 'error');
                    }
                  } else if (!menuItem.coverImage && worksheet.thumbnailUrl) {
                    menuItem.coverImage = worksheet.thumbnailUrl;
                  }

                  // 4. Generate & upload PDF (only if not already present in worksheetData)
                  const existingPdfUrl = (worksheet as any).pdfUrl
                    || (topicFolder.children as any[]).find((item: any) => item.id === mat.id)?.worksheetData?.pdfUrl;
                  if (!existingPdfUrl) {
                    addLog(`📄 Generuji PDF pro "${displayName}"...`);
                    try {
                      const pdfFilename = `${mat.id}-pracovni-list.pdf`;
                      const { data: { session: pdfSession } } = await supabase.auth.getSession();
                      const pdfResp = await fetch(
                        `https://njbtqmsxbyvpwigfceke.supabase.co/functions/v1/pdf-export`,
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g',
                            ...(pdfSession?.access_token ? { Authorization: `Bearer ${pdfSession.access_token}` } : {}),
                          },
                          body: JSON.stringify({
                            worksheetId: mat.id,
                            worksheetData: worksheet as unknown as Record<string, unknown>,
                            filename: pdfFilename,
                            saveToStorage: true,
                          }),
                        },
                      );
                      if (pdfResp.ok) {
                        // Deployed edge function may return raw PDF bytes OR JSON {pdfUrl}
                        let finalPdfUrl: string | null = null;
                        const ct = pdfResp.headers.get('content-type') || '';
                        if (ct.includes('application/pdf')) {
                          // Old deployed version: upload blob to storage from client
                          const pdfBlob = await pdfResp.blob();
                          const storageFileName = `pdfs/${pdfFilename}`;
                          const { error: uploadErr } = await supabase.storage
                            .from('teacher-files')
                            .upload(storageFileName, pdfBlob, { contentType: 'application/pdf', upsert: true });
                          if (!uploadErr) {
                            const { data: urlData } = supabase.storage.from('teacher-files').getPublicUrl(storageFileName);
                            finalPdfUrl = urlData.publicUrl;
                          } else {
                            addLog(`⚠️ PDF storage upload selhal: ${uploadErr.message}`, 'error');
                          }
                        } else {
                          const pdfResult = await pdfResp.json().catch(() => ({}));
                          finalPdfUrl = pdfResult.pdfUrl || null;
                        }
                        if (finalPdfUrl) {
                          menuItem.worksheetData = { ...(menuItem.worksheetData || {}), pdfUrl: finalPdfUrl };
                          supabase
                            .from('teacher_worksheets')
                            .update({
                              content: stripBase64FromObject({ ...worksheet, pdfUrl: finalPdfUrl } as any) as any,
                              updated_at: new Date().toISOString(),
                            })
                            .eq('id', mat.id)
                            .then(() => {});
                          addLog(`✅ PDF uloženo: ${finalPdfUrl}`);
                        }
                      } else {
                        const errText = await pdfResp.text().catch(() => '');
                        addLog(`⚠️ PDF generování selhalo (${pdfResp.status}): ${errText.slice(0, 100)}`, 'error');
                      }
                    } catch (pdfErr) {
                      addLog(`⚠️ PDF generování selhalo: ${pdfErr}`, 'error');
                    }
                  } else {
                    menuItem.worksheetData = { ...(menuItem.worksheetData || {}), pdfUrl: existingPdfUrl };
                    addLog(`📄 PDF již existuje pro "${displayName}", přeskakuji`);
                  }
                }
              } catch (wsErr) {
                console.warn('[CurriculumFactory] Worksheet enrichment failed:', wsErr);
              }
            }
            // ──────────────────────────────────────────────────────────────────

            const existingIndex = (topicFolder.children as any[]).findIndex(
              (item: any) => item.type === menuType && item.label === displayName
            );
            
            if (existingIndex >= 0) {
              topicFolder.children[existingIndex] = menuItem;
            } else {
              topicFolder.children.push(menuItem);
              added++;
            }
          }
          
          // 6. Save menu structure
          addLog(`💾 Ukládám do knihovny (${added} položek)...`);
          const saveResp = await fetch(`https://njbtqmsxbyvpwigfceke.supabase.co/functions/v1/make-server-46c8107b/menu`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ menu: menuStructure, category }),
          });
          
          if (!saveResp.ok) {
            throw new Error(`Chyba ukládání: ${await saveResp.text()}`);
          }
          
          // 7. Mark DataSet as published
          await supabase
            .from('topic_data_sets')
            .update({ status: 'published', updated_at: new Date().toISOString() })
            .eq('id', selectedDataSet.id);
          
          setSelectedDataSet((prev: any) => ({ ...prev, status: 'published' }));
          
          toast.success(`Uloženo ${added} materiálů do knihovny!`);
          addLog(`🎉 Hotovo! Materiály jsou v admin knihovně`, 'success');
          
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Ukládání selhalo');
        } finally {
          setSavingMaterials(false);
        }
      };
      
      const handleDeleteMaterial = async (mat: any, idx: number) => {
        if (!confirm(`Opravdu smazat "${mat.title || mat.type}"?`)) return;
        
        const updatedMaterials = materials.filter((_: any, i: number) => i !== idx);
        
        // Update local state
        setSelectedDataSet((prev: any) => ({
          ...prev,
          generated_materials: updatedMaterials
        }));
        
        // Save to DB
        await supabase
          .from('topic_data_sets')
          .update({ generated_materials: updatedMaterials })
          .eq('id', selectedDataSet.id);
        
        toast.success('Materiál smazán');
        addLog(`🗑️ Smazán materiál: ${mat.title || mat.type}`, 'success');
      };
      
      const handleRegenerateMaterial = async (mat: any, idx: number) => {
        if (!materialFeedback.trim()) {
          toast.error('Zadej zpětnou vazbu pro AI');
          return;
        }
        
        setRegeneratingMaterialId(mat.id || `mat-${idx}`);
        addLog(`🔄 Přegenerovávám: ${mat.title || mat.type}...`);
        addLog(`📝 Feedback: ${materialFeedback}`);
        
        try {
          const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
          
          // Add user feedback to content for AI to consider
          const dataSet = {
            id: selectedDataSet.id,
            topic: selectedDataSet.topic,
            subjectCode: selectedDataSet.subject_code,
            grade: selectedDataSet.grade,
            status: selectedDataSet.status,
            rvp: selectedDataSet.rvp || {},
            targetGroup: {},
            content: {
              ...(selectedDataSet.content || {}),
              userFeedback: materialFeedback, // Pass feedback to generator
            },
            media: selectedDataSet.media || {},
            generatedMaterials: selectedDataSet.generated_materials || [],
            createdAt: selectedDataSet.created_at,
            updatedAt: selectedDataSet.updated_at,
          };
          
          // Typ materiálu - generateFromDataSet očekává pomlčky
          const materialType = mat.type;
          const regenFolderId = await ensureDatasetFolder();
          const result = await generateFromDataSet(dataSet, materialType, undefined, regenFolderId);
          console.log(`[CurriculumFactory] Regen ${materialType} result:`, result.success, result.id, result.error);
          
          // Generátor vrací { success, id, preview } - materiál už je uložen v DB!
          if (result.success && result.id) {
            const newMaterial = {
              id: result.id,
              type: mat.type,
              title: mat.title || `${selectedDataSet.topic} - ${mat.type}`,
              preview: result.preview,
              regeneratedAt: new Date().toISOString(),
            };
            
            // Replace old material with new one
            const updatedMaterials = [...materials];
            updatedMaterials[idx] = newMaterial;
            
            // Update local state
            setSelectedDataSet((prev: any) => ({
              ...prev,
              generated_materials: updatedMaterials
            }));
            
            // Save to DB
            await supabase
              .from('topic_data_sets')
              .update({ generated_materials: updatedMaterials })
              .eq('id', selectedDataSet.id);
            
            toast.success('Materiál přegenerován!');
            addLog(`✅ Přegenerováno: ${mat.title || mat.type}`, 'success');
          } else {
            throw new Error(result.error || 'Generování selhalo');
          }
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Přegenerování selhalo');
        } finally {
          setRegeneratingMaterialId(null);
          setShowFeedbackFor(null);
          setMaterialFeedback('');
        }
      };
      
      const LANGUAGE_SUBJECTS = ['anglictina', 'anglictina_1st', 'nemcina', 'francouzstina', 'aj'];
      const isLanguageSubject = LANGUAGE_SUBJECTS.includes(selectedDataSet?.subject_code || '');

      const MATERIAL_TYPES = isLanguageSubject ? [
        { type: 'vocabulary-set',    label: 'Slovní zásoba',      icon: '🔤', description: 'Flashcard board – 16 karet s překladem, fonetikou a příkladem' },
        { type: 'language-quiz',     label: 'Jazykový kvíz',      icon: '🎯', description: 'Interaktivní VividBoard: ABC, doplňování, spojovačka' },
        { type: 'grammar-lesson',    label: 'Gramatická lekce',   icon: '📐', description: 'PPP struktura: pravidlo, řízená cvičení, volné použití' },
        { type: 'reading-activity',  label: 'Čtení',              icon: '📖', description: 'Text + T/F, otázky s porozuměním, slovíčka v kontextu' },
        { type: 'listening-activity',label: 'Poslech',            icon: '🎧', description: 'Audioskript + řazení, T/F, poslechové úkoly' },
        { type: 'writing-activity',  label: 'Psaní',              icon: '✍️', description: 'Řízené psaní: vzorový text, fráze, šablona, sebehodnocení' },
        { type: 'speaking-activity', label: 'Mluvení',            icon: '💬', description: 'Diskuse + role-play karet pro dvojice' },
        { type: 'unit-plan',         label: 'Plán lekce',         icon: '📋', description: '4× 45 min: cíle, aktivity, hodnocení, diferenciace' },
        { type: 'methodology',       label: 'Metodika',           icon: '📕', description: 'Metodická příručka pro učitele' },
      ] : [
        { type: 'text', label: 'Text', icon: '📝' },
        { type: 'board-easy', label: 'Board Easy', icon: '🎯' },
        { type: 'board-hard', label: 'Board Hard', icon: '🧠' },
        { type: 'worksheet', label: 'Pracovní list', icon: '📋' },
        { type: 'textbook-page', label: 'List učebnice', icon: '📖' },
        { type: 'test', label: 'Test', icon: '✅' },
        { type: 'lessons', label: 'Lekce (E-U-R)', icon: '📚' },
        { type: 'methodology', label: 'Metodika', icon: '📕' },
      ];

      const MILESTONE_MATERIAL_TYPES = [
        { type: 'board-easy', label: 'Závěrečný test (jednoduchý)', icon: '✅' },
        { type: 'board-hard', label: 'Závěrečný test (složitý)', icon: '🔥' },
        { type: 'hodnoceni', label: 'Výstupní hodnocení', icon: '📋' },
      ];

      const handleGenerateMilestonePart = async (partType: string) => {
        setRegeneratingMaterialId(partType);
        addLog(`⏳ Generuji milestoneový obsah (${partType})...`);
        try {
          const { buildMilestoneData } = await import('../../utils/curriculum/milestone-generator');
          const subjectMap: Record<string, string> = {
            dejepis: 'Dějepis', zemepis: 'Zeměpis', cestina: 'Český jazyk',
            anglictina: 'Anglický jazyk', matematika: 'Matematika', prirodopis: 'Přírodopis',
            fyzika: 'Fyzika', chemie: 'Chemie', prvouka: 'Prvouka', prirodoveda: 'Přírodověda',
            vlastiveda: 'Vlastivěda',
          };
          const md = selectedDataSet.milestone_data || {};
          const subjectName = subjectMap[selectedDataSet.subject_code] || selectedDataSet.subject_code;
          const milestoneData = await buildMilestoneData({
            topicGroupName: md.topicGroupName || selectedDataSet.topic.replace('Uzavření: ', ''),
            coveredTopics: md.coveredTopics || [],
            coveredWeekNumbers: md.coveredWeekNumbers || [],
            rvpOutcomes: selectedDataSet.rvp?.expectedOutcomes || [],
            subjectName,
            grade: selectedDataSet.grade,
          });
          await supabase.from('topic_data_sets').update({ milestone_data: milestoneData }).eq('id', selectedDataSet.id);
          setSelectedDataSet((prev: any) => ({ ...prev, milestone_data: milestoneData }));
          addLog(`✅ Uzlový bod vygenerován`, 'success');
          toast.success('Uzlový bod vygenerován');
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error(`Chyba: ${err.message}`);
        } finally {
          setRegeneratingMaterialId(null);
        }
      };
      
      const buildDataSetObject = () => {
        if (selectedDataSet?.milestone) {
          // Pro milestone: použij přímo selectedDataSet + coveredTopics z milestone_data jako kontext.
          // NESMÍME agregovat ze skupiny — ty datasety mohou mít špatná/nerelevantní data.
          const md = selectedDataSet.milestone_data || {};
          const groupName = (md as any).topicGroupName
            || selectedDataSet.topic.replace(/^Uzavř[eě]n[íi]:\s*/i, '').trim();

          // Témata: 1) z milestone_data.coveredTopics, 2) z dataSets skupiny (fallback)
          let coveredTopics: string[] = (md as any).coveredTopics || [];
          if (coveredTopics.length === 0) {
            // Fallback: vezmi témata datasetů ve stejné skupině z dsGroupMap
            const area = [...groupMilestoneMap.entries()].find(([, id]) => id === selectedDataSet.id)?.[0];
            if (area) {
              coveredTopics = dataSets
                .filter(ds => !ds.milestone && dsGroupMap.get(ds.id) === area)
                .map(ds => ds.topic);
            }
          }

          return {
            id: selectedDataSet.id,
            topic: groupName,                           // správný název tématu (ne "Uzavření: Obecné")
            subjectCode: selectedDataSet.subject_code,
            grade: selectedDataSet.grade,
            status: selectedDataSet.status,
            rvp: selectedDataSet.rvp || {},
            targetGroup: {},
            content: {
              ...selectedDataSet.content,
              // Klíčová témata ze skupiny jako kontext pro AI
              keyFacts: coveredTopics.length > 0
                ? coveredTopics.map((t: string) => `Téma: ${t}`)
                : (selectedDataSet.content?.keyFacts || []),
            },
            media: selectedDataSet.media || {},
            generatedMaterials: selectedDataSet.generated_materials || [],
            createdAt: selectedDataSet.created_at,
            updatedAt: selectedDataSet.updated_at,
          };
        }
        return {
        id: selectedDataSet.id,
        topic: selectedDataSet.topic,
        subjectCode: selectedDataSet.subject_code,
        grade: selectedDataSet.grade,
        status: selectedDataSet.status,
        rvp: selectedDataSet.rvp || {},
        targetGroup: {},
        content: selectedDataSet.content || {},
        media: selectedDataSet.media || {},
        generatedMaterials: selectedDataSet.generated_materials || [],
        createdAt: selectedDataSet.created_at,
        updatedAt: selectedDataSet.updated_at,
        };
      };

      // Generování všech milestone materiálů (board-easy, board-hard, lessons)
      const handleGenerateMilestoneAll = async () => {
        setRegeneratingMaterialId('all');
        addLog('🚀 Generuji závěrečné materiály...');
        try {
          const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Nejste přihlášeni');
          const dataSet = buildDataSetObject();
          const allFolderId = await ensureDatasetFolder();
          const existingMaterials = (selectedDataSet.generated_materials || []) as any[];
          const existingTypes = new Set(existingMaterials.map((m: any) => m.type));
          const generatedMaterials: any[] = [...existingMaterials];
          for (const { type } of MILESTONE_MATERIAL_TYPES) {
            if (existingTypes.has(type)) { addLog(`⏭ ${type} již existuje`); continue; }
            addLog(`⏳ Generuji: ${type}...`);
            try {
              const result = await generateFromDataSet(dataSet, type, undefined, allFolderId);
              if (result.success && result.id) {
                generatedMaterials.push({ id: result.id, type, title: `${selectedDataSet.topic} - ${type}`, preview: result.preview, status: 'draft', createdAt: new Date().toISOString() });
                addLog(`✅ ${type} hotovo`, 'success');
              } else {
                addLog(`⚠️ ${type}: ${result.error || 'Neznámá chyba'}`, 'warning');
              }
            } catch (err: any) {
              addLog(`❌ ${type} selhalo: ${err.message}`, 'error');
            }
          }
          await supabase.from('topic_data_sets').update({ generated_materials: generatedMaterials }).eq('id', selectedDataSet.id);
          setSelectedDataSet((prev: any) => ({ ...prev, generated_materials: generatedMaterials }));
          toast.success(`Hotovo! ${generatedMaterials.length - existingMaterials.length} nových materiálů`);
          addLog(`🎉 Závěrečné materiály vygenerovány`, 'success');
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Generování selhalo');
        } finally {
          setRegeneratingMaterialId(null);
        }
      };

      // Dvoustupňové generování worksheetu — spustí jen Agent 1
      const handleGenerateWorksheetPlan = async () => {
        setRegeneratingMaterialId('worksheet');
        setWorksheetPlanStep('planning');
        // setRagDebugInfo(null);
        addLog('🔍 [RAG] Hledám podobné pracovní listy v databázi...');
        try {
          const { generateContentPlanOnly } = await import('../../utils/dataset/material-generators');
          const dataSet = buildDataSetObject();
          setWorksheetPlanDataSet(dataSet);

          const result = await generateContentPlanOnly(dataSet, (step, detail, payload) => {
            const icons: Record<string, string> = {
              'rag': '🔍', 'rag-done': '✅', 'agent1': '🤖', 'agent1-done': '✅', 'error': '❌',
            };
            addLog(`${icons[step] || '⏳'} ${detail || step}`);
          });

          if (result.success && result.contentPlan) {
            setWorksheetContentPlan(result.contentPlan);
            setWorksheetPlanStep('review');
            // Inicializuj výběr obrázků na základě toho co vybral Agent 1
            const allImages = [
              ...(dataSet.media?.images ?? []),
              ...(dataSet.media?.generatedIllustrations ?? []),
              ...(dataSet.media?.generatedPhotos ?? []),
            ];
            const agentSelected = new Set((result.contentPlan.selectedImages ?? []).map((i: any) => i.url));
            const initSelection: Record<string, { selected: boolean; placement: string }> = {};
            allImages.forEach((img: any) => {
              const url = img.url || '';
              const agentImg = (result.contentPlan.selectedImages ?? []).find((i: any) => i.url === url);
              initSelection[url] = {
                selected: agentSelected.has(url),
                placement: agentImg?.suggestedPlacement ?? 'intro',
              };
            });
            setUserImageSelection(initSelection);
            addLog('📋 Plán obsahu připraven — zkontroluj a potvrď', 'success');
          } else {
            addLog(`❌ Agent 1 selhal: ${result.error}`, 'error');
            setWorksheetPlanStep('idle');
          }
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          setWorksheetPlanStep('idle');
        } finally {
          setRegeneratingMaterialId(null);
        }
      };

      // Krok 2 — spustí Agent 2 s potvrzeným ContentPlanem
      const handleGenerateWorksheetDesign = async () => {
        if (!worksheetContentPlan || !worksheetPlanDataSet) return;
        setRegeneratingMaterialId('worksheet-design');
        setWorksheetPlanStep('designing');
        addLog('🎨 [Agent 2] Navrhuji layout a rozmísťuji bloky...');
        try {
          const { generateFromContentPlan } = await import('../../utils/dataset/material-generators');

          // Přepis selectedImages dle výběru uživatele
          const mergedPlan = {
            ...worksheetContentPlan,
            selectedImages: Object.entries(userImageSelection)
              .filter(([, v]) => v.selected)
              .map(([url, v]) => ({ url, suggestedPlacement: v.placement })),
          };

          // setAgent2Debug(null);
          const contentPlanFolderId = await ensureDatasetFolder();
          const result = await generateFromContentPlan(worksheetPlanDataSet, mergedPlan, (step, detail, payload) => {
            const icons: Record<string, string> = {
              'rag': '🔍', 'rag-done': '✅', 'agent2': '🎨', 'agent2-done': '✅', 'saving': '💾', 'done': '🎉', 'error': '❌',
            };
            if (step !== 'agent2-prompt' && step !== 'agent2-raw') {
            addLog(`${icons[step] || '⏳'} ${detail || step}`);
            }
            if (step === 'agent2-raw' && payload) {
              addLog(`🎨 Agent 2 odpověděl (${((payload as any).raw || '').length} znaků)`);
            }
          }, contentPlanFolderId);

          if (result.success && result.id) {
            const newMaterial = {
              id: result.id,
              type: 'worksheet',
              title: worksheetContentPlan.title || `${selectedDataSet.topic} - Pracovní list`,
              preview: result.preview,
              status: 'draft',
              createdAt: new Date().toISOString(),
              generationMethod: 'two-agent',
            };
            const { data: freshRow } = await supabase.from('topic_data_sets').select('generated_materials').eq('id', selectedDataSet.id).single();
            const updatedMaterials = [...(freshRow?.generated_materials || []), newMaterial];
            await supabase.from('topic_data_sets').update({ generated_materials: updatedMaterials }).eq('id', selectedDataSet.id);
            setSelectedDataSet((prev: any) => ({ ...prev, generated_materials: updatedMaterials }));
            setWorksheetPlanStep('done');
            setWorksheetContentPlan(null);
            addLog(`🎉 Pracovní list vygenerován! Otevři v Pro editoru.`, 'success');
            toast.success('Pracovní list vygenerován!');
          } else {
            addLog(`❌ Agent 2 selhal: ${result.error}`, 'error');
            setWorksheetPlanStep('review'); // vrátíme se k review
          }
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          setWorksheetPlanStep('review');
        } finally {
          setRegeneratingMaterialId(null);
        }
      };

      // Generování listu učebnice — přímo z učebního textu (bez Agent 1)
      const handleGenerateTextbookPlan = async () => {
        setRegeneratingMaterialId('textbook-page');
        setTextbookPlanStep('planning');
        try {
          const { loadSourceTextAsBlocks, saveWorksheetDirect } = await import('../../utils/dataset/material-generators');
          const dataSet = buildDataSetObject();

          // Zkus načíst učební text jako bloky
          const textMat = (selectedDataSet?.generated_materials || []).find((m: any) => m.type === 'text');
          if (textMat?.id) {
            addLog('📄 Načítám obsah učebního textu...');
            const blocks = await loadSourceTextAsBlocks(textMat.id, dataSet);
            if (blocks && blocks.length > 0) {
              addLog(`✅ Načteno ${blocks.length} bloků z učebního textu — ukládám...`, 'success');
              const textbookFolderId = await ensureDatasetFolder();
              const worksheetId = `worksheet-${Date.now()}`;
              const { saveWorksheet } = await import('../../utils/worksheet-storage');
              saveWorksheet({
                id: worksheetId,
                title: `${dataSet.topic} - List učebnice`,
                blocks,
                settings: { showAnswerKey: false, pageSize: 'A4', margins: 'normal' },
                metadata: {
                  subject: dataSet.subjectCode,
                  grade: dataSet.grade,
                  topic: dataSet.topic,
                  sourceDatasetId: dataSet.id,
                  layoutMode: 'grid' as const,
                  gridColumns: 12 as const,
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }, textbookFolderId);
              const newMaterial = {
                id: worksheetId,
                type: 'textbook-page',
                title: `${dataSet.topic} - List učebnice`,
                preview: '',
                status: 'draft',
                createdAt: new Date().toISOString(),
                generationMethod: 'from-source-text',
              };
              const { data: freshRow } = await supabase.from('topic_data_sets').select('generated_materials').eq('id', dataSet.id).single();
              const updatedMaterials = [...(freshRow?.generated_materials || []), newMaterial];
              await supabase.from('topic_data_sets').update({ generated_materials: updatedMaterials }).eq('id', dataSet.id);
              setSelectedDataSet((prev: any) => ({ ...prev, generated_materials: updatedMaterials }));
              setTextbookPlanStep('done');
              addLog('🎉 List učebnice připraven! Otevři v Pro editoru a uprav layout.', 'success');
              toast.success('List učebnice připraven!');
              return;
            }
          }

          // Fallback — žádný učební text, použij Agent 1
          addLog('📝 Žádný učební text — generuji obsah přes Agent 1...');
          const { generateTextbookPlanOnly, generateTextbookFromContentPlan } = await import('../../utils/dataset/material-generators');
          setTextbookPlanDataSet(dataSet);
          const result = await generateTextbookPlanOnly(dataSet, (step, detail) => {
            const icons: Record<string, string> = { 'rag': '🔍', 'rag-done': '✅', 'agent1': '🤖', 'agent1-done': '✅', 'error': '❌' };
            addLog(`${icons[step] || '⏳'} ${detail || step}`);
          });
          if (result.success && result.contentPlan) {
            addLog('📐 Skládám obsah do bloků...');
            const textbookFolderId = await ensureDatasetFolder();
            const designResult = await generateTextbookFromContentPlan(dataSet, result.contentPlan, (step, detail) => {
              const icons: Record<string, string> = { 'agent2': '📐', 'agent2-done': '✅', 'saving': '💾', 'done': '🎉', 'error': '❌' };
              addLog(`${icons[step] || '⏳'} ${detail || step}`);
            }, [], textbookFolderId);
            if (designResult.success && designResult.id) {
              const newMaterial = {
                id: designResult.id,
                type: 'textbook-page',
                title: result.contentPlan.title || `${dataSet.topic} - List učebnice`,
                preview: '',
                status: 'draft',
                createdAt: new Date().toISOString(),
                generationMethod: 'two-agent',
              };
              const { data: freshRow } = await supabase.from('topic_data_sets').select('generated_materials').eq('id', dataSet.id).single();
              const updatedMaterials = [...(freshRow?.generated_materials || []), newMaterial];
              await supabase.from('topic_data_sets').update({ generated_materials: updatedMaterials }).eq('id', dataSet.id);
              setSelectedDataSet((prev: any) => ({ ...prev, generated_materials: updatedMaterials }));
              setTextbookPlanStep('done');
              addLog('🎉 List učebnice vygenerován!', 'success');
              toast.success('List učebnice vygenerován!');
            } else {
              addLog(`❌ Chyba: ${designResult.error}`, 'error');
              setTextbookPlanStep('idle');
            }
          } else {
            addLog(`❌ Agent 1 selhal: ${result.error}`, 'error');
            setTextbookPlanStep('idle');
          }
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          setTextbookPlanStep('idle');
        } finally {
          setRegeneratingMaterialId(null);
        }
      };

      // Agent 2 pro list učebnice
      const handleGenerateTextbookDesign = async () => {
        if (!textbookContentPlan || !textbookPlanDataSet) return;
        setRegeneratingMaterialId('textbook-design');
        setTextbookPlanStep('designing');
        addLog('📐 Skládám obsah do bloků...');
        try {
          const { generateTextbookFromContentPlan } = await import('../../utils/dataset/material-generators');

          // Keep Agent 1's selectedImages (they have sectionIndex for layout rules).
          // If user deselected some images, filter them out but preserve sectionIndex on the rest.
          const userDeselectedUrls = new Set(
            Object.entries(userImageSelection)
              .filter(([, v]) => !v.selected)
              .map(([url]) => url)
          );
          const hasUserSelection = Object.values(userImageSelection).some(v => v.selected);
          const mergedPlan = {
            ...textbookContentPlan,
            selectedImages: hasUserSelection
              ? (textbookContentPlan.selectedImages || []).filter((img: any) => !userDeselectedUrls.has(img.url))
              : textbookContentPlan.selectedImages,
          };

          const textbookFolderId = await ensureDatasetFolder();
          const result = await generateTextbookFromContentPlan(textbookPlanDataSet, mergedPlan, (step, detail) => {
            const icons: Record<string, string> = {
              'agent2': '📐', 'agent2-done': '✅', 'saving': '💾', 'done': '🎉', 'error': '❌',
            };
            addLog(`${icons[step] || '⏳'} ${detail || step}`);
          }, [], textbookFolderId);

          if (result.success && result.id) {
            const newMaterial = {
              id: result.id,
              type: 'textbook-page',
              title: textbookContentPlan.title || `${selectedDataSet.topic} - List učebnice`,
              preview: result.preview,
              status: 'draft',
              createdAt: new Date().toISOString(),
              generationMethod: 'two-agent',
            };
            const { data: freshRow } = await supabase.from('topic_data_sets').select('generated_materials').eq('id', selectedDataSet.id).single();
            const updatedMaterials = [...(freshRow?.generated_materials || []), newMaterial];
            await supabase.from('topic_data_sets').update({ generated_materials: updatedMaterials }).eq('id', selectedDataSet.id);
            setSelectedDataSet((prev: any) => ({ ...prev, generated_materials: updatedMaterials }));
            setTextbookPlanStep('done');
            setTextbookContentPlan(null);
            addLog('🎉 List učebnice vygenerován! Otevři v Pro editoru.', 'success');
            toast.success('List učebnice vygenerován!');
          } else {
            addLog(`❌ Agent 2 selhal: ${result.error}`, 'error');
            setTextbookPlanStep('review');
          }
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          setTextbookPlanStep('review');
        } finally {
          setRegeneratingMaterialId(null);
        }
      };

      const handleGenerateSingleMaterial = async (materialType: string) => {
        // Worksheet a List učebnice mají dvoustupňový flow
        if (materialType === 'worksheet') {
          handleGenerateWorksheetPlan();
          return;
        }
        if (materialType === 'textbook-page') {
          handleGenerateTextbookPlan();
          return;
        }

        setRegeneratingMaterialId(materialType);
        addLog(`⏳ Generuji: ${materialType}...`);
        try {
          const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Nejste přihlášeni');
          const dataSet = buildDataSetObject();
          const singleFolderId = await ensureDatasetFolder();
          const result = await generateFromDataSet(dataSet, materialType, (step, detail) => {
            addLog(`⏳ ${detail || step}`);
          }, singleFolderId);
          if (result.success && result.id) {
            const TYPE_LABELS: Record<string, string> = {
              'text': 'Učební text', 'board-easy': 'Procvičování I', 'board-hard': 'Procvičování II',
              'worksheet': 'Pracovní list', 'textbook-page': 'List učebnice', 'test': 'Písemka',
              'lesson': 'Interaktivní lekce', 'lessons': 'E-U-R lekce', 'methodology': 'Metodická inspirace',
              'vocabulary-set': 'Slovní zásoba', 'language-quiz': 'Jazykový kvíz',
              'grammar-lesson': 'Gramatická lekce', 'reading-activity': 'Čtení',
              'listening-activity': 'Poslech', 'writing-activity': 'Psaní',
              'speaking-activity': 'Mluvení', 'unit-plan': 'Plán lekce', 'hodnoceni': 'Hodnocení',
              'grammar-lesson-board': 'Gramatická lekce – Board', 'reading-activity-board': 'Čtení – Board',
              'listening-activity-board': 'Poslech – Board', 'writing-activity-board': 'Psaní – Board',
              'speaking-activity-board': 'Mluvení – Board',
            };
            const title = `${selectedDataSet.topic} – ${TYPE_LABELS[materialType] || materialType}`;
            const newMaterial = { id: result.id, type: materialType, title, preview: result.preview, status: 'draft', createdAt: new Date().toISOString() };
            
            const { data: freshRow } = await supabase
              .from('topic_data_sets')
              .select('generated_materials')
              .eq('id', selectedDataSet.id)
              .single();
            const freshMaterials = freshRow?.generated_materials || [];
            const newMaterials = [newMaterial];

            // Pokud generátor vrátil také board (grammar, reading, listening, writing, speaking),
            // přidej ho do seznamu jako samostatný materiál s typem '<typ>-board'
            if (result.linkedBoardId) {
              newMaterials.push({
                id: result.linkedBoardId,
                type: `${materialType}-board`,
                title: `${title} – Board`,
                preview: result.preview,
                status: 'draft',
                createdAt: new Date().toISOString(),
              });
            }

            const updatedMaterials = [...freshMaterials, ...newMaterials];
            
            const { error: saveErr } = await supabase
              .from('topic_data_sets')
              .update({ generated_materials: updatedMaterials })
              .eq('id', selectedDataSet.id);
            if (saveErr) console.error('[Materials] Save error:', saveErr);
            
            setSelectedDataSet((prev: any) => ({
              ...prev,
              generated_materials: updatedMaterials
            }));
            addLog(`✅ ${materialType} hotovo`, 'success');
            toast.success(`${materialType} vygenerováno!`);
          } else {
            addLog(`⚠️ ${materialType}: ${result.error || 'Neznámá chyba'}`, 'warning');
            toast.error(`${materialType}: ${result.error || 'Generování selhalo'}`);
          }
        } catch (err: any) {
          addLog(`❌ ${materialType} selhalo: ${err.message}`, 'error');
          toast.error(`${materialType} selhalo`);
        } finally {
          setRegeneratingMaterialId(null);
        }
      };
      
      const handleGenerateAll = async () => {
        setRegeneratingMaterialId('all');
        addLog('🚀 Generuji všechny materiály...');
        try {
          const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Nejste přihlášeni');
          const dataSet = {
            id: selectedDataSet.id,
            topic: selectedDataSet.topic,
            subjectCode: selectedDataSet.subject_code,
            grade: selectedDataSet.grade,
            status: selectedDataSet.status,
            rvp: selectedDataSet.rvp || {},
            targetGroup: {},
            content: selectedDataSet.content || {},
            media: selectedDataSet.media || {},
            generatedMaterials: [],
            createdAt: selectedDataSet.created_at,
            updatedAt: selectedDataSet.updated_at,
          };
          const allFolderId = await ensureDatasetFolder();
          const generatedMaterials: any[] = [];
          for (const { type } of MATERIAL_TYPES) {
            addLog(`⏳ Generuji: ${type}...`);
            try {
              const result = await generateFromDataSet(dataSet, type, undefined, allFolderId);
              if (result.success && result.id) {
                generatedMaterials.push({
                  id: result.id,
                  type,
                  title: `${selectedDataSet.topic} - ${type}`,
                  preview: result.preview,
                  status: 'draft',
                  createdAt: new Date().toISOString(),
                });
                addLog(`✅ ${type} hotovo`, 'success');
              } else {
                addLog(`⚠️ ${type}: ${result.error || 'Neznámá chyba'}`, 'warning');
              }
            } catch (err: any) {
              addLog(`❌ ${type} selhalo: ${err.message}`, 'error');
            }
          }
          setSelectedDataSet((prev: any) => ({ ...prev, generated_materials: generatedMaterials }));
          await supabase.from('topic_data_sets').update({ generated_materials: generatedMaterials }).eq('id', selectedDataSet.id);
          toast.success(`Vygenerováno ${generatedMaterials.length} materiálů!`);
          addLog(`🎉 Hotovo! ${generatedMaterials.length} materiálů`, 'success');
        } catch (err: any) {
          addLog(`❌ Chyba: ${err.message}`, 'error');
          toast.error('Generování selhalo');
        } finally {
          setRegeneratingMaterialId(null);
        }
      };
      
      // Dva sloupce: 1) seznam materiálů + vygenerovat vše / chybějící, 2) detail vybraného + chat
      return (
        <>
          {/* Sloupec 1: Seznam materiálů */}
          <div className="flex flex-col bg-white border-r border-slate-200 flex-shrink-0 overflow-hidden" style={{ width: 330 }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 flex-wrap gap-2">
              <span className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Materiály ({materials.length})</span>
              <div className="flex gap-1">
                <button
                  onClick={handleSaveToLibrary}
                  disabled={savingMaterials || materials.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: savingMaterials ? '#818cf8' : (selectedDataSet.status === 'published' ? '#22c55e' : '#4f46e5'),
                    color: 'white',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: savingMaterials ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    opacity: materials.length === 0 ? 0.5 : 1,
                  }}
                >
                  {savingMaterials ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {savingMaterials ? 'Ukládám...' : selectedDataSet.status === 'published' ? 'Uloženo' : 'Uložit do knihovny'}
                </button>
              </div>
            </div>
            <div className="flex-1 min-w-0 overflow-y-auto py-1">
              {materials.map((mat: any, idx: number) => {
                const isSelected = selectedMaterialIndex === idx;
                const matIcon = (() => {
                  const t = mat.type || '';
                  if (t.endsWith('-board') || t === 'board-easy' || t === 'board-hard' || t === 'lesson' || t === 'lessons' || t === 'vocabulary-set')
                    return <Monitor className="w-4 h-4 shrink-0 text-violet-500" />;
                  if (t === 'language-quiz' || t === 'test')
                    return <ClipboardCheck className="w-4 h-4 shrink-0 text-amber-500" />;
                  if (t === 'grammar-lesson')
                    return <BookMarked className="w-4 h-4 shrink-0 text-blue-500" />;
                  if (t === 'reading-activity')
                    return <BookOpen className="w-4 h-4 shrink-0 text-emerald-500" />;
                  if (t === 'listening-activity')
                    return <Headphones className="w-4 h-4 shrink-0 text-cyan-500" />;
                  if (t === 'writing-activity')
                    return <Pencil className="w-4 h-4 shrink-0 text-orange-500" />;
                  if (t === 'speaking-activity')
                    return <Mic className="w-4 h-4 shrink-0 text-pink-500" />;
                  if (t === 'worksheet' || t === 'textbook-page')
                    return <ClipboardEdit className="w-4 h-4 shrink-0 text-indigo-500" />;
                  if (t === 'methodology' || t === 'unit-plan')
                    return <ClipboardList className="w-4 h-4 shrink-0 text-slate-500" />;
                  if (t === 'hodnoceni')
                    return <Award className="w-4 h-4 shrink-0 text-yellow-500" />;
                  return <FileText className="w-4 h-4 shrink-0 text-slate-400" />;
                })();

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedMaterialIndex(idx)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                      ${isSelected ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500' : 'hover:bg-slate-50 text-slate-700'}
                    `}
                  >
                    {matIcon}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{mat.title || mat.type}</div>
                      <div className="text-xs text-slate-400">{mat.type}</div>
                    </div>
                    <span
                      className="shrink-0 px-2 py-0.5 text-xs rounded-full"
                      style={{
                        backgroundColor: mat.id ? '#dcfce7' : '#fef3c7',
                        color: mat.id ? '#166534' : '#92400e',
                      }}
                    >
                      {mat.id ? 'Uloženo' : '…'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                );
              })}
            </div>
            {/* Chybějící materiály + Vygenerovat vše - bude doplněno níže v bloku Generování materiálů */}
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <p className="text-xs font-medium text-slate-500 mb-2">Generovat</p>
              <button
                onClick={selectedDataSet.milestone ? handleGenerateMilestoneAll : handleGenerateAll}
                disabled={regeneratingMaterialId !== null}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  backgroundColor: regeneratingMaterialId === 'all' ? '#818cf8' : '#4f46e5',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: regeneratingMaterialId !== null ? 'not-allowed' : 'pointer',
                  marginBottom: '8px',
                }}
              >
                {regeneratingMaterialId === 'all' ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Generuji...</>
                ) : (
                  <><Sparkles className="w-3 h-3" /> Vygenerovat vše</>
                )}
              </button>
              {(() => {
                const isMilestoneDS = !!selectedDataSet.milestone;
                const existingTypes = new Set(materials.map((m: any) => m.type));
                const missingTypes = isMilestoneDS
                  ? MILESTONE_MATERIAL_TYPES.filter(t => !existingTypes.has(t.type))
                  : MATERIAL_TYPES.filter(t => !existingTypes.has(t.type) && t.type !== 'lessons');
                const openLessonWizard = () => {
                  setLessonSuggestedTopics([
                    selectedDataSet.topic,
                    ...(selectedDataSet.rvp?.thematicArea ? [selectedDataSet.rvp.thematicArea] : []),
                    ...(selectedDataSet.content?.keyTerms?.map((t: any) => typeof t === 'string' ? t : t.term)?.filter(Boolean) || []).slice(0, 8),
                    ...toStrArr(selectedDataSet.content?.keyFacts).slice(0, 3),
                  ].filter(Boolean));
                  setLessonSelectedTopics(new Set());
                  setLessonSelectedCompetencies(new Set());
                  setLessonSelectedFacts(new Set());
                  setLessonDescription('');
                  setLessonJustGenerated(false);
                  setLessonWizardOpen(true);
                };
                return (
                  <>
                    {missingTypes.length > 0 && (
                      <>
                        <p className="text-xs text-slate-500 mb-1">Chybějící:</p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {missingTypes.map(({ type, label, icon }) => {
                            const hasSourceText = type === 'textbook-page' && materials.some((m: any) => m.type === 'text');
                            const btnLabel = hasSourceText ? 'List učebnice (z učebního textu)' : label;
                            return (
                            <button
                              key={type}
                              onClick={() => handleGenerateSingleMaterial(type)}
                              disabled={regeneratingMaterialId !== null}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                backgroundColor: regeneratingMaterialId === type ? '#818cf8' : '#6366f1',
                                color: 'white',
                                fontSize: '11px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: regeneratingMaterialId !== null ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {regeneratingMaterialId === type ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>{icon}</span>}
                              + {btnLabel}
                            </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {!isMilestoneDS && (
                      <>
                        <p className="text-xs text-slate-500 mb-1">Lekce (E-U-R):</p>
                        <button
                          onClick={openLessonWizard}
                          disabled={regeneratingMaterialId !== null}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            backgroundColor: '#8b5cf6',
                            color: 'white',
                            fontSize: '11px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: regeneratingMaterialId !== null ? 'not-allowed' : 'pointer',
                          }}
                        >
                          📚 {materials.filter((m: any) => m.type === 'lessons').length > 0 ? 'Generovat další lekci' : 'Generovat lekci'}
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* ContentPlan review panel — zobrazí se po Agent 1 */}
          {worksheetPlanStep === 'review' && worksheetContentPlan && (
            <div className="flex flex-col bg-white border-r border-slate-200 flex-shrink-0 overflow-hidden" style={{ width: 420 }}>
              <div className="px-4 py-3 border-b border-indigo-100 bg-indigo-50 flex items-center gap-2">
                <span style={{ fontSize: 20 }}>🤖</span>
                <div>
                  <h3 className="font-semibold text-indigo-800 text-sm">Agent 1 — Plán obsahu</h3>
                  <p className="text-xs text-indigo-500">Zkontroluj plán, pak spusť Agent 2 (design)</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-3">
                {/* Hlavička */}
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Název</p>
                  <p className="font-semibold text-slate-800 text-sm">{worksheetContentPlan.title}</p>
                  {worksheetContentPlan.learningGoal && (
                    <>
                      <p className="text-xs text-slate-500 mt-2 mb-1">Vzdělávací cíl</p>
                      <p className="text-xs text-slate-600">{worksheetContentPlan.learningGoal}</p>
                    </>
                  )}
                  <div className="flex gap-3 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {worksheetContentPlan.difficulty === 'easy' ? 'Lehká' : worksheetContentPlan.difficulty === 'hard' ? 'Těžká' : 'Střední'} obtížnost
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {worksheetContentPlan.estimatedTimeMinutes} min
                    </span>
                  </div>
                </div>

                {/* Sekce */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Sekce ({worksheetContentPlan.sections?.length || 0})
                  </p>
                  <div className="space-y-1.5">
                    {(worksheetContentPlan.sections || []).map((section: any, i: number) => {
                      const typeColors: Record<string, string> = {
                        'intro': '#dbeafe', 'vocabulary': '#fef3c7', 'timeline': '#d1fae5',
                        'reading': '#ede9fe', 'summary': '#fce7f3',
                      };
                      const bg = typeColors[section.type] || '#f1f5f9';
                      return (
                        <div key={i} className="rounded-lg p-2.5" style={{ backgroundColor: bg }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-slate-500 w-5">{i + 1}.</span>
                            <span className="text-xs font-semibold text-slate-700">{section.title}</span>
                            <span className="ml-auto text-xs text-slate-400 bg-white/60 px-1.5 py-0.5 rounded">{section.type}</span>
                          </div>
                          {section.layoutHint && (
                            <p className="text-xs text-slate-500 ml-7">💡 {section.layoutHint}</p>
                          )}
                          {section.items && section.items.length > 0 && (
                            <p className="text-xs text-slate-400 ml-7">{section.items.length} položek</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Výběr obrázků — interaktivní galerie */}
                {worksheetPlanDataSet && (() => {
                  const allImgs = [
                    ...(worksheetPlanDataSet.media?.images ?? []),
                    ...(worksheetPlanDataSet.media?.generatedIllustrations ?? []),
                    ...(worksheetPlanDataSet.media?.generatedPhotos ?? []),
                  ];
                  if (!allImgs.length) return null;
                  const selectedCount = Object.values(userImageSelection).filter(v => v.selected).length;
                  return (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Obrázky — vyber co chceš použít ({selectedCount} vybráno)
                      </p>
                      <div className="space-y-2">
                        {allImgs.map((img: any, i: number) => {
                          const url = img.url || '';
                          const sel = userImageSelection[url];
                          const isSelected = sel?.selected ?? false;
                          const placement = sel?.placement ?? 'intro';
                          return (
                            <div
                              key={i}
                              className="rounded-lg border-2 overflow-hidden"
                              style={{ borderColor: isSelected ? '#4f46e5' : '#e2e8f0', background: isSelected ? '#eef2ff' : 'white' }}
                            >
                              <div className="flex items-center gap-2 p-2">
                                <img src={url} alt="" style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-600 truncate">{img.title || img.alt || `Obrázek ${i + 1}`}</p>
                                  {isSelected && (
                                    <select
                                      value={placement}
                                      onChange={e => setUserImageSelection(prev => ({
                                        ...prev,
                                        [url]: { ...prev[url], placement: e.target.value }
                                      }))}
                                      onClick={e => e.stopPropagation()}
                                      style={{ fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid #c7d2fe', background: 'white', color: '#4338ca', marginTop: 2 }}
                                    >
                                      <option value="intro">intro</option>
                                      <option value="header">header</option>
                                      <option value="reading">reading</option>
                                      <option value="summary">summary</option>
                                      <option value="decoration">decoration</option>
                                    </select>
                                  )}
                                </div>
                                <button
                                  onClick={() => setUserImageSelection(prev => ({
                                    ...prev,
                                    [url]: { ...prev[url], selected: !isSelected }
                                  }))}
                                  style={{
                                    flexShrink: 0, width: 26, height: 26, borderRadius: 6,
                                    border: isSelected ? 'none' : '1px solid #e2e8f0',
                                    background: isSelected ? '#4f46e5' : 'white',
                                    color: isSelected ? 'white' : '#94a3b8',
                                    fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  {isSelected ? '✓' : '+'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                </div>
              </div>

              {/* Akční tlačítka */}
              <div className="p-3 border-t border-slate-200 flex gap-2">
                <button
                  onClick={() => { setWorksheetPlanStep('idle'); setWorksheetContentPlan(null); }}
                  style={{
                    padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
                    background: 'white', color: '#64748b', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Zrušit
                </button>
                <button
                  onClick={handleGenerateWorksheetDesign}
                  disabled={regeneratingMaterialId !== null}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '8px 12px', borderRadius: 8, border: 'none',
                    backgroundColor: regeneratingMaterialId ? '#818cf8' : '#4f46e5',
                    color: 'white', fontSize: 12, fontWeight: 600,
                    cursor: regeneratingMaterialId ? 'not-allowed' : 'pointer',
                  }}
                >
                  {regeneratingMaterialId === 'worksheet-design' ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Agent 2 pracuje...</>
                  ) : (
                    <>🎨 Spustit Agent 2 — Navrhnout design</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Textbook ContentPlan review panel */}
          {textbookPlanStep === 'review' && textbookContentPlan && (
            <div className="flex flex-col bg-white border-r border-slate-200 flex-shrink-0 overflow-hidden" style={{ width: 420 }}>
              <div className="px-4 py-3 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
                <span style={{ fontSize: 20 }}>📖</span>
                <div>
                  <h3 className="font-semibold text-amber-800 text-sm">Agent 1 — Plán listu učebnice</h3>
                  <p className="text-xs text-amber-600">Zkontroluj plán, pak spusť Agent 2 (vizuální layout)</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-3">
                  {/* Hlavička */}
                  <p className="font-semibold text-slate-800 text-sm">{textbookContentPlan.title}</p>
                  {textbookContentPlan.learningGoal && (
                    <>
                      <p className="text-xs text-slate-500 mt-2 mb-1">Vzdělávací cíl</p>
                      <p className="text-xs text-slate-600">{textbookContentPlan.learningGoal}</p>
                    </>
                  )}
                  <div className="flex gap-3 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {textbookContentPlan.difficulty === 'easy' ? 'Lehká' : textbookContentPlan.difficulty === 'hard' ? 'Těžká' : 'Střední'} obtížnost
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {textbookContentPlan.estimatedTimeMinutes} min
                    </span>
                  </div>
                </div>

                {/* Výběr obrázků — interaktivní galerie */}
                {textbookPlanDataSet && (() => {
                  const allImgs = [
                    ...(textbookPlanDataSet.media?.images ?? []),
                    ...(textbookPlanDataSet.media?.generatedIllustrations ?? []),
                    ...(textbookPlanDataSet.media?.generatedPhotos ?? []),
                  ];
                  if (!allImgs.length) return null;
                  const selectedCount = Object.values(userImageSelection).filter(v => v.selected).length;
                  return (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
                        📸 Obrázky — vyber co chceš použít ({selectedCount} vybráno)
                      </p>
                      <div className="space-y-2">
                        {allImgs.map((img: any, i: number) => {
                          const url = img.url || '';
                          const sel = userImageSelection[url];
                          const isSelected = sel?.selected ?? false;
                          const placement = sel?.placement ?? 'intro';
                          return (
                            <div
                              key={i}
                              className="rounded-lg border-2 overflow-hidden"
                              style={{ borderColor: isSelected ? '#d97706' : '#e2e8f0', background: isSelected ? '#fffbeb' : 'white' }}
                            >
                              <div className="flex items-center gap-2 p-2">
                                <img src={url} alt="" style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-600 truncate">{img.title || img.alt || `Obrázek ${i + 1}`}</p>
                                  {isSelected && (
                                    <select
                                      value={placement}
                                      onChange={e => setUserImageSelection(prev => ({
                                        ...prev,
                                        [url]: { ...prev[url], placement: e.target.value }
                                      }))}
                                      onClick={e => e.stopPropagation()}
                                      style={{ fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid #fcd34d', background: 'white', color: '#92400e', marginTop: 2 }}
                                    >
                                      <option value="intro">intro</option>
                                      <option value="header">header</option>
                                      <option value="reading">reading</option>
                                      <option value="summary">summary</option>
                                      <option value="decoration">decoration</option>
                                    </select>
                                  )}
                                </div>
                                <button
                                  onClick={() => setUserImageSelection(prev => ({
                                    ...prev,
                                    [url]: { ...prev[url], selected: !isSelected }
                                  }))}
                                  style={{
                                    flexShrink: 0, width: 26, height: 26, borderRadius: 6,
                                    border: isSelected ? 'none' : '1px solid #e2e8f0',
                                    background: isSelected ? '#d97706' : 'white',
                                    color: isSelected ? 'white' : '#94a3b8',
                                    fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  {isSelected ? '✓' : '+'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Sekce */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Sekce ({textbookContentPlan.sections?.length || 0})
                  </p>
                  <div className="space-y-1.5">
                    {(textbookContentPlan.sections || []).map((section: any, i: number) => {
                      const typeColors: Record<string, string> = {
                        'intro': '#dbeafe', 'reading': '#fef9c3', 'vocabulary': '#fef3c7',
                        'timeline': '#d1fae5', 'summary': '#fce7f3',
                        'exercise-connect-pairs': '#f1f5f9', 'exercise-fill-blank': '#f1f5f9',
                      };
                      const bg = typeColors[section.type] || '#f1f5f9';
                      const isExercise = section.type.startsWith('exercise');
                      return (
                        <div key={i} className="rounded-lg p-2.5" style={{ backgroundColor: bg }}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400 w-5">{i + 1}.</span>
                            <span className="text-xs font-semibold text-slate-700">{section.title}</span>
                            <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${isExercise ? 'bg-slate-200 text-slate-500' : 'bg-white/60 text-slate-400'}`}>
                              {section.type}
                            </span>
                          </div>
                          {section.layoutHint && (
                            <p className="text-xs text-slate-400 ml-7 mt-1">💡 {section.layoutHint}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-3 border-t border-slate-200 flex gap-2 flex-shrink-0">
                <button
                  onClick={() => { setTextbookPlanStep('idle'); setTextbookContentPlan(null); }}
                  style={{
                    padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
                    background: 'white', color: '#64748b', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Zrušit
                </button>
                <button
                  onClick={handleGenerateTextbookDesign}
                  disabled={regeneratingMaterialId !== null}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '8px 12px', borderRadius: 8, border: 'none',
                    backgroundColor: regeneratingMaterialId ? '#fcd34d' : '#d97706',
                    color: 'white', fontSize: 12, fontWeight: 600,
                    cursor: regeneratingMaterialId ? 'not-allowed' : 'pointer',
                  }}
                >
                  {regeneratingMaterialId === 'textbook-design' ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Skládám bloky...</>
                  ) : (
                    <>📐 Složit obsah do bloků</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Sloupec 2: Detail vybraného materiálu + chat */}
          {selectedMat && (
            <div className="flex flex-col bg-white border-r border-slate-200 flex-shrink-0 overflow-hidden" style={{ width: 330 }}>
              <div className="px-4 py-3 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  <div>
                    <h3 className="font-semibold text-slate-800">{selectedMat.title || selectedMat.type}</h3>
                    <p className="text-xs text-slate-500">{selectedMat.type}</p>
                  </div>
                </div>
                <span
                  className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full"
                  style={{
                    backgroundColor: selectedMat.id ? '#dcfce7' : '#fef3c7',
                    color: selectedMat.id ? '#166534' : '#92400e',
                  }}
                >
                  {selectedMat.id ? 'Uloženo' : 'Generuje se...'}
                </span>
              </div>
              <div className="p-3 border-b border-slate-100 flex gap-2 flex-wrap">
                <button
                  onClick={() => handleOpenMaterial(selectedMat)}
                  disabled={!selectedMat.id}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: selectedMat.id ? '#3b82f6' : '#94a3b8',
                    color: 'white',
                    border: 'none',
                    cursor: selectedMat.id ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Eye className="w-4 h-4" />
                  Otevřít
                </button>
                {(selectedMat.type === 'worksheet' || selectedMat.type === 'textbook-page') && selectedMat.id && (
                  <button
                    onClick={() => window.open(`/admin/worksheet-pro/${selectedMat.id}`, '_blank')}
                    title="Otevřít v Pro editoru pracovních listů"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: selectedMat.type === 'textbook-page' ? '#d97706' : '#7c3aed',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✏️ Pro editor
                  </button>
                )}
                {(selectedMat.type === 'worksheet' || selectedMat.type === 'textbook-page') && selectedMat.id && (
                  <button
                    onClick={() => handleAddToRag(selectedMat)}
                    disabled={addingToRag.has(selectedMat.id) || inRag.has(selectedMat.id)}
                    title={inRag.has(selectedMat.id) ? 'Již v RAG databázi' : 'Přidat do RAG knihovny vzorových listů'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: inRag.has(selectedMat.id) ? '#10b981' : '#6d28d9',
                      color: 'white',
                      border: 'none',
                      cursor: (addingToRag.has(selectedMat.id) || inRag.has(selectedMat.id)) ? 'not-allowed' : 'pointer',
                      opacity: addingToRag.has(selectedMat.id) ? 0.7 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {addingToRag.has(selectedMat.id) ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> RAG...</>
                    ) : inRag.has(selectedMat.id) ? (
                      <><Check className="w-3.5 h-3.5" /> V RAG</>
                    ) : (
                      <><Database className="w-3.5 h-3.5" /> Do RAG</>
                    )}
                  </button>
                )}
                <button
                  onClick={() => handleDeleteMaterial(selectedMat, selectedMaterialIndex!)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4">

                {/* ── AI Quality Check materiálu ── */}
                {(() => {
                  const matKey = selectedMat.id || `mat-${selectedMaterialIndex}`;
                  const qr = matQualityResults[matKey];
                  const qColor = !qr ? '#94a3b8' : qr.score >= 80 ? '#22c55e' : qr.score >= 60 ? '#f59e0b' : '#ef4444';

                  const handleMatQC = async () => {
                    if (!selectedMat.id) { toast.error('Materiál nemá ID'); return; }
                    setMatQualityChecking(true);
                    addLog(`🔍 QC: ${selectedMat.title || selectedMat.type}...`);
                    try {
                      // Načteme preview obsah materiálu dle typu
                      let contentSummary = selectedMat.preview || '';
                      if (!contentSummary && selectedMat.id) {
                        if (selectedMat.type === 'worksheet' || selectedMat.type === 'textbook-page') {
                          const { data } = await supabase.from('worksheets').select('title, blocks').eq('id', selectedMat.id).single();
                          if (data) contentSummary = `Název: ${data.title}\nBloky: ${JSON.stringify(data.blocks?.slice(0, 5))}`;
                        } else if (selectedMat.type === 'board-easy' || selectedMat.type === 'board-hard' || selectedMat.type === 'test') {
                          const { data } = await supabase.from('quizzes').select('title, slides').eq('id', selectedMat.id).single();
                          if (data) contentSummary = `Název: ${data.title}\nSlidy: ${JSON.stringify(data.slides?.slice(0, 5))}`;
                        } else if (selectedMat.type === 'text' || selectedMat.type === 'methodology') {
                          const { data } = await supabase.from('library_content').select('title, content').eq('id', selectedMat.id).single();
                          if (data) contentSummary = `Název: ${data.title}\nObsah: ${String(data.content || '').slice(0, 600)}`;
                        }
                      }
                      const { chatWithAIProxy } = await import('../../utils/ai-chat-proxy');
                      const prompt = `Jsi pedagog hodnotící kvalitu vzdělávacího materiálu pro ${selectedDataSet.grade}. třídu ZŠ.

Typ materiálu: ${selectedMat.type}
Téma: "${selectedDataSet.topic}"
Předmět: ${selectedDataSet.subject_code}
Bloom úroveň datasetu: ${selectedDataSet.bloom_level || 'neuvedena'}

Obsah/preview materiálu:
${contentSummary || '(preview není k dispozici – zhodnoť dle typu a tématu)'}

Proveď pedagogickou kontrolu. Odpověz jako JSON:
{
  "score": 0-100,
  "flags": ["problém1", "problém2"],
  "positives": ["silná stránka"],
  "pedagogicalValue": 0-100,
  "ageAppropriateness": 0-100,
  "engagement": 0-100,
  "suggestion": "Krátký konkrétní návrh na zlepšení"
}
Vrať POUZE JSON.`;
                      const resp = await chatWithAIProxy([{ role: 'user', content: prompt }], 'gemini-3-flash');
                      const m = resp.match(/\{[\s\S]*\}/);
                      if (!m) throw new Error('Neplatná odpověď AI');
                      const result = JSON.parse(m[0]);
                      setMatQualityResults(prev => ({ ...prev, [matKey]: result }));
                      addLog(`✅ QC materiálu: ${result.score}%`, result.score >= 70 ? 'success' : 'warning');
                      toast.success(`Skóre materiálu: ${result.score}%`);
                    } catch (err: any) {
                      addLog(`❌ QC chyba: ${err.message}`, 'error');
                      toast.error('Quality Check selhal');
                    } finally {
                      setMatQualityChecking(false);
                    }
                  };

                  return (
                    <div style={{ padding: '12px 14px', background: qr ? (qr.score >= 80 ? '#f0fdf4' : qr.score >= 60 ? '#fffbeb' : '#fef2f2') : '#f8fafc', borderRadius: 12, border: `1px solid ${qColor}33` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: qr ? 8 : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>🔍 AI Quality Check</span>
                          {qr && <span style={{ fontSize: 22, fontWeight: 800, color: qColor, lineHeight: 1 }}>{qr.score}%</span>}
                        </div>
                        <button
                          onClick={handleMatQC}
                          disabled={matQualityChecking}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: 'none', backgroundColor: '#0f172a', color: 'white', fontSize: 11, fontWeight: 600, cursor: matQualityChecking ? 'not-allowed' : 'pointer', opacity: matQualityChecking ? 0.6 : 1 }}
                        >
                          {matQualityChecking ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertCircle className="w-3 h-3" />}
                          {qr ? 'Znovu' : 'Zkontrolovat'}
                        </button>
                      </div>
                      {qr && (
                        <>
                          {qr.flags?.length > 0 && qr.flags.map((f: string, i: number) => (
                            <div key={i} style={{ fontSize: 11, color: '#dc2626', display: 'flex', gap: 5, marginBottom: 2 }}>⚠️ {f}</div>
                          ))}
                          {qr.positives?.length > 0 && qr.positives.map((p: string, i: number) => (
                            <div key={i} style={{ fontSize: 11, color: '#16a34a', display: 'flex', gap: 5, marginBottom: 2 }}>✓ {p}</div>
                          ))}
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            {[
                              { label: 'Pedagog.', val: qr.pedagogicalValue },
                              { label: 'Věk', val: qr.ageAppropriateness },
                              { label: 'Zapojení', val: qr.engagement },
                            ].filter(x => x.val !== undefined).map(({ label, val }) => (
                              <div key={label} style={{ flex: 1, background: 'white', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                                <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: val >= 80 ? '#22c55e' : val >= 60 ? '#f59e0b' : '#ef4444' }}>{val}%</div>
                              </div>
                            ))}
                          </div>
                          {qr.suggestion && (
                            <div style={{ marginTop: 8, padding: '6px 10px', background: '#f0f9ff', borderRadius: 8, fontSize: 11, color: '#0369a1', borderLeft: '3px solid #38bdf8' }}>
                              💡 {qr.suggestion}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* ── Zpětná vazba pro přegenerování ── */}
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-2">💬 Zpětná vazba pro přegenerování</div>
                  <textarea
                    value={materialFeedback}
                    onChange={(e) => setMaterialFeedback(e.target.value)}
                    placeholder="Např: Chci víc interaktivních prvků, kratší texty, jednodušší jazyk..."
                    className="w-full p-3 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
                    rows={4}
                  />
                  <button
                    onClick={() => handleRegenerateMaterial(selectedMat, selectedMaterialIndex!)}
                    disabled={!materialFeedback.trim() || regeneratingMaterialId === (selectedMat.id || `mat-${selectedMaterialIndex}`)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '8px', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                      backgroundColor: (!materialFeedback.trim() || regeneratingMaterialId) ? '#a78bfa' : '#8b5cf6',
                      color: 'white', border: 'none',
                      cursor: (!materialFeedback.trim() || regeneratingMaterialId) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {regeneratingMaterialId === (selectedMat.id || `mat-${selectedMaterialIndex}`) ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Generuji...</>
                    ) : (
                      <><RotateCcw className="w-4 h-4" />Přegenerovat</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sloupec 3: Wizard Lekce – návrh témat + chat pro popis */}
          {lessonWizardOpen && (
            <div className="flex flex-col bg-white border-r border-slate-200 flex-shrink-0 overflow-hidden" style={{ width: 330 }}>
              <div className="px-4 py-3 border-b border-slate-200 bg-indigo-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-indigo-800 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Generovat lekci (E-U-R)
                  </h3>
                  <button
                    onClick={() => setLessonWizardOpen(false)}
                    className="p-1 rounded hover:bg-indigo-100 text-slate-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 mt-1">Popiš lekci a vyber témata – podklady (kompetence a fakta) se berou z DataSetu.</p>
              </div>
              <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4">
                {/* Chat / popis lekce – nahoru */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Popis lekce (zpětná vazba pro AI):</p>
                  <textarea
                    value={lessonDescription}
                    onChange={(e) => setLessonDescription(e.target.value)}
                    placeholder="Např: Zaměř se na porovnání Athén a Sparty, důraz na E-U-R fáze, 2. stupeň ZŠ..."
                    className="w-full p-3 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    rows={4}
                  />
                </div>
                {/* Podklady: klíčové kompetence a klíčová fakta – stejný UX jako témata, v základu vše off */}
                {(() => {
                  const rvp = selectedDataSet.rvp as any;
                  const competencies = Array.isArray(rvp?.competencies) ? rvp.competencies : (Array.isArray(rvp?.keyCompetencies) ? rvp.keyCompetencies : []);
                  const keyFacts = toStrArr(selectedDataSet.content?.keyFacts);
                  return (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-2">Klíčové kompetence:</p>
                        {competencies.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {competencies.map((c: string, i: number) => {
                              const isChecked = lessonSelectedCompetencies.has(i);
                              return (
                                <label
                                  key={i}
                                  className={`
                                    inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-sm break-words max-w-full
                                    ${isChecked ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600'}
                                  `}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setLessonSelectedCompetencies(prev => {
                                        const next = new Set(prev);
                                        if (next.has(i)) next.delete(i);
                                        else next.add(i);
                                        return next;
                                      });
                                    }}
                                    className="rounded border-slate-300 shrink-0"
                                  />
                                  <span>{c}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">V DataSetu nejsou vyplněné kompetence.</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-2">Klíčová fakta:</p>
                        {keyFacts.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {keyFacts.map((f: string, i: number) => {
                              const isChecked = lessonSelectedFacts.has(i);
                              return (
                                <label
                                  key={i}
                                  className={`
                                    inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-sm break-words max-w-full
                                    ${isChecked ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600'}
                                  `}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setLessonSelectedFacts(prev => {
                                        const next = new Set(prev);
                                        if (next.has(i)) next.delete(i);
                                        else next.add(i);
                                        return next;
                                      });
                                    }}
                                    className="rounded border-slate-300 shrink-0"
                                  />
                                  <span>{toStr(f)}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">V DataSetu nejsou vyplněná fakta.</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-2">Navržená témata z DataSetu:</p>
                        <div className="flex flex-wrap gap-2">
                          {lessonSuggestedTopics.map((topic: string) => {
                            const isChecked = lessonSelectedTopics.has(topic);
                            return (
                              <label
                                key={topic}
                                className={`
                                  inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-sm break-words max-w-full
                                  ${isChecked ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600'}
                                `}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setLessonSelectedTopics(prev => {
                                      const next = new Set(prev);
                                      if (next.has(topic)) next.delete(topic);
                                      else next.add(topic);
                                      return next;
                                    });
                                  }}
                                  className="rounded border-slate-300 shrink-0"
                                />
                                <span>{topic}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {lessonJustGenerated ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
                      ✓ Lekce přidána do seznamu. Vygeneruj další nebo zavři.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setLessonJustGenerated(false);
                          setLessonDescription('');
                          setLessonSelectedTopics(new Set());
                          setLessonSelectedCompetencies(new Set());
                          setLessonSelectedFacts(new Set());
                        }}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '10px 16px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: '#6366f1',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <Sparkles className="w-4 h-4" />
                        Generovat další lekci
                      </button>
                      <button
                        onClick={() => {
                          setLessonWizardOpen(false);
                          setLessonJustGenerated(false);
                        }}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: '#64748b',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Hotovo
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setGeneratingLesson(true);
                      addLog('⏳ Generuji lekci (E-U-R)...');
                      try {
                        const { generateFromDataSet } = await import('../../utils/dataset/material-generators');
                        const rvpPayload = selectedDataSet.rvp as any;
                        const competenciesPayload = Array.isArray(rvpPayload?.competencies) ? rvpPayload.competencies : (Array.isArray(rvpPayload?.keyCompetencies) ? rvpPayload.keyCompetencies : []);
                        const keyFactsPayload = toStrArr(selectedDataSet.content?.keyFacts);
                        const dataSet = {
                          id: selectedDataSet.id,
                          topic: selectedDataSet.topic,
                          subjectCode: selectedDataSet.subject_code,
                          grade: selectedDataSet.grade,
                          status: selectedDataSet.status,
                          rvp: {
                            ...(selectedDataSet.rvp || {}),
                            competencies: lessonSelectedCompetencies.size > 0
                              ? competenciesPayload.filter((_: string, i: number) => lessonSelectedCompetencies.has(i))
                              : [],
                          },
                          targetGroup: {},
                          content: {
                            ...(selectedDataSet.content || {}),
                            keyFacts: lessonSelectedFacts.size > 0
                              ? keyFactsPayload.filter((_: string, i: number) => lessonSelectedFacts.has(i))
                              : [],
                            lessonBrief: lessonDescription || undefined,
                            lessonTopics: Array.from(lessonSelectedTopics),
                          },
                          media: selectedDataSet.media || {},
                          generatedMaterials: selectedDataSet.generated_materials || [],
                          createdAt: selectedDataSet.created_at,
                          updatedAt: selectedDataSet.updated_at,
                        };
                        const lessonFolderId = await ensureDatasetFolder();
                        const result = await generateFromDataSet(dataSet, 'lessons', undefined, lessonFolderId);
                        if (result.success && result.id) {
                          const lessonCount = (selectedDataSet.generated_materials || []).filter((m: any) => m.type === 'lessons').length + 1;
                          const subtitle = result.preview?.split('\n')[1]?.replace(/^\d+\.\s*/, '').split(' (')[0]?.trim();
                          const newMaterial = {
                            id: result.id,
                            type: 'lessons',
                            title: subtitle ? `${selectedDataSet.topic} - ${subtitle}` : `${selectedDataSet.topic} - Lekce (E-U-R) ${lessonCount}`,
                            preview: result.preview,
                            status: 'draft',
                            createdAt: new Date().toISOString(),
                          };
                          
                          const { data: freshRow } = await supabase
                            .from('topic_data_sets')
                            .select('generated_materials')
                            .eq('id', selectedDataSet.id)
                            .single();
                          const freshMaterials = freshRow?.generated_materials || [];
                          const updatedMaterials = [...freshMaterials, newMaterial];
                          
                          const { error: saveErr } = await supabase
                            .from('topic_data_sets')
                            .update({ generated_materials: updatedMaterials })
                            .eq('id', selectedDataSet.id);
                          if (saveErr) console.error('[Lessons] Save error:', saveErr);
                          
                          setSelectedDataSet((prev: any) => ({
                            ...prev,
                            generated_materials: updatedMaterials
                          }));
                          setLessonJustGenerated(true);
                          addLog('✅ Lekce vygenerována', 'success');
                          toast.success('Lekce přidána. Můžeš vygenerovat další.');
                        } else {
                          throw new Error(result.error || 'Generování selhalo');
                        }
                      } catch (err: any) {
                        addLog(`❌ Lekce: ${err.message}`, 'error');
                        toast.error(err.message);
                      } finally {
                        setGeneratingLesson(false);
                      }
                    }}
                    disabled={generatingLesson}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      backgroundColor: generatingLesson ? '#a78bfa' : '#6366f1',
                      color: 'white',
                      border: 'none',
                      cursor: generatingLesson ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {generatingLesson ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generuji lekci...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Generovat lekci</>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      );
    }
    
    if (section === 'gallery') {
      const loadGallery = async (search: string) => {
        setGalleryLoading(true);
        try {
          let query = supabase
            .from('topic_data_sets')
            .select('id, topic, subject_code, grade, media')
            .not('media', 'is', null)
            .neq('id', selectedDataSet.id) // vyloučit aktuální dataset
            .order('updated_at', { ascending: false })
            .limit(50);

          if (search.trim()) {
            query = query.ilike('topic', `%${search.trim()}%`);
          }

          const { data } = await query;
          const result: typeof galleryImages = [];
          for (const ds of data || []) {
            const media = ds.media as any;
            if (!media) continue;
            const topic = ds.topic || '';
            const keywords = (selectedDataSet.content?.keyTerms || []).map((t: any) => (typeof t === 'object' ? t.term : t) as string);

            const illustrations: any[] = media.generatedIllustrations || [];
            const photos: any[] = media.generatedPhotos || [];

            for (const ill of illustrations) {
              if (!ill?.url) continue;
              const name = ill.name || ill.title || 'Ilustrace';
              if (search.trim() && !name.toLowerCase().includes(search.toLowerCase()) && !topic.toLowerCase().includes(search.toLowerCase())) continue;
              result.push({ url: ill.url, name, type: 'illustration', topic, dataSetId: ds.id });
            }
            for (const photo of photos) {
              if (!photo?.url) continue;
              const name = photo.name || photo.title || 'Fotka';
              if (search.trim() && !name.toLowerCase().includes(search.toLowerCase()) && !topic.toLowerCase().includes(search.toLowerCase())) continue;
              result.push({ url: photo.url, name, type: 'photo', topic, dataSetId: ds.id });
            }
          }
          setGalleryImages(result);
        } catch (err) {
          console.error('[Gallery] Error:', err);
          setGalleryImages([]);
        } finally {
          setGalleryLoading(false);
        }
      };

      if (galleryImages.length === 0 && !galleryLoading) {
        // První načtení — automaticky hledej podle tématu
        loadGallery(selectedDataSet.topic.split(' ')[0] || '');
      }

      const filtered = galleryTypeFilter === 'all' ? galleryImages : galleryImages.filter(img => img.type === galleryTypeFilter);

      const handleAddToDataset = async (img: typeof galleryImages[0]) => {
        const { data: freshData } = await supabase.from('topic_data_sets').select('media').eq('id', selectedDataSet.id).single();
        const freshMedia = (freshData?.media || {}) as any;
        const galleryList: any[] = freshMedia.galleryImages || [];
        if (galleryList.find((g: any) => g.url === img.url)) {
          toast.info('Obrázek je již v datasetu');
          return;
        }
        const newList = [...galleryList, { url: img.url, name: img.name, type: img.type, topic: img.topic, addedAt: new Date().toISOString() }];
        const newMedia = stripBase64FromObject({ ...freshMedia, galleryImages: newList }) as any;
        await supabase.from('topic_data_sets').update({ media: newMedia }).eq('id', selectedDataSet.id);
        setSelectedDataSet((prev: any) => ({ ...prev, media: newMedia }));
        toast.success(`✓ "${img.name}" přidáno do datasetu`);
      };

      return (
        <div className="flex flex-col h-full">
          {/* Search + filter */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6b21a8', marginBottom: 2 }}>🖼️ Z galerie ({filtered.length})</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={gallerySearch}
                onChange={e => {
                  setGallerySearch(e.target.value);
                  clearTimeout((window as any).__galleryTimer);
                  (window as any).__galleryTimer = setTimeout(() => loadGallery(e.target.value), 400);
                }}
                placeholder="Hledat téma nebo název…"
                style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <button onClick={() => loadGallery(gallerySearch)} style={{ padding: '6px 10px', background: '#6b21a8', color: 'white', border: 'none', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                🔍
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'illustration', 'photo'] as const).map(t => (
                <button key={t} onClick={() => setGalleryTypeFilter(t)} style={{ padding: '3px 9px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: galleryTypeFilter === t ? '#6b21a8' : '#f1f5f9', color: galleryTypeFilter === t ? 'white' : '#475569' }}>
                  {t === 'all' ? 'Vše' : t === 'illustration' ? '🎨 Ilustrace' : '📷 Fotky'}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {galleryLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#9333ea' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🖼️</div>
                Žádné obrázky nenalezeny
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {filtered.map((img, i) => (
                  <div key={i} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 10, overflow: 'hidden', background: '#f1f5f9', cursor: 'pointer', border: '2px solid transparent' }}
                    onClick={() => handleAddToDataset(img)}
                    title={`${img.name} — ${img.topic}\nKlikni pro přidání do datasetu`}
                  >
                    <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)', opacity: 0, transition: 'opacity .15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                    >
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px' }}>
                        <div style={{ color: 'white', fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.topic}</div>
                      </div>
                    </div>
                    <div style={{ position: 'absolute', top: 4, right: 4, background: img.type === 'illustration' ? 'rgba(147,51,234,0.85)' : 'rgba(245,158,11,0.85)', borderRadius: 4, padding: '1px 5px', fontSize: 9, color: 'white', fontWeight: 700 }}>
                      {img.type === 'illustration' ? '🎨' : '📷'}
                    </div>
                    {/* "přidat" tlačítko */}
                    <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(34,197,94,0.9)', borderRadius: 4, padding: '2px 6px', fontSize: 9, color: 'white', fontWeight: 700 }}>
                      + Přidat
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Přidané obrázky z galerie */}
            {(selectedDataSet.media?.galleryImages || []).length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8 }}>✓ Přidáno do datasetu ({(selectedDataSet.media?.galleryImages || []).length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(selectedDataSet.media?.galleryImages || []).map((img: any, i: number) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: '#f1f5f9' }}>
                      <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      <button
                        onClick={async () => {
                          const { data: freshData } = await supabase.from('topic_data_sets').select('media').eq('id', selectedDataSet.id).single();
                          const freshMedia = (freshData?.media || {}) as any;
                          const newList = (freshMedia.galleryImages || []).filter((_: any, idx: number) => idx !== i);
                          const newMedia = stripBase64FromObject({ ...freshMedia, galleryImages: newList }) as any;
                          await supabase.from('topic_data_sets').update({ media: newMedia }).eq('id', selectedDataSet.id);
                          setSelectedDataSet((prev: any) => ({ ...prev, media: newMedia }));
                        }}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: 4, color: 'white', fontSize: 10, cursor: 'pointer', padding: '1px 5px', fontWeight: 700 }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // ── Galerie — vyhledávání existujících AI obrázků z jiných datasetů ──
    if (section === 'gallery') {
      const loadGallery = async (searchTerm: string) => {
        setGalleryLoading(true);
        try {
          let query = supabase
            .from('topic_data_sets')
            .select('id, topic, subject_code, grade, media')
            .not('media', 'is', null)
            .neq('id', selectedDataSet.id) // vyloučit aktuální dataset
            .order('updated_at', { ascending: false })
            .limit(50);
          if (searchTerm.trim()) {
            query = query.ilike('topic', `%${searchTerm.trim()}%`);
          }
          const { data } = await query;
          const result: typeof galleryImages = [];
          for (const ds of data || []) {
            const media = ds.media as any;
            if (!media) continue;
            for (const ill of (media.generatedIllustrations || [])) {
              if (!ill?.url) continue;
              const name = ill.name || ill.title || 'Ilustrace';
              if (searchTerm.trim() && !name.toLowerCase().includes(searchTerm.toLowerCase()) && !ds.topic.toLowerCase().includes(searchTerm.toLowerCase())) continue;
              result.push({ url: ill.url, name, type: 'illustration', topic: ds.topic, dataSetId: ds.id });
            }
            for (const photo of (media.generatedPhotos || [])) {
              if (!photo?.url) continue;
              const name = photo.name || photo.title || 'Fotka';
              if (searchTerm.trim() && !name.toLowerCase().includes(searchTerm.toLowerCase()) && !ds.topic.toLowerCase().includes(searchTerm.toLowerCase())) continue;
              result.push({ url: photo.url, name, type: 'photo', topic: ds.topic, dataSetId: ds.id });
            }
          }
          setGalleryImages(result);
        } catch (err) {
          console.error('[Gallery] Error:', err);
        } finally {
          setGalleryLoading(false);
        }
      };

      const handleAddFromGallery = async (img: typeof galleryImages[0]) => {
        const entry = { id: `gallery-${Date.now()}`, name: img.name, url: img.url, fromGallery: true, sourceTopic: img.topic };
        const { data: freshData } = await supabase.from('topic_data_sets').select('media').eq('id', selectedDataSet.id).single();
        const freshMedia = freshData?.media || {};
        const key = img.type === 'illustration' ? 'generatedIllustrations' : 'generatedPhotos';
        const updated = [...(freshMedia[key] || []), entry];
        const mergedMedia = stripBase64FromObject({ ...freshMedia, [key]: updated }) as Record<string, any>;
        await supabase.from('topic_data_sets').update({ media: mergedMedia }).eq('id', selectedDataSet.id);
        setSelectedDataSet((prev: any) => ({ ...prev, media: mergedMedia }));
        toast.success(`"${img.name}" přidáno do datasetu`);
      };

      const filteredGallery = galleryTypeFilter === 'all' ? galleryImages : galleryImages.filter(img => img.type === galleryTypeFilter);

      return (
        <div className="flex flex-col h-full">
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', background: '#fdf4ff', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a21caf', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles className="w-3.5 h-3.5" /> AI Galerie — obrázky z ostatních datasetů
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search className="w-4 h-4" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input
                type="text"
                value={gallerySearch}
                onChange={e => {
                  setGallerySearch(e.target.value);
                  loadGallery(e.target.value);
                }}
                onFocus={() => { if (galleryImages.length === 0) loadGallery(''); }}
                placeholder="Hledat podle tématu nebo názvu…"
                style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: '1px solid #e9d5ff', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Type filter */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['all', 'illustration', 'photo'] as const).map(t => (
                <button key={t} onClick={() => setGalleryTypeFilter(t)} style={{
                  padding: '3px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: galleryTypeFilter === t ? '#a21caf' : '#f3e8ff',
                  color: galleryTypeFilter === t ? 'white' : '#7e22ce',
                }}>
                  {t === 'all' ? '🖼️ Vše' : t === 'illustration' ? '🎨 Ilustrace' : '📷 Fotky'}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8', alignSelf: 'center' }}>
                {filteredGallery.length} obrázků
              </span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {galleryLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#a21caf' }} />
              </div>
            ) : filteredGallery.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                <Sparkles className="w-12 h-12 mx-auto mb-3" style={{ opacity: 0.3 }} />
                <p style={{ fontSize: 13, fontWeight: 500 }}>
                  {gallerySearch ? 'Žádné výsledky' : 'Klikni do vyhledávání pro načtení galerie'}
                </p>
                <p style={{ fontSize: 11, marginTop: 4 }}>Obrázky se generují v Ilustrace a Fotky sekcích</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {filteredGallery.map((img, i) => (
                  <div key={`${img.dataSetId}-${i}`} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', cursor: 'pointer', border: '2px solid transparent', transition: 'border-color .15s' }}
                    onClick={() => handleAddFromGallery(img)}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#a21caf')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                    title={`${img.name}\nTéma: ${img.topic}\nKlik = přidat do datasetu`}
                  >
                    <img src={img.url} alt={img.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} loading="lazy" />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)', opacity: 0, transition: 'opacity .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                    >
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 6px' }}>
                        <p style={{ color: 'white', fontSize: 10, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name}</p>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.topic}</p>
                      </div>
                    </div>
                    <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 10, padding: '2px 5px', borderRadius: 4, fontWeight: 700,
                      background: img.type === 'illustration' ? 'rgba(147,51,234,0.85)' : 'rgba(245,158,11,0.85)', color: 'white' }}>
                      {img.type === 'illustration' ? '🎨' : '📷'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 text-slate-400 text-center">
        Sekce "{section}" - TODO
      </div>
    );
  };
  
  // =====================================================
  // RENDER
  // =====================================================
  
  return (
    <>
    <div className="flex h-screen bg-slate-100 overflow-x-auto">
      {/* Settings Column */}
      <SettingsColumn
        selectedSubject={selectedSubject}
        selectedGrade={selectedGrade}
        onSubjectChange={(s) => {
          setSelectedSubject(s);
          setSelectedAgentId(null);
          setSelectedRvpId(null);
          setSelectedPlanId(null);
          setSelectedDataSet(null);
          setSelectedDataSetSection(null);
          setSelectedGroupId(null);
        }}
        onGradeChange={(g) => {
          setSelectedGrade(g);
          setSelectedAgentId(null);
          setSelectedRvpId(null);
          setSelectedPlanId(null);
          setSelectedDataSet(null);
          setSelectedDataSetSection(null);
          setSelectedGroupId(null);
        }}
        agents={agents}
        selectedAgentId={selectedAgentId}
        onAgentSelect={(agent) => {
          // Vymaž výběry ostatních agentů — jinak sloupce visí přes sebe
          setSelectedAgentId(agent.id);
          setSelectedRvpId(null);
          setSelectedPlanId(null);
          setSelectedDataSet(null);
          setSelectedDataSetSection(null);
          setSelectedGroupId(null);
          loadRvpAndPlans();
        }}
        onRunPipeline={runPipeline}
        isRunning={isRunning}
      />
      
      {/* Agent Output Column (or Gantt) */}
      {selectedAgentId && (() => {
        const agent = agents.find(a => a.id === selectedAgentId);
        const isRvp = agent?.outputType === 'rvp';
        const isPlans = agent?.outputType === 'plans';
        const isDatasets = agent?.outputType === 'datasets';
        const isGrouped = isDatasets && dsGroupMap.size > 0;
        const selectedItemId = isRvp ? selectedRvpId : isPlans ? selectedPlanId : (selectedDataSet?.id || null);

        // Toolbar actions pro Column header
        const datasetActions = isDatasets ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={handleAddMilestones} disabled={isMilestonesRunning}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 6, border: '1px solid #fde68a', background: isMilestonesRunning ? '#fef3c7' : '#fffbeb', color: '#92400e', fontSize: 10, fontWeight: 700, cursor: isMilestonesRunning ? 'not-allowed' : 'pointer' }}>
              {isMilestonesRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
            </button>
            {dataSets.some(ds => ds.milestone) && (
              <button onClick={handleGroupDatasets}
                style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 7px', borderRadius: 6, border: '1px solid #e2e8f0', background: dsGroupMap.size > 0 ? '#f0fdf4' : '#f8fafc', color: dsGroupMap.size > 0 ? '#166534' : '#475569', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                <Folder className="w-3 h-3" />
              </button>
            )}
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              <button onClick={() => setDataCollectorView('list')}
                style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: dataCollectorView === 'list' ? '#0f172a' : '#f8fafc', color: dataCollectorView === 'list' ? 'white' : '#64748b' }}>
                ☰
              </button>
              <button onClick={() => setDataCollectorView('gantt')}
                style={{ padding: '3px 8px', fontSize: 10, fontWeight: 500, border: 'none', cursor: 'pointer', backgroundColor: dataCollectorView === 'gantt' ? '#0f172a' : '#f8fafc', color: dataCollectorView === 'gantt' ? 'white' : '#64748b' }}>
                📅
              </button>
            </div>
          </div>
        ) : undefined;

        // Skupinový Gantt – celá šířka
        if (isGrouped && dataCollectorView === 'gantt') {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', width: 900, flexShrink: 0, borderRight: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: 'white', flexShrink: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>Obsahové bloky – {getGroupItems().length} skupin</span>
                {datasetActions}
              </div>
              {renderGroupGanttView()}
            </div>
          );
        }

        // Flat dataset Gantt (bez seskupení)
        if (!isGrouped && isDatasets && dataCollectorView === 'gantt') {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', width: 900, flexShrink: 0, borderRight: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: 'white', flexShrink: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>Data Collector – {dataSets.length} datasetů</span>
                {datasetActions}
              </div>
              {renderGanttView()}
            </div>
          );
        }

        // Seznam – skupinový mód: Groups Column (flat column se schová)
        if (isGrouped) {
          return (
            <Column
              title="Obsahové bloky"
              items={getGroupItems()}
              selectedId={selectedGroupId}
              onSelect={(item) => { setSelectedGroupId(item.id); setSelectedDataSet(null); setSelectedDataSetSection(null); }}
              loading={dataSetsLoading}
              emptyMessage="Žádné skupiny"
              badge={getGroupItems().length}
              actions={datasetActions}
            />
          );
        }

        // Seznam – flat mód
        return (
          <Column
            title={agent?.name || 'Výstup'}
            items={getAgentOutputItems()}
            selectedId={selectedItemId}
            onSelect={(item) => {
              if (item.type === 'header') return;
              if (isRvp) { setSelectedRvpId(item.id); setSelectedDataSet(null); }
              else if (isPlans) { setSelectedPlanId(item.id); setSelectedDataSet(null); }
              else {
                setSelectedDataSet(item.data ? { ...item.data, media: undefined } : item.data);
                setSelectedDataSetSection(null);
                setSelectedRvpId(null);
                setSelectedPlanId(null);
                setChartSuggestions([]);
                setMapSuggestions([]);
              }
            }}
            loading={dataSetsLoading}
            emptyMessage={isRvp || isPlans ? 'Spusť pipeline pro načtení dat' : 'Žádná data'}
            badge={getAgentOutputItems().length}
            actions={isDatasets ? datasetActions : undefined}
          />
        );
      })()}

      {/* Detail – RVP téma */}
      {selectedRvpId && (() => {
        const item = rvpItems.find(r => r.id === selectedRvpId);
        if (!item) return null;
        return (
          <div className="bg-white overflow-y-auto flex-shrink-0 border-l border-slate-200" style={{ width: 360, padding: 24 }}>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-slate-800 text-base leading-tight">{item.topic}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 font-medium uppercase tracking-wide">{item.thematic_area}</p>
            {item.expected_outcomes?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-600 mb-2">Očekávané výstupy ({item.expected_outcomes.length})</p>
                <ul className="space-y-1.5">
                  {item.expected_outcomes.map((o: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>{o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {item.key_competencies?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-600 mb-2">Klíčové kompetence</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.key_competencies.map((c: string, i: number) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="text-xs text-slate-400 mt-4">Doporučeno hodin: <strong>{item.recommended_hours || '–'}</strong></div>
          </div>
        );
      })()}

      {/* Detail – týdenní plán */}
      {selectedPlanId && (() => {
        const item = weeklyPlanItems.find(p => p.id === selectedPlanId);
        if (!item) return null;
        return (
          <div className="bg-white overflow-y-auto flex-shrink-0 border-l border-slate-200" style={{ width: 400, padding: 24 }}>
            {/* Hlavička */}
            <div className="flex items-start gap-2 mb-1">
              <Calendar className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800 text-base leading-snug">{item.topic_title || item.topic}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Týden {item.week_number}{(item.month_name || item.month) ? ` – ${item.month_name || item.month}` : ''}
                </p>
              </div>
              <span className="flex-shrink-0 text-xs px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full font-medium">{item.hours_allocated} h</span>
            </div>

            {/* Bloom level badge */}
            {item.learning_unit?.bloom_level && (() => {
              const bloomConfig: Record<string, { label: string; color: string }> = {
                remember:  { label: '🧠 Zapamatovat',  color: 'bg-slate-100 text-slate-600' },
                understand:{ label: '💡 Porozumět',    color: 'bg-blue-50 text-blue-700' },
                apply:     { label: '⚙️ Aplikovat',    color: 'bg-green-50 text-green-700' },
                analyze:   { label: '🔍 Analyzovat',   color: 'bg-amber-50 text-amber-700' },
                evaluate:  { label: '⚖️ Hodnotit',     color: 'bg-orange-50 text-orange-700' },
                create:    { label: '✨ Tvořit',        color: 'bg-purple-50 text-purple-700' },
              };
              const cfg = bloomConfig[item.learning_unit.bloom_level] || bloomConfig.remember;
              return (
                <span className={`inline-block mt-2 mb-4 ml-7 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                  {cfg.label}
                </span>
              );
            })()}

            <div className="space-y-5 mt-2">

              {/* Výukové cíle */}
              {(item.learning_unit?.learning_goals || item.learning_goals)?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Výukové cíle</p>
                  <ul className="space-y-1.5">
                    {(item.learning_unit?.learning_goals || item.learning_goals || []).map((o: string, idx: number) => (
                      <li key={idx} className="flex gap-2 text-sm text-slate-700">
                        <span className="text-violet-400 mt-0.5 flex-shrink-0">•</span>{o}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Nové pojmy */}
              {item.learning_unit?.new_concepts?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nové pojmy v této lekci</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.learning_unit.new_concepts.map((c: string, idx: number) => (
                      <span key={idx} className="text-xs px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full border border-violet-100">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Context chain – co bylo před */}
              {item.learning_unit?.already_covered_summary && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Kontext – probráno dříve</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.learning_unit.already_covered_summary}</p>
                </div>
              )}

              {/* Prerekvizity */}
              {item.learning_unit?.prerequisite_concepts?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Předpoklady (z předchozích lekcí)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.learning_unit.prerequisite_concepts.slice(-12).map((c: string, idx: number) => (
                      <span key={idx} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{c}</span>
                    ))}
                    {item.learning_unit.prerequisite_concepts.length > 12 && (
                      <span className="text-xs px-2 py-0.5 text-slate-400">+{item.learning_unit.prerequisite_concepts.length - 12} dalších</span>
                    )}
                  </div>
                </div>
              )}

              {/* Typy materiálů */}
              {item.learning_unit?.material_types?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Typy materiálů k vytvoření</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.learning_unit.material_types.map((m: string, idx: number) => {
                      const icons: Record<string, string> = {
                        explanation_text: '📄 Výklad',
                        vocabulary_cards: '📇 Pojmy',
                        worksheet: '📝 Pracovní list',
                        quiz: '❓ Kvíz',
                        comparison_table: '📊 Srovnání',
                        timeline: '📅 Časová osa',
                        case_study: '🔬 Případová studie',
                        project: '🎯 Projekt',
                      };
                      return (
                        <span key={idx} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                          {icons[m] || m}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pořadí v ročním plánu */}
              {item.learning_unit?.order_global && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    Learning unit #{item.learning_unit.order_global}
                    {item.learning_unit.order_in_topic > 1 && ` · ${item.learning_unit.order_in_topic}. část tématu`}
                    {item.learning_unit.weeks?.length > 1 && ` · ${item.learning_unit.weeks.length} týdnů`}
                  </p>
                </div>
              )}

            </div>
          </div>
        );
      })()}
      
      {/* Datasety ve vybrané skupině */}
      {dsGroupMap.size > 0 && selectedGroupId && agents.find(a => a.id === selectedAgentId)?.outputType === 'datasets' && dataCollectorView === 'list' && (
        <Column
          title={getGroupItems().find(g => g.id === selectedGroupId)?.label ?? 'Datasety'}
          items={getDatasetsInGroup()}
          selectedId={selectedDataSet?.id ?? null}
          onSelect={(item) => {
            if (item.type === 'header') return;
            setSelectedDataSet(item.data ? { ...item.data, media: undefined } : item.data);
            setSelectedDataSetSection(null);
            setChartSuggestions([]);
            setMapSuggestions([]);
          }}
          emptyMessage="Žádné datasety"
          badge={getDatasetsInGroup().length}
        />
      )}

      {/* DataSet Sections Column */}
      {selectedDataSet && (
        <Column
          title={selectedDataSet.topic}
          items={getDataSetSections()}
          selectedId={selectedDataSetSection}
          onSelect={(item) => setSelectedDataSetSection(item.id)}
          emptyMessage="Žádné sekce"
        />
      )}

      {/* Section Detail (nebo při Materiály dva sloupce: seznam + detail) */}
      {selectedDataSet && selectedDataSetSection && selectedDataSetSection !== 'materials' && (
        <div className="bg-white overflow-y-auto flex-shrink-0" style={{ width: 330 }}>
          {getSectionDetail()}
        </div>
      )}
      {selectedDataSet && selectedDataSetSection === 'materials' && getSectionDetail()}
      
      {/* Empty state */}
      {!selectedAgentId && (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <GraduationCap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-600 mb-2">Curriculum Factory</h2>
            <p className="text-slate-400 max-w-md">
              Vyberte předmět a ročník, pak klikněte na agenta pro zobrazení jeho výstupu.
            </p>
          </div>
        </div>
      )}

      {/* Console – vždy poslední sloupec vpravo */}
      <Console
        logs={logs}
        isOpen={consoleOpen}
        onToggle={() => setConsoleOpen(!consoleOpen)}
      />
    </div>

    {/* ── Fullscreen Map Preview Modal ── */}
    {mapPreview && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(6px)' }}
        onClick={() => setMapPreview(null)}
      >
        <div
          style={{ background: 'white', borderRadius: 20, overflow: 'hidden', width: '100%', maxWidth: 1100, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', flexShrink: 0 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>🗺️ {mapPreview.title}</div>
              {mapPreview.description && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{mapPreview.description}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                {mapPreview.region}
              </span>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: '#ede9fe', color: '#6d28d9', fontWeight: 600 }}>
                {mapPreview.exerciseType}
              </span>
              <button
                onClick={() => setMapPreview(null)}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                ✕ Zavřít
              </button>
            </div>
          </div>
          {/* Map body */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <VividMap map={mapPreview} height={620} overlays={mapPreview.overlays} />
          </div>
          {/* Footer: markers list */}
          {(mapPreview.markers || []).length > 0 && (
            <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0, overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {mapPreview.markers.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: m.color ? `${m.color}20` : '#f1f5f9', border: `1px solid ${m.color || '#e2e8f0'}33`, fontSize: 11 }}>
                    <span>{m.icon || '📍'}</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.name}</span>
                    {m.year && <span style={{ color: '#94a3b8' }}>({m.year})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {/* ── Map Editor Modal ── */}
    {mapEdit && selectedDataSet && (
      <MapEditorModal
        map={mapEdit}
        dataSetTopic={selectedDataSet.topic}
        onSave={handleSaveEditedMap}
        onClose={() => setMapEdit(null)}
      />
    )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUGGESTED IMAGE GROUPS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function SuggestedImageGroupsPanel({
  groups,
  onGenerateGroup,
  onDismissGroup,
  onDismissAll,
  generatingIds,
}: {
  groups: ImageGroup[];
  onGenerateGroup: (group: ImageGroup) => void;
  onDismissGroup: (id: string) => void;
  onDismissAll: () => void;
  generatingIds: Set<string>;
}) {
  if (groups.length === 0) return null;
  return (
    <div style={{ margin: '10px 0', borderRadius: 12, border: '2px solid #c4b5fd', background: '#faf5ff', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9' }}>
          💡 Navrhované skupiny ({groups.length})
        </span>
        <button onClick={onDismissAll} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>
          Zavřít vše
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {groups.map(group => {
          const isGen = generatingIds.has(group.id);
          return (
            <div key={group.id} style={{ background: 'white', borderRadius: 9, border: '1px solid #e9d5ff', padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#4c1d95', lineHeight: 1.3 }}>
                  {group.title}
                </div>
                <div style={{ fontSize: 10, color: '#a78bfa' }}>{group.subjects.length} obrázků</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => onGenerateGroup(group)}
                  disabled={isGen}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: isGen ? '#e9d5ff' : '#7c3aed', color: 'white', border: 'none', cursor: isGen ? 'not-allowed' : 'pointer' }}
                >
                  {isGen ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Generovat
                </button>
                <button onClick={() => onDismissGroup(group.id)} style={{ padding: '5px 8px', borderRadius: 7, fontSize: 13, background: '#f1f5f9', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE GROUPS SECTION
// ─────────────────────────────────────────────────────────────────────────────
// IMAGE GROUP TILE — zobrazí se inline v gridu ilustrací/fotek
// ─────────────────────────────────────────────────────────────────────────────
function ImageGroupTile({
  group,
  onGenerateAll,
  onGenerateWide,
  onDelete,
  generating,
  onPreview,
}: {
  group: ImageGroup;
  onGenerateAll: (group: ImageGroup) => void;
  onGenerateWide: (group: ImageGroup) => void;
  onDelete: (groupId: string) => void;
  generating: boolean;
  onPreview: (url: string, label: string) => void;
}) {
  const done = group.subjects.filter(s => s.status === 'done' && s.imageUrl);
  const pending = group.subjects.filter(s => s.status !== 'done' || !s.imageUrl);

  return (
    <div style={{
      gridColumn: 'span 2',
      borderRadius: 12,
      border: '2px solid #c4b5fd',
      backgroundColor: 'white',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ background: '#faf5ff', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e9d5ff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={14} style={{ color: '#7c3aed' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#4c1d95' }}>{group.title}</span>
          <span style={{ fontSize: 10, color: '#a78bfa', background: '#ede9fe', borderRadius: 99, padding: '1px 7px' }}>
            {done.length}/{group.subjects.length}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Generate missing */}
          {pending.length > 0 && (
            <button
              onClick={() => onGenerateWide(group)}
              disabled={generating}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                background: generating ? '#e9d5ff' : '#7c3aed', color: 'white',
                border: 'none', cursor: generating ? 'not-allowed' : 'pointer',
              }}
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Generovat ({pending.length})
            </button>
          )}
          {/* All done badge + regenerate button */}
          {pending.length === 0 && (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', borderRadius: 7, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Sparkles className="w-3 h-3" /> Hotovo
              </span>
              <button
                onClick={() => onGenerateWide(group)}
                disabled={generating}
                title="Přegenerovat vše"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 8px', borderRadius: 7, fontSize: 11,
                  background: generating ? '#f5f3ff' : '#f5f3ff', color: '#7c3aed',
                  border: '1px solid #ddd6fe', cursor: generating ? 'not-allowed' : 'pointer',
                }}
              >
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(group.id)}
            style={{ padding: '4px 8px', borderRadius: 7, background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer' }}
            title="Smazat skupinu"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Images strip */}
      <div style={{ padding: '10px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {group.subjects.map(s => (
          <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 72 }}>
            {s.imageUrl ? (
              <div style={{ position: 'relative', width: 72, height: 72 }}>
                <img
                  src={s.imageUrl}
                  alt={s.name}
                  onClick={() => onPreview(s.imageUrl!, s.name)}
                  style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #e9d5ff', cursor: 'zoom-in', display: 'block' }}
                />
                <button
                  onClick={() => onPreview(s.imageUrl!, s.name)}
                  title="Náhled"
                  style={{
                    position: 'absolute', bottom: 3, right: 3,
                    width: 20, height: 20, borderRadius: 5,
                    background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 11, lineHeight: 1,
                  }}
                >🔍</button>
              </div>
            ) : (
              <div style={{
                width: 72, height: 72, borderRadius: 8,
                background: s.status === 'generating' ? '#ede9fe' : '#f8fafc',
                border: `1.5px dashed ${s.status === 'generating' ? '#a855f7' : '#cbd5e1'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.status === 'generating'
                  ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#a855f7' }} />
                  : <ImageIcon className="w-5 h-5" style={{ color: '#cbd5e1' }} />
                }
              </div>
            )}
            <span style={{ fontSize: 9, color: '#64748b', textAlign: 'center', lineHeight: 1.2, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ImageGroupsSection({ dataSet, onUpdate }: {
  dataSet: any;
  onUpdate: (groups: ImageGroup[]) => void;
}) {
  const groups: ImageGroup[] = dataSet.media?.imageGroups || [];
  const [editingGroup, setEditingGroup] = React.useState<ImageGroup | null>(null);
  const [newGroupTitle, setNewGroupTitle] = React.useState('');
  const [newGroupStyle, setNewGroupStyle] = React.useState('');
  const [newGroupType, setNewGroupType] = React.useState<'illustration' | 'photo' | 'diagram'>('illustration');
  const [newSubjectName, setNewSubjectName] = React.useState('');
  const [generating, setGenerating] = React.useState<string | null>(null); // group id being generated

  const saveGroups = (updated: ImageGroup[]) => {
    onUpdate(updated);
  };

  const createGroup = () => {
    if (!newGroupTitle.trim()) return;
    const group: ImageGroup = {
      id: `ig-${Date.now()}`,
      title: newGroupTitle.trim(),
      stylePrompt: newGroupStyle.trim() || 'educational illustration, white background, consistent style, same scale and detail level',
      type: newGroupType,
      layout: 'gallery',
      subjects: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveGroups([...groups, group]);
    setEditingGroup(group);
    setNewGroupTitle('');
    setNewGroupStyle('');
  };

  const deleteGroup = (id: string) => {
    saveGroups(groups.filter(g => g.id !== id));
    if (editingGroup?.id === id) setEditingGroup(null);
  };

  const addSubject = (group: ImageGroup) => {
    if (!newSubjectName.trim()) return;
    const subject: ImageGroupSubject = {
      id: `subj-${Date.now()}`,
      name: newSubjectName.trim(),
      status: 'pending',
    };
    const updated = groups.map(g => g.id === group.id
      ? { ...g, subjects: [...g.subjects, subject], updatedAt: new Date().toISOString() }
      : g
    );
    saveGroups(updated);
    setEditingGroup(updated.find(g => g.id === group.id) || null);
    setNewSubjectName('');
  };

  const removeSubject = (group: ImageGroup, subjectId: string) => {
    const updated = groups.map(g => g.id === group.id
      ? { ...g, subjects: g.subjects.filter(s => s.id !== subjectId) }
      : g
    );
    saveGroups(updated);
    setEditingGroup(updated.find(g => g.id === group.id) || null);
  };

  const generateGroupImages = async (group: ImageGroup) => {
    const pending = group.subjects.filter(s => s.status === 'pending' || s.status === 'error');
    if (pending.length === 0) return;
    setGenerating(group.id);

    const { generatePhoto } = await import('../../utils/dataset/material-generators');
    const dataSetObj = {
      id: dataSet.id, topic: dataSet.topic, subjectCode: dataSet.subject_code,
      grade: dataSet.grade, status: dataSet.status, rvp: dataSet.rvp || {},
      targetGroup: {}, content: dataSet.content || {}, media: dataSet.media || {},
      generatedMaterials: dataSet.generated_materials || [],
      createdAt: dataSet.created_at, updatedAt: dataSet.updated_at,
    };

    let currentGroups = [...groups];

    for (const subject of pending) {
      // Mark as generating
      currentGroups = currentGroups.map(g => g.id === group.id
        ? { ...g, subjects: g.subjects.map(s => s.id === subject.id ? { ...s, status: 'generating' as const } : s) }
        : g
      );
      saveGroups(currentGroups);

      try {
        const prompt = `${group.stylePrompt}, subject: ${subject.name}${subject.extraPrompt ? ', ' + subject.extraPrompt : ''}`;
        const fakePrompt = { id: subject.id, name: subject.name, prompt, category: group.type as any, keywords: [], status: 'pending' as const };
        const url = await generatePhoto(fakePrompt, dataSetObj as any, 'imagen');

        currentGroups = currentGroups.map(g => g.id === group.id
          ? { ...g, subjects: g.subjects.map(s => s.id === subject.id
              ? { ...s, status: 'done' as const, imageUrl: url || undefined }
              : s) }
          : g
        );
      } catch (e: any) {
        currentGroups = currentGroups.map(g => g.id === group.id
          ? { ...g, subjects: g.subjects.map(s => s.id === subject.id
              ? { ...s, status: 'error' as const, error: e.message }
              : s) }
          : g
        );
      }
      saveGroups(currentGroups);
    }

    setEditingGroup(currentGroups.find(g => g.id === group.id) || null);
    setGenerating(null);
    toast.success(`Generování skupiny "${group.title}" dokončeno`);
  };

  const cardStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0', borderRadius: 10, padding: 12,
    backgroundColor: 'white', marginBottom: 8,
  };
  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300";
  const btnBase: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
  };

  return (
    <div style={{ padding: 12 }}>
      <h3 className="font-semibold text-slate-700 mb-3" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Layers size={16} className="text-orange-500" /> Skupiny obrázků ({groups.length})
      </h3>

      {/* Nová skupina */}
      <div style={{ ...cardStyle, backgroundColor: '#fff7ed', borderColor: '#fed7aa' }}>
        <p className="text-xs font-semibold text-orange-700 uppercase mb-2">Nová skupina</p>
        <input className={inputCls} placeholder="Název skupiny (např. Druhy listnatých keřů)"
          value={newGroupTitle} onChange={e => setNewGroupTitle(e.target.value)} style={{ marginBottom: 6 }} />
        <input className={inputCls} placeholder="Styl promptu (shared style prefix)"
          value={newGroupStyle} onChange={e => setNewGroupStyle(e.target.value)} style={{ marginBottom: 6 }} />
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {(['illustration', 'photo', 'diagram'] as const).map(t => (
            <button key={t} onClick={() => setNewGroupType(t)}
              style={{ ...btnBase, background: newGroupType === t ? '#f97316' : '#f1f5f9', color: newGroupType === t ? 'white' : '#475569' }}>
              {t === 'illustration' ? '🎨' : t === 'photo' ? '📷' : '📊'} {t}
            </button>
          ))}
        </div>
        <button onClick={createGroup}
          style={{ ...btnBase, background: '#f97316', color: 'white', width: '100%', justifyContent: 'center' }}>
          <Plus size={14} /> Vytvořit skupinu
        </button>
      </div>

      {/* Seznam skupin */}
      {groups.map(group => {
        const isEditing = editingGroup?.id === group.id;
        const isGenerating = generating === group.id;
        const doneCount = group.subjects.filter(s => s.status === 'done').length;
        const pendingCount = group.subjects.filter(s => s.status === 'pending' || s.status === 'error').length;

        return (
          <div key={group.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{group.title}</span>
                <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', borderRadius: 4, padding: '1px 5px' }}>
                  {doneCount}/{group.subjects.length}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setEditingGroup(isEditing ? null : group)}
                  style={{ ...btnBase, background: isEditing ? '#e0e7ff' : '#f1f5f9', color: isEditing ? '#4f46e5' : '#475569' }}>
                  {isEditing ? 'Zavřít' : 'Upravit'}
                </button>
                {pendingCount > 0 && (
                  <button onClick={() => generateGroupImages(group)} disabled={isGenerating}
                    style={{ ...btnBase, background: '#f97316', color: 'white', opacity: isGenerating ? 0.7 : 1 }}>
                    {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                    Generovat ({pendingCount})
                  </button>
                )}
                <button onClick={() => deleteGroup(group.id)}
                  style={{ ...btnBase, background: '#fee2e2', color: '#dc2626' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Náhled vygenerovaných obrázků */}
            {group.subjects.filter(s => s.imageUrl).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {group.subjects.map(s => s.imageUrl ? (
                  <div key={s.id} style={{ position: 'relative' }}>
                    <img src={s.imageUrl} alt={s.name}
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} />
                    <div style={{ fontSize: 9, color: '#64748b', textAlign: 'center', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </div>
                  </div>
                ) : null)}
              </div>
            )}

            {/* Editační panel */}
            {isEditing && (
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 4 }}>
                <p className="text-xs text-slate-500 mb-1">Styl: <span className="text-slate-700">{group.stylePrompt}</span></p>

                {/* Subjekty */}
                <p className="text-xs font-semibold text-slate-600 mb-2 mt-3">Subjekty ({group.subjects.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {group.subjects.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 6, padding: '4px 8px' }}>
                      <span style={{ fontSize: 12 }}>
                        {s.status === 'done' ? '✅' : s.status === 'generating' ? '⏳' : s.status === 'error' ? '❌' : '⬜'}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: '#1e293b' }}>{s.name}</span>
                      {s.status === 'done' && s.imageUrl && (
                        <img src={s.imageUrl} alt={s.name} style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} />
                      )}
                      <button onClick={() => removeSubject(group, s.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Přidat subjekt */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className={inputCls} placeholder="Název subjektu (např. Bez černý)"
                    value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addSubject(group); }}
                    style={{ flex: 1 }} />
                  <button onClick={() => addSubject(group)}
                    style={{ ...btnBase, background: '#f97316', color: 'white', flexShrink: 0 }}>
                    <ImagePlus size={12} /> Přidat
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default CurriculumFactoryV2;
