import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Settings, ChevronDown, Undo, Redo, Eye, CheckCircle2, Plus, Trash2, LogOut, Brain, Loader2, User, GraduationCap, ExternalLink, BookOpen, BarChart3, Download } from 'lucide-react';
import { HtmlRenderer } from './HtmlRenderer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner@2.0.3';
import { RichTextEditor } from './RichTextEditor';
import { SectionMediaManager } from './admin/SectionMediaManager';
import { WorkbookEditor, WorkbookData, DEFAULT_WORKBOOK_DATA } from './admin/WorkbookEditor';
import { WorksheetEditor } from './admin/WorksheetEditor';
import { WorksheetData, DEFAULT_WORKSHEET_DATA } from '../types/worksheet';
// AdminSidebar removed - using column browser
import { SectionMediaItem } from '../types/section-media';
import { DOCUMENT_TYPES } from '../types/document-types';
import { supabase } from '../utils/supabase/client';
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';
import { LottieSequencePlayer } from './media/LottieSequencePlayer';
import { useRAGSync } from '../hooks/useRAGSync';
import { useViewMode } from '../contexts/ViewModeContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

interface AdminEditorProps {
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

export function AdminEditor({ theme, toggleTheme, onLogout }: AdminEditorProps) {
  const params = useParams();
  const category = params.category;
  const slug = params['*'];
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [title, setTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [documentType, setDocumentType] = useState('lesson');
  const [featuredMedia, setFeaturedMedia] = useState<string>('');
  const [sectionImages, setSectionImages] = useState<SectionMediaItem[]>([]);
  const [workbookData, setWorkbookData] = useState<WorkbookData>(DEFAULT_WORKBOOK_DATA);
  const [worksheetData, setWorksheetData] = useState<WorksheetData>(DEFAULT_WORKSHEET_DATA);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Featured media dialog
  const [showFeaturedMediaDialog, setShowFeaturedMediaDialog] = useState(false);
  const [featuredMediaInput, setFeaturedMediaInput] = useState('');
  
  // Ref for SectionMediaManager dialog
  const sectionMediaDialogRef = useRef<{ openAdd: () => void; openEdit: (index: number) => void } | null>(null);
  
  // Autosave refs
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);
  
  // Sidebar removed - using column browser

  // RAG Sync state
  const { state: ragState, syncToRAG } = useRAGSync(currentPage?.id);
  
  // Get current document type config
  const currentDocType = DOCUMENT_TYPES.find(t => t.id === documentType) || DOCUMENT_TYPES[0];
  const DocIcon = currentDocType.icon;

  // Extract H2 headings from content for SectionMediaManager
  const availableHeadings = useMemo(() => {
    if (!content) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    return Array.from(doc.querySelectorAll('h2')).map(h2 => h2.textContent || '').filter(Boolean);
  }, [content]);

  // Load page when slug changes
  useEffect(() => {
    console.log('AdminEditor: category=', category, 'slug=', slug);
    if (category && slug) {
      loadPage(category, slug);
    } else {
      // Clear editor for new page
      setCurrentPage(null);
      const titleParam = searchParams.get('title');
      setTitle(titleParam || '');
      setPageSlug('');
      setDescription('');
      setContent('');
      setExternalUrl('');
      setDocumentType('lesson');
      setLoading(false);
    }
  }, [category, slug]);

  const loadPage = async (cat: string, pageSlugParam: string) => {
    console.log('loadPage called with:', cat, pageSlugParam);
    setLoading(true);
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages/${pageSlugParam}?category=${cat}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      console.log('Load page response:', response.status);

      if (response.ok) {
        const data = await response.json();
        const page = data.page;

        if (page) {
          setCurrentPage(page);
          setTitle(page.title || '');
          setPageSlug(page.slug || '');
          setDescription(page.description || '');
          setExternalUrl(page.externalUrl || '');
          setDocumentType(page.documentType || 'lesson');
          setFeaturedMedia(page.featuredMedia || '');
          setSectionImages(page.sectionImages || []);
          
          // Handle special content types
          if (page.documentType === 'workbook') {
            try {
              const wbData = JSON.parse(page.content || '{}');
              setWorkbookData(wbData);
              setContent('');
            } catch {
              setWorkbookData(DEFAULT_WORKBOOK_DATA);
              setContent('');
            }
            setWorksheetData(DEFAULT_WORKSHEET_DATA);
          } else if (page.documentType === 'worksheet') {
            try {
              const wsData = JSON.parse(page.content || '{}');
              setWorksheetData(wsData);
              setContent('');
            } catch {
              setWorksheetData(DEFAULT_WORKSHEET_DATA);
              setContent('');
            }
            setWorkbookData(DEFAULT_WORKBOOK_DATA);
          } else {
            setContent(page.content || '');
            setWorkbookData(DEFAULT_WORKBOOK_DATA);
            setWorksheetData(DEFAULT_WORKSHEET_DATA);
          }
        }
      } else if (response.status === 404) {
        // Page not found - might be a new page
        setCurrentPage(null);
        setTitle('');
        setPageSlug(pageSlugParam);
        setDescription('');
        setContent('');
        setExternalUrl('');
        setDocumentType('lesson');
        setFeaturedMedia('');
        setSectionImages([]);
      } else {
        throw new Error(`Failed to load page: ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading page:', error);
      toast.error('Chyba při načítání stránky');
    } finally {
      setLoading(false);
      initialLoadRef.current = true;
    }
  };

  // Autosave effect - triggers 3 seconds after last change
  useEffect(() => {
    // Skip on initial load
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    // Only autosave if we have an existing page
    if (!currentPage) return;
    
    setAutoSaveStatus('unsaved');
    
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set new timer for autosave
    autoSaveTimerRef.current = setTimeout(() => {
      autoSave();
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, content, description, pageSlug, documentType, externalUrl, featuredMedia, sectionImages, workbookData, worksheetData]);

  // Autosave function
  const autoSave = async () => {
    if (!currentPage || !category || !title.trim() || !pageSlug.trim()) return;
    
    setAutoSaveStatus('saving');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setAutoSaveStatus('unsaved');
        return;
      }

      // For workbooks/worksheets, content is JSON stringified data
      const contentToSave = documentType === 'workbook' 
        ? JSON.stringify(workbookData)
        : documentType === 'worksheet'
        ? JSON.stringify(worksheetData)
        : content;

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
            content: contentToSave,
            description,
            documentType,
            externalUrl,
            featuredMedia,
            sectionImages,
            category,
            newSlug: pageSlug !== currentPage.slug ? pageSlug : undefined
          })
        }
      );

      if (response.ok) {
        setAutoSaveStatus('saved');
        
        // If slug changed, update URL
        if (pageSlug !== currentPage.slug) {
          setCurrentPage({ ...currentPage, slug: pageSlug });
          navigate(`/admin/${category}/${pageSlug}`, { replace: true });
        }
        
      } else {
        setAutoSaveStatus('unsaved');
      }
    } catch (error) {
      console.error('Autosave error:', error);
      setAutoSaveStatus('unsaved');
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    // Auto-generate slug from title if creating new page
    if (!currentPage) {
      const generatedSlug = newTitle
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setPageSlug(generatedSlug);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !pageSlug.trim()) {
      toast.error('Vyplňte název a slug stránky');
      return;
    }

    setSaving(true);
    setAutoSaveStatus('saving');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Relace vypršela. Přihlaste se znovu.');
        return;
      }

      // For workbooks/worksheets, content is JSON stringified data
      const contentToSave = documentType === 'workbook' 
        ? JSON.stringify(workbookData)
        : documentType === 'worksheet'
        ? JSON.stringify(worksheetData)
        : content;

      if (currentPage) {
        // Update existing page
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
              content: contentToSave,
              description,
              documentType,
              externalUrl,
              featuredMedia,
              sectionImages,
              category,
              newSlug: pageSlug !== currentPage.slug ? pageSlug : undefined
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to save: ${response.status}`);
        }

        // Update local state if slug changed
        if (pageSlug !== currentPage.slug) {
          navigate(`/admin/${category}/${pageSlug}`, { replace: true });
        }

        // Auto-sync to RAG on save with media descriptions
        let contentForRAG = contentToSave;
        
        // Append media descriptions to content for RAG context
        if (sectionImages && sectionImages.length > 0) {
          const mediaContext = sectionImages.map(item => {
            const parts = [`[MÉDIUM V SEKCI: "${item.heading}"]`];
            
            if (item.type === 'lottie' && item.lottieConfig) {
               if (item.lottieConfig.introDescription) {
                 parts.push(`Intro animace: ${item.lottieConfig.introDescription}`);
               }
               
               if (item.lottieConfig.steps) {
                 item.lottieConfig.steps.forEach((step, i) => {
                   if (step.description || step.detailedDescription) {
                     parts.push(`Animace ${i+1}:`);
                     if (step.description) parts.push(`- Co se děje: ${step.description}`);
                     if (step.detailedDescription) parts.push(`- Detailní průběh: ${step.detailedDescription}`);
                     if (step.keywords && step.keywords.length > 0) parts.push(`- Klíčová slova: ${step.keywords.join(', ')}`);
                   }
                 });
               }
            } else if (item.type === 'image' && item.imageUrl) {
               parts.push(`Obrázek: ${item.imageUrl}`);
            }
            
            return parts.join('\n');
          }).join('\n\n');
          
          if (mediaContext) {
            contentForRAG += `\n\n=== POPISY ANIMACÍ A OBRÁZKŮ PRO AI UČITELE ===\nTyto informace popisují vizuální obsah lekce, který žák vidí. Využij je pro vysvětlování.\n\n${mediaContext}`;
          }
        }

        syncToRAG({
            documentId: currentPage.id,
            title,
            content: contentForRAG,
            subject: category || 'general',
            grade: '6',
            topic: title
        });

        toast.success('Stránka uložena');
      } else {
        // Create new page
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/pages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              title,
              slug: pageSlug,
              content: contentToSave,
              description,
              documentType,
              externalUrl,
              featuredMedia,
              sectionImages,
              category: category || 'knihovna-vividbooks'
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to create: ${response.status}`);
        }

        const data = await response.json();
        setCurrentPage(data.page);
        toast.success('Stránka vytvořena');
        navigate(`/admin/${category || 'knihovna-vividbooks'}/${pageSlug}`);
      }

      setAutoSaveStatus('saved');
    } catch (error) {
      console.error('Error saving page:', error);
      toast.error('Chyba při ukládání');
      setAutoSaveStatus('unsaved');
    } finally {
      setSaving(false);
    }
  };

  // Check if this is an external link type document
  const isExternalLinkType = ['exercise', 'test', 'presentation'].includes(documentType);

  const handleSelectPage = (cat: string, pageSlug: string) => {
    navigate(`/admin/${cat}/${pageSlug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EFF1F8' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4E5871]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex relative" style={{ backgroundColor: '#EFF1F8' }}>
      {/* Header buttons - fixed top right - hidden when editing a document */}
      {!slug && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          {/* Zobrazit Vividbooks dropdown */}
          <ViewModeDropdown />
          
          {/* License Admin button */}
          <button
            onClick={() => navigate('/admin/licence')}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 bg-white/80 hover:bg-white rounded-lg shadow-sm transition-colors"
          >
            <Settings className="h-4 w-4" />
            Správa licencí
          </button>

          {/* Customer Success button */}
          <button
            onClick={() => navigate('/admin/customer-success')}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 bg-white/80 hover:bg-white rounded-lg shadow-sm transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            Aktivita škol
          </button>

          {/* Migration Agent button */}
          <button
            onClick={() => navigate('/admin/migration')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#8b5cf6'}
          >
            <Download className="h-4 w-4" />
            Migrace obsahu
          </button>
          
          {/* Logout button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 bg-white/80 hover:bg-white rounded-lg shadow-sm transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Odhlásit se
          </button>
        </div>
      )}

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-[#4E5871]" />
              Náhled: {title}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <HtmlRenderer content={content} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Sidebar removed - using column browser instead */}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto h-screen">
        {/* Header */}
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-4">
          <div className="max-w-5xl mx-auto">
            {/* Top Row - All controls */}
            <div className="flex items-center justify-between mb-8">
              {/* Left: Menu + Back + Doc Type */}
              <div className="flex items-center gap-3">
                {/* Back Button */}
                <button 
                  onClick={() => navigate(`/admin/${category || 'knihovna-vividbooks'}`)}
                  className="p-2.5 rounded-[6px] bg-[#D1D9E6] hover:bg-[#c0cce6] transition-all text-[#4E5871]"
                  title="Zpět na přehled"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

              {/* Document Type Badge */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-2.5 rounded-[6px] bg-[#D1D9E6] hover:bg-[#c0cce6] text-[#4E5871] font-medium text-sm transition-colors flex items-center gap-2">
                    <DocIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{currentDocType.label}</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {DOCUMENT_TYPES.filter(t => t.id !== 'workbook').map((type) => {
                    const TypeIcon = type.icon;
                    return (
                      <DropdownMenuItem 
                        key={type.id}
                        onClick={() => setDocumentType(type.id)}
                        className={documentType === type.id ? 'bg-accent' : ''}
                      >
                        <TypeIcon className="h-4 w-4 mr-2" />
                        {type.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-2">
              {/* RAG Status */}
              <div className="text-sm font-medium flex items-center gap-1 mr-3 border-r border-slate-200 pr-3">
                {ragState.status === 'active' ? (
                  <>
                    <Brain className="h-4 w-4 text-purple-500" />
                    <span className="text-slate-400">RAG aktivní</span>
                  </>
                ) : ragState.status === 'uploading' || ragState.status === 'indexing' ? (
                  <>
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    <span className="text-blue-500">Indexuji...</span>
                  </>
                ) : ragState.status === 'error' ? (
                  <button 
                    onClick={() => currentPage && syncToRAG({
                        documentId: currentPage.id,
                        title: title,
                        content: content,
                        subject: category || 'general',
                        grade: '6',
                        topic: title
                    })}
                    className="flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded transition-colors text-red-500"
                    title={`Chyba indexace: ${ragState.error}`}
                  >
                    <Brain className="h-4 w-4" />
                    <span>RAG chyba</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => currentPage && syncToRAG({
                        documentId: currentPage.id,
                        title: title,
                        content: content,
                        subject: category || 'general',
                        grade: '6',
                        topic: title
                    })}
                    className="flex items-center gap-1 hover:bg-slate-100 px-2 py-1 rounded transition-colors group"
                    title="Klikněte pro indexaci do AI učitele"
                    disabled={!currentPage}
                  >
                    <Brain className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
                    <span className="text-slate-300 group-hover:text-slate-500">RAG neaktivní</span>
                  </button>
                )}
              </div>

              {/* Autosave Status */}
              <div className="text-sm text-slate-400 font-medium flex items-center gap-1">
                {autoSaveStatus === 'saved' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {autoSaveStatus === 'saved' ? 'Uloženo' : autoSaveStatus === 'saving' ? 'Ukládání...' : 'Neuloženo'}
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={saving || !title.trim() || !pageSlug.trim()}
                size="sm"
                className="gap-1.5 bg-[#4E5871] hover:bg-[#3d455a] ml-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Ukládání...' : currentPage ? 'Uložit' : 'Vytvořit'}
              </Button>

              {/* Preview Button */}
              <button
                onClick={() => setPreviewOpen(true)}
                className="p-2.5 rounded-[6px] bg-[#D1D9E6] hover:bg-[#c0cce6] transition-all text-[#4E5871]"
                title="Náhled"
              >
                <Eye className="h-4 w-4" />
              </button>

              {/* Undo/Redo */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    document.querySelector<HTMLButtonElement>('[data-undo-btn]')?.click();
                  }}
                  className="p-2.5 rounded-[6px] bg-[#D1D9E6] hover:bg-[#c0cce6] transition-all text-[#4E5871]"
                  title="Zpět (Ctrl+Z)"
                >
                  <Undo className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    document.querySelector<HTMLButtonElement>('[data-redo-btn]')?.click();
                  }}
                  className="p-2.5 rounded-[6px] bg-[#D1D9E6] hover:bg-[#c0cce6] transition-all text-[#4E5871]"
                  title="Vpřed (Ctrl+Y)"
                >
                  <Redo className="h-4 w-4" />
                </button>
              </div>

            </div>
          </div>

          {/* Title Row */}
          <div className="mb-6" style={{ paddingLeft: '70px' }}>
            <label className="block text-sm text-[#4E5871]/60 mb-2 ml-1 font-medium uppercase tracking-wider text-[10px]">
              Název dokumentu
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Název dokumentu..."
              className="w-full bg-transparent text-[#1e1b4b] text-4xl lg:text-5xl placeholder:text-[#4E5871]/20 focus:outline-none transition-shadow"
              style={{ fontFamily: '"Cooper Light", "Cooper Black", serif', fontWeight: 300 }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area (Two Columns) */}
      <div className="px-4 pb-24">
        <div 
          className="flex gap-6 items-start justify-start"
          style={{ flexDirection: 'row' }}
        >
          
          {/* Left Column - Editor */}
          <div 
            className="shrink-0 transition-all"
            style={{ 
              backgroundColor: (documentType === 'workbook' || documentType === 'worksheet') ? 'transparent' : '#EFF1F8', 
              borderRadius: '11px',
              width: (documentType === 'workbook' || documentType === 'worksheet') ? '100%' : 'calc(100% - 340px)',
              maxWidth: (documentType === 'workbook' || documentType === 'worksheet') ? '1200px' : '800px',
              minWidth: '400px'
            }}
          >
            {documentType === 'workbook' ? (
              <WorkbookEditor 
                data={workbookData}
                onChange={setWorkbookData}
                slug={pageSlug}
                category={category || 'knihovna-vividbooks'}
              />
            ) : documentType === 'worksheet' ? (
              <div className="p-8 bg-white rounded-[18px]">
                <h2 className="text-lg font-medium mb-6">Obsah pracovního listu</h2>
                <WorksheetEditor 
                  data={worksheetData}
                  onChange={setWorksheetData}
                />
              </div>
            ) : isExternalLinkType ? (
              <div className="p-8 bg-white rounded-[18px]">
                <Label htmlFor="externalUrl" className="block mb-2 text-sm font-medium">
                  Odkaz na cvičení/test *
                </Label>
                <Input
                  id="externalUrl"
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Pro tento typ dokumentu se zadává pouze externí odkaz. Po kliknutí na kartu v přehledu bude uživatel přesměrován.
                </p>
              </div>
            ) : (
              <RichTextEditor 
                content={content} 
                onChange={setContent} 
              />
            )}
            <div className="h-4" />
          </div>

          {/* Right Column - Settings Panel (hidden for workbooks and worksheets) */}
          {documentType !== 'workbook' && documentType !== 'worksheet' && (
          <div 
            className="shrink-0 space-y-6 sticky top-6"
            style={{ width: '320px', marginTop: '50px' }}
          >
            {/* Settings Panel */}
            <div className="bg-white rounded-xl p-5">
              {/* Title - centered */}
              <h3 className="font-medium text-[#4E5871] text-center mb-6">Pravý sloupec</h3>

              <div className="space-y-6">
                {/* Slug */}
                <div className="space-y-2">
                  <Label htmlFor="slug" className="text-sm font-medium text-slate-700">
                    URL slug *
                  </Label>
                  <Input 
                    id="slug" 
                    value={pageSlug} 
                    onChange={(e) => setPageSlug(e.target.value)} 
                    placeholder="url-stranky" 
                  />
                  <p className="text-xs text-slate-500">
                    Část URL adresy stránky
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-slate-700">
                    Popis
                  </Label>
                  <Input 
                    id="description" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Krátký popis stránky..." 
                  />
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100" />

                {/* Featured Media / Úvodní obsah */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-700">
                    Úvodní obsah
                  </Label>
                  <p className="text-xs text-slate-500">
                    Obrázek nebo video zobrazené v pravém sloupci nahoře
                  </p>
                  
                  {/* Preview if media exists */}
                  {featuredMedia && (
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                      {featuredMedia.includes('youtube') || featuredMedia.includes('youtu.be') ? (
                        <div className="aspect-video">
                          <iframe
                            src={`https://www.youtube.com/embed/${featuredMedia.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1] || ''}`}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : featuredMedia.includes('vimeo') ? (
                        <div className="aspect-video">
                          <iframe
                            src={`https://player.vimeo.com/video/${featuredMedia.match(/vimeo\.com\/(\d+)/)?.[1] || ''}`}
                            className="w-full h-full"
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : featuredMedia.includes('loom') ? (
                        <div className="aspect-video">
                          <iframe
                            src={`https://www.loom.com/embed/${featuredMedia.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)?.[1] || ''}`}
                            className="w-full h-full"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <img 
                          src={featuredMedia} 
                          alt="Úvodní obsah" 
                          className="w-full aspect-video object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f1f5f9" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="12">Chyba</text></svg>';
                          }}
                        />
                      )}
                      {/* Remove button */}
                      <button
                        onClick={() => setFeaturedMedia('')}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-full shadow-sm transition-colors"
                        title="Odstranit"
                      >
                        <Trash2 className="h-4 w-4 text-slate-500" />
                      </button>
                    </div>
                  )}
                  
                  {/* Add button */}
                  {!featuredMedia && (
                    <button
                      onClick={() => {
                        setFeaturedMediaInput('');
                        setShowFeaturedMediaDialog(true);
                      }}
                      className="w-full py-3 px-4 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Přidat
                    </button>
                  )}
                  
                  {/* Change button if media exists */}
                  {featuredMedia && (
                    <button
                      onClick={() => {
                        setFeaturedMediaInput(featuredMedia);
                        setShowFeaturedMediaDialog(true);
                      }}
                      className="w-full py-2 px-4 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      Změnit
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100" />

                {/* Section Media - Obsah u nadpisů */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-700">
                    Obsah u nadpisů
                  </Label>
                  <p className="text-xs text-slate-500">
                    Obrázky/animace se zobrazí v pravém sloupci, když se čtenář posune na nastavený nadpis.
                  </p>
                  
                  {/* Custom list with previews */}
                  {sectionImages.length > 0 && (
                    <div className="space-y-3">
                      {sectionImages.map((item, index) => (
                        <div 
                          key={`${item.id}-${index}`}
                          className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:border-slate-300 transition-colors"
                          onClick={() => sectionMediaDialogRef.current?.openEdit(index)}
                        >
                          {/* Heading label */}
                          <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700">{item.heading}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSectionImages(prev => prev.filter((_, i) => i !== index));
                              }}
                              className="p-1 hover:bg-slate-200 rounded transition-colors"
                              title="Odstranit"
                            >
                              <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                            </button>
                          </div>
                          
                          {/* Media preview */}
                          <div className="relative">
                            {item.type === 'image' ? (
                              <img 
                                src={item.imageUrl} 
                                alt={item.heading}
                                className="w-full aspect-video object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f1f5f9" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="12">Obrázek</text></svg>';
                                }}
                              />
                            ) : item.lottieConfig?.steps && item.lottieConfig.steps.length > 0 ? (
                              <div className="aspect-video bg-slate-100" onClick={(e) => e.stopPropagation()}>
                                <LottieSequencePlayer
                                  introUrl={item.lottieConfig.introUrl}
                                  steps={item.lottieConfig.steps}
                                  shouldLoop={item.lottieConfig.shouldLoop ?? true}
                                  autoplay={false}
                                  backgroundImage={item.lottieConfig.backgroundImage}
                                />
                              </div>
                            ) : (
                              <div className="aspect-video flex items-center justify-center bg-slate-200">
                                <span className="text-sm text-slate-500">Chybí URL animace</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add button */}
                  <button
                    onClick={() => sectionMediaDialogRef.current?.openAdd()}
                    className="w-full py-3 px-4 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Přidat
                  </button>
                  
                  {/* Hidden SectionMediaManager for dialog only */}
                  <SectionMediaManager 
                    mediaItems={sectionImages}
                    availableHeadings={availableHeadings}
                    onUpdate={setSectionImages}
                    dialogOnly={true}
                    dialogRef={sectionMediaDialogRef}
                  />
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
      </div>

      {/* Featured Media Dialog */}
      <Dialog open={showFeaturedMediaDialog} onOpenChange={setShowFeaturedMediaDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#4E5871]" />
              Úvodní obsah
            </DialogTitle>
            <DialogDescription>
              Přidejte URL obrázku nebo videa pro pravý sloupec.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="featured-url" className="text-sm font-medium text-slate-700">
                URL média
              </Label>
              <Input 
                id="featured-url" 
                value={featuredMediaInput} 
                onChange={(e) => setFeaturedMediaInput(e.target.value)} 
                placeholder="https://..." 
              />
              <p className="text-xs text-slate-500">
                Podporované formáty: obrázky (jpg, png, gif, webp) nebo video (YouTube, Vimeo, Loom)
              </p>
            </div>
            
            {/* Preview */}
            {featuredMediaInput && (
              <div className="rounded-lg overflow-hidden border border-slate-200">
                {featuredMediaInput.includes('youtube') || featuredMediaInput.includes('youtu.be') ? (
                  <div className="aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${featuredMediaInput.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1] || ''}`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : featuredMediaInput.includes('vimeo') ? (
                  <div className="aspect-video">
                    <iframe
                      src={`https://player.vimeo.com/video/${featuredMediaInput.match(/vimeo\.com\/(\d+)/)?.[1] || ''}`}
                      className="w-full h-full"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : featuredMediaInput.includes('loom') ? (
                  <div className="aspect-video">
                    <iframe
                      src={`https://www.loom.com/embed/${featuredMediaInput.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)?.[1] || ''}`}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <img 
                    src={featuredMediaInput} 
                    alt="Náhled" 
                    className="w-full aspect-video object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeaturedMediaDialog(false)}>
              Zrušit
            </Button>
            <Button 
              onClick={() => {
                setFeaturedMedia(featuredMediaInput);
                setShowFeaturedMediaDialog(false);
              }}
              className="bg-[#4E5871] hover:bg-[#3d455a]"
            >
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

