import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Moon, Sun, Save, BookOpen, CheckCircle2, Loader2, ChevronDown, ChevronUp, Settings, User, GraduationCap, ExternalLink, BarChart3, Play, Pencil, Plus, Download, ArrowLeft } from 'lucide-react';
import { CategoryOverview } from './admin/CategoryOverview';
import { AdminColumnBrowser } from './admin/AdminColumnBrowser';
import { RichTextEditor } from './RichTextEditor';
import { HtmlRenderer } from './HtmlRenderer';
import { SectionMediaManager } from './admin/SectionMediaManager';
import { WorksheetEditor } from './admin/WorksheetEditor';
import { WorkbookEditor, WorkbookData, DEFAULT_WORKBOOK_DATA } from './admin/WorkbookEditor';
import { SectionMediaItem } from '../types/section-media';
import { WorksheetData, DEFAULT_WORKSHEET_DATA } from '../types/worksheet';
import { supabase } from '../utils/supabase/client';
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';
import { DOCUMENT_TYPES } from '../types/document-types';
import { useViewMode } from '../contexts/ViewModeContext';
import * as quizStorage from '../utils/quiz-storage';
import { createEmptyQuiz } from '../types/quiz';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

/**
 * Utility to get current session reliably, trying localStorage first
 * then falling back to Supabase API with a timeout to prevent hanging.
 */
async function getSupabaseSession() {
  // Method 1: Try localStorage
  try {
    const storageKey = `sb-njbtqmsxbyvpwigfceke-auth-token`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.access_token) {
        console.log('[Auth] Got token from localStorage');
        return {
          data: {
            session: {
              access_token: parsed.access_token,
              user: parsed.user
            }
          },
          error: null
        };
      }
    }
  } catch (e) {
    console.error('[Auth] Error reading from localStorage:', e);
  }

  // Method 2: Fallback to getSession with timeout
  try {
    const sessionPromise = getSupabaseSession();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Session timeout')), 3000)
    );
    const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
    console.log('[Auth] Got session from API:', result?.data?.session ? 'yes' : 'no');
    return {
      data: { session: result?.data?.session || null },
      error: result?.error || null
    };
  } catch (e) {
    console.error('[Auth] Session fetch failed/timeout:', e);
    return { data: { session: null }, error: e };
  }
}

interface AdminLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onLogout: () => void;
}

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  description: string;
  category: string;
  icon?: string;
  documentType?: string;
  externalUrl?: string;
  featuredMedia?: string;
  sectionImages?: SectionMediaItem[];
  updatedAt: string;
}

// Component for opening Vividbooks as teacher or student
function ViewModeDropdown() {
  const { setViewMode } = useViewMode();
  const navigate = useNavigate();
  
  // Use BASE_URL to handle both localhost and GitHub Pages deployment
  const baseUrl = import.meta.env.BASE_URL || '/';
  
  const openAsTeacher = () => {
    setViewMode('teacher');
    window.open(`${baseUrl}docs/fyzika`, '_blank');
  };
  
  const openAsStudent = () => {
    setViewMode('student');
    window.open(`${baseUrl}library/student-wall`, '_blank');
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors">
          <BookOpen className="h-4 w-4" />
          Zobrazit Vividbooks
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={openAsTeacher} className="cursor-pointer">
          <User className="w-4 h-4 mr-2 text-indigo-600" />
          <div className="flex flex-col">
            <span className="font-medium">Jako učitel</span>
            <span className="text-xs text-slate-500">Plný přístup k materiálům</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-400" />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openAsStudent} className="cursor-pointer">
          <GraduationCap className="w-4 h-4 mr-2 text-emerald-600" />
          <div className="flex flex-col">
            <span className="font-medium">Jako žák</span>
            <span className="text-xs text-slate-500">Zobrazení pro studenty</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-400" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NewAdminLayout({ theme, toggleTheme, onLogout }: AdminLayoutProps) {
  const params = useParams();
  const category = params.category;
  const slug = params['*'];
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  
  // Build current admin URL for returnUrl parameter
  const currentAdminUrl = location.pathname;
  
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [title, setTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [icon, setIcon] = useState<string>('');
  const [documentType, setDocumentType] = useState('lesson');
  const [featuredMedia, setFeaturedMedia] = useState<string>('');
  const [sectionImages, setSectionImages] = useState<SectionMediaItem[]>([]);
  const [worksheetData, setWorksheetData] = useState<WorksheetData>(DEFAULT_WORKSHEET_DATA);
  const [workbookData, setWorkbookData] = useState<WorkbookData>(DEFAULT_WORKBOOK_DATA);
  const [boardId, setBoardId] = useState<string>('');
  const [availableHeadings, setAvailableHeadings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showPreview, setShowPreview] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [error, setError] = useState('');
  // sidebarKey was used for AdminSidebar - removed

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);


  // Load page when slug changes
  useEffect(() => {
    if (category && slug) {
      loadPage(category, slug);
    } else {
      // Clear editor
      setCurrentPage(null);
      const titleParam = searchParams.get('title');
      setTitle(titleParam || '');
      setPageSlug('');
      setDescription('');
      setContent('');
      setExternalUrl('');
      setBoardId('');
      setIcon('');
      setDocumentType('lesson');
      initialLoadRef.current = true;
    }
  }, [category, slug]);
  
  // Redirect to quiz editor if this is a board type (practice/test/exam)
  useEffect(() => {
    const boardTypes = ['practice', 'test', 'exam'];
    const isBoardType = boardTypes.includes(documentType);
    
    if (isBoardType && pageSlug) {
      // Determine board ID - either from externalUrl or construct from slug
      let targetBoardId = '';
      if (externalUrl?.startsWith('board://')) {
        targetBoardId = externalUrl.replace('board://', '');
      } else {
        // Construct from slug if no externalUrl
        targetBoardId = `board_${pageSlug}`;
      }
      
      if (targetBoardId) {
        // Navigate to quiz editor with return URL
        navigate(`/quiz/edit/${targetBoardId}?returnUrl=${encodeURIComponent(currentAdminUrl)}`);
      }
    }
  }, [documentType, externalUrl, pageSlug, currentAdminUrl, navigate]);

  // Extract H2 headings from content
  useEffect(() => {
    const extractHeadings = () => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const headings: string[] = [];
      doc.querySelectorAll('h2').forEach(h2 => {
        if (h2.textContent) headings.push(h2.textContent);
      });
      setAvailableHeadings(headings);
    };

    extractHeadings();
  }, [content]);

  // Auto-save functionality
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    if (!currentPage) return;
    if (!title || !pageSlug) return;
    
    setAutoSaveStatus('unsaved');
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setTimeout(() => {
      autoSave();
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, content, description, pageSlug, icon, documentType, externalUrl, featuredMedia, sectionImages, worksheetData, workbookData]);

  const loadPage = async (cat: string, pageSlug: string) => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`Loading page: category=${cat}, slug=${pageSlug}`);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${pageSlug}?category=${cat}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      console.log(`Load page response: status=${response.status}`);

      if (response.ok) {
        const data = await response.json();
        const page = data.page;
        
        console.log(`Page loaded successfully: ${page.title}, sectionImages:`, page.sectionImages);
        setCurrentPage(page);
        setTitle(page.title);
        setPageSlug(page.slug);
        setDescription(page.description || '');
        setContent(page.content || '');
        setExternalUrl(page.externalUrl || '');
        // Parse boardId from externalUrl if it's a board:// URL
        if (page.externalUrl?.startsWith('board://')) {
          setBoardId(page.externalUrl.replace('board://', ''));
        } else {
          setBoardId('');
        }
        setIcon(page.icon || '');
        setDocumentType(page.documentType || 'lesson');

        if (page.documentType === 'worksheet') {
          try {
            const parsed = JSON.parse(page.content || '{}');
            setWorksheetData({ ...DEFAULT_WORKSHEET_DATA, ...parsed });
          } catch (e) {
            console.warn('Failed to parse worksheet data from content, using defaults');
            setWorksheetData(DEFAULT_WORKSHEET_DATA);
          }
        } else if (page.documentType === 'workbook') {
          try {
            const parsed = JSON.parse(page.content || '{}');
            setWorkbookData({ ...DEFAULT_WORKBOOK_DATA, ...parsed });
          } catch (e) {
            setWorkbookData(DEFAULT_WORKBOOK_DATA);
          }
        } else {
          setWorksheetData(DEFAULT_WORKSHEET_DATA);
          setWorkbookData(DEFAULT_WORKBOOK_DATA);
        }

        setFeaturedMedia(page.featuredMedia || '');
        setSectionImages(page.sectionImages || []);
        setAutoSaveStatus('saved');
        initialLoadRef.current = true;
      } else {
        const errorData = await response.json();
        console.log(`Page not found: ${errorData.error || 'Unknown error'}`);
        // Page doesn't exist - set up for new page creation
        setCurrentPage(null);
        const titleParam = searchParams.get('title');
        setTitle(titleParam || '');
        setPageSlug(pageSlug);
        setDescription('');
        setContent('');
        setExternalUrl('');
        setIcon('');
        setDocumentType('lesson');
        setFeaturedMedia('');
        setSectionImages([]);
        setAutoSaveStatus('unsaved');
        initialLoadRef.current = true;
      }
    } catch (err) {
      console.error('Error loading page:', err);
      setError('Chyba při načítání stránky');
    } finally {
      setLoading(false);
    }
  };

  const autoSave = async () => {
    if (!currentPage || !category) return;
    
    console.log(`Auto-saving page: slug=${currentPage.slug}, icon=${icon}, sectionImages=${JSON.stringify(sectionImages)}`);
    setAutoSaveStatus('saving');
    
    try {
      const { data: { session } } = await getSupabaseSession();
      if (!session?.access_token) {
        console.log('Auto-save failed: no session');
        setAutoSaveStatus('unsaved');
        return;
      }

      const contentToSend = documentType === 'worksheet' 
        ? JSON.stringify(worksheetData)
        : documentType === 'workbook'
          ? JSON.stringify(workbookData)
          : content;

      // For workbooks, sync featuredMedia from workbookData
      const mediaToSend = documentType === 'workbook' ? (workbookData.coverImage || '') : featuredMedia;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${currentPage.slug}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            title,
            content: contentToSend,
            description,
            icon,
            documentType,
            externalUrl,
            featuredMedia: mediaToSend,
            sectionImages,
            category,
            newSlug: pageSlug !== currentPage.slug ? pageSlug : undefined
          })
        }
      );

      if (response.ok) {
        console.log('Auto-save successful');
        setAutoSaveStatus('saved');
        
        // If slug changed, navigate to new URL
        if (pageSlug !== currentPage.slug) {
          navigate(`/admin/${category}/${pageSlug}`, { replace: true });
        }
      } else {
        const errorData = await response.json();
        console.error(`Auto-save failed: ${errorData.error}`);
        setAutoSaveStatus('unsaved');
      }
    } catch (err) {
      console.error('Error auto-saving:', err);
      setAutoSaveStatus('unsaved');
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !pageSlug.trim()) {
      setError('Vyplňte název a slug stránky');
      return;
    }

    console.log(`Saving page: currentPage=${currentPage ? 'exists' : 'null'}, slug=${pageSlug}, category=${category}`);

    setSaving(true);
    setError('');

    try {
      const { data: { session } } = await getSupabaseSession();
      if (!session?.access_token) {
        setError('Relace vypršela. Přihlaste se znovu.');
        return;
      }

      if (currentPage) {
        // Update existing page
        console.log(`Updating existing page: ${currentPage.slug}`);
        
        const contentToSend = documentType === 'worksheet' 
          ? JSON.stringify(worksheetData)
          : documentType === 'workbook'
            ? JSON.stringify(workbookData)
            : content;

        // For workbooks, sync featuredMedia from workbookData
        const mediaToSend = documentType === 'workbook' ? (workbookData.coverImage || '') : featuredMedia;

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${currentPage.slug}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              title,
              content: contentToSend,
              description,
              icon,
              documentType,
              externalUrl,
              featuredMedia: mediaToSend,
              sectionImages,
              category,
              newSlug: pageSlug !== currentPage.slug ? pageSlug : undefined
            })
          }
        );

        if (response.ok) {
          console.log(`Page updated successfully`);
          setAutoSaveStatus('saved');
          // Refresh sidebar to show updated icon
          setSidebarKey(prev => prev + 1);
          
          if (pageSlug !== currentPage.slug) {
            navigate(`/admin/${category}/${pageSlug}`, { replace: true });
          }
        } else {
          const data = await response.json();
          console.error(`Error updating page: ${data.error}`);
          throw new Error(data.error || 'Chyba při ukládání');
        }
      } else {
        // Create new page
        console.log(`Creating new page with slug=${pageSlug}, title=${title}`);
        
        const contentToSend = documentType === 'worksheet' 
          ? JSON.stringify(worksheetData)
          : documentType === 'workbook'
            ? JSON.stringify(workbookData)
            : content;

        // For workbooks, sync featuredMedia from workbookData
        const mediaToSend = documentType === 'workbook' ? (workbookData.coverImage || '') : featuredMedia;

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              slug: pageSlug,
              title,
              content: contentToSend,
              description,
              icon,
              documentType,
              externalUrl,
              featuredMedia: mediaToSend,
              sectionImages,
              category
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log(`Page created successfully: ${data.page.slug}`);
          // Set currentPage immediately so auto-save knows it exists
          setCurrentPage(data.page);
          setAutoSaveStatus('saved');
          // Refresh sidebar to show new page
          setSidebarKey(prev => prev + 1);
          navigate(`/admin/${category}/${pageSlug}`);
        } else {
          const data = await response.json();
          console.error(`Error creating page: ${data.error}`);
          throw new Error(data.error || 'Chyba při vytváření stránky');
        }
      }
    } catch (err: any) {
      console.error('Error saving page:', err);
      setError(err.message || 'Chyba při ukládání stránky');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPage = (cat: string, slug: string) => {
    navigate(`/admin/${cat}/${slug}`);
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    
    // Auto-generate slug for new pages
    if (!currentPage && newTitle) {
      setPageSlug(generateSlug(newTitle));
    }
  };

  return (
    <div className="h-screen flex bg-background text-foreground relative">

      {/* Main content: Column Browser OR Editor */}
      <div className="flex-1 flex overflow-hidden pt-16">
        {/* When editing a document - show editor only (no sidebar) */}
        {slug ? (
          <>
            {/* Full-width editor area */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
            <div className="max-w-5xl mx-auto p-8">
              {error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded text-destructive">
                  {error}
                </div>
              )}

              {/* Header Row: Label + Actions */}
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigate(`/admin/${category || 'fyzika'}`)}
                      className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Zpět
                    </button>
                    <div className="text-sm font-medium text-muted-foreground">
                       {currentPage ? 'Upravit dokument' : 'Vytvořit dokument'}
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center gap-2 px-3 py-1.5 border border-border rounded hover:bg-accent transition-colors text-sm"
                    >
                      {showPreview ? 'Editor' : 'Náhled'}
                    </button>
                    
                    <button
                      onClick={handleSave}
                      disabled={saving || !title.trim() || !pageSlug.trim()}
                      className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 text-sm"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Ukládám...' : currentPage ? 'Uložit' : 'Vytvořit'}
                    </button>
                 </div>
              </div>

              {/* Type Selector */}
              <div className="mb-2">
                 <Popover>
                    <PopoverTrigger asChild>
                       <button className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted rounded-lg text-sm transition-colors text-muted-foreground hover:text-foreground">
                          {(() => {
                             const currentType = DOCUMENT_TYPES.find(t => t.id === documentType) || DOCUMENT_TYPES[0];
                             const Icon = currentType.icon;
                             return (
                                <>
                                   <Icon className="h-4 w-4" />
                                   <span>{currentType.label}</span>
                                   <ChevronDown className="h-3 w-3 opacity-50 ml-1" />
                                </>
                             );
                          })()}
                       </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-3" align="start">
                        <div className="grid grid-cols-4 gap-2">
                            {DOCUMENT_TYPES.filter(t => t.id !== 'workbook').map((type) => (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => {
                                  setDocumentType(type.id);
                                  // For test/exam/practice types, auto-initialize VividBoard if not exists
                                  const boardTypes = ['test', 'exam', 'practice'];
                                  if (boardTypes.includes(type.id) && !boardId && pageSlug) {
                                    const expectedBoardId = `board_${pageSlug}`;
                                    // Check if quiz already exists
                                    const existingQuiz = quizStorage.getQuiz(expectedBoardId);
                                    if (!existingQuiz) {
                                      // Create empty quiz
                                      const newQuiz = createEmptyQuiz();
                                      newQuiz.id = expectedBoardId;
                                      newQuiz.title = title || 'Nový board';
                                      newQuiz.subject = category || undefined;
                                      quizStorage.saveQuiz(newQuiz);
                                    }
                                    setBoardId(expectedBoardId);
                                    setExternalUrl(`board://${expectedBoardId}`);
                                  }
                                }}
                                className={`
                                  flex flex-col items-center justify-center p-2 rounded-lg border transition-all h-20
                                  ${documentType === type.id 
                                    ? 'bg-primary/5 border-primary ring-1 ring-primary' 
                                    : 'bg-background border-border hover:border-primary/50 hover:bg-accent/50'
                                  }
                                `}
                              >
                                <div className={`p-1.5 rounded-md mb-1 ${type.bgColor}`}>
                                  <type.icon className={`h-4 w-4 ${type.color}`} />
                                </div>
                                <span className="text-[10px] font-medium text-center leading-tight px-1 line-clamp-2">{type.label}</span>
                              </button>
                            ))}
                        </div>
                    </PopoverContent>
                 </Popover>
              </div>

              {/* Title + Settings */}
              <div className="flex items-start gap-4 mb-8 relative group">
                 <input
                   id="title"
                   type="text"
                   value={title}
                   onChange={(e) => handleTitleChange(e.target.value)}
                   className="flex-1 text-4xl font-bold bg-transparent border-none px-0 focus:ring-0 placeholder:text-muted-foreground/30 focus:outline-none"
                   placeholder="Nadpis stránky..."
                   required
                 />
                 
                 <Popover>
                    <PopoverTrigger asChild>
                       <button className="mt-2 p-2 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground" title="Nastavení stránky">
                          <Settings className="h-5 w-5" />
                       </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-5" align="end">
                       <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Nastavení stránky
                       </h4>
                       <div className="space-y-4">
                          <div>
                             <label className="block text-xs font-medium text-muted-foreground mb-1.5">Slug (URL)</label>
                             <input
                               value={pageSlug}
                               onChange={(e) => setPageSlug(e.target.value)}
                               className="w-full px-3 py-2 bg-muted/30 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                               placeholder="slug-stranky"
                             />
                          </div>
                          
                          {documentType !== 'workbook' && (
                             <>
                                <div>
                                   <label className="block text-xs font-medium text-muted-foreground mb-1.5">Hlavní médium (URL)</label>
                                   <input
                                      value={featuredMedia}
                                      onChange={(e) => setFeaturedMedia(e.target.value)}
                                      className="w-full px-3 py-2 bg-muted/30 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                      placeholder="https://..."
                                   />
                                </div>
                                
                                {['practice', 'test', 'exam'].includes(documentType) && (
                                   <div>
                                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Externí odkaz</label>
                                      <input
                                         value={externalUrl}
                                         onChange={(e) => setExternalUrl(e.target.value)}
                                         className="w-full px-3 py-2 bg-muted/30 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                         placeholder="https://..."
                                      />
                                   </div>
                                )}

                                <div className="pt-2 border-t border-border">
                                   <SectionMediaManager
                                      mediaItems={sectionImages}
                                      availableHeadings={availableHeadings}
                                      onUpdate={setSectionImages}
                                   />
                                </div>
                             </>
                          )}
                       </div>
                    </PopoverContent>
                 </Popover>
              </div>

              {/* Content editor/preview */}
              {showPreview ? (
                <div>
                  <h2 className="text-lg mb-4">Náhled</h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    {documentType === 'worksheet' ? (
                      <div className="p-4 border rounded bg-muted">
                        <p>Náhled pracovního listu není v admin panelu plně dostupný. Použijte "Zobrazit docs".</p>
                        <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(worksheetData, null, 2)}</pre>
                      </div>
                    ) : documentType === 'workbook' ? (
                      <div className="p-4 border rounded bg-muted">
                        <p>Náhled pracovního sešitu není v admin panelu plně dostupný. Použijte "Zobrazit docs".</p>
                        <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(workbookData, null, 2)}</pre>
                      </div>
                    ) : ['practice', 'test', 'exam'].includes(documentType) ? (
                      <div className="p-4 border rounded bg-muted">
                        <p className="font-medium mb-1">Externí odkaz:</p>
                        <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                          {externalUrl || 'Zatím nevyplněno'}
                        </a>
                        <p className="text-xs text-muted-foreground mt-2">Po kliknutí na kartu v přehledu bude uživatel přesměrován na tento odkaz.</p>
                      </div>
                    ) : (
                      <HtmlRenderer content={content} />
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  {documentType === 'worksheet' ? (
                    <div>
                      <label className="block mb-2 text-sm">Obsah pracovního listu</label>
                      <WorksheetEditor 
                        data={worksheetData} 
                        onChange={setWorksheetData} 
                      />
                    </div>
                  ) : documentType === 'workbook' ? (
                    <div>
                       <WorkbookEditor
                          data={workbookData}
                          onChange={setWorkbookData}
                          slug={pageSlug}
                          category={category || ''}
                       />
                    </div>
                  ) : ['practice', 'test', 'exam'].includes(documentType) ? (
                    <div className="space-y-4">
                      <label className="block mb-2 text-sm font-medium">Vividboard</label>
                      
                      {/* Show connected board or create button */}
                      {boardId ? (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                                <Play className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <p className="font-medium text-green-800">Vividboard propojený</p>
                                <p className="text-xs text-green-600">ID: {boardId}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => navigate(`/quiz/edit/${boardId}?returnUrl=${encodeURIComponent(currentAdminUrl)}`)}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                                Upravit
                              </button>
                              <button
                                onClick={() => window.open(`/quiz/view/${boardId}`, '_blank')}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                              >
                                <Play className="w-4 h-4" />
                                Přehrát
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 text-center">
                          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Plus className="w-8 h-8 text-indigo-600" />
                          </div>
                          <h3 className="text-lg font-medium text-slate-800 mb-2">Vytvořit Vividboard</h3>
                          <p className="text-sm text-slate-500 mb-4">
                            Vytvořte interaktivní {documentType === 'practice' ? 'procvičování' : documentType === 'test' ? 'test' : 'písemku'} pomocí Vividboard editoru.
                          </p>
                          <button
                            onClick={() => {
                              // Create a new quiz with a unique ID based on page slug
                              const newBoardId = `board_${pageSlug || crypto.randomUUID()}`;
                              const newQuiz = createEmptyQuiz();
                              newQuiz.id = newBoardId;
                              newQuiz.title = title || 'Nový board';
                              newQuiz.subject = category || undefined;
                              
                              // Save the quiz
                              quizStorage.saveQuiz(newQuiz);
                              
                              // Update boardId state
                              setBoardId(newBoardId);
                              
                              // Store boardId in externalUrl for persistence
                              setExternalUrl(`board://${newBoardId}`);
                              
                              // Navigate to the editor with returnUrl
                              navigate(`/quiz/edit/${newBoardId}?returnUrl=${encodeURIComponent(currentAdminUrl)}`);
                            }}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                          >
                            <Plus className="w-5 h-5" />
                            Vytvořit Vividboard
                          </button>
                        </div>
                      )}
                      
                      {/* Divider */}
                      <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="px-2 bg-white text-slate-400">nebo použijte externí odkaz</span>
                        </div>
                      </div>
                      
                      {/* External URL fallback */}
                      <div>
                        <label htmlFor="externalUrl" className="block mb-2 text-sm text-slate-500">Externí odkaz (volitelné)</label>
                        <input
                          id="externalUrl"
                          type="url"
                          value={externalUrl.startsWith('board://') ? '' : externalUrl}
                          onChange={(e) => {
                            setExternalUrl(e.target.value);
                            // Clear boardId if external URL is set
                            if (e.target.value && !e.target.value.startsWith('board://')) {
                              setBoardId('');
                            }
                          }}
                          className="w-full px-4 py-2 bg-input-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block mb-2 text-sm">Obsah stránky</label>
                      <div 
                        style={{ 
                          backgroundColor: '#EFF1F8', 
                          borderRadius: '11px',
                          marginTop: '8px'
                        }}
                      >
                      <RichTextEditor
                        content={content}
                        onChange={setContent}
                      />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
              )}
            </div>
          </>
        ) : (
          /* Column Browser - shown when no document is selected */
          <AdminColumnBrowser
            activeCategory={category || 'fyzika'}
            onSelectDocument={(cat, docSlug, type) => {
              // For interactive (Vividboard) items, open Quiz Editor
              if (type === 'interactive' && docSlug.startsWith('interactive-')) {
                const boardId = docSlug.replace('interactive-', '');
                navigate(`/quiz/edit/${boardId}`);
                return;
              }
              // Navigate to the document editor
              navigate(`/admin/${cat}/${docSlug}`);
            }}
            onCreateDocument={(parentId, type) => {
              // Navigate to create new document
              const typeParam = type !== 'folder' ? `&type=${type}` : '';
              navigate(`/admin/${category || 'fyzika'}?new=true${typeParam}${parentId ? `&parent=${parentId}` : ''}`);
            }}
          />
        )}
      </div>
    </div>
  );
}
