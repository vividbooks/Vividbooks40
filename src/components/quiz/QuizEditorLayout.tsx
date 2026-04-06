/**
 * Quiz Editor Layout
 * 
 * 3-column layout similar to WorksheetEditorLayout:
 * 1. Narrow toolbar (slide types)
 * 2. Structure panel (slide list)
 * 3. Main editing area
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom';
import { NoteIcon, ColorIcon } from './editor/NoteIcon';
import { SidebarButton, AddContentButton } from './editor/SidebarButton';
import { InlineColorPicker } from './editor/InlineColorPicker';
import { SlidePreviewThumbnail } from './editor/SlidePreviewThumbnail';
import { SortableSlideItem } from './editor/SortableSlideItem';
import { renderSlideEditor, getSlideTitle } from './editor/renderSlideEditor';
import { SessionsList } from './editor/SessionsList';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useMarqueeSelection } from '../../hooks/useMarqueeSelection';
import { useEditorModals } from '../../hooks/quiz/useEditorModals';
import { useImportState } from '../../hooks/quiz/useImportState';
import { useContentPanel, type ActivePanel } from '../../hooks/quiz/useContentPanel';
import { useBlockSelection } from '../../hooks/quiz/useBlockSelection';
import { usePageSettingsPanel } from '../../hooks/quiz/usePageSettingsPanel';
import { useSessionsData, type SessionData } from '../../hooks/quiz/useSessionsData';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Plus,
  Save,
  Play,
  Settings,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Undo2,
  Redo2,
  Copy,
  FileText,
  HelpCircle,
  MessageSquare,
  Calculator,
  CheckCircle,
  XCircle,
  MoreVertical,
  Eye,
  EyeOff,
  Share2,
  Download,
  ListOrdered,
  Menu,
  Lightbulb,
  BarChart2,
  Users,
  Link2,
  BookOpen,
  Sparkles,
  SlidersHorizontal,
  ArrowLeft,
  ArrowRight,
  Palette,
  History,
  LayoutGrid,
  Printer,
  Layers,
  Zap,
  Paintbrush,
  // New activity icons
  Puzzle,
  MapPin,
  Film,
  // Block editing icons
  Type,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  X,
  Upload,
  Grid2X2,
  Map,
} from 'lucide-react';

import { boardToWorksheet } from '../../utils/content-converter';
import { saveWorksheet } from '../../utils/worksheet-storage';
import { useVersionHistory } from '../../hooks/useVersionHistory';
import { useFileStorage } from '../../hooks/useFileStorage';
import { getMediaFolderId, ensureMediaFolderExists, createMediaSubfolder } from '../../utils/folder-storage';
import { VersionHistoryPanel } from '../shared/VersionHistoryPanel';
import { supabase } from '../../utils/supabase/client';
import { projectId } from '../../utils/supabase/info';
import { fetchVividboardProxy } from '../../utils/vividboard-proxy-fetch';
import { 
  Quiz, 
  QuizSlide, 
  InfoSlide, 
  ActivityType, 
  createABCSlide, 
  createOpenSlide, 
  createExampleSlide, 
  createInfoSlide, 
  createBoardSlide, 
  createVotingSlide, 
  createFillBlanksSlide, 
  createImageHotspotsSlide, 
  createConnectPairsSlide, 
  createVideoQuizSlide,
  createFormSlide,
  createFlashcardSlide,
  createCertificateSlide,
  FillBlanksActivitySlide, 
  ImageHotspotsActivitySlide, 
  ConnectPairsActivitySlide, 
  VideoQuizActivitySlide,
  FlashcardActivitySlide,
  OpenActivitySlide,
  ExampleActivitySlide,
  SlideBlock,
  ToolsSlide,
  QuizSettings,
} from '../../types/quiz';
import { getContrastColor } from '../../utils/color-utils';
import { SLIDE_TYPES, SlideTypeOption } from './slide-types';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path for PDF.js - Using a consistent and reliable CDN URL
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

import { ConnectPairsEditor } from './slides/ConnectPairsEditor';
import { FillBlanksEditor } from './slides/FillBlanksEditor';
import { ImageHotspotsEditor } from './slides/ImageHotspotsEditor';
import { VideoQuizEditor } from './slides/VideoQuizEditor';
import { FormEditor } from './slides/FormEditor';
import { CertificateEditor } from './slides/CertificateEditor';
import { SlideTextToolbar } from './slides/SlideTextToolbar';
import { BackgroundPicker } from './slides/BackgroundPicker';
import { PageSettingsPanel, LayoutIcon } from './slides/PageSettingsPanel';
import { BlockSettingsPanel } from './slides/BlockSettingsPanel';
import { QuizPreview } from './QuizPreview';
import { ShareEditDialog } from './ShareEditDialog';
import { getBoardComments, BoardComment, getCommentsGroupedBySlide, addBoardComment } from '../../utils/supabase/board-comments';
import { SlideCommentsPreview } from './slides/SlideCommentsPreview';
import { TeacherSession } from './QuizLiveSession';
import { AIBoardPanel } from './AIBoardPanel';
import { OsnovaPanel } from './OsnovaPanel';
import { boardRoutes } from '../../features/board-v2';
import type { BoardEditorEntryFlags } from '../../features/board-v2/components/views/board-editor';
import {
  clearBoardBlockSelection,
  buildBoardReturnUrl,
  closeBoardLiveSession,
  closeBoardPreview,
  getBoardPreviewSlideIndex,
  handleBoardBlockSelectionChange,
  openBoardResultsPage,
  openBoardBlockSettings,
  openBoardResultsTab,
  openBoardPreview,
  openBoardShareEditDialog,
  openBoardVersionHistory,
  openBoardViewFromEditor,
  openWorksheetEditorFromBoard,
  persistBoardDraft,
  resetBoardCanvasInteraction,
  resetBoardEditorSelection,
  updateBoardEditorQuizSettings,
  updateSelectedInfoBlock,
  uploadImageToSelectedInfoBlock,
} from '../../features/board-v2/components/views/board-editor';
import { loadOrCreateBoardEditorQuiz } from '../../features/board-v2/components/views/board-editor/boardEditorBootstrap';
import * as storage from '../../utils/profile-storage';
import * as quizStorage from '../../utils/quiz-storage';

const SLIDE_COLORS = [
  { color: '#ffffff', label: 'Bílá' },
  { color: '#f8fafc', label: 'Šedá' },
  { color: '#eff6ff', label: 'Modrá' },
  { color: '#f0fdf4', label: 'Zelená' },
  { color: '#fefce8', label: 'Žlutá' },
  { color: '#fff1f2', label: 'Červená' },
  { color: '#faf5ff', label: 'Fialová' },
];

// ============================================
// UI COMPONENTS (SIDEBAR)
// ============================================


// ============================================
// STORAGE (using centralized quiz-storage)
// ============================================

const {
  saveQuiz: defaultSaveQuiz,
  getQuiz: defaultLoadQuizLocal,
  getQuizAsync: defaultLoadQuizAsync,
} = quizStorage;


// ============================================
// MAIN COMPONENT
// ============================================

interface QuizEditorLayoutProps {
  theme?: 'light' | 'dark';
  boardId?: string;
  queryParams?: URLSearchParams;
  navigateOverride?: NavigateFunction;
  entryFlags?: BoardEditorEntryFlags;
  persistence?: {
    loadQuizLocal: (boardId: string) => Quiz | null;
    loadQuizAsync: (boardId: string) => Promise<Quiz | null>;
    saveQuiz: (quiz: Quiz) => void;
  };
  routes?: Pick<typeof boardRoutes, 'results' | 'view'>;
}

export function QuizEditorLayout({
  theme = 'light',
  boardId,
  queryParams,
  navigateOverride,
  entryFlags,
  persistence,
  routes = boardRoutes,
}: QuizEditorLayoutProps) {
  const { id: routedId } = useParams<{ id: string }>();
  const navigateFromRouter = useNavigate();
  const [searchParamsFromRouter] = useSearchParams();
  const id = boardId ?? routedId;
  const navigate = navigateOverride ?? navigateFromRouter;
  const searchParams = queryParams ?? searchParamsFromRouter;
  const {
    saveQuiz,
    loadQuizLocal,
    loadQuizAsync,
  } = persistence ?? {
    saveQuiz: defaultSaveQuiz,
    loadQuizLocal: defaultLoadQuizLocal,
    loadQuizAsync: defaultLoadQuizAsync,
  };
  const resolvedEntryFlags = useMemo(
    () => entryFlags ?? {
      returnUrl: searchParams.get('returnUrl'),
      initialTab: (searchParams.get('tab') as 'editor' | 'results') || 'editor',
      fromPdf: searchParams.get('fromPdf') === 'true',
      fromWorksheet: searchParams.get('fromWorksheet') === 'true',
      openAI: searchParams.get('openAI') === 'true',
      sourceId: searchParams.get('sourceId'),
      sourceSlug: searchParams.get('sourceSlug'),
      sourceCategory: searchParams.get('sourceCategory'),
    },
    [entryFlags, searchParams],
  );
  
  // Get returnUrl from search params (for admin navigation)
  const returnUrl = resolvedEntryFlags.returnUrl;
    
  // Track window width for responsive toolbar labels
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Check if user is admin (for showing advanced features)
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email;
      setIsAdmin(email?.endsWith('@admin.cz') || email === '123456@gmail.com' || email === 'vitekskop@vividbooks.com');
    });
  }, []);
  
  // Quiz state
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const quizRef = useRef<Quiz | null>(null); // Ref to always have current quiz value
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Dataset images — obrázky z linked datasetu (pro AssetPicker tab "Z datasetu")
  const [datasetImages, setDatasetImages] = useState<Array<{ url: string; title?: string; alt?: string }>>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    quizRef.current = quiz;
  }, [quiz]);

  // Fetch dataset images when quiz has sourceDatasetId
  useEffect(() => {
    const sourceDatasetId = quiz?.sourceDatasetId;
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
  }, [quiz?.sourceDatasetId]);
  
  // Warn user before closing page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty || isSaving) {
        e.preventDefault();
        e.returnValue = 'Máte neuložené změny. Opravdu chcete odejít?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isSaving]);
  
  const [isImportingPdf, setIsImportingPdf] = useState(false);

  const {
    showPreview, setShowPreview,
    showNewSlideDropdown, setShowNewSlideDropdown,
    showShareEditDialog, setShowShareEditDialog,
    showVersionHistory, setShowVersionHistory,
    showLiveSession, setShowLiveSession,
    showColorPicker, setShowColorPicker,
    showSettings, setShowSettings,
    showSlidePreviews, setShowSlidePreviews,
  } = useEditorModals();

  const {
    showImportInput, setShowImportInput,
    importInputValue, setImportInputValue,
    jsonPreviewText, setJsonPreviewText,
    jsonPreviewLoading, setJsonPreviewLoading,
  } = useImportState();
  const [boardComments, setBoardComments] = useState<BoardComment[]>([]);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  // Load board comments
  const loadComments = useCallback(async () => {
    if (id) {
      const comments = await getBoardComments(id);
      setBoardComments(comments);
    }
  }, [id]);
  
  useEffect(() => {
    loadComments();
  }, [loadComments]);
  const newSlideDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownContentRef = useRef<HTMLDivElement>(null);

  const { uploadFile } = useFileStorage();

  // Dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag (prevents accidental drags on click)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (quiz && over && active.id !== over.id) {
      const activeId = active.id as string;
      const overId = over.id as string;
      
      const oldIndex = quiz.slides.findIndex((s) => s.id === activeId);
      const newIndex = quiz.slides.findIndex((s) => s.id === overId);
      
      let newSlides = [...quiz.slides];
      
      if (multiSelectedIds.includes(activeId)) {
        // Multi-drag: move all selected slides together to the target position
        const selectedIndices = multiSelectedIds
          .map(id => quiz.slides.findIndex(s => s.id === id))
          .filter(idx => idx !== -1)
          .sort((a, b) => a - b);
        
        const selectedSlides = selectedIndices.map(idx => quiz.slides[idx]);
        
        // Remove selected slides
        newSlides = newSlides.filter(s => !multiSelectedIds.includes(s.id));
        
        // Find new insertion point after removal
        let adjustedNewIndex = newSlides.findIndex(s => s.id === overId);
        
        // Determine if we should insert before or after the 'over' item
        // If we are moving downwards, insert after. If upwards, insert before.
        // Actually, SortableContext logic usually handles this. 
        // Let's match the target index as closely as possible.
        if (oldIndex < newIndex) {
          adjustedNewIndex += 1; // Insert after
        }
        
        newSlides.splice(adjustedNewIndex, 0, ...selectedSlides);
      } else {
        // Single drag
        newSlides = arrayMove(quiz.slides, oldIndex, newIndex);
      }
      
      // Update slide order property
      newSlides.forEach((s, idx) => {
        s.order = idx;
      });
      
      updateQuizWithUndo({
        ...quiz,
        slides: newSlides,
        updatedAt: new Date().toISOString()
      });
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isInsideTrigger = newSlideDropdownRef.current?.contains(target);
      const isInsideContent = dropdownContentRef.current?.contains(target);
      
      if (!isInsideTrigger && !isInsideContent) {
        setShowNewSlideDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Undo/Redo via custom hook (handles keyboard shortcuts internally)
  const { updateQuizWithUndo, undo, redo, canUndo, canRedo } = useUndoRedo(quiz, setQuiz, setIsDirty);
  
  // UI state
  const [isResizing, setIsResizing] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'results'>(
    resolvedEntryFlags.initialTab
  );

  // Open AI panel automatically if coming from PDF or Worksheet
  const fromPdfParam = resolvedEntryFlags.fromPdf;
  const fromWorksheetParam = resolvedEntryFlags.fromWorksheet;
  const openAIParam = resolvedEntryFlags.openAI;

  const {
    activePanel, setActivePanel,
    contentPanelMode, setContentPanelMode,
    showActivitiesSubmenu, setShowActivitiesSubmenu,
    showToolsSubmenu, setShowToolsSubmenu,
  } = useContentPanel((fromPdfParam || fromWorksheetParam || openAIParam) ? 'ai' : 'board');

  const {
    selectedBlockIndex, setSelectedBlockIndex,
    showBlockSettings, setShowBlockSettings,
    blockSettingsSection, setBlockSettingsSection,
    showBlockColorPicker, setShowBlockColorPicker,
    editingTextBlockIndex, setEditingTextBlockIndex,
    clearBlockSelection,
  } = useBlockSelection();

  const {
    showPageSettings, setShowPageSettings,
    pageSettingsSection, setPageSettingsSection,
    pageSettingsInitialShowActivities, setPageSettingsInitialShowActivities,
    openPageSettings,
    togglePageSettings,
  } = usePageSettingsPanel(clearBlockSelection);

  // Multi-selection and Marquee via custom hook
  const {
    multiSelectedIds,
    setMultiSelectedIds,
    selectionRect,
    scrollContainerRef,
    handleMarqueeMouseDown,
  } = useMarqueeSelection(!!quiz?.slides.length);

  // Results sessions data
  const { sessions, loadingSessions } = useSessionsData(id, viewMode);
  
  // Get current user
  const profile = storage.getCurrentUserProfile();
  
  // Version history hook
  const versionHistory = useVersionHistory({
    documentId: id || '',
    documentType: 'quiz',
    content: quiz ? JSON.stringify(quiz) : '',
    title: quiz?.title || 'Nová tabule',
    userId: profile?.userId,
    userType: 'teacher',
    userName: profile?.firstName,
    autoSave: true,
    autoSaveDelay: 10000, // Auto-save every 10 seconds for better UX
    onVersionRestored: useCallback((version) => {
      try {
        const restoredQuiz = JSON.parse(version.content);
        setQuiz(restoredQuiz);
        setIsDirty(true);
      } catch (e) {
        console.error('Failed to parse restored quiz:', e);
      }
    }, []),
  });
  
  // Loading state for async quiz fetch
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(true);
  
  // Load or create quiz (with async Supabase fallback)
  useEffect(() => {
    if (!id) return;
    
    const loadQuizData = async () => {
      setIsLoadingQuiz(true);

      try {
        const bootstrapResult = await loadOrCreateBoardEditorQuiz({
          boardId: id,
          entryFlags: resolvedEntryFlags,
          persistence: {
            loadQuizLocal,
            loadQuizAsync,
          },
          storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        });

        setQuiz(bootstrapResult.quiz);
        setSelectedSlideId(bootstrapResult.selectedSlideId);

        if (bootstrapResult.created) {
          // Save immediately to localStorage to prevent race conditions with sync.
          // This ensures the quiz exists before any Supabase sync can overwrite.
          saveQuiz(bootstrapResult.quiz);
          console.log('[QuizEditor] Saved new quiz to localStorage:', bootstrapResult.quiz.id);
        }
      } catch (error) {
        console.error('[QuizEditor] Failed to bootstrap board editor:', error);
      } finally {
        setIsLoadingQuiz(false);
      }
    };
    
    loadQuizData();
  }, [id, resolvedEntryFlags, loadQuizAsync, loadQuizLocal, saveQuiz]);
  
  // Auto-save (local + server)
  useEffect(() => {
    if (quiz && isDirty && !isSaving) {
      const timer = setTimeout(async () => {
        setIsSaving(true);
        console.log('[AutoSave] Starting save...');
        
        try {
          const persistPromise = persistBoardDraft({
            quiz,
            persistence: { saveQuiz },
            projectId,
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          });
          setIsDirty(false);
          await persistPromise;
          console.log('[AutoSave] Board saved');
        } catch (err) {
          console.warn('[AutoSave] Server save failed:', err);
        } finally {
          setIsSaving(false);
          console.log('[AutoSave] Save complete');
        }
      }, 2000); // 2 seconds delay for server save
      return () => clearTimeout(timer);
    }
  }, [quiz, isDirty, isSaving]);
  
  // Publish to server (Supabase pages API)
  
  // Get selected slide
  const selectedSlide = quiz?.slides.find(s => s.id === selectedSlideId) || null;
  const selectedSlideIndex = quiz?.slides.findIndex(s => s.id === selectedSlideId) ?? -1;
  
  // Track window width for responsive navigation arrows
  const [showNavArrows, setShowNavArrows] = useState(window.innerWidth >= 1265);
  
  useEffect(() => {
    const handleResize = () => {
      setShowNavArrows(window.innerWidth >= 1265);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Navigation functions for editor
  const goToPrevSlide = useCallback(() => {
    if (!quiz || selectedSlideIndex <= 0) return;
    setSelectedSlideId(quiz.slides[selectedSlideIndex - 1].id);
  }, [quiz, selectedSlideIndex]);
  
  const goToNextSlide = useCallback(() => {
    if (!quiz || selectedSlideIndex >= quiz.slides.length - 1) return;
    setSelectedSlideId(quiz.slides[selectedSlideIndex + 1].id);
  }, [quiz, selectedSlideIndex]);
  
  // Keyboard navigation for slides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.isContentEditable ||
                       target.closest('[contenteditable="true"]');
      
      // Arrow key navigation (only when not typing)
      if (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPrevSlide();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToNextSlide();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevSlide, goToNextSlide]);
  
  // ============================================
  // SLIDE OPERATIONS
  // ============================================
  
  const addSlide = useCallback((typeOption: SlideTypeOption) => {
    if (!quiz) return;
    
    const order = quiz.slides.length;
    let newSlide: QuizSlide;
    
    switch (typeOption.id) {
      case 'abc':
        newSlide = createABCSlide(order);
        break;
      case 'open':
        newSlide = createOpenSlide(order);
        break;
      case 'example':
        newSlide = createExampleSlide(order);
        break;
      case 'board':
        newSlide = createBoardSlide(order);
        break;
      case 'voting':
        newSlide = createVotingSlide(order);
        break;
      case 'fill-blanks':
        newSlide = createFillBlanksSlide(order);
        break;
      case 'connect-pairs':
        newSlide = createConnectPairsSlide(order);
        break;
      case 'image-hotspots':
        newSlide = createImageHotspotsSlide(order);
        break;
      case 'video-quiz':
        newSlide = createVideoQuizSlide(order);
        break;
      case 'form':
        newSlide = createFormSlide(order);
        break;
      case 'flashcard':
        newSlide = createFlashcardSlide(order);
        break;
      case 'certificate':
        newSlide = createCertificateSlide(order);
        break;
      case 'info':
      default:
        newSlide = createInfoSlide(order);
        break;
    }
    
    updateQuizWithUndo({
      ...quiz,
      slides: [...quiz.slides, newSlide],
      updatedAt: new Date().toISOString(),
    });
    setSelectedSlideId(newSlide.id);
    
    // Switch to board view after adding
    setActivePanel('board');
  }, [quiz, updateQuizWithUndo]);

  const changeSlideType = useCallback((typeOption: SlideTypeOption) => {
    if (!quiz || !selectedSlideId) return;
    
    const currentIndex = quiz.slides.findIndex(s => s.id === selectedSlideId);
    if (currentIndex === -1) return;
    
    const currentSlide = quiz.slides[currentIndex];
    const currentActivityType = (currentSlide as any).activityType;
    
    // Get template for the new type to get default properties
    let template: any;
    switch (typeOption.id) {
      case 'abc': template = createABCSlide(currentSlide.order); break;
      case 'open': template = createOpenSlide(currentSlide.order); break;
      case 'example': template = createExampleSlide(currentSlide.order); break;
      case 'board': template = createBoardSlide(currentSlide.order); break;
      case 'voting': template = createVotingSlide(currentSlide.order); break;
      case 'fill-blanks': template = createFillBlanksSlide(currentSlide.order); break;
      case 'connect-pairs': template = createConnectPairsSlide(currentSlide.order); break;
      case 'image-hotspots': template = createImageHotspotsSlide(currentSlide.order); break;
      case 'video-quiz': template = createVideoQuizSlide(currentSlide.order); break;
      case 'form': template = createFormSlide(currentSlide.order); break;
      case 'flashcard': template = createFlashcardSlide(currentSlide.order); break;
      case 'certificate': template = createCertificateSlide(currentSlide.order); break;
      case 'info':
      default: template = createInfoSlide(currentSlide.order); break;
    }
    
    // Create new slide object by merging
    // We start with currentSlide to preserve ALL existing content (even from other types)
    const newSlide = { ...currentSlide };
    
    // Update the type-defining properties
    newSlide.type = template.type;
    if (template.activityType) {
      (newSlide as any).activityType = template.activityType;
    } else {
      delete (newSlide as any).activityType;
    }
    
    // Special conversions between Open and Example
    if (currentActivityType === 'open' && typeOption.id === 'example') {
      // Open -> Example: map question to problem, correctAnswers[0] to finalAnswer
      const openSlide = currentSlide as OpenActivitySlide;
      (newSlide as any).problem = openSlide.question || '';
      (newSlide as any).finalAnswer = openSlide.correctAnswers?.[0] || '';
      (newSlide as any).steps = [];
    } else if (currentActivityType === 'example' && typeOption.id === 'open') {
      // Example -> Open: map problem to question, finalAnswer to correctAnswers
      const exampleSlide = currentSlide as ExampleActivitySlide;
      (newSlide as any).question = exampleSlide.problem || '';
      (newSlide as any).correctAnswers = exampleSlide.finalAnswer ? [exampleSlide.finalAnswer] : [];
    }
    
    // Add any missing properties required by the new type from the template
    Object.keys(template).forEach(key => {
      if (!(key in newSlide)) {
        (newSlide as any)[key] = template[key];
      }
    });
    
    const newSlides = [...quiz.slides];
    newSlides[currentIndex] = newSlide as QuizSlide;
    
    setQuiz({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString()
    });
    setIsDirty(true);
    
    // Switch to board structure view only if NOT in page settings
    if (!showPageSettings) {
      setActivePanel('board');
    }
  }, [quiz, selectedSlideId, showPageSettings]);

  const deleteSlide = useCallback((slideId: string) => {
    if (!quiz) return;
    
    // If the slide being deleted is part of a multi-selection, delete all selected slides
    const idsToDelete = multiSelectedIds.includes(slideId) 
      ? multiSelectedIds 
      : [slideId];
    
    const newSlides = quiz.slides.filter(s => !idsToDelete.includes(s.id));
    
    // Reorder
    newSlides.forEach((s, i) => s.order = i);
    
    updateQuizWithUndo({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
    
    if (idsToDelete.includes(selectedSlideId as string)) {
      setSelectedSlideId(newSlides[0]?.id || null);
    }
    
    setMultiSelectedIds([]);
  }, [quiz, selectedSlideId, multiSelectedIds, updateQuizWithUndo]);
  
  const duplicateSlide = useCallback((slideId: string) => {
    if (!quiz) return;
    
    // If the slide being duplicated is part of a multi-selection, duplicate all selected slides
    const idsToDuplicate = multiSelectedIds.includes(slideId)
      ? [...quiz.slides].filter(s => multiSelectedIds.includes(s.id)).map(s => s.id)
      : [slideId];
    
    const newSlides = [...quiz.slides];
    const duplicatedSlides: QuizSlide[] = [];
    
    // Find the last index of the selection to insert after it
    const lastIndex = Math.max(...idsToDuplicate.map(id => quiz.slides.findIndex(s => s.id === id)));
    
    idsToDuplicate.forEach(id => {
      const slide = quiz.slides.find(s => s.id === id);
      if (slide) {
        duplicatedSlides.push({
          ...slide,
          id: crypto.randomUUID(),
        });
      }
    });
    
    newSlides.splice(lastIndex + 1, 0, ...duplicatedSlides);
    
    // Reorder
    newSlides.forEach((s, i) => s.order = i);
    
    updateQuizWithUndo({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
    
    // Select the first duplicated slide
    if (duplicatedSlides.length > 0) {
      setSelectedSlideId(duplicatedSlides[0].id);
      setMultiSelectedIds(duplicatedSlides.map(s => s.id));
    }
  }, [quiz, multiSelectedIds, updateQuizWithUndo]);

  const handleImportFromOldFormat = useCallback(async () => {
    console.log('Starting handleImportFromOldFormat');
    const input = importInputValue;
    if (!input) {
      alert('Prosím vložte ID nebo link.');
      return;
    }

    let data;
    const trimmed = input.trim();

    // Extract UUID from raw UUID or any URL containing one
    const uuidMatch = trimmed.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);

    try {
      if (uuidMatch) {
        // Use Supabase proxy to avoid CORS issues with the old vividboard API
        const boardId = uuidMatch[1];
        const response = await fetchVividboardProxy(boardId);
        if (!response.ok) throw new Error(`Proxy vrátila chybu ${response.status}`);
        data = await response.json();
      } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // Raw JSON pasted directly
        data = JSON.parse(trimmed);
      } else {
        throw new Error('Vložte UUID boardu, odkaz obsahující UUID, nebo přímo JSON.');
      }
    } catch (e) {
      alert('Chyba při načítání dat: ' + e);
      return;
    }

    if (!data) return;

    // Helper to strip HTML tags and ql-editor wrapper
    const stripHtml = (html: string) => {
      if (!html) return '';
      
      let text = html;
      
      // Handle Quill formulas: <span class="ql-formula" data-value="x^2"></span>
      text = text.replace(/<span[^>]*class=['"]ql-formula['"][^>]*data-value=['"]([^'"]*)['"][^>]*>[\s\S]*?<\/span>/gi, function(_match, formula) {
        // Double the backslashes so \frac stays as literal \frac (not form-feed + rac)
        const safeFormula = formula.replace(/\\/g, '\\\\');
        return '$' + safeFormula + '$';
      });
      
      // Remove ql-editor divs
      text = text.replace(/<div class=['"]ql-editor['"]>/g, '');
      text = text.replace(/<\/div>/g, '');
      
      // Remove other tags but keep content
      text = text.replace(/<[^>]*>?/gm, '');
      
      // Decode common entities
      text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      return text.trim();
    };

    // Helper to map legacy slides to new format
    const mapLegacySlides = (legacySlides: any[]): QuizSlide[] => {
      const slides: QuizSlide[] = [];
      let slideOrder = 0;

      legacySlides.forEach((legacy) => {
        const id = `slide-imported-${Date.now()}-${slideOrder}`;

        // Handle the nested structure (data.content.pages)
        if (legacy.type === 'selector' && legacy.data?.pageContent?.data?.activity) {
          const activity = legacy.data.pageContent.data.activity;
          const activityKey = activity.key;
          const activityData = activity.data?.[activityKey];

          // Chapter name / note are in legacy.data.notes for all activity types
          const actNotes = legacy.data?.notes || {};
          const actChapterName: string = stripHtml(actNotes.chapter || actNotes.name || '');
          const actNote: string = stripHtml(actNotes.text || '');

          if (activityKey === 'abc' && activityData) {
            const abcSlide = createABCSlide(slideOrder++);
            abcSlide.id = id;
            if (actChapterName) abcSlide.chapterName = actChapterName;
            if (actNote) abcSlide.note = actNote;
            
            // Extract question — check both "text" and "textvisual" tabs
            const activeTab = activityData.selector?.activeTab;
            let questionHtml = '';
            let imageUrl = '';

            if (activeTab === 'textvisual' && activityData.selector?.tabs?.textvisual) {
              const tv = activityData.selector.tabs.textvisual;
              questionHtml = tv.text || '';
              imageUrl = tv.visual?.data || '';
            } else {
              questionHtml = activityData.selector?.tabs?.text?.data || '';
              // Also check if there's an image tab
              imageUrl = activityData.selector?.tabs?.image?.images?.[0]?.data || '';
            }

            abcSlide.question = stripHtml(questionHtml);
            
            if (imageUrl) {
              abcSlide.media = { type: 'image', url: imageUrl };
            }

            // Extract options
            const buttons = activityData.selectorAnswers?.tabs?.buttons?.buttons || [];
            abcSlide.options = buttons.map((btn: any, i: number) => ({
              id: `opt-${i}-${Date.now()}`,
              label: String.fromCharCode(65 + i),
              content: stripHtml(btn.text || ''),
              isCorrect: !!btn.isValid
            }));
            
            slides.push(abcSlide);
            return;
          }
          
          if (activityKey === 'open' && activityData) {
            const openSlide = createOpenSlide(slideOrder++);
            openSlide.id = id;
            if (actChapterName) openSlide.chapterName = actChapterName;
            if (actNote) openSlide.note = actNote;

            // Check both "text" and "textvisual" tabs
            const openActiveTab = activityData.selector?.activeTab;
            let openQuestionHtml = '';
            let openImageUrl = '';

            if (openActiveTab === 'textvisual' && activityData.selector?.tabs?.textvisual) {
              const tv = activityData.selector.tabs.textvisual;
              openQuestionHtml = tv.text || '';
              openImageUrl = tv.visual?.data || '';
            } else {
              openQuestionHtml = activityData.selector?.tabs?.text?.data || '';
              openImageUrl = activityData.selector?.tabs?.image?.images?.[0]?.data || '';
            }

            openSlide.question = stripHtml(openQuestionHtml);
            if (openImageUrl) {
              (openSlide as any).media = { type: 'image', url: openImageUrl };
            }

            const answerHtml = activityData.selectorAnswers?.tabs?.text?.data || '';
            if (answerHtml) {
              openSlide.correctAnswers = [stripHtml(answerHtml)];
            }
            slides.push(openSlide);
            return;
          }
          
          // Handle "input" activity type as Example (simple problem + answer)
          if (activityKey === 'input' && activityData) {
            const exampleSlide = createExampleSlide(slideOrder++);
            exampleSlide.id = id;
            if (actChapterName) exampleSlide.chapterName = actChapterName;
            if (actNote) exampleSlide.note = actNote;
            
            // Check both "text" and "textvisual" tabs
            const inputActiveTab = activityData.selector?.activeTab;
            let inputQuestionHtml = '';
            let inputImageUrl = '';

            if (inputActiveTab === 'textvisual' && activityData.selector?.tabs?.textvisual) {
              const tv = activityData.selector.tabs.textvisual;
              inputQuestionHtml = tv.text || '';
              inputImageUrl = tv.visual?.data || '';
            } else {
              inputQuestionHtml = activityData.selector?.tabs?.text?.data || '';
              inputImageUrl = activityData.selector?.tabs?.image?.images?.[0]?.data || '';
            }

            exampleSlide.problem = stripHtml(inputQuestionHtml);
            exampleSlide.title = '';
            if (inputImageUrl) {
              exampleSlide.media = { type: 'image', url: inputImageUrl };
            }
            
            const answerHtml = activityData.answer || '';
            if (answerHtml) {
              exampleSlide.finalAnswer = stripHtml(answerHtml);
            }
            
            const suffixHtml = activityData.pripona || '';
            if (suffixHtml) {
              exampleSlide.answerSuffix = stripHtml(suffixHtml);
            }
            
            exampleSlide.steps = [];
            slides.push(exampleSlide);
            return;
          }

          // "question" = open question with hiddenAnswer (old format activity key)
          if ((activityKey === 'question' || activityKey === 'open_question') && activityData) {
            const qSlide = createOpenSlide(slideOrder++);
            qSlide.id = id;
            if (actChapterName) qSlide.chapterName = actChapterName;
            if (actNote) qSlide.note = actNote;

            const qActiveTab = activityData.selector?.activeTab;
            let qHtml = '';
            let qImageUrl = '';
            if (qActiveTab === 'textvisual' && activityData.selector?.tabs?.textvisual) {
              const tv = activityData.selector.tabs.textvisual;
              qHtml = tv.text || '';
              qImageUrl = tv.visual?.data || '';
            } else {
              qHtml = activityData.selector?.tabs?.text?.data || activityData.selector?.tabs?.textvisual?.text || '';
              qImageUrl = activityData.selector?.tabs?.image?.images?.[0]?.data || '';
            }

            qSlide.question = stripHtml(qHtml);
            if (qImageUrl) (qSlide as any).media = { type: 'image', url: qImageUrl };

            // Hidden answer (revealed on demand)
            const hiddenAnswerHtml = activityData.hiddenAnswer || activityData.selectorAnswers?.tabs?.text?.data || '';
            if (hiddenAnswerHtml) qSlide.correctAnswers = [stripHtml(hiddenAnswerHtml)];

            slides.push(qSlide);
            return;
          }
        }

        // Handle info_page with images (new format from legacy board)
        if (legacy.type === 'selector' && legacy.data?.pageContent?.key === 'info_page') {
          const infoPageData = legacy.data.pageContent.data?.info_page?.data?.info;
          const notes = legacy.data.notes || {};
          
          if (infoPageData) {
            const infoSlide = createInfoSlide(slideOrder++);
            infoSlide.id = id;
            
            // Set chapter name and note from notes
            if (notes.chapter) {
              infoSlide.chapterName = notes.chapter;
            }
            if (notes.text) {
              infoSlide.note = stripHtml(notes.text);
            }
            
            // Get selectors data - find the one with images first, then fallback to text
            const selectors = infoPageData.selectors || [];
            
            // Find selector with images (check all selectors, not just first one)
            let imageSelector = selectors.find((s: any) => 
              s.activeTab === 'image' && s.tabs?.image?.images?.length > 0
            );
            
            // Also check selectors that have images even if activeTab is different
            if (!imageSelector) {
              imageSelector = selectors.find((s: any) => s.tabs?.image?.images?.length > 0);
            }
            
            if (imageSelector) {
              const tabs = imageSelector.tabs;
              const images = tabs.image.images;
              
              // Create single-block layout for full-page image
              infoSlide.layout = {
                type: 'single',
                blocks: [{
                  id: `block-${Date.now()}`,
                  type: 'image',
                  content: images[0].image || '',
                  // Set gallery for all images (even if just one, to support solution button)
                  gallery: images.map((img: any) => img.image).filter(Boolean),
                  galleryIndex: 0,
                  // Map galleryMenu to galleryNavType (solution = show solution button)
                  galleryNavType: tabs.image.galleryMenu === 'solution' ? 'solution' : 
                                  images.length > 1 ? 'dots-bottom' : undefined,
                  imageFit: tabs.image.setup?.align === 'contain' ? 'contain' : 'cover',
                  imageCaption: images[0].description || '',
                  imageLink: images[0].link || '',
                }],
              };
              
              // Set blockGap to 0 for full-page image
              infoSlide.blockGap = 0;
              infoSlide.blockRadius = parseInt(tabs.image.setup?.borderRadius) || 10;
            } else {
              // Find text selector
              const textSelector = selectors.find((s: any) => s.tabs?.text?.data);
              
              if (textSelector && textSelector.tabs.text.data) {
                // Text-based info slide with single block
                infoSlide.layout = {
                  type: 'single',
                  blocks: [{
                    id: `block-${Date.now()}`,
                    type: 'text',
                    content: stripHtml(textSelector.tabs.text.data),
                    textAlign: 'center',
                    fontSize: 'large',
                  }],
                };
              } else {
                // Fallback: use title-content layout
                infoSlide.title = notes.chapter || 'Importovaná stránka';
              }
            }
            
            slides.push(infoSlide);
            return;
          }
        }

        // Fallback for older flat structure (legacy.type is 'abc', 'info', etc.)
        if (['text', 'info'].includes(legacy.type)) {
          const infoSlide = createInfoSlide(slideOrder++);
          infoSlide.id = id;
          infoSlide.title = stripHtml(legacy.title || legacy.name || '');
          if (infoSlide.layout) {
            infoSlide.layout.blocks[0].content = stripHtml(legacy.title || legacy.name || '');
            infoSlide.layout.blocks[1].content = stripHtml(legacy.content || legacy.text || '');
          }
          slides.push(infoSlide);
        } else if (['abc', 'multi', 'multiple-choice'].includes(legacy.type)) {
          const abcSlide = createABCSlide(slideOrder++);
          abcSlide.id = id;
          abcSlide.question = stripHtml(legacy.question || legacy.text || '');
          const options = legacy.options || legacy.answers || [];
          if (options) {
            abcSlide.options = options.map((opt: any, i: number) => ({
              id: opt.id || `opt-${i}-${Date.now()}`,
              label: String.fromCharCode(65 + i),
              content: typeof opt === 'string' ? stripHtml(opt) : stripHtml(opt.text || opt.content || opt.answer || ''),
              isCorrect: Array.isArray(legacy.correct) 
                ? legacy.correct.includes(i) 
                : (opt.is_correct || opt.isCorrect || i === legacy.correct_index || i === legacy.correctIndex),
            }));
          }
          abcSlide.explanation = stripHtml(legacy.explanation || legacy.hint || legacy.transcript);
          slides.push(abcSlide);
        } else if (['open', 'question'].includes(legacy.type)) {
          const openSlide = createOpenSlide(slideOrder++);
          openSlide.id = id;
          openSlide.question = stripHtml(legacy.question || legacy.text || '');
          if (legacy.answer || legacy.correct_answer || legacy.correctAnswer) {
            openSlide.correctAnswers = [stripHtml(legacy.answer || legacy.correct_answer || legacy.correctAnswer)];
          }
          openSlide.explanation = stripHtml(legacy.explanation || legacy.hint || legacy.transcript);
          slides.push(openSlide);
        } else if (legacy.type === 'example') {
          const exampleSlide = createExampleSlide(slideOrder++);
          exampleSlide.id = id;
          exampleSlide.title = stripHtml(legacy.title || legacy.name || '');
          exampleSlide.problem = stripHtml(legacy.problem || legacy.content || legacy.text || '');
          if (legacy.steps) {
            exampleSlide.steps = legacy.steps.map((step: any, i: number) => ({
              id: `step-${i}-${Date.now()}`,
              content: typeof step === 'string' ? stripHtml(step) : stripHtml(step.content || step.text || ''),
            }));
          }
          exampleSlide.finalAnswer = stripHtml(legacy.finalAnswer || legacy.answer || '');
          const legacySuffix = legacy.pripona || legacy.suffix || legacy.answerSuffix || '';
          if (legacySuffix) {
            exampleSlide.answerSuffix = stripHtml(legacySuffix);
          }
          slides.push(exampleSlide);
        } else if (legacy.type !== 'config' && legacy.type !== 'add') {
          // General fallback — also handles selector pages with unrecognised activity keys
          const fallbackNotes = legacy.data?.notes || {};
          const fallbackChapterName = stripHtml(fallbackNotes.chapter || fallbackNotes.name || '');
          const fallback = createInfoSlide(slideOrder++);
          fallback.id = id;
          if (fallbackChapterName) fallback.chapterName = fallbackChapterName;
          fallback.title = fallbackChapterName || stripHtml(legacy.title || legacy.name || legacy.type || 'Importovaný slide');
          if (fallback.layout) {
            fallback.layout.blocks[1].content = typeof legacy === 'string' ? legacy : JSON.stringify(legacy);
          }
          slides.push(fallback);
        }
      });
      
      return slides;
    };

    // Map old format to new format
    const legacySlides = data.content?.pages || data.slides || data.questions || [];
    
    if (!Array.isArray(legacySlides) || legacySlides.length === 0) {
      alert('V importovaných datech nebyly nalezeny žádné slidy ani otázky.');
      return;
    }

    const importedSlides = mapLegacySlides(legacySlides);

    if (importedSlides.length === 0) {
      alert('Nepodařilo se naimportovat žádné slidy. Zkontrolujte formát dat.');
      return;
    }

    // ── Build worksheetMap from pageEdit (Osnova) ─────────────────────────
    // chapterIndex in the old system's selections = 1-based page array position.
    // (pages[0] is always config and is skipped; pages[1] gets chapterIndex=1, etc.)
    // The correct mapping is therefore: chapterIndex → pageIndexToSlideIndex[chapterIndex].
    // NOTE: We do NOT use a sequential named-chapter count because that diverges from
    // chapterIndex whenever unnamed pages appear before the target position.
    const pageIndexToSlideIndex: Record<number, number> = {};
    {
      let si = 1;
      legacySlides.forEach((page: any, pageIndex: number) => {
        if (page.type !== 'config' && page.type !== 'add') {
          pageIndexToSlideIndex[pageIndex] = si;
          si++;
        }
      });
    }

    const pageEdit = data.content?.pageEdit;
    let worksheetMap: import('../../types/quiz').WorksheetMap | undefined;
    if (pageEdit?.pageBlocks && Array.isArray(pageEdit.pageBlocks)) {

      // Resolve old chapterIndex → new slideIndex.
      // chapterIndex is the 0-based array position in legacySlides (pages[N] → chapterIndex=N).
      const resolveSlideIndex = (chapterIndex: number): number => {
        const v = pageIndexToSlideIndex[chapterIndex];
        if (v !== undefined) return v;
        // Last resort: shift by same offset (si starts at 1)
        return chapterIndex;
      };

      worksheetMap = {
        pages: pageEdit.pageBlocks.map((pb: any) => ({
          thumbnailUrl: pb.thumbnailUrl || '',
          pageNumber: pb.pageNumber || '',
          regions: (pb.selections || []).map((sel: any) => {
            const slideIndex = resolveSlideIndex(sel.chapterIndex);
            return {
              slideIndex,
              chapterIndex: sel.chapterIndex,  // keep original for badge label
              xPct: sel.xPct,
              yPct: sel.yPct,
              wPct: sel.wPct,
              hPct: sel.hPct,
              color: sel.color || '#4f46e5',
            };
          }).filter((r: any) => r.slideIndex >= 0 && r.slideIndex < importedSlides.length),
        })),
      };
    }
    // ─────────────────────────────────────────────────────────────────────

    const newQuiz: Quiz = {
      ...quiz!,
      title: data.name || data.title || quiz!.title,
      // @ts-ignore
      boardType: data.type || 'practice',
      slides: importedSlides,
      updatedAt: new Date().toISOString(),
      ...(worksheetMap ? { worksheetMap } : {}),
    };

    setQuiz(newQuiz);
    if (importedSlides.length > 0) {
      setSelectedSlideId(importedSlides[0].id);
    }
    setIsDirty(true);
    setShowImportInput(false);
    setImportInputValue('');
    alert(`Board byl úspěšně importován! (${importedSlides.length} slidů)`);
  }, [quiz, importInputValue, setSelectedSlideId, setIsDirty, setShowImportInput, setImportInputValue]);
  
  const updateSlide = useCallback((slideId: string, updates: Partial<QuizSlide>) => {
    if (!quiz) return;
    
    const newSlides = quiz.slides.map(s => 
      s.id === slideId ? { ...s, ...updates } : s
    );
    
    updateQuizWithUndo({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
  }, [quiz, updateQuizWithUndo]);
  
  const moveSlide = useCallback((slideId: string, direction: 'up' | 'down') => {
    if (!quiz) return;
    
    // If the slide being moved is part of a multi-selection, move all selected slides
    const idsToMove = multiSelectedIds.includes(slideId)
      ? [...quiz.slides].filter(s => multiSelectedIds.includes(s.id)).map(s => s.id)
      : [slideId];
    
    if (idsToMove.length === 0) return;

    const newSlides = [...quiz.slides];
    
    // Find min and max index of slides to move
    const indices = idsToMove.map(id => quiz.slides.findIndex(s => s.id === id)).sort((a, b) => a - b);
    const minIdx = indices[0];
    const maxIdx = indices[indices.length - 1];

    if (direction === 'up' && minIdx === 0) return;
    if (direction === 'down' && maxIdx === quiz.slides.length - 1) return;

    if (direction === 'up') {
      // For each slide index, swap it with the one above it
      // To keep relative order, we move them one by one starting from the top one
      for (const idx of indices) {
        [newSlides[idx], newSlides[idx - 1]] = [newSlides[idx - 1], newSlides[idx]];
      }
    } else {
      // For each slide index, swap it with the one below it
      // To keep relative order, we move them one by one starting from the bottom one
      for (let i = indices.length - 1; i >= 0; i--) {
        const idx = indices[i];
        [newSlides[idx], newSlides[idx + 1]] = [newSlides[idx + 1], newSlides[idx]];
      }
    }

    // Reorder
    newSlides.forEach((s, i) => s.order = i);
    
    updateQuizWithUndo({
      ...quiz,
      slides: newSlides,
      updatedAt: new Date().toISOString(),
    });
  }, [quiz, multiSelectedIds, updateQuizWithUndo]);

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quiz) return;

    setIsImportingPdf(true);
    const toastId = toast.loading('Zpracovávám PDF...', {
      description: 'Převádím stránky na obrázky a nahrávám do knihovny.'
    });

    // Helper: upload with timeout
    const uploadWithTimeout = async (pageFile: File, folderId: string, timeoutMs = 30000): Promise<string | null> => {
      return Promise.race([
        (async () => {
          const result = await uploadFile(pageFile, { folderId });
          return result.success && result.file ? result.file.filePath : null;
        })(),
        new Promise<null>((resolve) => setTimeout(() => {
          console.warn('[PDF Import] Upload timeout reached');
          resolve(null);
        }, timeoutMs)),
      ]);
    };

    try {
      // Ensure media folder exists for storing PDF page images
      ensureMediaFolderExists();
      const pdfBaseName = file.name.replace(/\.pdf$/i, '');
      
      // Create a subfolder for this PDF in the Média folder (synced to Supabase immediately)
      const pdfSubfolderId = await createMediaSubfolder(`PDF - ${pdfBaseName}`);
      console.log('[PDF Import] Created subfolder for PDF:', pdfSubfolderId);
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const newSlides: QuizSlide[] = [];
      
      // Higher quality for better readability
      const RENDER_SCALE = 2.0;
      const JPEG_QUALITY = 0.85;
      const BATCH_SIZE = 3; // Process 3 pages at a time
      let successCount = 0;
      let fallbackCount = 0;

      // Process pages in batches for better performance
      for (let batchStart = 1; batchStart <= numPages; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, numPages);
        const progress = Math.round((batchStart / numPages) * 100);
        console.log(`[PDF Import] Processing batch: pages ${batchStart}-${batchEnd} of ${numPages} (${progress}%)`);
        toast.loading(`Zpracovávám stránky ${batchStart}-${batchEnd} z ${numPages} (${progress}%)`, { 
          id: toastId,
          description: `${newSlides.length} stránek zpracováno` 
        });
        
        // Process batch in parallel
        const batchPromises = [];
        for (let i = batchStart; i <= batchEnd; i++) {
          batchPromises.push((async (pageNum: number) => {
            try {
              console.log(`[PDF Import] Starting page ${pageNum}`);
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: RENDER_SCALE });
              
              // Render to canvas
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              if (!context) return null;

              await page.render({ canvasContext: context, viewport }).promise;
              
              // Convert canvas to Blob
              const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Blob creation failed')), 'image/jpeg', JPEG_QUALITY);
              });
              
              // Create a File object for upload
              const pageFileName = `${pdfBaseName}_page_${pageNum}.jpg`;
              const pageFile = new File([blob], pageFileName, { type: 'image/jpeg' });
              
              // Try upload with timeout, fallback to base64
              let imageUrl: string;
              const uploadedUrl = await uploadWithTimeout(pageFile, pdfSubfolderId, 20000);
              
              if (uploadedUrl) {
                imageUrl = uploadedUrl;
                successCount++;
                console.log(`[PDF Import] Page ${pageNum} uploaded successfully`);
              } else {
                // Fallback to base64 if upload fails or times out
                console.warn(`[PDF Import] Page ${pageNum} upload failed/timeout, using base64`);
                imageUrl = canvas.toDataURL('image/jpeg', 0.7);
                fallbackCount++;
              }

              // Extract text (with timeout protection)
              let pageText = '';
              try {
                const textContent = await Promise.race([
                  page.getTextContent(),
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
                ]);
                if (textContent) {
                  pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                }
              } catch { /* ignore text extraction errors */ }

              // Create new slide
              const slideOrder = quiz.slides.length + pageNum - 1;
              const newSlide = createInfoSlide(slideOrder, 'single');
              
              newSlide.layout = {
                type: 'single',
                blocks: [
                  {
                    id: crypto.randomUUID(),
                    type: 'image',
                    content: imageUrl,
                    imageFit: 'contain'
                  }
                ]
              };
              
              newSlide.note = pageText;
              
              // Clean up canvas to free memory
              canvas.width = 0;
              canvas.height = 0;
              
              console.log(`[PDF Import] ✅ Page ${pageNum} completed`);
              return { pageNum, slide: newSlide };
            } catch (pageErr) {
              console.error(`[PDF Import] ❌ Error processing page ${pageNum}:`, pageErr);
              return null;
            }
          })(i));
        }
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Add successful slides (sorted by page number)
        const validResults = batchResults.filter(r => r !== null) as { pageNum: number; slide: QuizSlide }[];
        validResults.sort((a, b) => a.pageNum - b.pageNum);
        newSlides.push(...validResults.map(r => r.slide));
        
        console.log(`[PDF Import] Batch ${batchStart}-${batchEnd} completed. ${validResults.length}/${batchResults.length} pages successful. Total: ${newSlides.length} slides`);
      }

      if (newSlides.length === 0) {
        throw new Error('Nepodařilo se zpracovat žádnou stránku z PDF');
      }

      const updatedQuiz = {
        ...quiz,
        slides: [...quiz.slides, ...newSlides],
        updatedAt: new Date().toISOString(),
      };

      // Recalculate order for all slides
      updatedQuiz.slides.forEach((s, idx) => {
        s.order = idx;
      });

      updateQuizWithUndo(updatedQuiz);
      
      const description = fallbackCount > 0 
        ? `Přidáno ${newSlides.length} stránek. ${successCount} nahráno do knihovny, ${fallbackCount} uloženo lokálně.`
        : `Přidáno ${newSlides.length} stránek z PDF. Obrázky uloženy do vaší knihovny.`;
      
      toast.success(`Import dokončen!`, { id: toastId, description });
      
      // Select the first imported slide
      if (newSlides.length > 0) {
        setSelectedSlideId(newSlides[0].id);
      }
    } catch (err) {
      console.error('PDF import error:', err);
      toast.error('Chyba při importu PDF', { 
        id: toastId,
        description: err instanceof Error ? err.message : 'Neznámá chyba' 
      });
    } finally {
      setIsImportingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };
  
  // Navigate to full results page
  const openSessionResults = (session: SessionData) => {
    openBoardResultsPage({
      session,
      navigate,
      routes,
    });
  };

  const openPreview = useCallback(() => {
    openBoardPreview(setShowPreview);
  }, [setShowPreview]);

  const closePreview = useCallback(() => {
    closeBoardPreview(setShowPreview);
  }, [setShowPreview]);

  const closeLiveSession = useCallback(() => {
    closeBoardLiveSession(setShowLiveSession);
  }, [setShowLiveSession]);

  const openVersionHistory = useCallback(() => {
    openBoardVersionHistory(setShowVersionHistory);
  }, [setShowVersionHistory]);

  const openShareEdit = useCallback(() => {
    openBoardShareEditDialog(setShowShareEditDialog);
  }, [setShowShareEditDialog]);

  const openResultsTab = useCallback(() => {
    openBoardResultsTab(setViewMode);
  }, [setViewMode]);

  const resetCanvasInteraction = useCallback(() => {
    resetBoardCanvasInteraction({
      setSelectedBlockIndex,
      setShowBlockSettings,
      setActivePanel,
      setEditingTextBlockIndex,
      setShowPageSettings,
    });
  }, [
    setActivePanel,
    setEditingTextBlockIndex,
    setSelectedBlockIndex,
    setShowBlockSettings,
    setShowPageSettings,
  ]);

  const clearCanvasBlockSelection = useCallback(() => {
    clearBoardBlockSelection({
      setSelectedBlockIndex,
      setShowBlockSettings,
    });
  }, [setSelectedBlockIndex, setShowBlockSettings]);

  const clearSlideEditorSelection = useCallback(() => {
    clearBoardBlockSelection({
      setSelectedBlockIndex,
      setShowBlockSettings,
      setBlockSettingsSection,
      setEditingTextBlockIndex,
    });
  }, [
    setBlockSettingsSection,
    setEditingTextBlockIndex,
    setSelectedBlockIndex,
    setShowBlockSettings,
  ]);

  const resetEditorSelection = useCallback(() => {
    resetBoardEditorSelection({
      setSelectedBlockIndex,
      setActivePanel,
      setShowPageSettings,
      setEditingTextBlockIndex,
    });
  }, [
    setActivePanel,
    setEditingTextBlockIndex,
    setSelectedBlockIndex,
    setShowPageSettings,
  ]);

  const handleBlockSelectionChange = useCallback((blockIndex: number | null) => {
    handleBoardBlockSelectionChange({
      blockIndex,
      setSelectedBlockIndex,
      setShowPageSettings,
      setActivePanel,
      setShowBlockSettings,
    });
  }, [
    setActivePanel,
    setSelectedBlockIndex,
    setShowBlockSettings,
    setShowPageSettings,
  ]);

  const handleOpenBlockSettings = useCallback((blockIndex: number, initialSection?: string) => {
    setSelectedBlockIndex(blockIndex);
    openBoardBlockSettings({
      setShowBlockSettings,
      setBlockSettingsSection,
      initialSection: initialSection ?? null,
    });
  }, [setBlockSettingsSection, setSelectedBlockIndex, setShowBlockSettings]);

  const handleQuizSettingsUpdate = useCallback((settingsUpdate: Partial<QuizSettings>) => {
    updateBoardEditorQuizSettings({
      quiz,
      settingsUpdate,
      setQuiz,
      setIsDirty,
    });
  }, [quiz, setIsDirty, setQuiz]);

  const handleBlockSettingsUpdate = useCallback((updates: Partial<SlideBlock>) => {
    if (selectedBlockIndex === null || selectedSlide?.type !== 'info' || !selectedSlide.layout) {
      return;
    }

    updateSelectedInfoBlock({
      selectedSlide,
      selectedBlockIndex,
      updates,
      updateSlide,
    });
  }, [selectedBlockIndex, selectedSlide, updateSlide]);

  const handleBlockImageUpload = useCallback(async (file: File) => {
    if (selectedBlockIndex === null || selectedSlide?.type !== 'info' || !selectedSlide.layout) {
      return;
    }

    await uploadImageToSelectedInfoBlock({
      file,
      uploadFile,
      selectedSlide,
      selectedBlockIndex,
      updateSlide,
    });
  }, [selectedBlockIndex, selectedSlide, updateSlide, uploadFile]);

  // ============================================
  // RENDER
  // ============================================
  
  if (!quiz) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }
  
  if (showPreview) {
    const previewSlideIndex = getBoardPreviewSlideIndex(
      selectedSlideId,
      quiz.slides.map((slide) => slide.id),
    );
    
    return (
      <QuizPreview 
        quiz={quiz} 
        onClose={closePreview}
        initialSlideIndex={previewSlideIndex}
      />
    );
  }
  
  if (showLiveSession) {
    return (
      <TeacherSession
        quiz={quiz}
        teacherId={profile?.userId || 'anonymous'}
        teacherName={profile?.firstName || 'Učitel'}
        onClose={closeLiveSession}
      />
    );
  }
  
  // Show loading indicator while fetching quiz from Supabase
  if (isLoadingQuiz) {
    return (
      <div className="flex h-screen bg-[#F8F9FB] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
          <p className="text-slate-600 font-medium">Načítám board...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className="flex h-screen bg-[#F8F9FB] overflow-hidden font-sans"
    >
      {/* 1. LEFT NARROW NAVIGATION STRIP */}
      <div 
        className="left-toolbar print:!hidden"
        style={{ 
          width: '100px',
          minWidth: '100px',
          height: '100%',
          backgroundColor: '#E8ECF4',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '16px',
          paddingBottom: '16px',
          borderRight: '1px solid #D8DCE6',
          zIndex: 20,
        }}
      >
        {/* Back button - shows "Ukládám..." when saving is in progress */}
        <button
          type="button"
          disabled={isSaving}
          onClick={async () => {
            // If saving in progress, don't allow navigation
            if (isSaving) {
              console.log('[QuizEditor] Save in progress, cannot navigate');
              return;
            }
            
            // If there are unsaved changes, save first
            if (isDirty && quiz) {
              setIsSaving(true);
              console.log('[QuizEditor] Saving before navigation...');
              
              try {
                const persistPromise = persistBoardDraft({
                  quiz,
                  persistence: { saveQuiz },
                  projectId,
                  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
                });
                setIsDirty(false);
                await persistPromise;
                console.log('[QuizEditor] Saved before navigation');
              } catch (err) {
                console.warn('[QuizEditor] Save before navigation failed:', err);
              } finally {
                setIsSaving(false);
              }
            }
            
            // Navigate after save
            const targetUrl = buildBoardReturnUrl({ quiz, returnUrl });
            if (quiz?.sourceWorksheet) {
              console.log('[QuizEditor] Navigating back with board link:', targetUrl);
            }
            navigate(targetUrl);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '16px',
            background: 'none',
            border: 'none',
            cursor: isSaving ? 'wait' : 'pointer',
            padding: 0,
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" style={{ color: '#22c55e' }} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#22c55e' }}>Ukládám...</span>
            </>
          ) : isDirty ? (
            <>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#f59e0b' }}>Neuloženo</span>
            </>
          ) : (
            <>
              <ArrowLeft size={16} strokeWidth={2} style={{ color: '#4E5871' }} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#4E5871' }}>Zpět</span>
            </>
          )}
        </button>
        
        {/* My Board Tab (Settings) */}
        <SidebarButton
          onClick={() => {
            setActivePanel('settings');
            setViewMode('editor');
          }}
          isActive={activePanel === 'settings' && viewMode === 'editor'}
          icon={BookOpen}
          label="Můj board"
        />
        
        {/* Structure Tab (Slide list) */}
        <SidebarButton
          onClick={() => {
            setActivePanel('board');
            setViewMode('editor');
          }}
          isActive={activePanel === 'board' && viewMode === 'editor'}
          icon={Layers}
          label="Struktura"
        />

        {/* Osnova Tab (Worksheet map) — only shown when worksheetMap exists */}
        {quiz?.worksheetMap && (
          <SidebarButton
            onClick={() => {
              setActivePanel('osnova');
              setViewMode('editor');
            }}
            isActive={activePanel === 'osnova' && viewMode === 'editor'}
            icon={Map}
            label="Osnova"
          />
        )}
        
        {/* Add Content Tab */}
        <SidebarButton
          onClick={() => {
            setContentPanelMode('add');
            setActivePanel('content');
            setViewMode('editor');
          }}
          isActive={activePanel === 'content' && viewMode === 'editor' && contentPanelMode === 'add'}
          icon={Plus}
          label="Přidat obsah"
        />
        
        {/* AI Tab */}
        <SidebarButton
          onClick={() => {
            setActivePanel('ai');
            setViewMode('editor');
          }}
          isActive={activePanel === 'ai' && viewMode === 'editor'}
          icon={Sparkles}
          label="AI"
        />

        {/* Spacer */}
        <div style={{ flex: 1 }} />
      </div>
      
      {/* 2. CONTEXTUAL SIDEBAR PANEL (Only visible in editor mode) */}
      {viewMode === 'editor' && (
        <div 
          className="flex flex-col transition-all duration-300 relative"
          style={{ width: '320px', minWidth: '320px', backgroundColor: '#F2F5F9', zIndex: 100 }}
        >
          {/* PANEL CONTENT */}
          
          {/* BOARD STRUCTURE PANEL */}
          {activePanel === 'board' && (
            <div className="flex flex-col h-full bg-white relative overflow-visible">
              {/* Header with high z-index and explicit stacking context to keep dropdown on top */}
              <div className="p-6 border-b border-slate-100 bg-[#F8F9FB] min-h-[170px] flex flex-col justify-between relative z-[500] overflow-visible">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <input
                      type="text"
                      value={quiz.title}
                      onChange={(e) => {
                        setQuiz({ ...quiz, title: e.target.value });
                        setIsDirty(true);
                      }}
                      className="text-base font-bold text-slate-800 bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-100 rounded px-1 -ml-1 w-full truncate"
                      placeholder="Název boardu..."
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActivePanel('settings'); }}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                      title="Nastavení boardu"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* View switcher: List vs Grid - No background */}
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => setShowSlidePreviews(false)}
                      className={`p-1.5 rounded-md transition-all ${
                        !showSlidePreviews 
                          ? 'text-indigo-600' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title="Seznam"
                    >
                      <ListOrdered className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowSlidePreviews(true)}
                      className={`p-1.5 rounded-md transition-all ${
                        showSlidePreviews 
                          ? 'text-indigo-600' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title="Náhledy"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* New Slide Button Dropdown - Joined with rounded corners */}
                <div className="relative" ref={newSlideDropdownRef}>
                  <div className="flex items-stretch bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-all overflow-hidden">
                    <button
                      onClick={() => setShowNewSlideDropdown(!showNewSlideDropdown)}
                      className="flex-1 flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span>Nová stránka</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showNewSlideDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    <div className="w-px bg-slate-100" />
                    <button
                      onClick={() => {
                        const infoType = SLIDE_TYPES.find(t => t.id === 'info');
                        if (infoType) addSlide(infoType);
                      }}
                      className="px-5 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                      title="Rychle přidat informační stránku"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {showNewSlideDropdown && createPortal(
                    <div 
                      ref={dropdownContentRef}
                      className="fixed bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] overflow-hidden py-1 max-h-[450px] overflow-y-auto"
                      style={{ 
                        width: newSlideDropdownRef.current?.offsetWidth || 272,
                        top: (newSlideDropdownRef.current?.getBoundingClientRect().bottom || 0) + 4,
                        left: newSlideDropdownRef.current?.getBoundingClientRect().left || 0
                      }}
                    >
                      {/* Informace */}
                      <button
                        onClick={() => {
                          const type = SLIDE_TYPES.find(t => t.id === 'info');
                          if (type) addSlide(type);
                          setShowNewSlideDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
                      >
                        <div 
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#4E587115', color: '#4E5871' }}
                        >
                          {React.cloneElement(SLIDE_TYPES.find(t => t.id === 'info')?.icon as React.ReactElement, { className: 'w-5 h-5' })}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-700 truncate">Informace</span>
                          <span className="block text-[10px] text-slate-400 truncate">Text, obrázky, video</span>
                        </div>
                      </button>

                      {/* Aktivita - Opens activity selection in left panel */}
                      <button
                        onClick={() => {
                          setContentPanelMode('add');
                          setActivePanel('content');
                          setShowActivitiesSubmenu(true);
                          setShowToolsSubmenu(false);
                          setShowNewSlideDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
                      >
                        <div 
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#03CA9015', color: '#03CA90' }}
                        >
                          {React.cloneElement(SLIDE_TYPES.find(t => t.id === 'abc')?.icon as React.ReactElement, { className: 'w-5 h-5' })}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-700 truncate">Aktivita</span>
                          <span className="block text-[10px] text-slate-400 truncate">Kvízy, hry, hlasování</span>
                        </div>
                      </button>

                      {/* Nástroje */}
                      <button
                        onClick={() => {
                          setContentPanelMode('add');
                          setActivePanel('content');
                          setShowActivitiesSubmenu(false);
                          setShowToolsSubmenu(true);
                          setShowNewSlideDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
                      >
                        <div 
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#FF815815', color: '#FF8158' }}
                        >
                          {React.cloneElement(SLIDE_TYPES.find(t => t.type === 'tools')?.icon as React.ReactElement, { className: 'w-5 h-5' })}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-700 truncate">Nástroje</span>
                          <span className="block text-[10px] text-slate-400 truncate">Interaktivní pomůcky</span>
                        </div>
                      </button>

                      <div className="border-t border-slate-100 my-1" />

                      {/* Import PDF */}
                      <button
                        onClick={() => {
                          pdfInputRef.current?.click();
                          setShowNewSlideDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 text-left text-orange-600 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold">Importovat z PDF</span>
                      </button>

                      {/* Import from board */}
                      <button
                        onClick={() => {
                          alert('Funkce bude brzy dostupná');
                          setShowNewSlideDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left text-indigo-600 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold">Vložit z boardu</span>
                      </button>
                    </div>,
                    document.body
                  )}
                </div>
              </div>
              
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-3 bg-[#F8F9FB] relative z-0 select-none"
                onMouseDown={handleMarqueeMouseDown}
              >
                {selectionRect && (
                  <div 
                    style={{
                      position: 'fixed',
                      left: selectionRect.x,
                      top: selectionRect.y,
                      width: selectionRect.w,
                      height: selectionRect.h,
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgb(99, 102, 241)',
                      zIndex: 999999,
                      pointerEvents: 'none'
                    }}
                  />
                )}
                {quiz.slides.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <BookOpen className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="font-medium text-slate-600 mb-1">Zatím žádné slidy</p>
                    <p className="text-xs text-slate-400 mb-4">Začněte přidáním obsahu nebo použijte AI</p>
                    <button
                      onClick={() => setActivePanel('content')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                      Přidat obsah
                    </button>
                  </div>
                ) : (
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={quiz.slides.map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className={showSlidePreviews ? 'space-y-3' : 'space-y-2'}>
                        {(() => {
                          let chapterCount = 0;
                          return quiz.slides.map((slide, index) => {
                            const typeInfo = SLIDE_TYPES.find(t => 
                              t.type === slide.type && 
                              (slide.type !== 'activity' || t.activityType === (slide as any).activityType)
                            ) || SLIDE_TYPES[0];
                            
                            const chapterName = (slide as any).chapterName;
                            if (chapterName) chapterCount++;
                            
                            return (
                              <SortableSlideItem 
                                key={slide.id}
                                slide={slide}
                                index={index}
                                selectedSlideId={selectedSlideId}
                                setSelectedSlideId={setSelectedSlideId}
                                multiSelectedIds={multiSelectedIds}
                                setMultiSelectedIds={setMultiSelectedIds}
                                typeInfo={typeInfo}
                                chapterName={chapterName}
                                chapterCount={chapterCount}
                                showSlidePreviews={showSlidePreviews}
                                duplicateSlide={duplicateSlide}
                                deleteSlide={deleteSlide}
                                getSlideTitle={getSlideTitle}
                              />
                            );
                          });
                        })()}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          )}

          {/* ADD CONTENT PANEL */}
          {activePanel === 'content' && (
            <div className="flex flex-col h-full bg-white">
              <div className="p-5 border-b border-slate-100 bg-[#F8F9FB]">
                <h2 className="text-xl font-bold text-[#4E5871]">
                  {contentPanelMode === 'add' ? 'Přidat obsah' : 'Změnit typ stránky'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {contentPanelMode === 'add' 
                    ? 'Vyberte, co chcete přidat do svého boardu' 
                    : 'Vyberte nový typ pro aktuální stránku'}
                </p>
              </div>
              
              <div className="p-5 overflow-y-auto flex-1">
                {!showActivitiesSubmenu && !showToolsSubmenu ? (
                  <>
                    {/* Main options */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-slate-500 mb-3">
                        {contentPanelMode === 'add' ? 'Přidat stránku:' : 'Změnit na:'}
                      </h3>
                      <div className="space-y-2">
                        {/* Informace */}
                        <button
                          onClick={() => {
                            const infoType = SLIDE_TYPES.find(t => t.id === 'info');
                            if (infoType) {
                              if (contentPanelMode === 'add') addSlide(infoType);
                              else changeSlideType(infoType);
                            }
                          }}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-slate-400 hover:shadow-md transition-all text-left group"
                        >
                          {(() => {
                            const type = SLIDE_TYPES.find(t => t.id === 'info') || SLIDE_TYPES[0];
                            return (
                              <>
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" 
                                  style={{ backgroundColor: `${type.color}15`, color: type.color }}
                                >
                                  {type.icon}
                          </div>
                                <span className="font-semibold text-slate-700 group-hover:text-slate-900">Informace</span>
                              </>
                            );
                          })()}
                          <Plus className="w-5 h-5 text-slate-300 ml-auto group-hover:text-slate-500" />
                        </button>
                        
                        {/* Aktivity */}
                        <button
                          onClick={() => setShowActivitiesSubmenu(true)}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
                        >
                          {(() => {
                            const type = SLIDE_TYPES.find(t => t.id === 'abc') || SLIDE_TYPES[1];
                            return (
                              <>
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" 
                                  style={{ backgroundColor: `${type.color}15`, color: type.color }}
                                >
                                  {type.icon}
                          </div>
                                <span className="font-semibold text-slate-700 group-hover:text-emerald-700">Aktivita</span>
                              </>
                            );
                          })()}
                          <ChevronRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-emerald-500" />
                        </button>
                        
                        {/* Nástroje */}
                        <button
                          onClick={() => {
                            setShowActivitiesSubmenu(false);
                            setShowToolsSubmenu(true);
                          }}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-orange-400 hover:shadow-md transition-all text-left group"
                        >
                          {(() => {
                            const type = SLIDE_TYPES.find(t => t.type === 'tools') || SLIDE_TYPES[SLIDE_TYPES.length - 1];
                            return (
                              <>
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" 
                                  style={{ backgroundColor: `${type.color}15`, color: type.color }}
                                >
                                  {type.icon}
                          </div>
                                <span className="font-semibold text-slate-700 group-hover:text-orange-700">Nástroje</span>
                              </>
                            );
                          })()}
                          <Plus className="w-5 h-5 text-slate-300 ml-auto group-hover:text-orange-500" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Additional options (only in add mode) */}
                    {contentPanelMode === 'add' && (
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            // TODO: Implement import from another board
                            alert('Funkce bude brzy dostupná');
                          }}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left group"
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#8b5cf615', color: '#8b5cf6' }}>
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <span className="font-semibold text-slate-700 group-hover:text-indigo-700">Přidat obsah z jiného boardu</span>
                        </button>
                        
                        <button
                          onClick={() => pdfInputRef.current?.click()}
                          disabled={isImportingPdf}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left group ${isImportingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f9731615', color: '#f97316' }}>
                            {isImportingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                          </div>
                          <span className="font-semibold text-slate-700 group-hover:text-indigo-700">
                            {isImportingPdf ? 'Zpracovávám PDF...' : 'Přidat obsah z PDF'}
                          </span>
                        </button>
                        
                        <input 
                          type="file"
                          ref={pdfInputRef}
                          onChange={handlePdfImport}
                          accept="application/pdf"
                          className="hidden"
                        />
                      </div>
                    )}
                  </>
                ) : showActivitiesSubmenu ? (
                  /* Activities submenu */
                  <>
                    <button
                      onClick={() => setShowActivitiesSubmenu(false)}
                      className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="text-sm font-medium">Zpět</span>
                    </button>
                    
                    <h3 className="text-sm font-semibold text-slate-500 mb-3">
                      {contentPanelMode === 'add' ? 'Vyberte aktivitu:' : 'Změnit na aktivitu:'}
                    </h3>
                    <div className="space-y-6">
                      {/* Vyhodnotitelné */}
                      <div>
                        <h4 className="text-[10px] uppercase font-bold text-emerald-600 mb-2 px-1 tracking-wider text-left">Aktivity vyhodnotitelné</h4>
                        <div className="space-y-2">
                          {SLIDE_TYPES.filter(t => t.type === 'activity' && t.category === 'evaluable').map((type) => (
                            <button
                              key={type.id}
                              onClick={() => {
                                if (contentPanelMode === 'add') addSlide(type);
                                else changeSlideType(type);
                                setShowActivitiesSubmenu(false);
                                setShowToolsSubmenu(false);
                              }}
                              className="w-full flex items-center gap-4 p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
                            >
                              <div 
                                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${type.color}15`, color: type.color }}
                              >
                                {React.cloneElement(type.icon as React.ReactElement, { className: 'w-5 h-5' })}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="block font-semibold text-slate-700 group-hover:text-emerald-700 text-sm leading-tight">{type.label}</span>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{type.description}</p>
                              </div>
                              <Plus className="w-4 h-4 text-slate-300 ml-auto group-hover:text-emerald-500" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Nevyhodnotitelné */}
                      <div>
                        <h4 className="text-[10px] uppercase font-bold text-violet-600 mb-2 px-1 tracking-wider text-left">Nevyhodnotitelné</h4>
                        <div className="space-y-2">
                          {SLIDE_TYPES.filter(t => t.type === 'activity' && t.category === 'non-evaluable').map((type) => (
                            <button
                              key={type.id}
                              onClick={() => {
                                if (contentPanelMode === 'add') addSlide(type);
                                else changeSlideType(type);
                                setShowActivitiesSubmenu(false);
                                setShowToolsSubmenu(false);
                              }}
                              className="w-full flex items-center gap-4 p-3 rounded-xl border border-slate-200 hover:border-violet-400 hover:shadow-md transition-all text-left group"
                            >
                              <div 
                                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${type.color}15`, color: type.color }}
                              >
                                {React.cloneElement(type.icon as React.ReactElement, { className: 'w-5 h-5' })}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="block font-semibold text-slate-700 group-hover:text-violet-700 text-sm leading-tight">{type.label}</span>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{type.description}</p>
                              </div>
                              <Plus className="w-4 h-4 text-slate-300 ml-auto group-hover:text-violet-500" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Živé */}
                      <div>
                        <h4 className="text-[10px] uppercase font-bold text-red-600 mb-2 px-1 tracking-wider text-left">Živé aktivity</h4>
                        <div className="space-y-2">
                          {SLIDE_TYPES.filter(t => t.type === 'activity' && t.category === 'live').map((type) => (
                            <button
                              key={type.id}
                              onClick={() => {
                                if (contentPanelMode === 'add') addSlide(type);
                                else changeSlideType(type);
                                setShowActivitiesSubmenu(false);
                                setShowToolsSubmenu(false);
                              }}
                              className="w-full flex items-center gap-4 p-3 rounded-xl border border-slate-200 hover:border-red-400 hover:shadow-md transition-all text-left group"
                            >
                              <div 
                                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${type.color}15`, color: type.color }}
                              >
                                {React.cloneElement(type.icon as React.ReactElement, { className: 'w-5 h-5' })}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="block font-semibold text-slate-700 group-hover:text-red-700 text-sm leading-tight">{type.label}</span>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{type.description}</p>
                              </div>
                              <Plus className="w-4 h-4 text-slate-300 ml-auto group-hover:text-red-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowToolsSubmenu(false)}
                      className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="text-sm font-medium">Zpět</span>
                    </button>

                    <h3 className="text-sm font-semibold text-slate-500 mb-3">
                      {contentPanelMode === 'add' ? 'Vyberte nástroj:' : 'Změnit na nástroj:'}
                    </h3>
                    <div className="space-y-2">
                      {SLIDE_TYPES.filter(t => t.type === 'tools').map((type) => (
                        <button
                          key={type.id}
                          onClick={() => {
                            if (contentPanelMode === 'add') addSlide(type);
                            else changeSlideType(type);
                            setShowActivitiesSubmenu(false);
                            setShowToolsSubmenu(false);
                          }}
                          className="w-full flex items-center gap-4 p-3 rounded-xl border border-slate-200 hover:border-orange-400 hover:shadow-md transition-all text-left group"
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${type.color}15`, color: type.color }}
                          >
                            {React.cloneElement(type.icon as React.ReactElement, { className: 'w-5 h-5' })}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block font-semibold text-slate-700 group-hover:text-orange-700 text-sm leading-tight">{type.label}</span>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{type.description}</p>
                          </div>
                          <Plus className="w-4 h-4 text-slate-300 ml-auto group-hover:text-orange-500" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* AI PANEL */}
          {activePanel === 'ai' && (
            <div className="flex flex-col h-full bg-white">
            <AIBoardPanel
              quiz={quiz}
              pdfTranscript={quiz.pdfTranscript}
              onAddSlides={(newSlides) => {
                // Add slides to quiz
                const updatedSlides = [...quiz.slides];
                newSlides.forEach((slide, idx) => {
                  slide.order = updatedSlides.length + idx;
                  updatedSlides.push(slide);
                });
                setQuiz({
                  ...quiz,
                  slides: updatedSlides,
                  updatedAt: new Date().toISOString(),
                });
                setIsDirty(true);
                // Select first new slide
                if (newSlides.length > 0) {
                  setSelectedSlideId(newSlides[0].id);
                }
                // Switch to board view to see results
                setActivePanel('board');
              }}
              onClose={() => setActivePanel('board')}
            />
            </div>
          )}
          
          {/* OSNOVA PANEL */}
          {activePanel === 'osnova' && quiz?.worksheetMap && (
            <OsnovaPanel
              worksheetMap={quiz.worksheetMap}
              slides={quiz.slides}
              selectedSlideId={selectedSlideId}
              onSlideSelect={(id) => setSelectedSlideId(id)}
            />
          )}

          {/* SETTINGS PANEL */}
          {activePanel === 'settings' && (
            <div className="flex flex-col h-full border-0" style={{ backgroundColor: '#F2F5F9' }}>
              <div className="px-6 flex-1 overflow-y-auto" style={{ paddingTop: '155px' }}>
                <div className="space-y-4">
                  {/* Board Name - 80px height */}
                  <input
                    type="text"
                    value={quiz.title}
                    onChange={(e) => {
                      setQuiz({ ...quiz, title: e.target.value });
                      setIsDirty(true);
                    }}
                    className="w-full px-5 text-2xl font-bold rounded-2xl border-0 focus:ring-2 focus:ring-indigo-300 outline-none transition-all text-slate-700 placeholder-slate-400"
                    placeholder="Název boardu"
                    style={{ backgroundColor: '#DFE4F0', height: '80px' }}
                  />
                  
                  {/* Označení dropdown */}
                  <div className="flex items-center gap-4">
                    <span className="text-base font-medium text-slate-500 whitespace-nowrap">Označení:</span>
                    <select 
                      value={(quiz as any).boardType || 'practice'}
                      onChange={(e) => {
                        setQuiz({ ...quiz, boardType: e.target.value } as any);
                        setIsDirty(true);
                      }}
                      className="flex-1 px-4 py-3.5 rounded-2xl border-0 focus:ring-2 focus:ring-indigo-300 outline-none text-slate-700 font-medium"
                      style={{ backgroundColor: '#DFE4F0' }}
                    >
                      <option value="practice">Procvičování</option>
                      <option value="text">Text</option>
                      <option value="test">Písemky</option>
                      <option value="lesson">Lekce</option>
                    </select>
                </div>
                
                  {/* Subject dropdown - full width */}
                  <select 
                    value={quiz.subject || ''}
                    onChange={(e) => {
                      setQuiz({ ...quiz, subject: e.target.value });
                      setIsDirty(true);
                    }}
                    className="w-full px-5 py-4 rounded-2xl border-0 focus:ring-2 focus:ring-indigo-300 outline-none text-slate-600 font-medium"
                    style={{ backgroundColor: '#DFE4F0' }}
                  >
                    <option value="">Předmět</option>
                    <option value="matematika">Matematika</option>
                    <option value="fyzika">Fyzika</option>
                    <option value="chemie">Chemie</option>
                    <option value="biologie">Biologie</option>
                    <option value="cestina">Český jazyk</option>
                    <option value="anglictina">Anglický jazyk</option>
                    <option value="dejepis">Dějepis</option>
                    <option value="zemepis">Zeměpis</option>
                  </select>
                </div>
                
                {/* Action buttons - no background, smaller spacing */}
                <div className="mt-8 space-y-2">
                  {/* Version History Button */}
                  <button
                    onClick={openVersionHistory}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-600"
                  >
                    <History className="w-5 h-5" />
                    <span className="font-medium">Historie verzí</span>
                  </button>
                  
                  {/* Share Edit Link Button */}
                  <button
                    onClick={openShareEdit}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-600"
                  >
                    <Share2 className="w-5 h-5" />
                    <span className="font-medium">Sdílet odkaz pro úpravu</span>
                  </button>
                  
                  {/* Results Button */}
                  <button
                    onClick={openResultsTab}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-600"
                  >
                    <BarChart2 className="w-5 h-5" />
                    <span className="font-medium">Výsledky</span>
                  </button>
                  
                  {/* Print Button */}
                  <button
                    onClick={() => {
                      const currentQuiz = quizRef.current;
                      if (!currentQuiz) return;
                      openWorksheetEditorFromBoard({
                        quiz: currentQuiz,
                        persistence: { saveQuiz },
                        navigate,
                        saveWorksheet,
                        createWorksheetFromBoard: boardToWorksheet,
                      });
                      setIsDirty(false);
                    }}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-600"
                  >
                    <Printer className="w-5 h-5" />
                    <span className="font-medium">Tisknout</span>
                  </button>
                  
                  
                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (confirm('Opravdu chcete smazat tento board? Tato akce je nevratná.')) {
                        navigate('/quizzes');
                      }
                    }}
                    className="w-full flex items-center gap-4 px-2 py-2.5 rounded-lg hover:bg-red-100 transition-colors text-red-500"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="font-medium">Smazat</span>
                  </button>

                  <div className="pt-4 mt-4 border-t border-slate-200">
                    {!showImportInput ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowImportInput(true);
                        }}
                        className="w-full flex items-center gap-4 px-2 py-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-400 text-xs"
                      >
                        <Download className="w-4 h-4" />
                        <span>Importovat ze starého formátu</span>
                      </button>
                    ) : (
                      <div className="space-y-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <input
                          type="text"
                          value={importInputValue}
                          onChange={(e) => setImportInputValue(e.target.value)}
                          placeholder="ID nebo link na API"
                          className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 focus:ring-1 focus:ring-indigo-300 outline-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleImportFromOldFormat}
                            className="flex-1 px-2 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded hover:bg-indigo-700 transition-colors"
                          >
                            Importovat
                          </button>
                          <button
                            disabled={jsonPreviewLoading}
                            onClick={async () => {
                              const input = importInputValue.trim();
                              if (!input) { alert('Vložte ID, odkaz nebo JSON.'); return; }
                              // Raw JSON — show immediately
                              if (input.startsWith('{') || input.startsWith('[')) {
                                try {
                                  const parsed = JSON.parse(input);
                                  setJsonPreviewText(JSON.stringify(parsed, null, 2));
                                } catch {
                                  setJsonPreviewText(input);
                                }
                                return;
                              }
                              // Extract UUID and go via proxy
                              const uuidM = input.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
                              if (!uuidM) {
                                alert('Nepodařilo se najít UUID v zadaném textu.');
                                return;
                              }
                              const boardId = uuidM[1];
                              setJsonPreviewLoading(true);
                              try {
                                const res = await fetchVividboardProxy(boardId);
                                const text = await res.text();
                                try {
                                  const json = JSON.parse(text);
                                  setJsonPreviewText(JSON.stringify(json, null, 2));
                                } catch {
                                  setJsonPreviewText(text || '(prázdná odpověď)');
                                }
                              } catch(e) {
                                setJsonPreviewText(
                                  `CHYBA: ${e}\n\nBoard ID: ${boardId}`,
                                );
                              } finally {
                                setJsonPreviewLoading(false);
                              }
                            }}
                            className="px-2 py-1.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded hover:bg-amber-200 transition-colors disabled:opacity-50"
                            title="Zobrazit surová data JSON (nebo vložte JSON přímo)"
                          >
                            {jsonPreviewLoading ? '...' : 'JSON'}
                          </button>
                          <button
                            onClick={() => {
                              setShowImportInput(false);
                              setImportInputValue('');
                            }}
                            className="px-2 py-1.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded hover:bg-slate-300 transition-colors"
                          >
                            Zrušit
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Save as Interactive Worksheet */}
                    <button
                      onClick={async () => {
                        saveQuiz(quiz);
                        setIsDirty(false);
                        
                        // Determine category - from sourceWorksheet or ask user
                        let category = quiz.sourceWorksheet?.category;
                        if (!category) {
                          const input = prompt('Do které kategorie uložit? (fyzika, matematika, chemie, atd.)', 'fyzika');
                          if (!input) return;
                          category = input.trim();
                        }
                        
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session?.access_token) {
                            alert('Nepodařilo se získat session');
                            return;
                          }
                            const menuResp = await fetch(
                              `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${category}`,
                              { headers: { 'Authorization': `Bearer ${session.access_token}` } }
                            );
                            if (!menuResp.ok) {
                              alert('Nepodařilo se načíst menu');
                              return;
                            }
                          const menuData = await menuResp.json();
                          let menu = menuData.menu || [];
                          const worksheetId = quiz.sourceWorksheet?.id;
                          const newBoardItem = {
                            id: `board-${quiz.id}`,
                            label: `${quiz.title} - Interaktivní`,
                            slug: `interactive-${quiz.id}`,
                            type: 'interactive',
                            icon: 'play',
                            externalUrl: `board://${quiz.id}`,
                          };
                          
                          // Check if already exists
                          const alreadyExists = (items: any[]): boolean => {
                            for (const item of items) {
                              if (item.id === newBoardItem.id) return true;
                              if (item.children && alreadyExists(item.children)) return true;
                            }
                            return false;
                          };
                          
                          if (alreadyExists(menu)) {
                            alert('Tento interaktivní list už v menu existuje.');
                            return;
                          }
                          
                          let added = false;
                          let updatedMenu = menu;
                          
                          if (worksheetId) {
                            // Try to add next to source worksheet
                            const addBoardToParent = (items: any[]): any[] => {
                              return items.map((item) => {
                                if (item.children && item.children.length > 0) {
                                  const worksheetIndex = item.children.findIndex((c: any) => c.id === worksheetId);
                                  if (worksheetIndex !== -1) {
                                    const newChildren = [...item.children];
                                    newChildren.splice(worksheetIndex + 1, 0, newBoardItem);
                                    added = true;
                                    return { ...item, children: newChildren };
                                  }
                                  return { ...item, children: addBoardToParent(item.children) };
                                }
                                return item;
                              });
                            };
                            updatedMenu = addBoardToParent(menu);
                            if (!added) {
                              const worksheetIndex = menu.findIndex((item: any) => item.id === worksheetId);
                              if (worksheetIndex !== -1) {
                                updatedMenu = [...menu];
                                updatedMenu.splice(worksheetIndex + 1, 0, newBoardItem);
                                added = true;
                              }
                            }
                          }
                          
                          // If not added (no worksheetId or not found), add to root
                          if (!added) {
                            updatedMenu = [...menu, newBoardItem];
                          }
                            const saveResp = await fetch(
                              `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu`,
                              {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify({ menu: updatedMenu, category }),
                              }
                            );
                            if (saveResp.ok) {
                              alert('✓ Interaktivní pracovní list byl uložen do složky!');
                            } else {
                              alert('Nepodařilo se uložit');
                            }
                          } catch (e) {
                            console.error('Save error:', e);
                            alert('Chyba: ' + (e instanceof Error ? e.message : 'Neznámá chyba'));
                          }
                        }}
                        className="w-full flex items-center gap-4 px-2 py-2 mt-2 rounded-lg hover:bg-emerald-50 transition-colors text-emerald-600 text-xs"
                      >
                        <Link2 className="w-4 h-4" />
                      <span>Uložit jako Interaktivní PL</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* 3. MAIN CONTENT AREA - High z-index to stay above sidebar */}
      <div 
        className="flex-1 flex flex-col relative bg-slate-100 cursor-default" 
        style={{ zIndex: 10 }}
      >
        {viewMode === 'editor' ? (
          <>
            {/* Top bar - clean, no background */}
            <div 
              className="h-16 flex items-center justify-between px-6 z-10"
            >
              {/* Slide navigation */}
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    const currentIndex = quiz.slides.findIndex(s => s.id === selectedSlideId);
                    if (currentIndex > 0) {
                      setSelectedSlideId(quiz.slides[currentIndex - 1].id);
                    }
                  }}
                  disabled={!selectedSlideId || quiz.slides.findIndex(s => s.id === selectedSlideId) === 0}
                  className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="px-4 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: '#374151', color: '#f3f4f6' }}>
                  {selectedSlideId ? quiz.slides.findIndex(s => s.id === selectedSlideId) + 1 : 0} / {quiz.slides.length}
                </div>
                <button
                  onClick={() => {
                    const currentIndex = quiz.slides.findIndex(s => s.id === selectedSlideId);
                    if (currentIndex < quiz.slides.length - 1) {
                      setSelectedSlideId(quiz.slides[currentIndex + 1].id);
                    }
                  }}
                  disabled={!selectedSlideId || quiz.slides.findIndex(s => s.id === selectedSlideId) === quiz.slides.length - 1}
                  className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
            </div>
            
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {/* Undo/Redo buttons - square icons */}
                      <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="w-10 h-10 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-30 disabled:hover:bg-slate-200 transition-colors flex items-center justify-center"
                  title="Zpět (Ctrl+Z)"
                >
                  <Undo2 className="w-5 h-5" />
                      </button>
                      <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="w-10 h-10 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-30 disabled:hover:bg-slate-200 transition-colors flex items-center justify-center"
                  title="Vpřed (Ctrl+Shift+Z)"
                >
                  <Redo2 className="w-5 h-5" />
                      </button>

                {/* Preview - square icon */}
                      <button
                  onClick={openPreview}
                  className="w-10 h-10 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors flex items-center justify-center"
                  title="Náhled"
                >
                  <Eye className="w-5 h-5" />
                      </button>

                {/* Print / Worksheet - square icon */}
                                <button
                                  onClick={() => {
                    const currentQuiz = quizRef.current;
                    if (!currentQuiz) return;
                    openWorksheetEditorFromBoard({
                      quiz: currentQuiz,
                      persistence: { saveQuiz },
                      navigate,
                      saveWorksheet,
                      createWorksheetFromBoard: boardToWorksheet,
                    });
                    setIsDirty(false);
                  }}
                  className="w-10 h-10 rounded-lg text-white flex items-center justify-center transition-colors"
                  style={{ backgroundColor: '#f97316' }}
                  title="Pracovní list"
                >
                  <Printer className="w-5 h-5" />
                                </button>

                {/* Play and Share - green button */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    // Use ref to get the CURRENT quiz value (avoid stale closure)
                    const currentQuiz = quizRef.current;
                    if (!currentQuiz) {
                      console.error('[QuizEditor] No quiz to save!');
                      return;
                    }
                    
                    // Debug: log quiz state before save
                    console.log('[QuizEditor] Saving before navigation:', {
                      id: currentQuiz.id,
                      title: currentQuiz.title,
                      slidesCount: currentQuiz.slides?.length,
                      hasSettings: !!currentQuiz.settings,
                    });
                    
                    openBoardViewFromEditor({
                      quiz: currentQuiz,
                      persistence: { saveQuiz },
                      navigate,
                      routes,
                      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
                    });
                    setIsDirty(false);
                  }}
                  disabled={quiz.slides.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:transform-none"
                  style={{ backgroundColor: '#78F1B1', color: '#1a1a1a' }}
                >
                  <Play className="w-5 h-5" />
                  {windowWidth > 1050 ? 'Přehrát a sdílet' : 'Přehrát'}
                </button>
              </div>
                            </div>
                          </div>
            
            {/* Editor Canvas - Responsive with reserved space for block settings on left, expanded to right */}
            <div 
              className="flex-1 overflow-auto p-4 flex justify-center bg-slate-100 relative cursor-default"
              style={{ paddingLeft: showNavArrows ? '80px' : '16px', paddingRight: showNavArrows ? '80px' : '16px' }}
              onClick={resetCanvasInteraction}
            >
              {selectedSlide ? (
                <div 
                  className="relative w-full flex flex-col mb-4 transition-all duration-300 mx-auto" 
                  style={{ 
                    width: '100%',
                    maxWidth: showNavArrows 
                      ? 'min(calc((100vh - 220px) * 4 / 3 * 0.97), calc(100% - 40px))' 
                      : 'min(calc((100vh - 220px) * 4 / 3 * 0.88), calc(100% - 40px))',
                  }}
                  onClick={clearCanvasBlockSelection}
                >
                  {/* Settings and Slide Type Info - aligned left */}
                  <div className="flex items-center justify-start gap-2 mb-3 relative z-[100] min-h-[40px] ml-2.5" data-block-settings-row>
                    {/* BLOCK SETTINGS - When a block is selected */}
                    {selectedBlockIndex !== null && selectedSlide?.type === 'info' && selectedSlide.layout ? (
                      <>
                        {/* Close Button - X in white circle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBlockIndex(null);
                            setBlockSettingsSection(null);
                          }}
                          className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-500 flex items-center justify-center transition-all shrink-0"
                          title="Zavřít nastavení bloku"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        
                        {/* Block Settings Button - Toggles BlockSettingsPanel */}
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const selectedBlock = selectedSlide.layout.blocks[selectedBlockIndex];
                            const defaultSection = selectedBlock?.type === 'image' || selectedBlock?.type === 'lottie'
                              ? 'image'
                              : selectedBlock?.type === 'link'
                                ? 'link'
                                : null;
                            if (showBlockSettings) {
                              setShowBlockSettings(false);
                              setBlockSettingsSection(null);
                            } else {
                              setShowBlockSettings(true);
                              setBlockSettingsSection(defaultSection);
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-2xl transition-all group active:scale-95 h-10"
                          style={{ 
                            backgroundColor: showBlockSettings ? '#1d4ed8' : '#dbeafe',
                            color: showBlockSettings ? '#ffffff' : '#1d4ed8',
                            border: '1px solid #93c5fd',
                          }}
                          title={showBlockSettings ? "Zavřít nastavení bloku" : "Otevřít nastavení bloku"}
                        >
                          <Settings className="w-4 h-4" />
                          <span className="text-[13px] font-medium whitespace-nowrap">
                            Blok
                          </span>
                        </button>
                        
                        {/* Block Background Color Button - wider style */}
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setShowBlockSettings(true);
                            setBlockSettingsSection('background');
                          }}
                          className="flex items-center justify-center px-4 h-10 rounded-2xl transition-all group active:scale-95 border border-slate-200 hover:border-slate-400"
                          style={{ 
                            backgroundColor: selectedSlide.layout.blocks[selectedBlockIndex]?.background?.color || '#ffffff',
                            color: getContrastColor(
                              (selectedSlide.layout.blocks[selectedBlockIndex]?.background?.color === 'transparent'
                                ? (selectedSlide.layout.blocks[selectedBlockIndex]?.background?.strokeColor || '#f8fafc')
                                : selectedSlide.layout.blocks[selectedBlockIndex]?.background?.color) || '#ffffff'
                            ),
                            ...(selectedSlide.layout.blocks[selectedBlockIndex]?.background?.strokeColor &&
                            (selectedSlide.layout.blocks[selectedBlockIndex]?.background?.strokeWidth ?? 0) > 0
                              ? {
                                  border: `${selectedSlide.layout.blocks[selectedBlockIndex]?.background?.strokeWidth}px solid ${selectedSlide.layout.blocks[selectedBlockIndex]?.background?.strokeColor}`,
                                }
                              : {}),
                          }}
                          title="Barva pozadí bloku"
                        >
                          <ColorIcon className="w-5 h-5" />
                        </button>

                        {/* Text Block Toolbar */}
                        {selectedSlide.layout.blocks[selectedBlockIndex]?.type === 'text' && (
                          <>
                            <div className="w-px h-6 bg-slate-200 mx-1" />
                            
                            {/* Text label with gray background - clickable to open settings */}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBlockSettings(true);
                                setBlockSettingsSection('format');
                              }}
                              className="flex items-center gap-2 px-3 rounded-2xl h-10 hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: '#64748b' }}
                            >
                              <Type className="w-4 h-4 text-white" />
                              <span className="text-[13px] font-medium text-white">Text</span>
                            </button>
                            
                            <SlideTextToolbar
                              isBold={selectedSlide.layout.blocks[selectedBlockIndex]?.fontWeight === 'bold'}
                              isItalic={selectedSlide.layout.blocks[selectedBlockIndex]?.fontStyle === 'italic'}
                              isUnderline={selectedSlide.layout.blocks[selectedBlockIndex]?.textDecoration === 'underline'}
                              textAlign={selectedSlide.layout.blocks[selectedBlockIndex]?.textAlign || 'left'}
                              fontSize={selectedSlide.layout.blocks[selectedBlockIndex]?.fontSize || 'medium'}
                              textColor={selectedSlide.layout.blocks[selectedBlockIndex]?.textColor || '#000000'}
                              highlightColor={selectedSlide.layout.blocks[selectedBlockIndex]?.highlightColor || 'transparent'}
                              textOverflow={selectedSlide.layout.blocks[selectedBlockIndex]?.textOverflow === 'scroll' ? 'scroll' : 'fit'}
                              listType={selectedSlide.layout.blocks[selectedBlockIndex]?.listType || 'none'}
                              onBoldToggle={() => {
                                const block = selectedSlide.layout!.blocks[selectedBlockIndex];
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...block, fontWeight: block.fontWeight === 'bold' ? 'normal' : 'bold' };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onItalicToggle={() => {
                                const block = selectedSlide.layout!.blocks[selectedBlockIndex];
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...block, fontStyle: block.fontStyle === 'italic' ? 'normal' : 'italic' };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onUnderlineToggle={() => {
                                const block = selectedSlide.layout!.blocks[selectedBlockIndex];
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...block, textDecoration: block.textDecoration === 'underline' ? 'none' : 'underline' };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onAlignChange={(align) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], textAlign: align };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onFontSizeChange={(size) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], fontSize: size };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onTextColorChange={(color) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], textColor: color };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onHighlightColorChange={(color) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], highlightColor: color };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onTextOverflowChange={(overflow) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { ...newBlocks[selectedBlockIndex], textOverflow: overflow };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onSizePresetChange={(preset) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { 
                                  ...newBlocks[selectedBlockIndex], 
                                  fontSize: preset.fontSize, 
                                  textOverflow: preset.textOverflow 
                                };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onListTypeChange={(type) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                const block = newBlocks[selectedBlockIndex];
                                let content = block.content || '';
                                content = content.split('\n').map(line => 
                                  line.replace(/^(\d+\.\s|•\s|☐\s|☑\s)/, '')
                                ).join('\n');
                                if (type !== 'none') {
                                  content = content.split('\n').map((line, idx) => {
                                    if (!line.trim()) return line;
                                    if (type === 'numbered') return `${idx + 1}. ${line}`;
                                    if (type === 'bullet') return `• ${line}`;
                                    if (type === 'checklist') return `☐ ${line}`;
                                    return line;
                                  }).join('\n');
                                }
                                newBlocks[selectedBlockIndex] = { ...block, listType: type, content };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              onInsertSymbol={(symbol) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                const block = newBlocks[selectedBlockIndex];
                                newBlocks[selectedBlockIndex] = { ...block, content: (block.content || '') + symbol };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                            />
                          </>
                        )}

                        {/* Image Block Toolbar */}
                        {(selectedSlide.layout.blocks[selectedBlockIndex]?.type === 'image' || selectedSlide.layout.blocks[selectedBlockIndex]?.type === 'lottie') && (
                          <>
                            <div className="w-px h-6 bg-slate-200 mx-1" />
                            
                            {/* Image label with purple background - clickable to open settings */}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBlockSettings(true);
                                setBlockSettingsSection('image');
                              }}
                              className="flex items-center gap-2 px-3 rounded-2xl h-10 hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: '#6366f1' }}
                            >
                              <ImageIcon className="w-4 h-4 text-white" />
                              <span className="text-[13px] font-medium text-white">Obrázek</span>
                            </button>
                            
                            {/* Upload/Change image button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBlockSettings(true);
                                setBlockSettingsSection('image');
                              }}
                              className="flex items-center gap-2 px-4 bg-white border border-slate-200 hover:border-slate-400 rounded-2xl transition-all h-10"
                              title="Nahrát nový obrázek"
                            >
                              <Upload className="w-4 h-4 text-slate-500" />
                              <span className="text-[13px] font-medium text-[#4E5871]">
                                {selectedSlide.layout.blocks[selectedBlockIndex]?.content ? 'Změnit' : 'Nahrát'}
                              </span>
                            </button>

                            {/* Image scale slider - only show if image exists */}
                            {selectedSlide.layout.blocks[selectedBlockIndex]?.content && (
                              <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 rounded-2xl h-10">
                                <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">Velikost</span>
                                <input
                                  type="range"
                                  min="10"
                                  max="200"
                                  value={selectedSlide.layout.blocks[selectedBlockIndex]?.imageScale || 100}
                                  onChange={(e) => {
                                    const newBlocks = [...selectedSlide.layout!.blocks];
                                    newBlocks[selectedBlockIndex] = { 
                                      ...newBlocks[selectedBlockIndex], 
                                      imageScale: parseInt(e.target.value),
                                      imageFit: 'contain'
                                    };
                                    updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                                  }}
                                  className="w-16 accent-indigo-500"
                                  style={{ height: '4px' }}
                                  title="Velikost obrázku"
                                />
                              </div>
                            )}

                            {/* Gallery button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBlockSettings(true);
                                setBlockSettingsSection('image');
                              }}
                              className={`flex items-center gap-2 px-4 rounded-2xl transition-all h-10 ${
                                selectedSlide.layout.blocks[selectedBlockIndex]?.gallery?.length 
                                  ? 'bg-indigo-50 border border-indigo-300 text-indigo-600' 
                                  : 'bg-white border border-slate-200 hover:border-slate-400 text-[#4E5871]'
                              }`}
                              title="Spravovat galerii obrázků"
                            >
                              <Grid2X2 className="w-4 h-4" />
                              <span className="text-[13px] font-medium">
                                {selectedSlide.layout.blocks[selectedBlockIndex]?.gallery?.length 
                                  ? `Galerie (${selectedSlide.layout.blocks[selectedBlockIndex]?.gallery?.length})` 
                                  : 'Galerie'}
                              </span>
                            </button>
                          </>
                        )}

                        {/* Link Block Toolbar */}
                        {selectedSlide.layout.blocks[selectedBlockIndex]?.type === 'link' && (
                          <>
                            <div className="w-px h-6 bg-slate-200 mx-1" />
                            
                            {/* Link label with orange background - clickable to open settings */}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBlockSettings(true);
                                setBlockSettingsSection(null);
                              }}
                              className="flex items-center gap-2 px-3 rounded-2xl h-10 hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: '#f97316' }}
                            >
                              <Link2 className="w-4 h-4 text-white" />
                              <span className="text-[13px] font-medium text-white">Odkaz</span>
                            </button>
                            
                            {/* URL input */}
                            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 rounded-2xl h-10">
                              <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                value={selectedSlide.layout.blocks[selectedBlockIndex]?.content || ''}
                                onChange={(e) => {
                                  const newBlocks = [...selectedSlide.layout!.blocks];
                                  newBlocks[selectedBlockIndex] = { 
                                    ...newBlocks[selectedBlockIndex], 
                                    content: e.target.value 
                                  };
                                  updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                                }}
                                placeholder="https://..."
                                className="w-44 text-[13px] font-medium text-[#4E5871] bg-transparent border-none focus:outline-none placeholder-slate-400"
                              />
                            </div>

                            {/* Link display style dropdown */}
                            <select
                              value={selectedSlide.layout.blocks[selectedBlockIndex]?.linkMode || 'button'}
                              onChange={(e) => {
                                const newBlocks = [...selectedSlide.layout!.blocks];
                                newBlocks[selectedBlockIndex] = { 
                                  ...newBlocks[selectedBlockIndex], 
                                  linkMode: e.target.value as 'button' | 'embed' | 'video' | 'qr' | 'preview'
                                };
                                updateSlide(selectedSlide.id, { layout: { ...selectedSlide.layout!, blocks: newBlocks } });
                              }}
                              className="text-[13px] font-medium text-[#4E5871] bg-white border border-slate-200 rounded-2xl h-10 px-4 focus:outline-none focus:border-indigo-400 cursor-pointer"
                            >
                              <option value="button">Tlačítko</option>
                              <option value="preview">Náhled</option>
                              <option value="embed">Vložit</option>
                              <option value="video">Video</option>
                              <option value="qr">QR kód</option>
                            </select>
                          </>
                        )}
                      </>
                    ) : (
                      /* PAGE SETTINGS - When no block is selected */
                      <>
                        {/* Page Settings Button - Light blue - toggles panel */}
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePageSettings(); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-2xl transition-all group active:scale-95 h-10 ml-1"
                          style={{ 
                            backgroundColor: showPageSettings ? '#1d4ed8' : '#dbeafe',
                            color: showPageSettings ? '#ffffff' : '#1d4ed8',
                            border: '1px solid #93c5fd',
                          }}
                          title={showPageSettings ? "Zavřít nastavení stránky" : "Otevřít nastavení stránky"}
                        >
                          <Settings className="w-4 h-4" />
                          <span className="text-[13px] font-medium whitespace-nowrap">
                            Stránka
                          </span>
                        </button>

                    {/* Page Type Buttons */}
                    {selectedSlide.type === 'activity' ? (
                      <>
                        {/* 1. Category Button: Aktivita */}
                    <button
                      onClick={(e) => { e.stopPropagation(); openPageSettings('type'); }}
                          className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-slate-400 px-4 py-2 rounded-2xl transition-all group active:scale-95 h-10 ml-1"
                          title="Změnit typ stránky"
                        >
                          <div style={{ color: '#03CA90' }}>
                            {React.cloneElement(SLIDE_TYPES.find(t => t.id === 'abc')?.icon as React.ReactElement, { className: 'w-4 h-4' })}
                          </div>
                          <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">
                            Aktivita
                          </span>
                        </button>

                        {/* 2. Specific Type Button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); openPageSettings('type', true); }}
                          className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-slate-400 px-4 py-2 rounded-2xl transition-all group active:scale-95 h-10 ml-1"
                          title="Změnit typ aktivity"
                        >
                          {(() => {
                            const typeInfo = SLIDE_TYPES.find(t => 
                              t.type === selectedSlide.type && 
                              t.activityType === (selectedSlide as any).activityType
                            ) || SLIDE_TYPES[0];
                            return (
                              <>
                                <div style={{ color: typeInfo.color }}>
                                  {React.cloneElement(typeInfo.icon as React.ReactElement, { className: 'w-4 h-4' })}
                                </div>
                                <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">
                                  {typeInfo.label}
                                </span>
                              </>
                            );
                          })()}
                        </button>
                      </>
                    ) : (
                      /* Standard button for non-activity slides */
                      <button
                        onClick={(e) => { e.stopPropagation(); openPageSettings('type'); }}
                        className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-slate-400 px-4 py-2 rounded-2xl transition-all group active:scale-95 h-10 ml-1"
                      title="Změnit typ stránky"
                    >
                      {(() => {
                        const typeInfo = SLIDE_TYPES.find(t => 
                          t.type === selectedSlide.type && 
                          (selectedSlide.type !== 'activity' || t.activityType === (selectedSlide as any).activityType)
                        ) || SLIDE_TYPES[0];
                        return (
                          <>
                            <div style={{ color: typeInfo.color }}>
                              {React.cloneElement(typeInfo.icon as React.ReactElement, { className: 'w-4 h-4' })}
                            </div>
                            <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">
                                {typeInfo.label}
                            </span>
                          </>
                        );
                      })()}
                    </button>
                    )}

                    {/* Layout Button (only for info slides) */}
                    {selectedSlide.type === 'info' && (
                        <button 
                        onClick={(e) => { e.stopPropagation(); openPageSettings('layout'); }}
                        className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-slate-400 px-4 py-2 rounded-2xl transition-all group active:scale-95 h-10 shrink-0"
                          title="Změnit rozložení"
                        >
                            {windowWidth > 1260 && (
                        <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">
                          Rozvržení
                        </span>
                            )}
                        <LayoutIcon type={(selectedSlide as InfoSlide).layout?.type || 'title-content'} size="small" />
                        </button>
                    )}

                        {/* Background Color Button - just icon - for all slides including activities */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); openPageSettings('background'); }}
                          className="flex items-center justify-center w-10 h-10 rounded-2xl transition-all group active:scale-95 border border-slate-200 hover:border-slate-400 shrink-0"
                      style={{ 
                        backgroundColor: (() => {
                          const bg = (selectedSlide as any).slideBackground;
                          if (bg?.type === 'color') return bg.color;
                          if (typeof bg === 'string') return bg;
                          return '#ffffff';
                        })(),
                        ...(() => {
                          const bg = (selectedSlide as any).slideBackground;
                          if (bg?.strokeColor && (bg?.strokeWidth ?? 0) > 0) {
                            return { border: `${bg.strokeWidth}px solid ${bg.strokeColor}` };
                          }
                          return {};
                        })(),
                        color: (() => {
                          const bgColor = (() => {
                            const bg = (selectedSlide as any).slideBackground;
                            if (bg?.type === 'color') return bg.color;
                            if (typeof bg === 'string') return bg;
                            return '#ffffff';
                          })();
                          const strokeColor = (() => {
                            const bg = (selectedSlide as any).slideBackground;
                            return bg?.strokeColor;
                          })();
                          return getContrastColor(bgColor === 'transparent' ? (strokeColor || '#f8fafc') : bgColor);
                        })()
                      }}
                      title="Změnit barvu pozadí"
                    >
                          <ColorIcon className="w-[18px] h-[16px]" />
                    </button>

                    <div className="flex-1" /> {/* Spacer */}

                    {/* Navigation and Slide Operations */}
                    <div className="flex items-center gap-2">
                      {/* Move Slide Buttons */}
                      <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-2xl h-10">
                            {windowWidth > 1050 && (
                        <span className="text-[13px] font-medium text-[#4E5871] whitespace-nowrap">
                          Přesunout
                        </span>
                            )}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveSlide(selectedSlide.id, 'up'); }}
                            disabled={quiz?.slides.findIndex(s => s.id === selectedSlide.id) === 0}
                            className={`p-1 rounded-lg transition-all ${
                              quiz?.slides.findIndex(s => s.id === selectedSlide.id) === 0
                                ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                : 'bg-slate-100 text-[#4E5871] hover:bg-slate-200 active:scale-90'
                            }`}
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveSlide(selectedSlide.id, 'down'); }}
                            disabled={quiz?.slides.findIndex(s => s.id === selectedSlide.id) === quiz?.slides.length - 1}
                            className={`p-1 rounded-lg transition-all ${
                              quiz?.slides.findIndex(s => s.id === selectedSlide.id) === quiz?.slides.length - 1
                                ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                : 'bg-slate-100 text-[#4E5871] hover:bg-slate-200 active:scale-90'
                            }`}
                          >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                      </div>

                      {/* Duplicate Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateSlide(selectedSlide.id); }}
                        className="w-10 h-10 bg-white border border-slate-200 text-[#4E5871] hover:border-indigo-400 hover:text-indigo-600 rounded-2xl transition-all flex items-center justify-center active:scale-95 group"
                        title="Duplikovat stránku"
                      >
                        <Copy className="w-5 h-5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (confirm('Opravdu chcete tuto stránku smazat?')) {
                            deleteSlide(selectedSlide.id);
                          }
                        }}
                        className="w-10 h-10 bg-white border border-slate-200 text-[#4E5871] hover:bg-red-50 hover:border-red-300 hover:text-red-600 rounded-2xl transition-all flex items-center justify-center active:scale-95"
                        title="Smazat stránku"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                      </>
                    )}
                  </div>
                  
                  {/* The actual editor with navigation arrows */}
                  <div className="relative">
                    {/* Left Arrow - Gray style like in preview (hidden on smaller screens) */}
                    {showNavArrows && (
                      <button
                        onClick={goToPrevSlide}
                        disabled={selectedSlideIndex <= 0}
                        className={`absolute top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                          selectedSlideIndex <= 0 
                            ? 'opacity-30 cursor-not-allowed' 
                            : 'hover:scale-110 hover:h-20 active:scale-95'
                        }`}
                        style={{ 
                          left: '-60px',
                          backgroundColor: '#CBD5E1'
                        }}
                      >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                      </button>
                    )}
                    
                    {/* Slide Editor */}
                    <div 
                      className="rounded-xl shadow-sm border border-slate-200 transition-colors duration-300"
                      style={{ 
                        backgroundColor: (selectedSlide as any).slideBackground?.color || '#ffffff'
                      }}
                      onClick={clearSlideEditorSelection}
                    >
                      {renderSlideEditor(
                        selectedSlide, 
                        updateSlide, 
                        resetEditorSelection,
                        selectedBlockIndex,
                        handleBlockSelectionChange,
                        handleOpenBlockSettings,
                        (blockIndex) => {
                          setEditingTextBlockIndex(blockIndex);
                        },
                        () => {
                          setEditingTextBlockIndex(null);
                        },
                        quiz,
                        handleQuizSettingsUpdate,
                        datasetImages.length > 0 ? datasetImages : undefined
                      )}
                    </div>
                    
                    {/* Right Arrow - Purple style like in preview (hidden on smaller screens) */}
                    {showNavArrows && (
                      <button
                        onClick={goToNextSlide}
                        disabled={!quiz || selectedSlideIndex >= quiz.slides.length - 1}
                        className={`absolute top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full flex items-center justify-center text-white transition-all duration-300 ${
                          !quiz || selectedSlideIndex >= quiz.slides.length - 1 
                            ? 'opacity-30 cursor-not-allowed' 
                            : 'hover:scale-110 hover:h-20 active:scale-95'
                        }`}
                        style={{ 
                          right: '-60px',
                          backgroundColor: '#7C3AED'
                        }}
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Buttons below slide */}
                  <div className="flex items-center justify-between mt-4">
                    {/* Left side: Comments + Nová kapitola */}
                    <div className="flex items-center gap-1">
                      {/* Comments button */}
                      {(() => {
                        const slideComments = boardComments.filter(c => c.slide_id === selectedSlide.id);
                        const unreadCount = slideComments.filter(c => !c.is_read).length;
                        return (
                          <SlideCommentsPreview
                            comments={slideComments}
                            unreadCount={unreadCount}
                            onOpenPanel={() => {
                              setPageSettingsSection('comments');
                              setShowPageSettings(true);
                            }}
                          />
                        );
                      })()}
                      
                      {/* Nová kapitola */}
                      <button
                        onClick={(e) => { e.stopPropagation(); openPageSettings('chapter'); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Menu className="w-4 h-4" />
                        <span>
                          {(selectedSlide as any).chapterName || 'Nová kapitola'}
                        </span>
                      </button>
                    </div>
                    
                    {/* Přidat poznámku - right */}
                    <button
                      onClick={(e) => { e.stopPropagation(); openPageSettings('note'); }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <NoteIcon size={16} />
                      <span className="truncate max-w-[200px]">
                        {(selectedSlide as any).note 
                          ? ((selectedSlide as any).note.length > 30 
                              ? (selectedSlide as any).note.substring(0, 30) + '...' 
                              : (selectedSlide as any).note)
                          : 'Přidat poznámku'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6 opacity-50">
                    <Plus className="w-10 h-10 text-slate-400" />
                  </div>
                  <p className="text-xl font-medium text-slate-600">Začněte tvořit</p>
                  <p className="text-slate-500 mt-2 mb-6">Vyberte "Přidat obsah" v levém panelu pro vytvoření prvního slidu.</p>
                  <button
                    onClick={() => setActivePanel('content')}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all"
                  >
                    + Přidat první blok
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Results View */
          <div className="flex-1 bg-slate-50 overflow-hidden">
            <SessionsList
              sessions={sessions}
              loadingSessions={loadingSessions}
              onOpenSession={openSessionResults}
            />
          </div>
        )}
      </div>

      {/* Version History Modal */}
      {showVersionHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <VersionHistoryPanel
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
            onClose={() => setShowVersionHistory(false)}
          />
        </div>
      )}
      
      {/* Page Settings Panel - Rendered via portal to document.body */}
      {showPageSettings && selectedSlide && createPortal(
        <PageSettingsPanel
          slide={selectedSlide}
          onClose={() => {
            setShowPageSettings(false);
            setPageSettingsSection(undefined);
            setPageSettingsInitialShowActivities(false);
          }}
          onUpdate={(updates) => updateSlide(selectedSlide.id, updates)}
          onTypeChange={changeSlideType}
          initialSection={pageSettingsSection}
          initialShowActivitiesList={pageSettingsInitialShowActivities}
          comments={boardComments}
          boardId={id}
          onCommentsUpdated={loadComments}
        />,
        document.body
      )}
      
      {/* Block Settings Panel - Rendered via portal to document.body */}
      {showBlockSettings && selectedBlockIndex !== null && selectedSlide?.type === 'info' && selectedSlide.layout && createPortal(
        <BlockSettingsPanel
          key={`block-${selectedBlockIndex}-${blockSettingsSection}`}
          block={selectedSlide.layout.blocks[selectedBlockIndex]}
          blockIndex={selectedBlockIndex}
          initialSection={blockSettingsSection || undefined}
          onUpdate={handleBlockSettingsUpdate}
          onClose={clearSlideEditorSelection}
          onImageUpload={handleBlockImageUpload}
          datasetImages={datasetImages.length > 0 ? datasetImages : undefined}
        />,
        document.body
      )}
      
      {/* No backdrop - allow interaction with slide while panel is open */}

      {/* JSON Preview Modal */}
      {jsonPreviewText && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center z-[99999]"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setJsonPreviewText(null)}
        >
          <div
            className="flex flex-col rounded-xl shadow-2xl overflow-hidden"
            style={{ width: '80vw', maxWidth: 900, height: '80vh', background: '#1e1e1e' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-mono text-slate-300">JSON — starý formát</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(jsonPreviewText); }}
                  className="px-3 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors font-medium"
                >
                  Kopírovat vše
                </button>
                <button
                  onClick={() => setJsonPreviewText(null)}
                  className="px-3 py-1 text-xs rounded bg-slate-600 text-white hover:bg-slate-500 transition-colors"
                >
                  Zavřít
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={jsonPreviewText}
              className="flex-1 resize-none outline-none p-4 font-mono text-xs leading-relaxed"
              style={{ background: '#1e1e1e', color: '#d4d4d4' }}
              onClick={e => (e.target as HTMLTextAreaElement).select()}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Share Edit Dialog */}
      {quiz && (
        <ShareEditDialog
          isOpen={showShareEditDialog}
          onClose={() => setShowShareEditDialog(false)}
          boardId={quiz.id}
          boardTitle={quiz.title || 'Board'}
        />
      )}
    </div>
  );
}


export default QuizEditorLayout;
