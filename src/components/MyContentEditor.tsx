import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Settings, ChevronDown, X, Undo, Redo, Eye, Plus, Trash2, Play, Image as ImageIcon, PanelRight, Sparkles, History } from 'lucide-react';
import { HtmlRenderer } from './HtmlRenderer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { toast } from 'sonner@2.0.3';
import { RichTextEditor } from './RichTextEditor';
import { SectionMediaItem } from '../types/section-media';
import { SectionMediaManager } from './admin/SectionMediaManager';
import { LottieSequencePlayer } from './media/LottieSequencePlayer';
import { DOCUMENT_TYPES } from '../types/document-types';
import { DocumentAIPanel } from './DocumentAIPanel';
import { useVersionHistory } from '../hooks/useVersionHistory';
import { VersionHistoryPanel } from './shared/VersionHistoryPanel';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface ContentItem {
  id: string;
  name: string;
  type: 'folder' | 'document' | 'board';
  documentType?: string;
  content?: string;
  description?: string;
  children?: ContentItem[];
  copiedFrom?: string;
  originalId?: string;
  slug?: string;
  featuredMedia?: string;
  sectionImages?: SectionMediaItem[];
}

interface MyContentEditorProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function MyContentEditor({ theme, toggleTheme }: MyContentEditorProps) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isStudentMode = searchParams.get('studentMode') === 'true' || searchParams.get('studentAssignmentId') !== null;
  const isTeacherView = searchParams.get('teacherView') === 'true';
  const viewingStudentId = searchParams.get('studentId');
  const isReadOnly = searchParams.get('readOnly') === 'true';
  const navigate = useNavigate();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  
  // Editor content states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [documentType, setDocumentType] = useState('lesson');
  const [slug, setSlug] = useState('');
  const [featuredMedia, setFeaturedMedia] = useState('');
  const [sectionImages, setSectionImages] = useState<SectionMediaItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  // Autosave timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);
  
  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Version history state
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  
  // Right column settings
  const [showTOC, setShowTOC] = useState(true);
  const [showFeaturedMediaDialog, setShowFeaturedMediaDialog] = useState(false);
  const [featuredMediaInput, setFeaturedMediaInput] = useState('');
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  
  // AI content history for undo/redo
  const [contentHistory, setContentHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Ref for SectionMediaManager dialog
  const sectionMediaDialogRef = useRef<{ openAdd: () => void; openEdit: (index: number) => void } | null>(null);
  
  
  // Get current document type config
  const currentDocType = DOCUMENT_TYPES.find(t => t.id === documentType) || DOCUMENT_TYPES[0];
  const DocIcon = currentDocType.icon;
  
  // Version history hook
  const versionHistory = useVersionHistory({
    documentId: id || 'new',
    documentType: 'my_content',
    content: content,
    title: title,
    userType: isStudentMode ? 'student' : 'teacher',
    autoSave: true,
    autoSaveDelay: 3000,
    readOnly: isReadOnly || !item,
    onVersionRestored: (version) => {
      setContent(version.content);
      setTitle(version.title);
      toast.success(`Obnovena verze ${version.version_number}`);
    },
  });
  
  // Extract H2 headings from content for SectionMediaManager
  const availableHeadings = useMemo(() => {
    if (!content) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    return Array.from(doc.querySelectorAll('h2')).map(h2 => h2.textContent || '').filter(Boolean);
  }, [content]);

  useEffect(() => {
    if (!id) return;

    const loadItem = () => {
      try {
        // Primary source: vivid-doc-${id} (for all user-created documents)
        const docData = localStorage.getItem(`vivid-doc-${id}`);
        if (docData) {
          const data = JSON.parse(docData);
          const foundItem: ContentItem = {
            id: data.id || id,
            name: data.title || 'Bez názvu',
            type: 'document',
            content: data.content || '',
            documentType: data.documentType || 'lesson',
            slug: data.slug || id,
            featuredMedia: data.featuredMedia || '',
            sectionImages: data.sectionImages || [],
          };
          setItem(foundItem);
          setTitle(data.title || '');  // Empty for placeholder
          setContent(foundItem.content || '');
          setDocumentType(foundItem.documentType || 'lesson');
          setSlug(foundItem.slug || '');
          setFeaturedMedia(foundItem.featuredMedia || '');
          setSectionImages(foundItem.sectionImages || []);
          setShowTOC(data.showTOC !== false); // Default to true if not set
          setLoading(false);
          return;
        }

        // Fallback: Check copied content (vivid-my-content-copied) for VividBooks copies
        const copiedJson = localStorage.getItem('vivid-my-content-copied');
        if (copiedJson) {
          const items: ContentItem[] = JSON.parse(copiedJson);
          
          const findItem = (items: ContentItem[]): ContentItem | undefined => {
            for (const i of items) {
              if (i.id === id) return i;
              if (i.children) {
                const found = findItem(i.children);
                if (found) return found;
              }
            }
            return undefined;
          };

          const found = findItem(items);
          if (found) {
            setItem(found);
            setTitle(found.name);
            setContent(found.content || '');
            setDocumentType(found.documentType || 'lesson');
            setSlug(found.slug || '');
            setFeaturedMedia(found.featuredMedia || '');
            setSectionImages(found.sectionImages || []);
            setLoading(false);
            return;
          }
        }

        // Not found anywhere
        toast.error("Položka nenalezena");
        navigate(isStudentMode ? '/student/my-content' : '/library/my-content');
      } catch (e) {
        console.error("Error loading item", e);
        toast.error("Chyba při načítání");
      } finally {
        setLoading(false);
      }
    };

    loadItem();
  }, [id, navigate]);

  // Autosave when content changes
  useEffect(() => {
    // Skip autosave on initial load
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    // Don't autosave if no item loaded
    if (!item || !id) return;

    setAutoSaveStatus('unsaved');

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for autosave (1 second debounce)
    autoSaveTimerRef.current = setTimeout(() => {
      // Save directly to localStorage
      const docData = {
        id: id,
        title: title,
        content: content,
        documentType: documentType,
        featuredMedia: featuredMedia,
        sectionImages: sectionImages,
        slug: slug,
        showTOC: showTOC,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`vivid-doc-${id}`, JSON.stringify(docData));
      setAutoSaveStatus('saved');
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, content, documentType, featuredMedia, sectionImages, slug, showTOC, item, id]);

  const handleSave = async () => {
    if (!item || !id) return;
    setSaving(true);

    try {
      // Save to vivid-doc-${id} (primary storage for all user documents)
      const docData = {
        id: id,
        title: title,
                content: content,
        documentType: documentType,
        featuredMedia: featuredMedia,
        sectionImages: sectionImages,
                slug: slug,
        showTOC: showTOC,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`vivid-doc-${id}`, JSON.stringify(docData));

      // Also update the name in the document list (vivid-my-documents)
      const myDocsJson = localStorage.getItem('vivid-my-documents');
      if (myDocsJson) {
        const myDocs: ContentItem[] = JSON.parse(myDocsJson);
        const docIndex = myDocs.findIndex(d => d.id === id);
        if (docIndex !== -1) {
          myDocs[docIndex].name = title;
          localStorage.setItem('vivid-my-documents', JSON.stringify(myDocs));
        }
      }

      // Also update in folders if present
      const foldersJson = localStorage.getItem('vivid-my-folders');
      if (foldersJson) {
        const folders: ContentItem[] = JSON.parse(foldersJson);
        let updated = false;
        folders.forEach(folder => {
          if (folder.children) {
            const childIndex = folder.children.findIndex(c => c.id === id);
            if (childIndex !== -1) {
              folder.children[childIndex].name = title;
              updated = true;
            }
          }
        });
        if (updated) {
          localStorage.setItem('vivid-my-folders', JSON.stringify(folders));
        }
      }

      // Update copied content if this came from VividBooks
      if (item.copiedFrom) {
        const copiedJson = localStorage.getItem('vivid-my-content-copied');
        if (copiedJson) {
          const items: ContentItem[] = JSON.parse(copiedJson);
          const updateInArray = (arr: ContentItem[]): boolean => {
            for (let i = 0; i < arr.length; i++) {
              if (arr[i].id === id) {
                arr[i] = { ...arr[i], name: title, content, documentType, slug, featuredMedia, sectionImages };
                return true;
              }
              if (arr[i].children && updateInArray(arr[i].children!)) return true;
          }
          return false;
        };
          if (updateInArray(items)) {
          localStorage.setItem('vivid-my-content-copied', JSON.stringify(items));
          }
        }
      }

      setItem({ ...item, name: title, content, documentType, slug, featuredMedia, sectionImages });
          toast.success("Uloženo");
    } catch (e) {
      console.error("Error saving", e);
      toast.error("Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EFF1F8' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4E5871]"></div>
      </div>
    );
  }
  
  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EFF1F8' }}>
        <p className="text-muted-foreground">Položka nenalezena</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EFF1F8' }}>
      {/* Read-only banner for shared content */}
      {isReadOnly && (
        <div className="bg-purple-600 text-white px-4 py-2 text-center text-sm font-medium">
          <span>📖 Prohlížíte sdílený dokument od učitele (pouze pro čtení)</span>
        </div>
      )}
      
      {/* AI Panel - Fixed left side */}
      {isAIPanelOpen && !isReadOnly && (
        <div className="fixed left-0 top-0 h-screen z-50" style={{ width: '400px' }}>
          <DocumentAIPanel
            isOpen={isAIPanelOpen}
            onClose={() => setIsAIPanelOpen(false)}
            documentContent={content}
            documentTitle={title}
            onInsertContent={(newContent) => {
              setContent(prev => prev + newContent);
            }}
            onReplaceContent={(newContent) => {
              setContent(newContent);
            }}
            onApplyContent={(newContent) => {
              // Save current content to history before applying AI changes
              const newHistory = contentHistory.slice(0, historyIndex + 1);
              newHistory.push(content);
              setContentHistory(newHistory);
              setHistoryIndex(newHistory.length - 1);
              setContent(newContent);
            }}
            canUndo={historyIndex >= 0}
            canRedo={historyIndex < contentHistory.length - 1}
            onUndo={() => {
              if (historyIndex >= 0) {
                // Save current content as "future" state
                const newHistory = [...contentHistory];
                if (historyIndex === contentHistory.length - 1) {
                  newHistory.push(content);
                  setContentHistory(newHistory);
                }
                setContent(contentHistory[historyIndex]);
                setHistoryIndex(historyIndex - 1);
              }
            }}
            onRedo={() => {
              if (historyIndex < contentHistory.length - 1) {
                const nextIndex = historyIndex + 2;
                if (nextIndex < contentHistory.length) {
                  setContent(contentHistory[nextIndex]);
                  setHistoryIndex(historyIndex + 1);
                }
              }
            }}
          />
        </div>
      )}
      
      {/* Fixed Back Button - OUTSIDE shifting div, always visible */}
      <button
        onClick={() => {
          if (isTeacherView) {
            // Go back to previous page (class results)
            window.history.back();
          } else if (isStudentMode) {
            navigate('/student/my-content');
          } else {
            navigate(`/library/my-content/view/${id}`);
          }
        }}
        className="fixed z-50 p-2 rounded-lg hover:bg-black/5 transition-all text-[#4E5871]"
        title={isTeacherView ? 'Zpět do třídy' : 'Zpět'}
        style={{ left: isAIPanelOpen ? '416px' : '16px', top: '17px' }}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      
      {/* Teacher viewing student work indicator */}
      {isTeacherView && (
        <div 
          className="fixed z-50 px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium flex items-center gap-2"
          style={{ left: isAIPanelOpen ? '456px' : '56px', top: '20px' }}
        >
          <Eye className="w-3.5 h-3.5" />
          Prohlížíte práci studenta
        </div>
      )}

      {/* Fixed AI Button - next to back button */}
      <button
        onClick={() => {
          setIsAIPanelOpen(true);
          setIsRightSidebarOpen(false);
        }}
        className="fixed z-50 flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-white"
        style={{ 
          left: isAIPanelOpen ? '456px' : '56px', 
          top: '14px',
          backgroundColor: '#4E5871' 
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3d4659'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4E5871'}
        title="AI Asistent"
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-medium">AI asistent</span>
      </button>

      {/* Main Content Area - shifts right when AI panel is open */}
      <div 
        className="transition-all duration-300"
        style={{ marginLeft: isAIPanelOpen ? '400px' : '0' }}
      >
      {/* Preview Modal - using existing HtmlRenderer */}
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

      {/* Header - scrolls with page */}
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-4">
        <div className="max-w-[1200px] mx-auto">
          {/* Top Row - All controls */}
          <div className="flex items-center justify-between mb-8 relative">
            {/* Left: Spacer for fixed buttons */}
            <div className="flex items-center gap-3" style={{ paddingLeft: '180px' }}>
            </div>

            {/* Center: Document Type Badge with border on hover */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="group px-5 py-2.5 rounded-xl text-[#4E5871] font-medium text-sm transition-all flex items-center gap-2"
                    style={{ border: '1px solid transparent' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.border = '1px solid #a0b0c8';
                      e.currentTarget.style.backgroundColor = 'rgba(239, 241, 248, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.border = '1px solid transparent';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <DocIcon className="h-4 w-4" />
                    <span>{currentDocType.label}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  {DOCUMENT_TYPES.filter(t => !['worksheet', 'workbook'].includes(t.id)).slice(0, 6).map((type) => {
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

            {/* Right Side - Undo/Redo */}
            <div className="flex items-center gap-2">
              {/* Autosave Status */}
              <div className="text-sm text-slate-400 font-medium mr-4">
                {autoSaveStatus === 'saving' || saving ? 'Ukládání...' : autoSaveStatus === 'unsaved' ? 'Neulož.' : 'Uloženo'}
              </div>

              {/* Version History Button */}
              {!isReadOnly && (
                <button
                  onClick={() => setVersionHistoryOpen(true)}
                  className={`relative p-2.5 rounded-[6px] transition-all ${
                    versionHistory.hasUnsavedChanges 
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-700' 
                      : 'bg-[#D1D9E6] hover:bg-[#c0cce6] text-[#4E5871]'
                  }`}
                  title={`Historie verzí${versionHistory.totalVersions > 0 ? ` (${versionHistory.totalVersions})` : ''}`}
                >
                  <History className="h-4 w-4" />
                  {versionHistory.autoSavePending && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  )}
                </button>
              )}

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

              {/* Right Sidebar Toggle */}
              <button
                onClick={() => {
                  const newState = !isRightSidebarOpen;
                  setIsRightSidebarOpen(newState);
                  if (newState) {
                    setIsAIPanelOpen(false); // Close AI panel when opening right sidebar
                  }
                }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-[6px] transition-all text-[#4E5871] ml-2 ${isRightSidebarOpen ? 'bg-[#D1D9E6] hover:bg-[#c0cce6]' : 'bg-transparent hover:bg-black/5'}`}
                title={isRightSidebarOpen ? "Skrýt pravý sloupec" : "Zobrazit pravý sloupec"}
              >
                <Settings className="h-4 w-4" />
                <span className="text-sm font-medium">Pravý sloupec</span>
              </button>
            </div>
          </div>
                         </div>
                     </div>

      {/* Main Content Area (Two Columns) */}
      <div className="px-4">
        {/* Document Title - Fixed position, doesn't move with sidebar */}
        <div className="max-w-[800px] mx-auto mb-8 px-2 text-center">
          <label className="block text-sm text-[#4E5871]/60 mb-2 font-medium uppercase tracking-wider text-[10px]">
            Název dokumentu
          </label>
          <div className="flex justify-center">
            <input
              type="text"
              value={title} 
              onChange={(e) => !isReadOnly && setTitle(e.target.value)} 
              placeholder="Nový dokument"
              disabled={isReadOnly}
              className={`text-[#1e1b4b] text-4xl lg:text-5xl placeholder:text-[#4E5871]/40 focus:outline-none transition-all duration-200 text-center rounded-xl px-6 py-3 ${isReadOnly ? 'cursor-default' : ''}`}
              style={{ 
                fontFamily: '"Cooper Light", "Cooper Black", serif', 
                fontWeight: 300,
                backgroundColor: isReadOnly ? 'transparent' : (isTitleHovered || isTitleFocused ? '#EFF1F8' : 'transparent'),
                border: isReadOnly ? '2px solid transparent' : (isTitleFocused ? '2px solid #A0B0C8' : (isTitleHovered ? '2px solid #D1D9E6' : '2px solid transparent')),
                width: '60%',
                minWidth: '300px',
              }}
              onMouseEnter={() => !isReadOnly && setIsTitleHovered(true)}
              onMouseLeave={() => !isReadOnly && setIsTitleHovered(false)}
              onFocus={() => !isReadOnly && setIsTitleFocused(true)}
              onBlur={() => !isReadOnly && setIsTitleFocused(false)}
            />
          </div>
        </div>

        <div 
          className="flex gap-6 items-start justify-center transition-all duration-300"
          style={{ flexDirection: 'row' }}
        >
          
          {/* Left Column - Editor (~750px) */}
          <div 
            className="shrink-0 transition-all duration-300"
            style={{ 
              backgroundColor: '#ffffff', 
              borderRadius: '11px 11px 0 0',
              width: isRightSidebarOpen ? 'calc(100% - 340px)' : '100%',
              maxWidth: '800px',
              minWidth: '400px',
              minHeight: 'calc(100vh - 200px)',
              paddingBottom: '100px',
              boxShadow: '0 0 40px rgba(0,0,0,0.05)',
            }}
          >
            <RichTextEditor 
              content={content} 
              onChange={isReadOnly ? () => {} : setContent}
              readOnly={isReadOnly}
            />
          </div>

          {/* Right Column - Settings (~320px) */}
          <div 
            className={`shrink-0 space-y-6 sticky top-6 transition-all duration-300 ${isRightSidebarOpen ? 'w-[320px] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-10 overflow-hidden pointer-events-none'}`}
            style={{ 
              width: isRightSidebarOpen ? '320px' : '0px', 
              marginTop: '85px',
              display: isRightSidebarOpen ? 'block' : 'none'
            }}
          >
            {isRightSidebarOpen && (
            /* Settings Panel */
            <div className="p-5">
              {/* Title - centered */}
              <h3 className="font-medium text-[#4E5871] text-center mb-6">Pravý sloupec</h3>

              <div className="space-y-6">
                {/* Show TOC Toggle */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-slate-700">
                    Zobrazovat přehled dokumentu
                  </Label>
                  <Switch 
                    checked={showTOC} 
                    onCheckedChange={setShowTOC}
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
            )}
          </div>

        </div>
                 </div>

      {/* Save Button - Fixed Bottom (hidden in read-only mode) */}
      {!isReadOnly && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            size="lg"
            className="gap-2 bg-[#4E5871] hover:bg-[#3d455a] shadow-lg hover:shadow-xl transition-all px-6"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Ukládání...' : 'Uložit'}
          </Button>
        </div>
      )}

      {/* Featured Media Dialog */}
      <Dialog open={showFeaturedMediaDialog} onOpenChange={setShowFeaturedMediaDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-[#4E5871]" />
              Úvodní obsah
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
                       <div className="space-y-2">
              <Label htmlFor="featuredUrl" className="text-sm font-medium text-slate-700">
                URL obrázku nebo videa
              </Label>
                         <Input 
                id="featuredUrl" 
                value={featuredMediaInput} 
                onChange={(e) => setFeaturedMediaInput(e.target.value)} 
                placeholder="https://..." 
                className="bg-slate-50 border-slate-200"
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

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowFeaturedMediaDialog(false)}>
              Zrušit
            </Button>
            <Button 
              onClick={() => {
                setFeaturedMedia(featuredMediaInput);
                setShowFeaturedMediaDialog(false);
              }} 
              className="bg-[#4E5871] hover:bg-[#3d455a]"
              disabled={!featuredMediaInput}
            >
              Uložit
            </Button>
      </div>
        </DialogContent>
      </Dialog>

      {/* Version History Modal */}
      {versionHistoryOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
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
              onClose={() => setVersionHistoryOpen(false)}
            />
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
