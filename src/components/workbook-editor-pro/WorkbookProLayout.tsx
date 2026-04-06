/**
 * WorkbookProLayout - Hlavní layout pro Workbook Pro editor
 * 
 * Figma-style editor pro správu pracovních sešitů.
 * Nekonečné plátno s dvojstránkami, klik otevře editor listu.
 */

import { useState, useCallback, useMemo, useRef, useEffect, type CSSProperties } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { LAIOUT_BOOKSHELF_PATH } from '../../utils/laiout-routes';
import { supabase } from '../../utils/supabase/client';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  BookOpen,
  Plus,
  Loader2,
  Check,
  ChevronRight,
  Trash2,
  MousePointer2,
  PanelLeftClose,
  PanelLeft,
  List,
  Users,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';

import { InfiniteCanvas } from './InfiniteCanvas';
import { WorkbookSpread } from './WorkbookSpread';
import { ChapterItem, ITEM_TYPES } from './ChapterItem';
import { WorkbookLivePagePreview } from './WorkbookLivePagePreview';
import { VirtualizedWorkbookRow } from './VirtualizedWorkbookRow';
import { ProMiniSidebar } from '../worksheet-editor-pro/ProMiniSidebar';
import { WorkbookInlineLibraryPanel } from './WorkbookInlineLibraryPanel';
import { DesignSystemPanel, type Category as DesignSidebarCategory } from '../worksheet-editor-pro/DesignSystemPanel';
import { DesignSystemCanvasWorkspace } from './DesignSystemCanvasWorkspace';
import { BookAgentPipelineWorkspace } from './BookAgentPipelineWorkspace';
import { DatasetPanel } from '../worksheet-editor-pro/DatasetPanel';
import { WorkbookCollaborationPanel } from './WorkbookCollaborationPanel';
import { BookShareControls } from './BookShareControls';
import { acceptTeacherBookInvite } from '../../utils/supabase/book-sharing';
import {
  fetchBookTeam,
  fetchTeacherDisplaysByUserIds,
  initialsFromDisplayName,
} from '../../utils/supabase/book-collaboration';
import type { DesignSystem } from '../../types/design-system';
import { getDesignSystem } from '../../utils/supabase/design-system-storage';
import {
  Workbook,
  WorkbookPage,
  WorkbookChapter,
  WorkbookSpread as SpreadType,
  createEmptyWorkbook,
  createSpreadsFromPages,
  CHAPTER_COLORS,
  getChapterForPage,
  getChapterStartingAtPage,
} from '../../types/workbook';
import { Worksheet, createEmptyWorksheet } from '../../types/worksheet';
import {
  getWorksheet as getWorksheetLocal,
  loadWorksheetFromSupabase,
  saveWorksheet,
  saveWorksheetAwait,
} from '../../utils/worksheet-storage';
import { deriveWorksheetPageCount } from '../../utils/worksheet-page-count';
import { replaceWorksheetPageSpan } from '../../utils/workbook/replace-worksheet-pages';
import { applyDesignSystemSnapshotToWorksheet } from '../../utils/design-system-sync';
import { syncDesignSystemToBookWorksheets } from '../../utils/supabase/book-design-system-sync';
import { buildStashedProEditorUrlForDesignSystemCustomLayout } from '../../utils/design-system-preview-worksheets';
import { stashWorksheetForEditorSession } from '../../utils/worksheet-editor-runtime';
import {
  buildPageUnitsFromPipelineDataset,
  createWorksheetFromPipelineUnit,
} from '../../utils/workbook-from-pipeline-dataset';

interface WorkbookProLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

type ViewMode =
  | 'canvas'
  | 'covers'
  | 'settings'
  | 'design'
  | 'design2'
  | 'agentPipeline'
  | 'collaboration';
type SettingsTab = 'general' | 'team' | 'dataset';

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * Nastavení knihy — barvy přes inline style (bundlovaný `index.css` bez řady Tailwind utilit).
 * Pozadí = stejné jako levý panel s kapitolami (`aside` v tomto layoutu).
 */
const WORKBOOK_CHAPTER_PANEL_BG = '#1e293b';

const STShellStyle: CSSProperties = {
  backgroundColor: WORKBOOK_CHAPTER_PANEL_BG,
  colorScheme: 'dark',
};
const STCardStyle: CSSProperties = {
  marginBottom: 20,
  borderRadius: 24,
  padding: 24,
  border: '1px solid #334155',
  backgroundColor: '#0f172a',
  boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.04)',
};

/** V `index.css` chybí `w-14` / `py-9` — výsledkem byl „pilulkový“ avatar a titulky nalepené nahoru. */
const STInnerStyle: CSSProperties = {
  paddingTop: 40,
  paddingBottom: 96,
  paddingLeft: 24,
  paddingRight: 24,
};

const TEAM_MEMBER_COL_STYLE: CSSProperties = {
  width: 128,
  minWidth: 128,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  textAlign: 'center',
};

function teamAvatarStyle(hueVar: string): CSSProperties {
  return {
    width: 56,
    height: 56,
    minWidth: 56,
    minHeight: 56,
    flexShrink: 0,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: '#ffffff',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.25)',
    border: '2px solid rgba(51, 65, 85, 0.85)',
    backgroundColor: `hsl(${hueVar} 48% 42%)`,
  };
}
const STFieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: 14,
  lineHeight: 1.45,
  color: '#f1f5f9',
  backgroundColor: WORKBOOK_CHAPTER_PANEL_BG,
  border: '1px solid #475569',
  outline: 'none',
};
const STCheckRowStyle: CSSProperties = {
  border: '1px solid #334155',
  backgroundColor: 'rgba(15, 23, 42, 0.85)',
};

const ST = {
  shell: 'h-full min-h-0 flex-1 overflow-y-auto',
  inner: 'mx-auto w-full max-w-2xl',
  h1: 'text-2xl font-semibold tracking-tight text-slate-200',
  lead: 'mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500',
  card: 'mb-5 rounded-2xl',
  cardTitle: 'text-sm font-semibold text-slate-200',
  cardDesc: 'mt-0.5 mb-5 text-xs leading-relaxed text-slate-500',
  labelCap: 'mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500',
  labelMuted: 'mb-2 block text-xs font-medium text-slate-400',
  field: 'w-full rounded-xl placeholder:text-slate-600',
  checkRow: 'flex cursor-pointer gap-3 rounded-xl p-4 transition-opacity hover:opacity-95',
} as const;
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Výchozí plánovaný počet stránek knihy (sjednoceno s Bookshelf / DB default) */
const DEFAULT_BOOK_PAGE_LIMIT = 96;

/** Jednorázové zpracování ?invite= i při dvojím spuštění effectu (React Strict Mode). */
const laioutBookInviteConsumedKeys = new Set<string>();

function uuidStringsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null || a === '' || b === '') return false;
  const na = String(a).replace(/-/g, '').toLowerCase();
  const nb = String(b).replace(/-/g, '').toLowerCase();
  return na.length > 0 && na === nb;
}

/** Sloučení total_pages z DB (0 není „nenastaveno“ přes ||) a lokálního stavu */
function resolvePageLimitFromDbAndPrev(
  totalPagesFromDb: number | null | undefined,
  prevLimit: number | undefined | null
): number {
  const db =
    totalPagesFromDb != null && Number.isFinite(Number(totalPagesFromDb)) && Number(totalPagesFromDb) > 0
      ? Math.round(Number(totalPagesFromDb))
      : undefined;
  if (db != null) return db;
  if (prevLimit != null && prevLimit >= 1) return prevLimit;
  return DEFAULT_BOOK_PAGE_LIMIT;
}

function hasLoadedWorksheetContent(worksheet: Worksheet | undefined): worksheet is Worksheet {
  return Boolean(worksheet && Array.isArray(worksheet.blocks));
}

function preferFreshWorksheet(a?: Worksheet, b?: Worksheet): Worksheet | undefined {
  const aLoaded = hasLoadedWorksheetContent(a);
  const bLoaded = hasLoadedWorksheetContent(b);

  if (aLoaded && !bLoaded) return a;
  if (bLoaded && !aLoaded) return b;
  if (!a && b) return b;
  if (!b && a) return a;
  if (!a && !b) return undefined;

  const aUpdatedAt = a?.updatedAt ?? '';
  const bUpdatedAt = b?.updatedAt ?? '';

  if (aUpdatedAt === bUpdatedAt) {
    return b ?? a;
  }

  return aUpdatedAt > bUpdatedAt ? a : (b ?? a);
}

/**
 * Generuje demo data pro testování
 */
function generateDemoWorkbook(id: string): Workbook {
  const worksheets: { [id: string]: Worksheet } = {};
  const pages: WorkbookPage[] = [];
  const chapters: WorkbookChapter[] = [
    { id: 'chapter-1', title: 'Úvod do zlomků', color: CHAPTER_COLORS[0], order: 1 },
    { id: 'chapter-2', title: 'Sčítání a odčítání', color: CHAPTER_COLORS[1], order: 2 },
    { id: 'chapter-3', title: 'Násobení a dělení', color: CHAPTER_COLORS[2], order: 3 },
  ];
  
  // Vytvořit demo worksheets a pages
  const worksheetTitles = [
    'Co je to zlomek?',
    'Čitatel a jmenovatel',
    'Krácení zlomků',
    'Rozšiřování zlomků',
    'Sčítání zlomků',
    'Odčítání zlomků',
    'Slovní úlohy I',
    'Násobení zlomků',
    'Dělení zlomků',
    'Smíšená čísla',
    'Opakování',
    'Test',
  ];
  
  worksheetTitles.forEach((title, index) => {
    const wsId = `ws-${index + 1}`;
    const chapterIndex = index < 4 ? 0 : index < 7 ? 1 : 2;
    
    worksheets[wsId] = {
      ...createEmptyWorksheet(wsId),
      title,
      subtitle: chapters[chapterIndex].title,
      blocks: [
        {
          id: `block-${index}-1`,
          type: 'title',
          content: { text: title },
          settings: {},
        },
        {
          id: `block-${index}-2`,
          type: 'text',
          content: { text: 'Lorem ipsum dolor sit amet...' },
          settings: {},
        },
        {
          id: `block-${index}-3`,
          type: 'task',
          content: { text: 'Úloha 1: Vyřešte následující příklad.' },
          settings: { taskNumber: 1 },
        },
        {
          id: `block-${index}-4`,
          type: 'lines',
          content: {},
          settings: { lineCount: 4 },
        },
      ],
    };
    
    // Nastav startsChapterId pouze na první stránku každé kapitoly
    const isFirstPageOfChapter = 
      index === 0 || // První stránka = první kapitola
      (index === 4 && chapterIndex === 1) || // Stránka 5 = začátek druhé kapitoly
      (index === 7 && chapterIndex === 2);   // Stránka 8 = začátek třetí kapitoly
    
    pages.push({
      id: `page-${index + 1}`,
      pageNumber: index + 1,
      worksheetId: wsId,
      worksheetPageIndex: 0,
      startsChapterId: isFirstPageOfChapter ? chapters[chapterIndex].id : undefined,
    });
  });
  
  return {
    id,
    title: 'Pracovní sešit - Zlomky',
    description: 'Kompletní pracovní sešit pro výuku zlomků',
    pages,
    chapters,
    worksheets,
    settings: {
      pageFormat: 'a4',
      orientation: 'portrait',
      margins: { top: 20, bottom: 20, left: 20, right: 20 },
      showPageNumbers: true,
      showChapterColors: true,
      pageLimit: 45,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function WorkbookProLayout({ theme, toggleTheme }: WorkbookProLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const debugWorkbookLayout = (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log('[WorkbookLayout]', ...args);
    }
  };
  
  // State
  const [workbook, setWorkbook] = useState<Workbook>(() => ({
    id: id || 'new-book',
    title: 'Načítám…',
    pages: [],
    chapters: [],
    worksheets: {},
    settings: {
      pageFormat: 'a4',
      orientation: 'portrait',
      showPageNumbers: true,
      pageLimit: DEFAULT_BOOK_PAGE_LIMIT,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  const [loadingReal, setLoadingReal] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [settingsTeam, setSettingsTeam] = useState<Awaited<ReturnType<typeof fetchBookTeam>> | null>(null);
  const [settingsTeamLoading, setSettingsTeamLoading] = useState(false);
  const [teamDisplays, setTeamDisplays] = useState<Map<string, { displayName: string; email: string | null }>>(
    () => new Map(),
  );
  const [showLibraryPanel, setShowLibraryPanel] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [hoveredChapterId, setHoveredChapterId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(0.8); // Track zoom for fixed-size badges
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [newChapterDialog, setNewChapterDialog] = useState<{ open: boolean; fromPage: number }>({ open: false, fromPage: 1 });
  const [newChapterTitle, setNewChapterTitle] = useState('');
  
  // Chapter drag & color state
  const [draggingChapterId, setDraggingChapterId] = useState<string | null>(null);
  const [chapterDropTargetId, setChapterDropTargetId] = useState<string | null>(null);
  const [editingChapterColor, setEditingChapterColor] = useState<string | null>(null);
  
  // Selection & Drag state
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPages, setDraggedPages] = useState<number[]>([]);
  const [dropTarget, setDropTarget] = useState<{ type: 'position' | 'chapter'; value: number | string } | null>(null);
  
  // Lasso state
  const [isLassoActive, setIsLassoActive] = useState(false);
  const [lassoStart, setLassoStart] = useState<{ x: number; y: number } | null>(null);
  const [lassoEnd, setLassoEnd] = useState<{ x: number; y: number } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const workbookRef = useRef(workbook);
  const [bookDesignSystem, setBookDesignSystem] = useState<DesignSystem | null>(null);
  const [appliedBookDesignSystemId, setAppliedBookDesignSystemId] = useState<string | null>(null);
  const [designSidebarCategory, setDesignSidebarCategory] = useState<DesignSidebarCategory>('system');
  const [layoutUserId, setLayoutUserId] = useState<string | null>(null);
  const [bookOwnerId, setBookOwnerId] = useState<string | null>(null);
  const persistPageLimitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designSystemSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSyncedDesignSystemRef = useRef<DesignSystem | null>(null);
  /** Plán stran z teacher_books.total_pages — applyMeta ho nesmí přebít výchozími 96 před načtením řádku z DB. */
  const bookPageLimitFromDbRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    workbookRef.current = workbook;
  }, [workbook]);

  useEffect(() => {
    bookPageLimitFromDbRef.current = undefined;
    setAppliedBookDesignSystemId(null);
    setBookDesignSystem(null);
  }, [id]);

  useEffect(() => {
    return () => {
      if (designSystemSyncTimerRef.current) clearTimeout(designSystemSyncTimerRef.current);
    };
  }, []);

  const isBookOwnerUi = uuidStringsEqual(layoutUserId, bookOwnerId);

  /** Vlastník knihy zvlášť od těžkého loadu — maybeSingle + fallback přes listy (teacher_id z API nemusí být typeof string). */
  useEffect(() => {
    if (!id) {
      setBookOwnerId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setBookOwnerId(null);
        return;
      }
      const { data: row, error } = await supabase
        .from('teacher_books')
        .select('teacher_id')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn('[WorkbookPro] teacher_books.teacher_id', error.message);
      }
      let owner: string | null =
        row?.teacher_id != null && String(row.teacher_id).trim() !== ''
          ? String(row.teacher_id).trim()
          : null;
      if (!owner) {
        const { data: ws, error: wsErr } = await supabase
          .from('teacher_worksheets')
          .select('id')
          .eq('book_id', id)
          .eq('teacher_id', user.id)
          .limit(1);
        if (cancelled) return;
        if (!wsErr && ws && ws.length > 0) {
          owner = String(user.id).trim();
        }
      }
      if (!cancelled) setBookOwnerId(owner);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (viewMode !== 'settings' || settingsTab !== 'team' || !id) return;
    let cancelled = false;
    setSettingsTeamLoading(true);
    void (async () => {
      try {
        const team = await fetchBookTeam(id);
        if (cancelled) return;
        setSettingsTeam(team);
        const uidList: string[] = [];
        if (team.ownerUserId) uidList.push(team.ownerUserId);
        for (const sh of team.shares) uidList.push(sh.shared_with_user_id);
        const displays = await fetchTeacherDisplaysByUserIds(uidList);
        if (!cancelled) setTeamDisplays(displays);
      } catch {
        if (!cancelled) {
          setSettingsTeam(null);
          setTeamDisplays(new Map());
        }
      } finally {
        if (!cancelled) setSettingsTeamLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewMode, settingsTab, id]);

  useEffect(() => {
    const raw = searchParams.get('invite');
    const token = raw?.trim();
    if (!token || !id || !layoutUserId) return;
    const dedupeKey = `${id}:${token}`;
    if (laioutBookInviteConsumedKeys.has(dedupeKey)) return;
    laioutBookInviteConsumedKeys.add(dedupeKey);

    void (async () => {
      const r = await acceptTeacherBookInvite(token);
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete('invite');
          return n;
        },
        { replace: true },
      );
      if (r.ok) {
        if (r.note === 'added') toast.success('Kniha byla přidána k tvému účtu.');
        else if (r.note === 'already_shared') toast.success('Už máš k této knize přístup.');
        else if (r.note === 'owner_skip') toast.message('Jsi vlastníkem této knihy.');
      } else {
        toast.error(r.message);
      }
    })();
  }, [id, layoutUserId, searchParams, setSearchParams]);

  useEffect(
    () => () => {
      if (persistPageLimitTimeoutRef.current) {
        clearTimeout(persistPageLimitTimeoutRef.current);
        persistPageLimitTimeoutRef.current = null;
      }
    },
    [],
  );

  const schedulePersistBookPageLimit = useCallback(
    (nextLimit: number) => {
      if (!id) return;
      const v = Math.max(1, Math.min(500, Math.round(nextLimit)));
      if (persistPageLimitTimeoutRef.current) clearTimeout(persistPageLimitTimeoutRef.current);
      persistPageLimitTimeoutRef.current = setTimeout(async () => {
        persistPageLimitTimeoutRef.current = null;
        const { error } = await supabase.from('teacher_books').update({ total_pages: v }).eq('id', id);
        if (error) console.error('[WorkbookPro] total_pages persist', error);
      }, 500);
    },
    [id],
  );
  
  // Track Space key for lasso vs pan conflict resolution (ne v input/textarea — Design systém 2 chat)
  useEffect(() => {
    const editable = (t: EventTarget | null) => {
      if (!t || !(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (t.isContentEditable) return true;
      return !!t.closest('[contenteditable="true"]');
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !editable(e.target)) setIsSpacePressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // ── Cache helpers ─────────────────────────────────────────────────────────
  /**
   * Per-workbook cache stored in sessionStorage.
   * Full content (ws object) is NOT cached — only the lightweight data needed
   * to rebuild the book structure quickly before full worksheets arrive.
   */
  type WsMetaCache = {
    updatedAt: Record<string, string>;
    meta: Record<string, { name: string; title: string; pageCount: number }>;
  };
  const cacheKey = `wb-meta-${id}`;
  const fullWorksheetCacheKey = `wb-full-${id}`;

  const readCache = (): WsMetaCache | null => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };
  const writeCache = (c: WsMetaCache) => {
    try { sessionStorage.setItem(cacheKey, JSON.stringify(c)); } catch { /* quota exceeded — ignore */ }
  };

  type WsFullCache = Record<string, Worksheet>;
  const readFullWorksheetCache = (): WsFullCache => {
    try {
      const raw = sessionStorage.getItem(fullWorksheetCacheKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };
  const writeFullWorksheetCache = (cache: WsFullCache) => {
    try { sessionStorage.setItem(fullWorksheetCacheKey, JSON.stringify(cache)); } catch { /* ignore */ }
  };

  // ── Shared function: load worksheets and build workbook structure ─────────
  const loadWorksheets = useCallback(async (showSpinner = false) => {
    if (!id) return;
    debugWorkbookLayout('load-start', { workbookId: id, showSpinner });

    const cache = readCache();
    const fullCache = readFullWorksheetCache();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLayoutUserId(null);
        setBookOwnerId(null);
        return;
      }
      setLayoutUserId(user.id);

      // 2a. Nejdřív řádek knihy (total_pages) — cache/applyMeta jinak přepíše limit na 96
      const { data: bookRow } = await supabase
        .from('teacher_books')
        .select('title, color, total_pages, design_system_id')
        .eq('id', id)
        .maybeSingle();

      if (
        bookRow != null &&
        bookRow.total_pages != null &&
        Number.isFinite(Number(bookRow.total_pages)) &&
        Number(bookRow.total_pages) > 0
      ) {
        bookPageLimitFromDbRef.current = Math.round(Number(bookRow.total_pages));
      } else {
        bookPageLimitFromDbRef.current = undefined;
      }

      if (cache && Object.keys(cache.meta).length > 0) {
        debugWorkbookLayout('apply-cache', {
          workbookId: id,
          worksheetCount: Object.keys(cache.meta).length,
          fullWorksheetCount: Object.keys(fullCache).length,
        });
        applyMeta(
          cache.meta,
          undefined,
          workbookRef.current.pages.length === 0 ? fullCache : undefined,
        );
        setLoadingReal(false);
      } else if (showSpinner) {
        setLoadingReal(true);
      }

      if (bookRow) {
        setWorkbook(prev => ({
          ...prev,
          title: bookRow.title || prev.title,
          settings: {
            ...prev.settings,
            pageLimit: resolvePageLimitFromDbAndPrev(bookRow.total_pages, prev.settings.pageLimit),
          },
        }));

        const selectedDesignSystemId =
          typeof bookRow.design_system_id === 'string' && bookRow.design_system_id.trim().length > 0
            ? bookRow.design_system_id
            : null;
        setAppliedBookDesignSystemId(selectedDesignSystemId);

        if (selectedDesignSystemId) {
          const ds = await getDesignSystem(selectedDesignSystemId);
          setBookDesignSystem(ds);
        } else {
          setBookDesignSystem(null);
        }
      }

      // 2b. Lightweight query — only id, name, updated_at (no content blob!)
      // Support both new book_id and legacy folder_id
      const { data: lightByBook } = await supabase
        .from('teacher_worksheets')
        .select('id, name, updated_at')
        .eq('teacher_id', user.id)
        .eq('book_id', id)
        .order('created_at', { ascending: true });

      const { data: lightByFolder } = await supabase
        .from('teacher_worksheets')
        .select('id, name, updated_at')
        .eq('teacher_id', user.id)
        .eq('folder_id', id)
        .order('created_at', { ascending: true });

      // Merge, prefer book_id rows, deduplicate
      const seenIds = new Set<string>();
      const lightRows: typeof lightByBook = [];
      for (const row of [...(lightByBook ?? []), ...(lightByFolder ?? [])]) {
        if (!seenIds.has(row.id)) { seenIds.add(row.id); lightRows.push(row); }
      }

      /** Počty stran z DB (content.metadata / blocks) — bez tahání celého JSONu na klienta */
      const countById: Record<string, number> = {};
      if (lightRows.length > 0) {
        const { data: rpcRows, error: rpcErr } = await supabase.rpc('worksheet_page_counts', {
          p_ids: lightRows.map((r) => r.id),
        });
        if (rpcErr) {
          console.warn('[WorkbookPro] worksheet_page_counts:', rpcErr.message);
        } else {
          for (const row of rpcRows ?? []) {
            const rid = row?.id as string | undefined;
            const pc = row?.page_count as number | undefined;
            if (rid && typeof pc === 'number' && pc > 0) countById[rid] = pc;
          }
        }
      }

      // Empty book — clear demo data and show empty canvas with correct pageLimit
      if (lightRows.length === 0) {
        setWorkbook(prev => ({
          ...prev,
          id: id!,
          title: bookRow?.title || (prev.title === 'Načítám…' ? 'Pracovní sešit' : prev.title),
          pages: [],
          chapters: [],
          worksheets: {},
          settings: {
            ...prev.settings,
            pageLimit: resolvePageLimitFromDbAndPrev(bookRow?.total_pages, prev.settings.pageLimit),
          },
        }));
        return;
      }

      // 3. Detect which worksheets changed since last cache
      const cachedUpdatedAt = cache?.updatedAt ?? {};
      const changedIds = lightRows
        .filter(r => cachedUpdatedAt[r.id] !== r.updated_at)
        .map(r => r.id);
      debugWorkbookLayout('fetched-light-rows', {
        workbookId: id,
        lightRowCount: lightRows.length,
        changedIds,
      });

      // 4. Build lightweight meta. Full worksheet content is loaded lazily
      // when a preview becomes visible, so opening a large book stays fast.
      const newMeta: WsMetaCache['meta'] = { ...(cache?.meta ?? {}) };
      const mergedFullWorksheetData: Record<string, Worksheet> = { ...fullCache };
      const changedWorksheetData: Record<string, Worksheet> = {};
      const currentWorksheets = workbookRef.current.worksheets;

      for (const light of lightRows) {
        if (changedIds.includes(light.id)) {
          // 1. Check localStorage first — always in sync because save is synchronous there
          const localWs = getWorksheetLocal(light.id);
          const localPageCount = localWs?.metadata?.pageCount ?? 0;
          const cachedPageCount = newMeta[light.id]?.pageCount ?? 0;
          const serverCount = countById[light.id] ?? 0;
          const wsPageCount =
            localPageCount > 0
              ? localPageCount
              : serverCount > 0
                ? serverCount
                : cachedPageCount > 0
                  ? cachedPageCount
                  : 1;

          newMeta[light.id] = {
            name: light.name,
            title: localWs?.title || newMeta[light.id]?.title || light.name || '',
            pageCount: wsPageCount,
          };
          if (localWs && Array.isArray(localWs.blocks)) {
            mergedFullWorksheetData[light.id] = localWs;
            if (currentWorksheets[light.id] !== localWs) {
              changedWorksheetData[light.id] = localWs;
            }
          }
        } else {
          // Worksheet not changed according to Supabase — but Supabase save may still be in-flight.
          // Cross-check localStorage to catch pending saves.
          const localWs = getWorksheetLocal(light.id);
          const localPageCount = localWs?.metadata?.pageCount ?? 0;
          const cachedPageCount = newMeta[light.id]?.pageCount ?? 0;
          const localUpdatedAt = localWs?.updatedAt ?? '';
          const cachedUpdatedAt2 = cache?.updatedAt?.[light.id] ?? '';
          // If localStorage is newer than what we last synced, prefer it immediately
          // even when pageCount stays the same. Otherwise the book view can show stale
          // page content right after returning from the editor.
          if (localWs && localUpdatedAt > cachedUpdatedAt2) {
            newMeta[light.id] = {
              ...(newMeta[light.id] ?? { name: light.name, title: light.name }),
              title: localWs?.title || newMeta[light.id]?.title || light.name,
              pageCount: localPageCount || cachedPageCount || newMeta[light.id]?.pageCount || 1,
            };
            if (Array.isArray(localWs.blocks)) {
              mergedFullWorksheetData[light.id] = localWs;
              const currentUpdatedAt = currentWorksheets[light.id]?.updatedAt ?? '';
              if (currentUpdatedAt !== localUpdatedAt) {
                changedWorksheetData[light.id] = localWs;
              }
            }
          } else if (localWs && Array.isArray(localWs.blocks)) {
            mergedFullWorksheetData[light.id] = localWs;
            if (!currentWorksheets[light.id] || !Array.isArray(currentWorksheets[light.id].blocks)) {
              changedWorksheetData[light.id] = localWs;
            }
          } else if (fullCache[light.id] && Array.isArray(fullCache[light.id].blocks)) {
            mergedFullWorksheetData[light.id] = fullCache[light.id];
            if (!currentWorksheets[light.id] || !Array.isArray(currentWorksheets[light.id].blocks)) {
              changedWorksheetData[light.id] = fullCache[light.id];
            }
          }
        }
      }

      // Bez lokálního draftu přebij počet stran hodnotou z DB (RPC), ať přehled neukazuje jen 1 stránku
      for (const light of lightRows) {
        const localPc = getWorksheetLocal(light.id)?.metadata?.pageCount ?? 0;
        if (localPc > 0) continue;
        const srv = countById[light.id];
        if (srv == null || srv < 1) continue;
        if (!newMeta[light.id]) {
          newMeta[light.id] = { name: light.name, title: light.name, pageCount: srv };
        } else {
          newMeta[light.id].pageCount = srv;
        }
      }

      // Remove worksheets that were deleted
      for (const cachedId of Object.keys(newMeta)) {
        if (!lightRows.find(r => r.id === cachedId)) {
          delete newMeta[cachedId];
          delete mergedFullWorksheetData[cachedId];
          delete changedWorksheetData[cachedId];
        }
      }

      // 6. Update cache
      const newUpdatedAt: Record<string, string> = {};
      for (const r of lightRows) newUpdatedAt[r.id] = r.updated_at;
      writeCache({ updatedAt: newUpdatedAt, meta: newMeta });
      writeFullWorksheetCache(mergedFullWorksheetData);

      // 7. Apply to state — preserving order from lightRows
      debugWorkbookLayout('apply-fresh', {
        workbookId: id,
        orderedIds: lightRows.map(r => r.id),
        changedIds,
      });
      applyMeta(newMeta, lightRows.map(r => r.id), changedWorksheetData);
    } catch (e) {
      console.error('[WorkbookPro] load error', e);
    } finally {
      setLoadingReal(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const syncExistingBookPagesWithDesignSystem = useCallback(async (
    ds: DesignSystem,
    options?: { toastOnSuccess?: boolean },
  ) => {
    if (!id || !ds.id || String(ds.id).startsWith('local-')) return;

    const result = await syncDesignSystemToBookWorksheets(id, ds);
    await loadWorksheets(false);

    if (options?.toastOnSuccess !== false) {
      toast.success(
        result.syncedCount > 0
          ? `Design system propsán do ${result.syncedCount} stran/kapitol.`
          : 'Kniha zatím nemá žádné stránky ke synchronizaci.',
      );
    }
  }, [id, loadWorksheets]);

  const handleBookDesignSystemChange = useCallback((ds: DesignSystem | null) => {
    setBookDesignSystem(ds);

    if (!ds || !appliedBookDesignSystemId || ds.id !== appliedBookDesignSystemId) return;
    if (!ds.id || String(ds.id).startsWith('local-')) return;

    latestSyncedDesignSystemRef.current = ds;
    if (designSystemSyncTimerRef.current) clearTimeout(designSystemSyncTimerRef.current);
    designSystemSyncTimerRef.current = setTimeout(() => {
      const latest = latestSyncedDesignSystemRef.current;
      if (!latest) return;
      void syncExistingBookPagesWithDesignSystem(latest, { toastOnSuccess: false });
    }, 1200);
  }, [appliedBookDesignSystemId, syncExistingBookPagesWithDesignSystem]);

  /** Vlastní layout design systému → Pro editor (session stash), nová karta — kniha zůstane otevřená. */
  const openDesignSystemLayoutInProEditor = useCallback(
    (layoutId: string, dsSnapshot?: DesignSystem | null) => {
      const ds = dsSnapshot ?? bookDesignSystem;
      if (!id || !ds) {
        toast.error('Nelze otevřít editor — chybí kniha nebo design systém.');
        return;
      }
      const url = buildStashedProEditorUrlForDesignSystemCustomLayout(ds, layoutId, {
        pageFormat: workbook.settings.pageFormat,
        bookId: id,
        workbookId: id,
      });
      if (!url) {
        toast.error('Vlastní layout nebyl nalezen.');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [id, bookDesignSystem, workbook.settings.pageFormat],
  );

  /** Rebuild workbook pages/chapters/worksheets from lightweight meta */
  function applyMeta(
    meta: Record<string, { name: string; title: string; pageCount: number }>,
    orderedIds?: string[],
    worksheetData?: Record<string, Worksheet>,
  ) {
    const ids = orderedIds ?? Object.keys(meta);
    const pages: WorkbookPage[] = [];
    const chapters: WorkbookChapter[] = [];
    let pageNum = 1;

    ids.forEach((wsId, i) => {
      const m = meta[wsId];
      if (!m) return;

      const chapter: WorkbookChapter = {
        id: `chapter-${wsId}`,
        title: m.title || m.name || `Kapitola ${i + 1}`,
        color: CHAPTER_COLORS[i % CHAPTER_COLORS.length],
        order: i + 1,
      };
      chapters.push(chapter);

      const count = m.pageCount || 1;
      for (let p = 0; p < count; p++) {
        pages.push({
          id: `page-${wsId}-${p}`,
          pageNumber: pageNum++,
          worksheetId: wsId,
          worksheetPageIndex: p,
          startsChapterId: p === 0 ? chapter.id : undefined,
        });
      }
    });

    setWorkbook(prev => {
      const wsMap: Record<string, Worksheet> = {};
      ids.forEach((wsId) => {
        const m = meta[wsId];
        if (!m) return;
        const fullWs = preferFreshWorksheet(prev.worksheets[wsId], worksheetData?.[wsId]);
        wsMap[wsId] = fullWs && Array.isArray(fullWs.blocks)
          ? fullWs
          : ({ ...(fullWs ?? {}), title: m.title || fullWs?.title || m.name } as Worksheet);
      });

      const contentPages = pages.length;
      const prevLimit = prev.settings.pageLimit;
      const dbPlan = bookPageLimitFromDbRef.current;
      const intended =
        dbPlan != null && dbPlan >= 1
          ? dbPlan
          : prevLimit != null && prevLimit >= 1
            ? prevLimit
            : DEFAULT_BOOK_PAGE_LIMIT;
      // Známe plán z teacher_books — nesmí ho přebít vysoký pageCount z meta jedné kapitoly (jinak 48 → 96)
      const pageLimit =
        dbPlan != null && dbPlan >= 1
          ? Math.max(dbPlan, Math.min(contentPages, dbPlan), 1)
          : Math.max(intended, contentPages, 1);

      return {
        ...prev,
        id: id!,
        title: (prev.title === 'Nový pracovní sešit' || prev.title === 'Načítám…') ? 'Pracovní sešit' : prev.title,
        pages,
        chapters,
        settings: {
          ...prev.settings,
          pageLimit,
        },
        worksheets: wsMap,
      };
    });
  }

  const ensureWorksheetLoaded = useCallback(async (worksheetId: string) => {
    const wb = workbookRef.current;
    const existing = wb.worksheets[worksheetId];
    if (existing && Array.isArray(existing.blocks) && existing.blocks.length > 0) {
      const expected = deriveWorksheetPageCount(existing);
      const span = wb.pages.filter((p) => p.worksheetId === worksheetId).length;
      if (span === expected) return;
    }

    try {
      const localWs = getWorksheetLocal(worksheetId);
      let resolved = localWs && Array.isArray(localWs.blocks) ? localWs : null;

      if (!resolved) {
        const { data: row } = await supabase
          .from('teacher_worksheets')
          .select('id, content')
          .eq('id', worksheetId)
          .maybeSingle();

        const dbWs = row?.content as Worksheet | undefined;
        if (dbWs && Array.isArray(dbWs.blocks)) {
          resolved = dbWs;
        }
      }

      if (!resolved) return;

      const pageCount = deriveWorksheetPageCount(resolved);

      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const c = JSON.parse(raw) as WsMetaCache;
          c.meta[worksheetId] = {
            ...(c.meta[worksheetId] ?? { name: resolved.title, title: resolved.title }),
            name: resolved.title || c.meta[worksheetId]?.name || '',
            title: resolved.title || c.meta[worksheetId]?.title || '',
            pageCount,
          };
          sessionStorage.setItem(cacheKey, JSON.stringify(c));
        }
      } catch {
        /* ignore */
      }

      const mergedFullCache = {
        ...readFullWorksheetCache(),
        [worksheetId]: resolved!,
      };
      writeFullWorksheetCache(mergedFullCache);

      setWorkbook((prev) => {
        const withPages = replaceWorksheetPageSpan(prev, worksheetId, pageCount);
        return {
          ...withPages,
          worksheets: {
            ...withPages.worksheets,
            [worksheetId]: resolved!,
          },
        };
      });
    } catch (e) {
      console.warn('[WorkbookPro] ensureWorksheetLoaded failed', worksheetId, e);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (viewMode !== 'canvas') return;
    const preloadIds = Array.from(new Set(
      workbook.pages
        .slice(0, 6)
        .map((page) => page.worksheetId)
        .filter(Boolean)
    )) as string[];
    if (preloadIds.length === 0) return;

    let cancelled = false;
    const run = async () => {
      for (const wsId of preloadIds) {
        if (cancelled) return;
        await ensureWorksheetLoaded(wsId);
      }
    };

    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    let timeoutId: number | null = null;
    if (idle) {
      idle(() => { void run(); });
    } else {
      timeoutId = window.setTimeout(() => { void run(); }, 300);
    }

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [ensureWorksheetLoaded, viewMode, workbook.pages]);

  // Initial load
  useEffect(() => {
    if (!id) { setLoadingReal(false); return; }
    loadWorksheets(true);
  }, [id, loadWorksheets]);

  // Re-load when user returns to this tab — clear cache first so page counts are always fresh
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        debugWorkbookLayout('visibility-visible-reload', { workbookId: id });
        loadWorksheets(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadWorksheets, cacheKey]);

  // Vytvoř spreads z pages
  const spreads = useMemo(
    () => createSpreadsFromPages(workbook.pages),
    [workbook.pages]
  );
  
  // Handlers
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    
    // TODO: Supabase save
    // Viz TODOSUPABASE.md
    
    await new Promise(resolve => setTimeout(resolve, 500));
    setSaveStatus('saved');
    
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);
  
  // Autosave - ukládá při změnách workbooku
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);
  
  useEffect(() => {
    // Přeskočit první renderování
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // Debounce autosave - 1.5 sekundy po poslední změně
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    
    autosaveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 1500);
    
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [workbook, handleSave]);
  
  // Blokovat opuštění editoru během ukládání
  const handleBack = useCallback(() => {
    if (saveStatus === 'saving') {
      toast.warning('Počkejte, probíhá ukládání...');
      return;
    }
    navigate(LAIOUT_BOOKSHELF_PATH);
  }, [navigate, saveStatus]);

  const closeLibraryPanel = useCallback(() => setShowLibraryPanel(false), []);

  const persistBookDesignSystemSelection = useCallback(async (ds: DesignSystem) => {
    if (!id) return;
    if (!ds.id || String(ds.id).startsWith('local-')) {
      toast.info('Nejprve design system uložte.');
      return;
    }

    setBookDesignSystem(ds);
    const { error } = await supabase
      .from('teacher_books')
      .update({ design_system_id: ds.id })
      .eq('id', id);

    if (error) {
      console.error('[WorkbookPro] design_system_id persist', error);
      toast.error('Nepodařilo se nastavit design system knihy.');
      return;
    }

    setAppliedBookDesignSystemId(ds.id);
    await syncExistingBookPagesWithDesignSystem(ds, { toastOnSuccess: true });
  }, [id, syncExistingBookPagesWithDesignSystem]);

  // Blokovat beforeunload během ukládání
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = 'Probíhá ukládání, opravdu chcete odejít?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);
  
  const handleEditPage = useCallback((pageId: string, worksheetId: string, worksheetPageIndex = 0) => {
    const ws = workbook.worksheets?.[worksheetId];
    if (ws) {
      stashWorksheetForEditorSession(worksheetId, ws);
    }
    navigate(
      `/admin/worksheet-pro/${worksheetId}?offline=1&page=${worksheetPageIndex + 1}&pageFormat=${workbook.settings.pageFormat}&workbookId=${workbook.id}&bookId=${workbook.id}`
    );
  }, [navigate, workbook.settings.pageFormat, workbook.id, workbook.worksheets]);
  
  const handleRemovePage = useCallback((pageId: string) => {
    setWorkbook(prev => ({
      ...prev,
      pages: prev.pages
        .filter(p => p.id !== pageId)
        .map((p, i) => ({ ...p, pageNumber: i + 1 })),
      updatedAt: new Date().toISOString(),
    }));
    toast.success('Stránka odstraněna');
  }, []);
  
  const handleCopyPage = useCallback((pageId: string) => {
    const pageToCopy = workbook.pages.find(p => p.id === pageId);
    if (!pageToCopy) return;
    
    const newPage: WorkbookPage = {
      ...pageToCopy,
      id: `page-${Date.now()}`,
      pageNumber: workbook.pages.length + 1,
    };
    
    setWorkbook(prev => ({
      ...prev,
      pages: [...prev.pages, newPage],
      updatedAt: new Date().toISOString(),
    }));
    toast.success('Stránka zkopírována');
  }, [workbook.pages]);
  
  const handleAddPage = useCallback(() => {
    handleAddChapterAtPage(workbook.pages.length + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbook.pages.length]);

  /**
   * Create a new chapter (worksheet) starting at a specific page number,
   * uložit přes saveWorksheetAwait (strip base64, book_id), pak otevřít editor.
   */
  const handleAddChapterAtPage = useCallback(async (startPageNum: number) => {
    const newWsId = `ws-${Date.now()}`;
    const baseWorksheet = createEmptyWorksheet(newWsId);
    const newWorksheet = bookDesignSystem
      ? applyDesignSystemSnapshotToWorksheet(baseWorksheet, bookDesignSystem)
      : baseWorksheet;

    const chapterId = `chapter-${newWsId}`;
    const newPage: WorkbookPage = {
      id: `page-${newWsId}-0`,
      pageNumber: startPageNum,
      worksheetId: newWsId,
      worksheetPageIndex: 0,
      startsChapterId: chapterId,
    };

    const { ok, error: saveErr } = await saveWorksheetAwait(newWorksheet, null, workbook.id);
    if (!ok) {
      const msg = saveErr ?? '';
      toast.error(
        msg.includes('Nepřihlášen') || msg.includes('No user')
          ? 'Pro uložení kapitoly se přihlas.'
          : `Nepodařilo se uložit kapitolu: ${msg}`,
      );
      return;
    }

    setWorkbook((prev) => ({
      ...prev,
      pages: [...prev.pages.filter((p) => p.pageNumber !== startPageNum), newPage].sort(
        (a, b) => a.pageNumber - b.pageNumber,
      ),
      chapters: [
        ...prev.chapters,
        {
          id: chapterId,
          title: 'Nová kapitola',
          color: CHAPTER_COLORS[prev.chapters.length % CHAPTER_COLORS.length],
          order: prev.chapters.length + 1,
        },
      ],
      worksheets: { ...prev.worksheets, [newWsId]: newWorksheet },
      updatedAt: new Date().toISOString(),
    }));

    stashWorksheetForEditorSession(newWsId, newWorksheet);
    navigate(
      `/admin/worksheet-pro/${newWsId}?offline=1&page=1&pageFormat=${workbook.settings.pageFormat}&workbookId=${workbook.id}&bookId=${workbook.id}`
    );
  }, [bookDesignSystem, workbook.id, workbook.pages, workbook.chapters, workbook.settings.pageFormat, navigate]);

  /** Poslední dataset z pipeline agentů → nové stránky + pracovní listy knihy */
  const handleApplyPipelineDatasetToBook = useCallback(
    async (datasetJson: string) => {
      const built = buildPageUnitsFromPipelineDataset(datasetJson);
      if (!built.ok) {
        toast.error(built.error);
        return;
      }
      let units = built.units;
      const limit =
        workbook.settings.pageLimit != null && workbook.settings.pageLimit >= 1
          ? workbook.settings.pageLimit
          : DEFAULT_BOOK_PAGE_LIMIT;
      const available = Math.max(0, limit - workbook.pages.length);
      if (available <= 0) {
        toast.error('Kniha je na limitu stránek — zvyš limit v nastavení knihy.');
        return;
      }
      if (units.length > available) {
        units = units.slice(0, available);
        toast.warning(`Přidáno jen ${available} stránek (limit knihy ${limit}).`);
      }

      const chapterId = `chapter-pipeline-${Date.now()}`;
      const newChapter: WorkbookChapter = {
        id: chapterId,
        title: 'Z pipeline',
        color: CHAPTER_COLORS[workbook.chapters.length % CHAPTER_COLORS.length],
        order: workbook.chapters.length + 1,
      };

      setWorkbook((prev) => {
        const startNum = prev.pages.length + 1;
        const newWorksheets: Record<string, Worksheet> = {};
        const newPages: WorkbookPage[] = [];
        units.forEach((unit, i) => {
          const wsId = `ws-${crypto.randomUUID()}`;
          const ws = createWorksheetFromPipelineUnit(unit, wsId, bookDesignSystem);
          newWorksheets[wsId] = ws;
          newPages.push({
            id: `page-${wsId}-0`,
            pageNumber: startNum + i,
            worksheetId: wsId,
            worksheetPageIndex: 0,
            startsChapterId: i === 0 ? chapterId : undefined,
          });
          saveWorksheet(ws, null, prev.id);
        });
        return {
          ...prev,
          pages: [...prev.pages, ...newPages],
          chapters: [...prev.chapters, newChapter],
          worksheets: { ...prev.worksheets, ...newWorksheets },
          updatedAt: new Date().toISOString(),
        };
      });

      toast.success(`Přidáno ${units.length} stránek z datasetu. Přepni na náhled knihy (plátno).`);
    },
    [bookDesignSystem, workbook.chapters.length, workbook.pages.length, workbook.settings.pageLimit],
  );

  const handleEditCover = useCallback(() => {
    toast.info('Editor obálky - TODO');
  }, []);
  
  const handleToggleChapterColors = useCallback(() => {
    setWorkbook(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        showChapterColors: !prev.settings.showChapterColors,
      },
    }));
  }, []);
  
  // === LASSO SELECTION LOGIC ===
  
  // Start lasso on mousedown on empty canvas area
  const handleLassoStart = useCallback((e: React.MouseEvent) => {
    // Only start lasso if clicking on empty area (not on a page)
    const target = e.target as HTMLElement;
    if (target.closest('[data-page]')) return;
    if (target.closest('button')) return; // Don't start on buttons
    if (e.button !== 0) return; // Only left click
    if (isSpacePressed) return; // Don't interfere with pan mode
    
    const container = canvasContainerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsLassoActive(true);
    setLassoStart({ x, y });
    setLassoEnd({ x, y });
  }, [isSpacePressed]);
  
  // Update lasso on mousemove
  const handleLassoMove = useCallback((e: React.MouseEvent) => {
    if (!isLassoActive || !lassoStart) return;
    
    const container = canvasContainerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setLassoEnd({ x, y });
  }, [isLassoActive, lassoStart]);
  
  // End lasso and select pages within rectangle
  const handleLassoEnd = useCallback(() => {
    if (!isLassoActive || !lassoStart || !lassoEnd) {
      setIsLassoActive(false);
      return;
    }
    
    const container = canvasContainerRef.current;
    if (!container) {
      setIsLassoActive(false);
      return;
    }
    
    // Calculate lasso rectangle in screen coordinates
    const lassoRect = {
      left: Math.min(lassoStart.x, lassoEnd.x),
      right: Math.max(lassoStart.x, lassoEnd.x),
      top: Math.min(lassoStart.y, lassoEnd.y),
      bottom: Math.max(lassoStart.y, lassoEnd.y),
    };
    
    // Only select if lasso is larger than 10px (prevent accidental clicks)
    const lassoWidth = lassoRect.right - lassoRect.left;
    const lassoHeight = lassoRect.bottom - lassoRect.top;
    
    if (lassoWidth > 10 && lassoHeight > 10) {
      // Find all page elements and check intersection
      const containerRect = container.getBoundingClientRect();
      const pageElements = container.querySelectorAll('[data-page]');
      const newSelectedPages = new Set<number>();
      
      pageElements.forEach((el) => {
        const pageNum = parseInt(el.getAttribute('data-page') || '0', 10);
        if (!pageNum) return;
        
        const pageRect = el.getBoundingClientRect();
        // Convert to container-relative coordinates
        const pageLeft = pageRect.left - containerRect.left;
        const pageRight = pageRect.right - containerRect.left;
        const pageTop = pageRect.top - containerRect.top;
        const pageBottom = pageRect.bottom - containerRect.top;
        
        // Check if page overlaps with lasso
        const overlaps = !(
          pageRight < lassoRect.left ||
          pageLeft > lassoRect.right ||
          pageBottom < lassoRect.top ||
          pageTop > lassoRect.bottom
        );
        
        if (overlaps) {
          newSelectedPages.add(pageNum);
        }
      });
      
      setSelectedPages(newSelectedPages);
    } else {
      // Small lasso = click on empty space = clear selection
      setSelectedPages(new Set());
    }
    
    setIsLassoActive(false);
    setLassoStart(null);
    setLassoEnd(null);
  }, [isLassoActive, lassoStart, lassoEnd]);
  
  // Calculate lasso rectangle for display
  const lassoRect = useMemo(() => {
    if (!isLassoActive || !lassoStart || !lassoEnd) return null;
    return {
      left: Math.min(lassoStart.x, lassoEnd.x),
      top: Math.min(lassoStart.y, lassoEnd.y),
      width: Math.abs(lassoEnd.x - lassoStart.x),
      height: Math.abs(lassoEnd.y - lassoStart.y),
    };
  }, [isLassoActive, lassoStart, lassoEnd]);
  
  // === SELECTION & DRAG LOGIC ===
  
  // Toggle page selection (ctrl/cmd click)
  const handlePageSelect = useCallback((pageNum: number, isMultiSelect: boolean) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (isMultiSelect) {
        if (next.has(pageNum)) {
          next.delete(pageNum);
        } else {
          next.add(pageNum);
        }
      } else {
        // Single click - select only this page
        if (next.has(pageNum) && next.size === 1) {
          next.clear(); // Deselect if already selected alone
        } else {
          next.clear();
          next.add(pageNum);
        }
      }
      return next;
    });
  }, []);
  
  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedPages(new Set());
  }, []);
  
  // Start dragging selected pages
  const handleDragStart = useCallback((pageNum: number) => {
    const pages = selectedPages.has(pageNum) 
      ? Array.from(selectedPages) 
      : [pageNum];
    setDraggedPages(pages);
    setIsDragging(true);
  }, [selectedPages]);
  
  // Handle drop on position
  const handleDropOnPosition = useCallback((targetPosition: number) => {
    if (draggedPages.length === 0) return;
    
    // Reorder pages
    const newPages = [...workbook.pages];
    const movedPages = draggedPages
      .map(pn => workbook.pages.find(p => p.pageNumber === pn))
      .filter(Boolean) as WorkbookPage[];
    
    // Remove moved pages from their positions
    draggedPages.forEach(pn => {
      const idx = newPages.findIndex(p => p.pageNumber === pn);
      if (idx !== -1) newPages.splice(idx, 1);
    });
    
    // Find insert position
    let insertIdx = newPages.findIndex(p => p.pageNumber >= targetPosition);
    if (insertIdx === -1) insertIdx = newPages.length;
    
    // Insert moved pages
    newPages.splice(insertIdx, 0, ...movedPages);
    
    // Renumber all pages
    const renumberedPages = newPages.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    
    setWorkbook(prev => ({
      ...prev,
      pages: renumberedPages,
      updatedAt: new Date().toISOString(),
    }));
    
    setIsDragging(false);
    setDraggedPages([]);
    setDropTarget(null);
    clearSelection();
    toast.success(`Přesunuto ${draggedPages.length} stránek`);
  }, [draggedPages, workbook.pages, clearSelection]);
  
  // Handle drop on chapter - nastaví začátek kapitoly na první stránce z výběru
  const handleDropOnChapter = useCallback((chapterId: string) => {
    if (draggedPages.length === 0) return;
    
    const chapter = workbook.chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    
    // Najdi první stránku z výběru (nejnižší číslo)
    const sortedPages = [...draggedPages].sort((a, b) => a - b);
    const firstPageNum = sortedPages[0];
    
    // Nastav startsChapterId na první stránku
    const updatedPages = workbook.pages.map(page => {
      if (page.pageNumber === firstPageNum) {
        return {
          ...page,
          startsChapterId: chapterId,
        };
      }
      return page;
    });
    
    setWorkbook(prev => ({
      ...prev,
      pages: updatedPages,
      updatedAt: new Date().toISOString(),
    }));
    
    setIsDragging(false);
    setDraggedPages([]);
    setDropTarget(null);
    clearSelection();
    toast.success(`Kapitola "${chapter.title}" začíná od stránky ${firstPageNum}`);
  }, [draggedPages, workbook.pages, workbook.chapters, clearSelection]);
  
  // Cancel drag
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedPages([]);
    setDropTarget(null);
  }, []);
  
  // Otevřít dialog pro vytvoření nové kapitoly
  const handleStartChapter = useCallback((fromPageNumber: number) => {
    setNewChapterTitle('');
    setNewChapterDialog({ open: true, fromPage: fromPageNumber });
  }, []);
  
  // Potvrdit vytvoření kapitoly
  const handleConfirmNewChapter = useCallback(() => {
    const title = newChapterTitle.trim();
    if (!title) {
      toast.error('Zadej název kapitoly');
      return;
    }
    
    const fromPageNumber = newChapterDialog.fromPage;
    
    // Vybrat barvu (cyklicky z CHAPTER_COLORS)
    const usedColors = workbook.chapters.map(c => c.color);
    const availableColor = CHAPTER_COLORS.find(c => !usedColors.includes(c)) || CHAPTER_COLORS[workbook.chapters.length % CHAPTER_COLORS.length];
    
    const newChapter: WorkbookChapter = {
      id: `chapter-${Date.now()}`,
      title,
      color: availableColor,
      order: workbook.chapters.length + 1,
    };
    
    // Nastav startsChapterId pouze na stránku kde kapitola začíná
    const updatedPages = workbook.pages.map(page => {
      if (page.pageNumber === fromPageNumber) {
        return {
          ...page,
          startsChapterId: newChapter.id,
        };
      }
      return page;
    });
    
    setWorkbook(prev => ({
      ...prev,
      chapters: [...prev.chapters, newChapter],
      pages: updatedPages,
      updatedAt: new Date().toISOString(),
    }));
    
    setNewChapterDialog({ open: false, fromPage: 1 });
    toast.success(`Kapitola "${title}" vytvořena od stránky ${fromPageNumber}`);
  }, [newChapterTitle, newChapterDialog.fromPage, workbook.chapters, workbook.pages]);
  
  // Smazat kapitolu
  const handleDeleteChapter = useCallback((chapterId: string) => {
    const chapter = workbook.chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    
    // Odeber startsChapterId ze všech stránek
    const updatedPages = workbook.pages.map(page => {
      if (page.startsChapterId === chapterId) {
        return { ...page, startsChapterId: undefined };
      }
      return page;
    });
    
    // Odeber kapitolu ze seznamu
    const updatedChapters = workbook.chapters.filter(c => c.id !== chapterId);
    
    setWorkbook(prev => ({
      ...prev,
      chapters: updatedChapters,
      pages: updatedPages,
      updatedAt: new Date().toISOString(),
    }));
    
    toast.success(`Kapitola "${chapter.title}" smazána`);
  }, [workbook.chapters, workbook.pages]);
  
  // Přeřadit kapitolu (drag & drop)
  const handleChapterDrop = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    
    setWorkbook(prev => {
      const chapters = [...prev.chapters];
      const draggedIndex = chapters.findIndex(c => c.id === draggedId);
      const targetIndex = chapters.findIndex(c => c.id === targetId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      // Získej stránky pro každou kapitolu
      const getChapterPages = (chapterId: string) => {
        return prev.pages
          .filter(p => getChapterForPage(p.pageNumber, prev.pages, prev.chapters)?.id === chapterId)
          .sort((a, b) => a.pageNumber - b.pageNumber);
      };
      
      // Přesuň kapitolu v poli
      const [draggedChapter] = chapters.splice(draggedIndex, 1);
      chapters.splice(targetIndex, 0, draggedChapter);
      
      // Přečísluj stránky podle nového pořadí kapitol
      const reorderedPages: typeof prev.pages = [];
      let pageNum = 1;
      
      // Projdi kapitoly v novém pořadí
      for (const chapter of chapters) {
        const chapterPages = getChapterPages(chapter.id);
        let isFirstInChapter = true;
        
        for (const page of chapterPages) {
          reorderedPages.push({
            ...page,
            pageNumber: pageNum,
            startsChapterId: isFirstInChapter ? chapter.id : undefined,
          });
          isFirstInChapter = false;
          pageNum++;
        }
      }
      
      // Přidej stránky bez kapitoly na konec
      const assignedPageIds = new Set(reorderedPages.map(p => p.id));
      const unassignedPages = prev.pages
        .filter(p => !assignedPageIds.has(p.id))
        .sort((a, b) => a.pageNumber - b.pageNumber);
      
      for (const page of unassignedPages) {
        reorderedPages.push({
          ...page,
          pageNumber: pageNum,
          startsChapterId: undefined,
        });
        pageNum++;
      }
      
      return {
        ...prev,
        chapters,
        pages: reorderedPages,
        updatedAt: new Date().toISOString(),
      };
    });
    
    setDraggingChapterId(null);
    setChapterDropTargetId(null);
    toast.success('Kapitola přesunuta');
  }, []);
  
  // Změnit barvu kapitoly
  const handleChapterColorChange = useCallback((chapterId: string, newColor: string) => {
    setWorkbook(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => 
        c.id === chapterId ? { ...c, color: newColor } : c
      ),
      updatedAt: new Date().toISOString(),
    }));
    setEditingChapterColor(null);
  }, []);
  
  // Dostupné barvy pro kapitoly
  const chapterColors = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#84cc16', // lime
    '#6366f1', // indigo
  ];
  
  // Vybrat všechny stránky kapitoly
  const handleSelectChapterPages = useCallback((chapterId: string) => {
    const chapter = workbook.chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    
    // Najdi všechny stránky, které patří do této kapitoly
    const chapterPages = new Set<number>();
    
    workbook.pages.forEach(page => {
      const pageChapter = getChapterForPage(page.pageNumber, workbook.pages, workbook.chapters);
      if (pageChapter?.id === chapterId) {
        chapterPages.add(page.pageNumber);
      }
    });
    
    setSelectedPages(chapterPages);
    toast.info(`Vybráno ${chapterPages.size} stránek z kapitoly "${chapter.title}"`);
  }, [workbook.chapters, workbook.pages]);

  /** Plátno design systému / komentáře — bez postranního panelu kapitol. */
  const bookChromeHidesChapterPanel =
    viewMode === 'design' ||
    viewMode === 'design2' ||
    viewMode === 'agentPipeline' ||
    viewMode === 'collaboration';
  
  return (
    <div
      className="h-screen flex overflow-hidden text-white"
      style={{ backgroundColor: '#0f172a', colorScheme: 'dark' }}
    >
      {/* Narrow mini sidebar — always visible */}
      <ProMiniSidebar
        activePanel="add"
        onPanelChange={() => {}}
        saveStatus={saveStatus === 'saving' ? 'saving' : saveStatus === 'saved' ? 'saved' : 'idle'}
        hideAI
        appMode="book"
        bookViewMode={viewMode}
        onBookViewChange={(m) => {
          closeLibraryPanel();
          if (m === 'settings') setSettingsTab('general');
          setViewMode(m);
        }}
        onLogoClick={() => setShowLibraryPanel((o) => !o)}
      />

      {/* Knihovna místo přepínače módu — po kliknutí na logo */}
      <WorkbookInlineLibraryPanel
        isOpen={showLibraryPanel}
        onClose={closeLibraryPanel}
        currentBookId={id}
      />

      {/* Postranní panel — kniha (obálka + kapitoly) nebo navigace Nastavení */}
      {sidebarOpen && !bookChromeHidesChapterPanel && (
        <aside 
          className="flex-shrink-0 flex flex-col overflow-hidden"
          style={{
            backgroundColor: WORKBOOK_CHAPTER_PANEL_BG,
            width: viewMode === 'settings' ? '260px' : '320px',
            borderRight: '1px solid #334155',
          }}
        >
          {viewMode === 'settings' ? (
            <>
              <div className="flex flex-col border-b border-slate-700/90" style={{ padding: '12px 14px' }}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-slate-200">Nastavení</span>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-700/80 hover:text-slate-300"
                    title="Zavřít panel"
                  >
                    <PanelLeftClose size={16} />
                  </button>
                </div>
                <p className="text-[11px] leading-snug text-slate-500">{workbook.title}</p>
              </div>
              <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-3">
                <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Kniha
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsTab('general')}
                  className="mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors"
                  style={{
                    backgroundColor: settingsTab === 'general' ? 'rgba(148, 163, 184, 0.12)' : 'transparent',
                    color: settingsTab === 'general' ? '#f8fafc' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  <List size={17} strokeWidth={2} style={{ color: settingsTab === 'general' ? '#e2e8f0' : '#64748b', flexShrink: 0 }} />
                  Obecné
                </button>
                <div className="mx-4 my-2 h-px bg-slate-700/80" role="separator" />
                <button
                  type="button"
                  onClick={() => setSettingsTab('team')}
                  className="mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors"
                  style={{
                    backgroundColor: settingsTab === 'team' ? 'rgba(148, 163, 184, 0.12)' : 'transparent',
                    color: settingsTab === 'team' ? '#f8fafc' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  <Users size={17} strokeWidth={2} style={{ color: settingsTab === 'team' ? '#e2e8f0' : '#64748b', flexShrink: 0 }} />
                  Tým
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab('dataset')}
                  className="mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors"
                  style={{
                    backgroundColor: settingsTab === 'dataset' ? 'rgba(148, 163, 184, 0.12)' : 'transparent',
                    color: settingsTab === 'dataset' ? '#f8fafc' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  <Database size={17} strokeWidth={2} style={{ color: settingsTab === 'dataset' ? '#e2e8f0' : '#64748b', flexShrink: 0 }} />
                  Data set
                </button>
              </nav>
            </>
          ) : (
            <>
          {/* Title + Toggle */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
            <div className="flex items-center justify-between mb-3">
              <div />
              
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  padding: '4px',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
                title="Zavřít panel"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <BookOpen size={18} style={{ color: '#10b981', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {workbook.title}
                </h1>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {workbook.settings.pageLimit ?? DEFAULT_BOOK_PAGE_LIMIT} stran v knize ·{' '}
                    {workbook.chapters.length} kapitol
                  </span>
                  {saveStatus === 'saving' && (
                    <span style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Loader2 size={10} className="animate-spin" />
                      Ukládám...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={10} />
                      Uloženo
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Obálka + Kapitoly — jeden sloupec, přepíná hlavní plátno (covers / canvas) */}
          <div className="flex flex-col flex-1 min-h-0 border-t border-slate-700/80">
            <button
              type="button"
              onClick={() => {
                setViewMode('covers');
                closeLibraryPanel();
              }}
              className="flex w-full items-center gap-3 text-left transition-colors"
              style={{
                padding: '12px 16px',
                flexShrink: 0,
                backgroundColor: viewMode === 'covers' ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
                borderLeft: viewMode === 'covers' ? '3px solid #818cf8' : '3px solid transparent',
                color: '#f1f5f9',
                cursor: 'pointer',
                border: 'none',
                font: 'inherit',
              }}
              title="Upravit obálku knihy"
            >
              <BookOpen
                size={18}
                strokeWidth={2}
                style={{
                  color: viewMode === 'covers' ? '#a5b4fc' : '#64748b',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.01em' }}>Obálka</span>
              <ChevronRight
                size={16}
                className="ml-auto shrink-0 opacity-50"
                style={{ color: viewMode === 'covers' ? '#c7d2fe' : '#64748b' }}
              />
            </button>

            <div
              style={{
                height: 1,
                backgroundColor: '#334155',
                margin: '0 16px',
                flexShrink: 0,
              }}
              role="separator"
              aria-hidden
            />

            <div
              className="flex shrink-0 items-stretch gap-0"
              style={{ padding: '8px 8px 8px 0' }}
            >
              <button
                type="button"
                onClick={() => {
                  setViewMode('canvas');
                  closeLibraryPanel();
                }}
                className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors"
                style={{
                  padding: '8px 8px 8px 16px',
                  backgroundColor: viewMode === 'canvas' ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
                  borderLeft: viewMode === 'canvas' ? '3px solid #818cf8' : '3px solid transparent',
                  color: '#f1f5f9',
                  cursor: 'pointer',
                  border: 'none',
                  font: 'inherit',
                  borderRadius: '0 6px 6px 0',
                }}
                title="Struktura knihy a kapitoly"
              >
                <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.01em', color: '#cbd5e1' }}>
                  Kapitoly
                </span>
                <ChevronRight
                  size={16}
                  className="ml-auto shrink-0 opacity-50"
                  style={{ color: viewMode === 'canvas' ? '#c7d2fe' : '#64748b' }}
                />
              </button>
              {viewMode === 'canvas' && (
                <button
                  type="button"
                  className="flex shrink-0 items-center justify-center rounded-md p-2 text-slate-400 hover:bg-slate-700/80 hover:text-white"
                  title="Nová kapitola (od 1. strany)"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartChapter(1);
                  }}
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

          {/* Seznam kapitol — jen při pohledu na plátno */}
          {viewMode === 'canvas' && (
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-700/50">
              <DndProvider backend={HTML5Backend}>
                <div className="p-4 pt-3">
                <div>
                  {(() => {
                    // Kapitoly jsou v pořadí jak jsou v poli (uživatel je může přesouvat drag & drop)
                    return workbook.chapters.map((chapter, chapterIndex) => {
                      // Získej stránky v kapitole
                      const chapterPages = workbook.pages
                        .filter(p => getChapterForPage(p.pageNumber, workbook.pages, workbook.chapters)?.id === chapter.id)
                        .sort((a, b) => a.pageNumber - b.pageNumber);
                      
                      const pagesInfo = chapterPages.map(page => ({
                        id: page.id,
                        pageNumber: page.pageNumber,
                        worksheetId: page.worksheetId,
                        worksheetTitle: workbook.worksheets[page.worksheetId]?.title,
                      }));
                      
                      return (
                        <ChapterItem
                          key={chapter.id}
                          id={chapter.id}
                          title={chapter.title}
                          color={chapter.color}
                          index={chapterIndex}
                          pages={pagesInfo}
                          isExpanded={expandedChapters.has(chapter.id)}
                          isHovered={hoveredChapterId === chapter.id}
                          selectedPages={selectedPages}
                          moveChapter={handleChapterDrop}
                          onDelete={handleDeleteChapter}
                          onToggleExpand={() => {
                            setExpandedChapters(prev => {
                              const next = new Set(prev);
                              if (next.has(chapter.id)) {
                                next.delete(chapter.id);
                              } else {
                                next.add(chapter.id);
                              }
                              return next;
                            });
                          }}
                          onHover={(hovered) => setHoveredChapterId(hovered ? chapter.id : null)}
                          onSelectChapterPages={handleSelectChapterPages}
                          onPageSelect={handlePageSelect}
                          onMovePage={(pageNumber, targetChapterId) => {
                            // Přesunout stránku do kapitoly a přečíslovat
                            const chapter = workbook.chapters.find(c => c.id === targetChapterId);
                            if (!chapter) return;
                            
                            setWorkbook(prev => {
                              // Najdi stránku kterou přesouváme
                              const movingPage = prev.pages.find(p => p.pageNumber === pageNumber);
                              if (!movingPage) return prev;
                              
                              // Získej stránky pro každou kapitolu
                              const getChapterPages = (chapterId: string) => {
                                return prev.pages
                                  .filter(p => getChapterForPage(p.pageNumber, prev.pages, prev.chapters)?.id === chapterId)
                                  .filter(p => p.id !== movingPage.id) // Vynech přesouvanou stránku
                                  .sort((a, b) => a.pageNumber - b.pageNumber);
                              };
                              
                              // Přečísluj stránky
                              const reorderedPages: typeof prev.pages = [];
                              let newPageNum = 1;
                              
                              for (const ch of prev.chapters) {
                                const chapterPages = getChapterPages(ch.id);
                                
                                // Pokud je toto cílová kapitola, přidej přesouvanou stránku na konec
                                if (ch.id === targetChapterId) {
                                  // Nejdřív existující stránky kapitoly
                                  let isFirstInChapter = true;
                                  for (const page of chapterPages) {
                                    reorderedPages.push({
                                      ...page,
                                      pageNumber: newPageNum,
                                      startsChapterId: isFirstInChapter ? ch.id : undefined,
                                    });
                                    isFirstInChapter = false;
                                    newPageNum++;
                                  }
                                  // Pak přesouvaná stránka
                                  reorderedPages.push({
                                    ...movingPage,
                                    pageNumber: newPageNum,
                                    startsChapterId: chapterPages.length === 0 ? ch.id : undefined,
                                  });
                                  newPageNum++;
                                } else {
                                  // Normální kapitola
                                  let isFirstInChapter = true;
                                  for (const page of chapterPages) {
                                    reorderedPages.push({
                                      ...page,
                                      pageNumber: newPageNum,
                                      startsChapterId: isFirstInChapter ? ch.id : undefined,
                                    });
                                    isFirstInChapter = false;
                                    newPageNum++;
                                  }
                                }
                              }
                              
                              // Přidej stránky bez kapitoly na konec
                              const assignedPageIds = new Set(reorderedPages.map(p => p.id));
                              const unassignedPages = prev.pages
                                .filter(p => !assignedPageIds.has(p.id))
                                .sort((a, b) => a.pageNumber - b.pageNumber);
                              
                              for (const page of unassignedPages) {
                                reorderedPages.push({
                                  ...page,
                                  pageNumber: newPageNum,
                                  startsChapterId: undefined,
                                });
                                newPageNum++;
                              }
                              
                              return {
                                ...prev,
                                pages: reorderedPages,
                                updatedAt: new Date().toISOString(),
                              };
                            });
                            
                            toast.success(`Stránka přesunuta do kapitoly "${chapter.title}"`);
                          }}
                        />
                      );
                    });
                  })()}
                </div>
              </div>
            </DndProvider>
          </div>
          )}
          </div>
            </>
          )}
        </aside>
      )}
      
      {/* Toggle sidebar button when closed (jen když panel v daném režimu existuje) */}
      {!sidebarOpen && !bookChromeHidesChapterPanel && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 50,
            padding: '8px',
            borderRadius: '8px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
          title="Otevřít panel"
        >
          <PanelLeft size={18} />
        </button>
      )}
        
      {/* Canvas area */}
        <main 
          ref={canvasContainerRef}
          className={
            bookChromeHidesChapterPanel
              ? 'relative flex min-h-0 flex-1 flex-col overflow-hidden'
              : 'relative min-h-0 flex-1'
          }
          style={{
            backgroundColor:
              bookChromeHidesChapterPanel
                ? '#0d1117'
                : viewMode === 'settings'
                  ? WORKBOOK_CHAPTER_PANEL_BG
                  : '#060a11',
            colorScheme: 'dark',
          }}
          onMouseDown={viewMode === 'canvas' ? handleLassoStart : undefined}
          onMouseMove={viewMode === 'canvas' ? handleLassoMove : undefined}
          onMouseUp={viewMode === 'canvas' ? handleLassoEnd : undefined}
          onMouseLeave={viewMode === 'canvas' ? handleLassoEnd : undefined}
        >
        {/* Loading overlay while fetching real worksheets */}
        {loadingReal && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            backgroundColor: 'rgba(15,23,42,0.8)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px',
          }}>
            <Loader2 size={32} className="animate-spin" style={{ color: '#3B82F6' }} />
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Načítám kapitoly…</span>
          </div>
        )}
          {/* Lasso selection overlay */}
          {lassoRect && (
            <div
              style={{
                position: 'absolute',
                left: lassoRect.left,
                top: lassoRect.top,
                width: lassoRect.width,
                height: lassoRect.height,
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '2px solid #3b82f6',
                borderRadius: '4px',
                pointerEvents: 'none',
                zIndex: 1000,
              }}
            />
          )}
          
          {viewMode === 'canvas' ? (
            <InfiniteCanvas showControls={true} onCanvasStateChange={(state) => setCanvasZoom(state.zoom)}>
              {/* Workbook content - centered container */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                transform: 'translateX(-50%)',
              }}>
                {/* Page spreads grid - 3 items per row with chapter breaks */}
                {/* Layout: Page 1 (single), then spreads 2-3, 4-5, 6-7, etc., ending with single page if even total */}
                {(() => {
                  // Use pageLimit from book settings, but always show at least the pages we have content for
                  const totalPages = Math.max(
                    workbook.settings.pageLimit ?? DEFAULT_BOOK_PAGE_LIMIT,
                    workbook.pages.length,
                    1,
                  );
                  
                  // Build items: first page single, then spreads, last page single if even
                  type SpreadItem = { 
                    type: 'single'; 
                    pageNum: number;
                    chapterId?: string;
                    startsNewChapter: boolean;
                    chapterInfo?: { id: string; title: string; color: string };
                  } | { 
                    type: 'spread'; 
                    leftPage: number; 
                    rightPage: number;
                    chapterId?: string;
                    startsNewChapter: boolean;
                    chapterInfo?: { id: string; title: string; color: string };
                  };
                  const items: SpreadItem[] = [];
                  
                  let lastChapterId: string | null = null;
                  
                  // Helper: získej kapitolu pro stránku (používá novou logiku)
                  const getPageChapter = (pageNum: number) => {
                    return getChapterForPage(pageNum, workbook.pages, workbook.chapters);
                  };
                  
                  // Helper: zjisti jestli na stránce ZAČÍNÁ nová kapitola
                  const pageStartsChapter = (pageNum: number) => {
                    return getChapterStartingAtPage(pageNum, workbook.pages, workbook.chapters);
                  };
                  
                  // Page 1 is always single (titulní strana)
                  const page1Chapter = getPageChapter(1);
                  const page1StartsChapter = pageStartsChapter(1);
                  items.push({ 
                    type: 'single', 
                    pageNum: 1,
                    chapterId: page1Chapter?.id,
                    startsNewChapter: !!page1StartsChapter,
                    chapterInfo: page1StartsChapter || undefined,
                  });
                  lastChapterId = page1Chapter?.id || null;
                  
                  // Spreads: 2-3, 4-5, 6-7, etc.
                  // Ale pokud pravá stránka začíná kapitolu, rozděl spread na dvě single pages
                  for (let leftPage = 2; leftPage < totalPages; leftPage += 2) {
                    const rightPage = leftPage + 1;
                    if (rightPage <= totalPages) {
                      const leftChapter = getPageChapter(leftPage);
                      const rightChapter = getPageChapter(rightPage);
                      const leftStartsChapter = pageStartsChapter(leftPage);
                      const rightStartsChapter = pageStartsChapter(rightPage);
                      
                      // Pokud PRAVÁ stránka začíná kapitolu, rozděl spread
                      if (rightStartsChapter) {
                        // Levá stránka jako single
                        items.push({
                          type: 'single',
                          pageNum: leftPage,
                          chapterId: leftChapter?.id,
                          startsNewChapter: !!leftStartsChapter,
                          chapterInfo: leftStartsChapter || undefined,
                        });
                        
                        // Pravá stránka jako single - začíná novou kapitolu
                        items.push({
                          type: 'single',
                          pageNum: rightPage,
                          chapterId: rightChapter?.id,
                          startsNewChapter: true,
                          chapterInfo: rightStartsChapter,
                        });
                      } else {
                        // Normální spread
                        const spreadChapter = leftChapter;
                        const startsNewChapter = !!leftStartsChapter;
                        
                        items.push({ 
                          type: 'spread', 
                          leftPage, 
                          rightPage,
                          chapterId: spreadChapter?.id,
                          startsNewChapter,
                          chapterInfo: leftStartsChapter || undefined,
                        });
                      }
                      
                      if (rightChapter) {
                        lastChapterId = rightChapter.id;
                      } else if (leftChapter) {
                        lastChapterId = leftChapter.id;
                      }
                    }
                  }
                  
                  // Last page is single if total is even
                  if (totalPages % 2 === 0) {
                    const lastPageChapter = getPageChapter(totalPages);
                    const lastStartsChapter = pageStartsChapter(totalPages);
                    items.push({ 
                      type: 'single', 
                      pageNum: totalPages,
                      chapterId: lastPageChapter?.id,
                      startsNewChapter: !!lastStartsChapter,
                      chapterInfo: lastStartsChapter || undefined,
                    });
                  }
                  
                  const itemsPerRow = 3;
                  
                  // Group items into rows, but start new row when chapter changes
                  type RowGroup = { items: SpreadItem[]; chapterInfo?: { id: string; title: string; color: string } };
                  const rowGroups: RowGroup[] = [];
                  let currentRow: SpreadItem[] = [];
                  
                  items.forEach((item, idx) => {
                    // If item starts new chapter, finalize current row and start new one
                    if (item.startsNewChapter && currentRow.length > 0) {
                      rowGroups.push({ items: currentRow });
                      currentRow = [];
                    }
                    
                    currentRow.push(item);
                    
                    // If row is full, finalize it
                    if (currentRow.length >= itemsPerRow) {
                      const chapterInfo = currentRow.find(i => i.chapterInfo)?.chapterInfo;
                      rowGroups.push({ items: currentRow, chapterInfo });
                      currentRow = [];
                    }
                  });
                  
                  // Don't forget the last partial row
                  if (currentRow.length > 0) {
                    const chapterInfo = currentRow.find(i => i.chapterInfo)?.chapterInfo;
                    rowGroups.push({ items: currentRow, chapterInfo });
                  }
                  
                  return (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '32px',
                      alignItems: 'center',
                    }}>
                      {rowGroups.map((rowGroup, rowIndex) => {
                        const rowItems = rowGroup.items;
                        
                        // Check if first item in this row starts a new chapter
                        const rowStartsNewChapter = rowItems[0]?.startsNewChapter;
                        const chapterInfo = rowItems[0]?.chapterInfo || rowGroup.chapterInfo;
                        const estimatedHeight = rowStartsNewChapter && rowIndex > 0 ? 322 : 262;
                        
                        return (
                          <VirtualizedWorkbookRow
                            key={rowIndex}
                            estimatedHeight={estimatedHeight}
                          >
                            <div 
                              style={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                alignItems: 'center',
                                marginTop: rowStartsNewChapter && rowIndex > 0 ? '60px' : '0',
                              }}
                            >
                              <div style={{ 
                                display: 'flex', 
                                gap: '24px',
                                justifyContent: 'flex-start',
                              }}>
                              {rowItems.map((item, idx) => {
                              // Check if THIS item specifically starts a new chapter (for mid-row breaks)
                              const itemStartsChapter = item.startsNewChapter && idx > 0;
                              
                              if (item.type === 'single') {
                                const pageNum = item.pageNum;
                                const page = workbook.pages.find(p => p.pageNumber === pageNum);
                                const ws = page ? workbook.worksheets[page.worksheetId] : null;
                                const isFirst = pageNum === 1;
                                const isLast = pageNum === totalPages;
                                const pageChapter = getChapterForPage(pageNum, workbook.pages, workbook.chapters);
                                const startsChapter = getChapterStartingAtPage(pageNum, workbook.pages, workbook.chapters);
                                
                                return (
                                  <div 
                                    key={`single-${pageNum}`}
                                    style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      position: 'relative',
                                      paddingTop: '32px', // Fixed space for badge
                                    }}
                                  >
                                    {/* Badge kapitoly nad stránkou - fixed size nezávislá na zoomu */}
                                    {startsChapter && (
                                      <div 
                                        style={{
                                          position: 'absolute',
                                          top: 0,
                                          left: '50%',
                                          transform: `translateX(-50%) scale(${1 / canvasZoom})`,
                                          transformOrigin: 'center top',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '4px 12px',
                                          backgroundColor: '#0f172a',
                                          border: `2px solid ${startsChapter.color}`,
                                          borderRadius: '16px',
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                          zIndex: 50,
                                        }}
                                        onClick={() => handleSelectChapterPages(startsChapter.id)}
                                        title="Klikni pro výběr všech stránek této kapitoly"
                                      >
                                        <div style={{
                                          width: '8px',
                                          height: '8px',
                                          borderRadius: '50%',
                                          backgroundColor: startsChapter.color,
                                        }} />
                                        <span style={{
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          color: startsChapter.color,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.5px',
                                        }}>
                                          {startsChapter.title}
                                        </span>
                                      </div>
                                    )}
                                    
                                    <div 
                                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
                                      onMouseEnter={(e) => {
                                        const btn = e.currentTarget.querySelector('.add-chapter-btn') as HTMLElement;
                                        if (btn) btn.style.opacity = '1';
                                      }}
                                      onMouseLeave={(e) => {
                                        const btn = e.currentTarget.querySelector('.add-chapter-btn') as HTMLElement;
                                        if (btn) btn.style.opacity = '0';
                                      }}
                                    >
                                      {/* Chapter color bar removed */}
                                      <div 
                                        data-page={pageNum}
                                        draggable
                                        onClick={(e) => {
                                          if (e.ctrlKey || e.metaKey) {
                                            e.stopPropagation();
                                            handlePageSelect(pageNum, true);
                                          } else if (selectedPages.size > 0 && !isDragging) {
                                            handlePageSelect(pageNum, false);
                                          } else if (page) {
                                            handleEditPage(page.id, page.worksheetId, page.worksheetPageIndex);
                                          } else {
                                            // Empty placeholder — create a new chapter here
                                            handleAddChapterAtPage(pageNum);
                                          }
                                        }}
                                        onDragStart={(e) => {
                                          e.dataTransfer.effectAllowed = 'move';
                                          e.dataTransfer.setData('text/plain', String(pageNum));
                                          handleDragStart(pageNum);
                                        }}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          setDropTarget({ type: 'position', value: pageNum });
                                        }}
                                        onDragLeave={() => setDropTarget(null)}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          handleDropOnPosition(pageNum);
                                        }}
                                        style={{
                                          width: '140px',
                                          height: '198px',
                                          backgroundColor: ws ? '#f8fafc' : '#1e293b',
                                          borderRadius: '8px',
                                          border: selectedPages.has(pageNum) 
                                            ? `3px solid ${pageChapter?.color || '#3b82f6'}` 
                                            : dropTarget?.type === 'position' && dropTarget.value === pageNum
                                              ? '3px solid #22c55e'
                                              : ws ? '1px solid #e2e8f0' : '2px dashed #334155',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '8px',
                                          cursor: isDragging ? 'grabbing' : 'pointer',
                                          transition: 'all 0.15s',
                                          position: 'relative',
                                          opacity: draggedPages.includes(pageNum) ? 0.5 : 1,
                                          boxShadow: selectedPages.has(pageNum) 
                                            ? `0 12px 32px -4px ${pageChapter?.color || '#3b82f6'}90, 0 6px 16px -2px ${pageChapter?.color || '#3b82f6'}60` 
                                            : 'none',
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isDragging) {
                                            e.currentTarget.style.transform = 'scale(1.02)';
                                            const btn = e.currentTarget.querySelector('.add-chapter-btn') as HTMLElement;
                                            if (btn) btn.style.opacity = '1';
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'scale(1)';
                                          const btn = e.currentTarget.querySelector('.add-chapter-btn') as HTMLElement;
                                          if (btn) btn.style.opacity = '0';
                                        }}
                                      >
                                        {/* Selection indicator with chapter color */}
                                        {selectedPages.has(pageNum) && (
                                          <div style={{
                                            position: 'absolute',
                                            top: '-8px',
                                            right: '-8px',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            backgroundColor: pageChapter?.color || '#3b82f6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 10,
                                          }}>
                                            <Check size={12} style={{ color: '#fff' }} />
                                          </div>
                                        )}
                                        {ws ? (
                                          <WorkbookLivePagePreview
                                            worksheet={ws}
                                            pageIndex={page?.worksheetPageIndex ?? 0}
                                            width={140}
                                            height={198}
                                            onLoadRequested={() => ensureWorksheetLoaded(page!.worksheetId)}
                                          />
                                        ) : (
                                          <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            width: '100%',
                                            height: '100%',
                                            padding: '8px',
                                          }}>
                                            <div
                                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                                              onMouseEnter={e => {
                                                const plusEl = e.currentTarget.querySelector('svg') as SVGElement | null;
                                                if (plusEl) plusEl.style.color = '#94a3b8';
                                                const label = e.currentTarget.querySelector('span') as HTMLElement | null;
                                                if (label) label.style.color = '#94a3b8';
                                              }}
                                              onMouseLeave={e => {
                                                const plusEl = e.currentTarget.querySelector('svg') as SVGElement | null;
                                                if (plusEl) plusEl.style.color = '#475569';
                                                const label = e.currentTarget.querySelector('span') as HTMLElement | null;
                                                if (label) label.style.color = '#64748b';
                                              }}
                                            >
                                              <Plus size={22} style={{ color: '#475569', transition: 'color 120ms' }} />
                                              <span style={{ fontSize: '11px', color: '#64748b', transition: 'color 120ms' }}>Nová kapitola</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      {/* Page number below card */}
                                      <span style={{ 
                                        fontSize: '14px', 
                                        color: '#64748b',
                                        fontWeight: 600,
                                        marginTop: '8px',
                                      }}>
                                        {pageNum}
                                      </span>
                                      {/* Hover button to add chapter - above card (only if no chapter starts here) */}
                                      {!startsChapter && (
                                        <button
                                          className="add-chapter-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartChapter(pageNum);
                                          }}
                                          style={{
                                            position: 'absolute',
                                            top: '-28px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            border: '1px dashed #475569',
                                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                            color: '#94a3b8',
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            opacity: 0,
                                            transition: 'all 0.2s',
                                            zIndex: 5,
                                          }}
                                          title="Začít novou kapitolu zde"
                                        >
                                          + Přidat kapitolu
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              } else {
                                // Spread
                                const { leftPage: leftPageNum, rightPage: rightPageNum } = item;
                                const leftPage = workbook.pages.find(p => p.pageNumber === leftPageNum);
                                const rightPage = workbook.pages.find(p => p.pageNumber === rightPageNum);
                                const leftWs = leftPage ? workbook.worksheets[leftPage.worksheetId] : null;
                                const rightWs = rightPage ? workbook.worksheets[rightPage.worksheetId] : null;
                                const leftChapter = getChapterForPage(leftPageNum, workbook.pages, workbook.chapters);
                                const rightChapter = getChapterForPage(rightPageNum, workbook.pages, workbook.chapters);
                                // Kapitola může začínat na levé NEBO pravé stránce spreadu
                                const leftStartsChapter = getChapterStartingAtPage(leftPageNum, workbook.pages, workbook.chapters);
                                const rightStartsChapter = getChapterStartingAtPage(rightPageNum, workbook.pages, workbook.chapters);
                                const startsChapter = leftStartsChapter || rightStartsChapter;
                                
                                // Can always start new chapter (just sets startsChapterId on this page)
                                const canStartChapter = true;
                                
                                // Pozice badge - nad levou nebo pravou stránkou podle toho kde kapitola začíná
                                // Spread: levá stránka 140px + 4px gap + pravá stránka 140px = 284px
                                // Střed levé: 70px, střed pravé: 70 + 4 + 140 = 214px
                                const badgePosition = leftStartsChapter ? '70px' : '214px';
                                
                                return (
                                  <div 
                                    key={`spread-${leftPageNum}`}
                                    style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      position: 'relative',
                                      paddingTop: '32px', // Fixed space for badge
                                      width: '284px', // 140px + 4px gap + 140px
                                    }}
                                  >
                                    {/* Badge kapitoly nad stránkou - fixed size nezávislá na zoomu */}
                                    {startsChapter && (
                                      <div 
                                        style={{
                                          position: 'absolute',
                                          top: 0,
                                          left: badgePosition,
                                          transform: `translateX(-50%) scale(${1 / canvasZoom})`,
                                          transformOrigin: 'center top',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '4px 12px',
                                          backgroundColor: '#0f172a',
                                          border: `2px solid ${startsChapter.color}`,
                                          borderRadius: '16px',
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                          zIndex: 50,
                                        }}
                                        onClick={() => handleSelectChapterPages(startsChapter.id)}
                                        title="Klikni pro výběr všech stránek této kapitoly"
                                      >
                                        <div style={{
                                          width: '8px',
                                          height: '8px',
                                          borderRadius: '50%',
                                          backgroundColor: startsChapter.color,
                                        }} />
                                        <span style={{
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          color: startsChapter.color,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.5px',
                                        }}>
                                          {startsChapter.title}
                                        </span>
                                      </div>
                                    )}
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
                                      <div style={{ display: 'flex', gap: '4px', position: 'relative' }}>
                                      {/* Chapter color bar removed */}
                                      
                                      {/* Left page wrapper */}
                                      <div 
                                        style={{ position: 'relative' }}
                                        onMouseEnter={(e) => {
                                          const btn = e.currentTarget.querySelector('.add-chapter-btn-left') as HTMLElement;
                                          if (btn) btn.style.opacity = '1';
                                        }}
                                        onMouseLeave={(e) => {
                                          const btn = e.currentTarget.querySelector('.add-chapter-btn-left') as HTMLElement;
                                          if (btn) btn.style.opacity = '0';
                                        }}
                                      >
                                        {/* Hover button for left page */}
                                        {!leftStartsChapter && (
                                          <button
                                            className="add-chapter-btn-left"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartChapter(leftPageNum);
                                            }}
                                            style={{
                                              position: 'absolute',
                                              top: '-28px',
                                              left: '50%',
                                              transform: 'translateX(-50%)',
                                              padding: '4px 10px',
                                              borderRadius: '12px',
                                              border: '1px dashed #475569',
                                              backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                              color: '#94a3b8',
                                              fontSize: '11px',
                                              fontWeight: 500,
                                              cursor: 'pointer',
                                              whiteSpace: 'nowrap',
                                              opacity: 0,
                                              transition: 'all 0.2s',
                                              zIndex: 5,
                                            }}
                                            title="Začít novou kapitolu zde"
                                          >
                                            + Přidat kapitolu
                                          </button>
                                        )}
                                        <div 
                                          data-page={leftPageNum}
                                          draggable
                                          onClick={(e) => {
                                            if (e.ctrlKey || e.metaKey) {
                                              e.stopPropagation();
                                              handlePageSelect(leftPageNum, true);
                                            } else if (selectedPages.size > 0 && !isDragging) {
                                              handlePageSelect(leftPageNum, false);
                                            } else if (leftPage) {
                                              handleEditPage(leftPage.id, leftPage.worksheetId, leftPage.worksheetPageIndex);
                                            } else {
                                              handleAddChapterAtPage(leftPageNum);
                                            }
                                          }}
                                          onDragStart={(e) => {
                                            e.dataTransfer.effectAllowed = 'move';
                                            handleDragStart(leftPageNum);
                                          }}
                                          onDragEnd={handleDragEnd}
                                          onDragOver={(e) => {
                                            e.preventDefault();
                                            setDropTarget({ type: 'position', value: leftPageNum });
                                          }}
                                          onDragLeave={() => setDropTarget(null)}
                                          onDrop={(e) => {
                                            e.preventDefault();
                                            handleDropOnPosition(leftPageNum);
                                          }}
                                        style={{
                                          width: '140px',
                                          height: '198px',
                                          backgroundColor: leftWs ? '#f8fafc' : '#1e293b',
                                          borderRadius: '4px 0 0 4px',
                                          border: selectedPages.has(leftPageNum) 
                                            ? `3px solid ${leftChapter?.color || '#3b82f6'}` 
                                            : dropTarget?.type === 'position' && dropTarget.value === leftPageNum
                                              ? '3px solid #22c55e'
                                              : leftWs ? '1px solid #e2e8f0' : '2px dashed #334155',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '8px',
                                          cursor: isDragging ? 'grabbing' : 'pointer',
                                          transition: 'all 0.15s',
                                          position: 'relative',
                                          opacity: draggedPages.includes(leftPageNum) ? 0.5 : 1,
                                          boxShadow: selectedPages.has(leftPageNum) 
                                            ? `0 12px 32px -4px ${leftChapter?.color || '#3b82f6'}90, 0 6px 16px -2px ${leftChapter?.color || '#3b82f6'}60` 
                                            : 'none',
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isDragging) e.currentTarget.style.transform = 'scale(1.02)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                      >
                                        {/* Selection indicator with chapter color */}
                                        {selectedPages.has(leftPageNum) && (
                                          <div style={{
                                            position: 'absolute',
                                            top: '-8px',
                                            right: '-8px',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            backgroundColor: leftChapter?.color || '#3b82f6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 10,
                                          }}>
                                            <Check size={12} style={{ color: '#fff' }} />
                                          </div>
                                        )}
                                        {leftWs ? (
                                          <WorkbookLivePagePreview
                                            worksheet={leftWs}
                                            pageIndex={leftPage?.worksheetPageIndex ?? 0}
                                            width={140}
                                            height={198}
                                            borderRadius="4px 0 0 4px"
                                            onLoadRequested={() => ensureWorksheetLoaded(leftPage!.worksheetId)}
                                          />
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                            <Plus size={22} style={{ color: '#475569' }} />
                                            <span style={{ fontSize: '11px', color: '#64748b' }}>Nová kapitola</span>
                                          </div>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Right page wrapper */}
                                      <div 
                                        style={{ position: 'relative' }}
                                        onMouseEnter={(e) => {
                                          const btn = e.currentTarget.querySelector('.add-chapter-btn-right') as HTMLElement;
                                          if (btn) btn.style.opacity = '1';
                                        }}
                                        onMouseLeave={(e) => {
                                          const btn = e.currentTarget.querySelector('.add-chapter-btn-right') as HTMLElement;
                                          if (btn) btn.style.opacity = '0';
                                        }}
                                      >
                                        {/* Hover button for right page */}
                                        {!rightStartsChapter && (
                                          <button
                                            className="add-chapter-btn-right"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartChapter(rightPageNum);
                                            }}
                                            style={{
                                              position: 'absolute',
                                              top: '-28px',
                                              left: '50%',
                                              transform: 'translateX(-50%)',
                                              padding: '4px 10px',
                                              borderRadius: '12px',
                                              border: '1px dashed #475569',
                                              backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                              color: '#94a3b8',
                                              fontSize: '11px',
                                              fontWeight: 500,
                                              cursor: 'pointer',
                                              whiteSpace: 'nowrap',
                                              opacity: 0,
                                              transition: 'all 0.2s',
                                              zIndex: 5,
                                            }}
                                            title="Začít novou kapitolu zde"
                                          >
                                            + Přidat kapitolu
                                          </button>
                                        )}
                                        <div 
                                          data-page={rightPageNum}
                                          draggable
                                          onClick={(e) => {
                                            if (e.ctrlKey || e.metaKey) {
                                              e.stopPropagation();
                                              handlePageSelect(rightPageNum, true);
                                            } else if (selectedPages.size > 0 && !isDragging) {
                                              handlePageSelect(rightPageNum, false);
                                            } else if (rightPage) {
                                              handleEditPage(rightPage.id, rightPage.worksheetId, rightPage.worksheetPageIndex);
                                            } else {
                                              handleAddChapterAtPage(rightPageNum);
                                            }
                                          }}
                                          onDragStart={(e) => {
                                            e.dataTransfer.effectAllowed = 'move';
                                          handleDragStart(rightPageNum);
                                        }}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          setDropTarget({ type: 'position', value: rightPageNum });
                                        }}
                                        onDragLeave={() => setDropTarget(null)}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          handleDropOnPosition(rightPageNum);
                                        }}
                                        style={{
                                          width: '140px',
                                          height: '198px',
                                          backgroundColor: rightWs ? '#f8fafc' : '#1e293b',
                                          borderRadius: '0 4px 4px 0',
                                          border: selectedPages.has(rightPageNum) 
                                            ? `3px solid ${rightChapter?.color || '#3b82f6'}` 
                                            : dropTarget?.type === 'position' && dropTarget.value === rightPageNum
                                              ? '3px solid #22c55e'
                                              : rightWs ? '1px solid #e2e8f0' : '2px dashed #334155',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '8px',
                                          cursor: isDragging ? 'grabbing' : 'pointer',
                                          transition: 'all 0.15s',
                                          position: 'relative',
                                          opacity: draggedPages.includes(rightPageNum) ? 0.5 : 1,
                                          boxShadow: selectedPages.has(rightPageNum) 
                                            ? `0 12px 32px -4px ${rightChapter?.color || '#3b82f6'}90, 0 6px 16px -2px ${rightChapter?.color || '#3b82f6'}60` 
                                            : 'none',
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isDragging) e.currentTarget.style.transform = 'scale(1.02)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                      >
                                        {/* Selection indicator with chapter color */}
                                        {selectedPages.has(rightPageNum) && (
                                          <div style={{
                                            position: 'absolute',
                                            top: '-8px',
                                            right: '-8px',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            backgroundColor: rightChapter?.color || '#3b82f6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 10,
                                          }}>
                                            <Check size={12} style={{ color: '#fff' }} />
                                          </div>
                                        )}
                                        {rightWs ? (
                                          <WorkbookLivePagePreview
                                            worksheet={rightWs}
                                            pageIndex={rightPage?.worksheetPageIndex ?? 0}
                                            width={140}
                                            height={198}
                                            borderRadius="0 4px 4px 0"
                                            onLoadRequested={() => ensureWorksheetLoaded(rightPage!.worksheetId)}
                                          />
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                            <Plus size={22} style={{ color: '#475569' }} />
                                            <span style={{ fontSize: '11px', color: '#64748b' }}>Nová kapitola</span>
                                          </div>
                                          )}
                                        </div>
                                      </div>
                                      </div>
                                      {/* Page numbers below spread */}
                                      <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                                        <span style={{ 
                                          width: '140px',
                                          textAlign: 'center',
                                          fontSize: '14px', 
                                          color: '#64748b',
                                          fontWeight: 600,
                                        }}>
                                          {leftPageNum}
                                        </span>
                                        <span style={{ 
                                          width: '140px',
                                          textAlign: 'center',
                                          fontSize: '14px', 
                                          color: '#64748b',
                                          fontWeight: 600,
                                        }}>
                                          {rightPageNum}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                            })}
                              </div>
                            </div>
                          </VirtualizedWorkbookRow>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </InfiniteCanvas>
          ) : viewMode === 'covers' ? (
            // Covers view - 4 strany obálky
            <InfiniteCanvas showControls={true} onCanvasStateChange={(state) => setCanvasZoom(state.zoom)}>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                transform: 'translateX(-50%)',
              }}>
                {/* Cover title */}
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                  <h1 
                    style={{ 
                      fontSize: '28px', 
                      fontWeight: 300, 
                      color: '#cbd5e1', 
                      marginBottom: '12px',
                      fontFamily: "'Georgia', serif",
                    }}
                  >
                    Obálky sešitu
                  </h1>
                  <p style={{ color: '#64748b', fontSize: '14px' }}>
                    4 strany: Přední, Vnitřní přední, Vnitřní zadní, Zadní
                  </p>
                </div>
                
                {/* Cover spreads - 2x2 grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '32px',
                }}>
                  {/* Front cover (přední obálka) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{
                        width: '210px',
                        height: '297px',
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: '2px solid #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#334155';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      {workbook.coverImage ? (
                        <img 
                          src={workbook.coverImage} 
                          alt="Cover" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }}
                        />
                      ) : (
                        <>
                          <BookOpen size={48} style={{ color: '#475569' }} />
                          <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 500 }}>Přední obálka</span>
                        </>
                      )}
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>PŘEDNÍ</span>
                  </div>
                  
                  {/* Inside front cover (vnitřní přední) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{
                        width: '210px',
                        height: '297px',
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: '2px dashed #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#334155';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <Plus size={32} style={{ color: '#475569' }} />
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Vnitřní přední</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>VNITŘNÍ PŘEDNÍ</span>
                  </div>
                  
                  {/* Inside back cover (vnitřní zadní) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{
                        width: '210px',
                        height: '297px',
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: '2px dashed #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#334155';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <Plus size={32} style={{ color: '#475569' }} />
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Vnitřní zadní</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>VNITŘNÍ ZADNÍ</span>
                  </div>
                  
                  {/* Back cover (zadní obálka) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{
                        width: '210px',
                        height: '297px',
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: '2px dashed #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#334155';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <Plus size={32} style={{ color: '#475569' }} />
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Zadní obálka</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>ZADNÍ</span>
                  </div>
                </div>
              </div>
            </InfiniteCanvas>
          ) : viewMode === 'design' ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ backgroundColor: '#0d1117' }}>
              <DesignSystemPanel
                activeDesignSystem={bookDesignSystem}
                onDesignSystemChange={handleBookDesignSystemChange}
                onApplyToProject={persistBookDesignSystemSelection}
                activeCategory={designSidebarCategory}
                onCategoryChange={setDesignSidebarCategory}
                openLayoutInProEditor={openDesignSystemLayoutInProEditor}
              />
            </div>
          ) : viewMode === 'design2' ? (
            <DesignSystemCanvasWorkspace
              activeDesignSystem={bookDesignSystem}
              onDesignSystemChange={handleBookDesignSystemChange}
              bookEditorContext={{
                bookId: workbook.id,
                workbookId: workbook.id,
                pageFormat: workbook.settings.pageFormat,
              }}
              onApplyToBook={persistBookDesignSystemSelection}
              onOpenClassicEditor={(layoutId, dsSnapshot) => {
                if (layoutId) openDesignSystemLayoutInProEditor(layoutId, dsSnapshot);
              }}
            />
          ) : viewMode === 'agentPipeline' ? (
            <BookAgentPipelineWorkspace
              bookId={workbook.id}
              bookDesignSystem={bookDesignSystem}
              onApplyPipelineDatasetToBook={handleApplyPipelineDatasetToBook}
            />
          ) : viewMode === 'collaboration' ? (
            <WorkbookCollaborationPanel bookId={id ?? ''} />
          ) : (
            <div className={ST.shell} style={STShellStyle}>
              <div className={ST.inner} style={STInnerStyle}>
                {settingsTab === 'general' && (
                  <>
                    <header className="mb-9">
                      <h1 className={ST.h1}>Obecné</h1>
                      <p className={ST.lead}>Název, popis, formát a zobrazení sešitu</p>
                    </header>

                    <section className={ST.card} style={STCardStyle}>
                      <h2 className={ST.cardTitle}>Základní údaje</h2>
                      <div className="mt-5 space-y-5">
                        <div>
                          <label className={ST.labelCap}>Název sešitu</label>
                          <input
                            type="text"
                            value={workbook.title}
                            onChange={(e) => setWorkbook((prev) => ({ ...prev, title: e.target.value }))}
                            className={ST.field}
                            style={STFieldStyle}
                            placeholder="Název knihy…"
                          />
                        </div>
                        <div>
                          <label className={ST.labelCap}>Popis</label>
                          <textarea
                            value={workbook.description}
                            onChange={(e) => setWorkbook((prev) => ({ ...prev, description: e.target.value }))}
                            rows={4}
                            className={`${ST.field} resize-none`}
                            style={STFieldStyle}
                            placeholder="Krátký popis nebo poznámka pro tebe…"
                          />
                        </div>
                      </div>
                    </section>

                    <section className={ST.card} style={STCardStyle}>
                      <h2 className={ST.cardTitle}>Formát stránky</h2>
                      <p className={ST.cardDesc}>Velikost plátna a plánovaný počet stran v knize</p>
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                          <label className={ST.labelMuted}>Formát</label>
                          <select
                            value={workbook.settings.pageFormat}
                            onChange={(e) =>
                              setWorkbook((prev) => ({
                                ...prev,
                                settings: { ...prev.settings, pageFormat: e.target.value as 'a4' | 'b5' | 'a5' },
                              }))
                            }
                            className={ST.field}
                            style={STFieldStyle}
                          >
                            <option value="a4">A4 (210 × 297 mm)</option>
                            <option value="b5">B5 (176 × 250 mm)</option>
                            <option value="a5">A5 (148 × 210 mm)</option>
                          </select>
                        </div>
                        <div>
                          <label className={ST.labelMuted}>
                            Limit stránek:{' '}
                            <span className="font-medium text-slate-200">
                              {workbook.settings.pageLimit ?? DEFAULT_BOOK_PAGE_LIMIT}
                            </span>
                          </label>
                          <input
                            type="range"
                            min={8}
                            max={128}
                            step={8}
                            value={workbook.settings.pageLimit ?? DEFAULT_BOOK_PAGE_LIMIT}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              setWorkbook((prev) => ({
                                ...prev,
                                settings: { ...prev.settings, pageLimit: v },
                              }));
                              schedulePersistBookPageLimit(v);
                            }}
                            className="mt-4 w-full"
                            style={{ accentColor: '#6366f1' }}
                          />
                        </div>
                      </div>
                    </section>

                    <section className={ST.card} style={STCardStyle}>
                      <h2 className={ST.cardTitle}>Zobrazení</h2>
                      <p className={ST.cardDesc}>Volby pro náhled a tisk knihy</p>
                      <div className="space-y-3">
                        <label className={ST.checkRow} style={STCheckRowStyle}>
                          <input
                            type="checkbox"
                            checked={workbook.settings.showChapterColors}
                            onChange={(e) =>
                              setWorkbook((prev) => ({
                                ...prev,
                                settings: { ...prev.settings, showChapterColors: e.target.checked },
                              }))
                            }
                            className="mt-0.5 h-5 w-5 shrink-0 rounded"
                            style={{ accentColor: '#6366f1' }}
                          />
                          <div>
                            <span className="text-sm font-medium text-slate-200">Zobrazit barvy kapitol</span>
                            <p className="text-xs text-slate-500">Barevné označení stránek podle kapitol</p>
                          </div>
                        </label>
                        <label className={ST.checkRow} style={STCheckRowStyle}>
                          <input
                            type="checkbox"
                            checked={workbook.settings.showPageNumbers}
                            onChange={(e) =>
                              setWorkbook((prev) => ({
                                ...prev,
                                settings: { ...prev.settings, showPageNumbers: e.target.checked },
                              }))
                            }
                            className="mt-0.5 h-5 w-5 shrink-0 rounded"
                            style={{ accentColor: '#6366f1' }}
                          />
                          <div>
                            <span className="text-sm font-medium text-slate-200">Zobrazit čísla stránek</span>
                            <p className="text-xs text-slate-500">Číslování stránek v patičce</p>
                          </div>
                        </label>
                      </div>
                    </section>
                  </>
                )}

                {settingsTab === 'team' && (
                  <>
                    <header className="mb-9">
                      <h1 className={ST.h1}>Tým</h1>
                      <p className={ST.lead}>
                        Kdo má přístup ke knize. Jména bereme z profilu učitele (tabulka teachers) a z tvého účtu.
                      </p>
                    </header>

                    <section className={ST.card} style={STCardStyle}>
                      <h2 className={ST.cardTitle}>Členové</h2>
                      <p className={ST.cardDesc}>
                        U pozvaných bez záznamu v databázi zobrazíme @jméno nebo zkrácené ID — po přihlášení a doplnění profilu se objeví jméno.
                      </p>
                      <div className="flex flex-wrap" style={{ gap: 20 }}>
                        {settingsTeam?.ownerUserId ? (() => {
                          const uid = settingsTeam.ownerUserId;
                          const d = teamDisplays.get(uid);
                          const slug = settingsTeam.ownerMentionSlug;
                          const primary =
                            d?.displayName ||
                            (slug ? `@${slug.replace(/^@/, '')}` : 'Vlastník');
                          const initials = initialsFromDisplayName(d?.displayName || primary, uid);
                          return (
                            <div key={uid} style={TEAM_MEMBER_COL_STYLE}>
                              <div
                                style={teamAvatarStyle(String(hashHue(uid)))}
                                title={d?.email ?? 'Vlastník knihy'}
                              >
                                {initials}
                              </div>
                              <div className="w-full min-w-0">
                                <div className="truncate text-[13px] font-semibold text-slate-100" title={primary}>
                                  {primary}
                                </div>
                                <div className="mt-0.5 truncate text-[11px] text-slate-500">Vlastník knihy</div>
                                {slug ? (
                                  <div className="mt-0.5 truncate text-[10px] text-slate-600">
                                    @{slug.replace(/^@/, '')}
                                  </div>
                                ) : null}
                                {d?.email ? (
                                  <div className="mt-1 truncate text-[10px] text-slate-600" title={d.email}>
                                    {d.email}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })() : null}
                        {(settingsTeam?.shares ?? []).map((s) => {
                          const d = teamDisplays.get(s.shared_with_user_id);
                          const slug = s.mention_slug;
                          const primary =
                            d?.displayName ||
                            (slug ? `@${slug.replace(/^@/, '')}` : `Kolega (${s.shared_with_user_id.slice(0, 8)}…)`);
                          const initials = initialsFromDisplayName(d?.displayName || primary, s.shared_with_user_id);
                          const roleLabel = s.access_role === 'commenter' ? 'Komentátor' : 'Editor';
                          return (
                            <div key={s.id} style={TEAM_MEMBER_COL_STYLE}>
                              <div
                                style={teamAvatarStyle(String(hashHue(s.shared_with_user_id)))}
                                title={d?.email ?? roleLabel}
                              >
                                {initials}
                              </div>
                              <div className="w-full min-w-0">
                                <div className="truncate text-[13px] font-semibold text-slate-100" title={primary}>
                                  {primary}
                                </div>
                                <div className="mt-0.5 truncate text-[11px] text-slate-500">{roleLabel}</div>
                                {slug ? (
                                  <div className="mt-0.5 truncate text-[10px] text-slate-600">
                                    @{slug.replace(/^@/, '')}
                                  </div>
                                ) : null}
                                {d?.email ? (
                                  <div className="mt-1 truncate text-[10px] text-slate-600" title={d.email}>
                                    {d.email}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                        {settingsTeamLoading && id ? (
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 size={16} className="animate-spin" />
                            Načítám tým…
                          </div>
                        ) : null}
                        {!settingsTeamLoading &&
                        settingsTeam &&
                        !settingsTeam.ownerUserId &&
                        (settingsTeam.shares?.length ?? 0) === 0 ? (
                          <p className="text-sm text-slate-500">Zatím žádní pozvaní — přidej je níže.</p>
                        ) : null}
                        {!settingsTeamLoading && !settingsTeam && id ? (
                          <p className="text-sm text-slate-500">Tým se nepodařilo načíst.</p>
                        ) : null}
                      </div>
                    </section>

                    <section className={ST.card} style={STCardStyle}>
                      <h2 className={ST.cardTitle}>Aktivita a komentáře</h2>
                      <p className="text-sm leading-relaxed text-slate-500">
                        Přehled aktivity a vláken doplníme sem v další verzi. Rychlý přístup ke komentářům máš přes ikonu v úzkém
                        levém panelu.
                      </p>
                    </section>

                    {id ? (
                      <section className={ST.card} style={STCardStyle}>
                        <h2 className={ST.cardTitle}>Pozvánky a sdílení</h2>
                        <p className={ST.cardDesc}>
                          E-mail nebo odkaz — po přihlášení se kniha objeví v Laiout.
                        </p>
                        <BookShareControls bookId={id} isOwner={isBookOwnerUi} variant="settings" />
                      </section>
                    ) : null}
                  </>
                )}

                {settingsTab === 'dataset' && (
                  <>
                    <header className="mb-8">
                      <h1 className={ST.h1}>Data set</h1>
                      <p className={ST.lead}>Podklady pro AI u této knihy</p>
                    </header>
                    <DatasetPanel scopeId={id ? `workbook-${id}` : 'workbook'} layout="stacked" />
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      
      {/* New Chapter Dialog */}
      {newChapterDialog.open && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setNewChapterDialog({ open: false, fromPage: 1 })}
        >
          <div 
            style={{
              backgroundColor: '#1e293b',
              borderRadius: '16px',
              padding: '24px',
              minWidth: '400px',
              border: '1px solid #334155',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#f1f5f9' }}>
              Nová kapitola od stránky {newChapterDialog.fromPage}
            </h2>
            
            <input
              type="text"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="Název kapitoly..."
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '15px',
                marginBottom: '20px',
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmNewChapter();
                if (e.key === 'Escape') setNewChapterDialog({ open: false, fromPage: 1 });
              }}
            />
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setNewChapterDialog({ open: false, fromPage: 1 })}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Zrušit
              </button>
              <button
                onClick={handleConfirmNewChapter}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Vytvořit kapitolu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
