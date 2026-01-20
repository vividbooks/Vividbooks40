import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { 
  Loader2, 
  FileText, 
  Sparkles, 
  Undo2, 
  Redo2, 
  Printer,
  ClipboardList,
  Play,
  Eye,
  Camera,
  X,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Users,
  Check,
  History,
} from 'lucide-react';
import { getClasses, ClassGroup } from '../utils/supabase/classes';
import { toast } from 'sonner';
import {
  Worksheet,
  WorksheetBlock,
  BlockType,
  BlockWidth,
  BlockImage,
  createEmptyWorksheet,
  createEmptyBlock,
} from '../types/worksheet';
import { SaveStatus } from '../types/worksheet-editor';
import { MiniSidebar, ActivePanel } from './worksheet-editor/MiniSidebar';
import { SettingsPanel } from './worksheet-editor/SettingsPanel';
import { StructurePanel } from './worksheet-editor/StructurePanel';
import { AddContentPanel } from './worksheet-editor/AddContentPanel';
import { AIChatPanel } from './worksheet-editor/AIChatPanel';
import { DraggableCanvas } from './worksheet-editor/DraggableCanvas';
import { BlockSettingsOverlay } from './worksheet-editor/BlockSettingsOverlay';
import { PrintableWorksheet } from './worksheet-editor/PrintableWorksheet';
import { usePDFExport } from '../hooks/usePDFExport';
import { useVersionHistory } from '../hooks/useVersionHistory';
import { saveWorksheet as saveToStorage, getWorksheet } from '../utils/worksheet-storage';
import { generateWorksheetFromText } from '../utils/pdf-worksheet-generator';
import { supabase } from '../utils/supabase/client';
import { extractTextFromPDF } from '../utils/pdf-text-extractor';
import { extractTextFromPPTX, isPPTX, isLegacyPPT } from '../utils/pptx-text-extractor';
import { STORAGE_LIMITS } from '../types/file-storage';
import { useAnalytics } from '../hooks/useAnalytics';
import { VersionHistoryPanel } from './shared/VersionHistoryPanel';
import { getCurrentUserProfile } from '../utils/profile-storage';

interface WorksheetEditorLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function WorksheetEditorLayout({ theme, toggleTheme }: WorksheetEditorLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trackEvent } = useAnalytics();
  
  // Editor state
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  
  // PDF/File generation state
  const [isGeneratingFromFile, setIsGeneratingFromFile] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const fileGenerationAttemptedRef = useRef(false);
  
  // PDF Export
  const { printRef, handleExport, isExporting } = usePDFExport();
  
  // Get current user profile
  const profile = getCurrentUserProfile();
  
  // Version history hook
  const versionHistory = useVersionHistory({
    documentId: id || '',
    documentType: 'worksheet',
    content: worksheet ? JSON.stringify(worksheet) : '',
    title: worksheet?.title || 'Nový pracovní list',
    userId: profile?.userId,
    userType: 'teacher',
    userName: profile?.name,
    autoSave: true,
    autoSaveDelay: 60000, // Auto-save every minute
    onVersionRestored: useCallback((version) => {
      try {
        const restoredWorksheet = JSON.parse(version.content);
        setWorksheet(restoredWorksheet);
        setIsDirty(true);
      } catch (e) {
        console.error('Failed to parse restored worksheet:', e);
      }
    }, []),
  });
  
  // Panel state - default to 'structure'
  const [activePanel, setActivePanel] = useState<ActivePanel>('structure');

  // Insert mode (after picking a block type from AddContentPanel)
  const [pendingInsertType, setPendingInsertType] = useState<BlockType | null>(null);
  
  // Block settings overlay state
  const [isBlockSettingsOpen, setIsBlockSettingsOpen] = useState(false);
  const [forceAIOpen, setForceAIOpen] = useState(false);
  
  // Assign task popup state
  const [showAssignPopup, setShowAssignPopup] = useState(false);
  
  // Version history modal state
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [assignStep, setAssignStep] = useState<'select-class' | 'select-type'>('select-class');
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  
  // Undo/Redo history
  const [history, setHistory] = useState<Worksheet[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);
  const MAX_HISTORY = 50;
  
  // Refs
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const worksheetRef = useRef<Worksheet | null>(null);
  
  // Keyboard shortcut for export: Ctrl+Shift+E
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+E for export
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        console.log('[Keyboard] Ctrl+Shift+E pressed - triggering export');
        if (worksheet && !isExporting) {
          handleExport(worksheet);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [worksheet, isExporting, handleExport]);

  // Scroll to block when hovering in structure panel
  const handleHoverBlock = useCallback((blockId: string | null) => {
    setHoveredBlockId(blockId);
    
    if (!blockId) return;
    
    // Find the block element in the canvas
    const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
    if (blockElement) {
      blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);
  
  // Keep ref in sync
  useEffect(() => {
    worksheetRef.current = worksheet;
  }, [worksheet]);
  
  // Track worksheet changes for undo/redo history
  useEffect(() => {
    if (!worksheet || isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    
    // Add current state to history
    setHistory(prev => {
      // Remove any future states (redo stack) when making a new change
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new state
      newHistory.push(JSON.parse(JSON.stringify(worksheet)));
      // Keep only last MAX_HISTORY states
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [worksheet]);
  
  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true;
      const prevState = history[historyIndex - 1];
      setWorksheet(JSON.parse(JSON.stringify(prevState)));
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);
  
  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      const nextState = history[historyIndex + 1];
      setWorksheet(JSON.parse(JSON.stringify(nextState)));
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);
  
  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z for undo
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Shift+Z or Ctrl+Y for redo
      if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);
  
  // Inicializace - načíst existující worksheet nebo vytvořit nový
  useEffect(() => {
    if (!id) return;
    
    const saved = getWorksheet(id);
    if (saved) {
      setWorksheet(saved);
    } else {
      setWorksheet(createEmptyWorksheet(id));
      trackEvent('worksheet_created', 'worksheet', { worksheetId: id, isNew: true });
    }
  }, [id]);
  
  // Zpracování source=file - generování pracovního listu z PDF/dokumentu
  useEffect(() => {
    const source = searchParams.get('source');
    
    // Pouze pokud je source=file a ještě jsme to nezkoušeli
    if (source !== 'file' || fileGenerationAttemptedRef.current || !worksheet) return;
    
    // Označit že jsme to už zkusili (prevent double execution)
    fileGenerationAttemptedRef.current = true;
    
    // Získat info o souboru ze sessionStorage
    const fileInfoStr = sessionStorage.getItem('worksheet-source-file');
    if (!fileInfoStr) {
      console.error('No file info in sessionStorage');
      toast.error('Chybí informace o souboru');
      return;
    }
    
    const fileInfo = JSON.parse(fileInfoStr);
    console.log('Generating worksheet from file:', fileInfo);
    
    // Spustit generování
    const generate = async () => {
      setIsGeneratingFromFile(true);
      setGenerationProgress('Načítám data souboru...');
      
      try {
        // Získat extrahovaný text z databáze
        const { data: fileData, error: dbError } = await supabase
          .from('user_files')
          .select('extracted_text, file_path')
          .eq('id', fileInfo.id)
          .single();
        
        if (dbError) {
          console.error('DB error:', dbError);
          throw new Error('Nepodařilo se načíst data souboru');
        }
        
        let extractedText = fileData?.extracted_text;
        
        // Fallback - pokud text není extrahován, extrahujeme ho teď
        if (!extractedText) {
          console.log('[WorksheetGen] No extracted text, extracting now...');
          setGenerationProgress('Extrahuji text z dokumentu...');
          
          const mimeType = fileInfo.mimeType || 'application/pdf';
          
          // Pro PPTX - stáhnout soubor a extrahovat přímo
          if (isPPTX(mimeType)) {
            console.log('[WorksheetGen] Using PPTX extractor');
            const { data: urlData } = await supabase.storage
              .from(STORAGE_LIMITS.STORAGE_BUCKET)
              .createSignedUrl(fileData?.file_path || fileInfo.filePath, 3600);
            
            if (!urlData?.signedUrl) {
              throw new Error('Nepodařilo se získat URL souboru');
            }
            
            // Stáhnout soubor jako Blob
            const response = await fetch(urlData.signedUrl);
            const blob = await response.blob();
            extractedText = await extractTextFromPPTX(blob);
          }
          // Pro starší PPT formát - není podporován
          else if (isLegacyPPT(mimeType)) {
            throw new Error('Starší formát PPT není podporován. Prosím uložte prezentaci jako PPTX.');
          }
          // Pro PDF a ostatní - použijeme Gemini API
          else {
            // Získat URL souboru
            const { data: urlData } = await supabase.storage
              .from(STORAGE_LIMITS.STORAGE_BUCKET)
              .createSignedUrl(fileData?.file_path || fileInfo.filePath, 3600);
            
            if (!urlData?.signedUrl) {
              throw new Error('Nepodařilo se získat URL souboru');
            }
            
            // Extrahovat text pomocí Gemini
            extractedText = await extractTextFromPDF(
              urlData.signedUrl, 
              fileInfo.fileName, 
              mimeType
            );
          }
          
          // Uložit do DB pro příště
          if (extractedText) {
            await supabase
              .from('user_files')
              .update({ extracted_text: extractedText })
              .eq('id', fileInfo.id);
            console.log('[WorksheetGen] Text extracted and saved to DB');
          }
        }
        
        if (!extractedText || extractedText.length < 50) {
          throw new Error('Nepodařilo se extrahovat dostatek textu z dokumentu');
        }
        
        console.log('[WorksheetGen] Using text with', extractedText.length, 'characters');
        setGenerationProgress('Generuji pracovní list pomocí AI...');
        
        const result = await generateWorksheetFromText(extractedText, fileInfo.fileName);
        
        if (result.success && result.blocks && result.blocks.length > 0) {
          setGenerationProgress('Vytvářím pracovní list...');
          
          // Aktualizovat worksheet s vygenerovaným obsahem
          setWorksheet(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              title: result.title || fileInfo.fileName.replace(/\.[^.]+$/, ''),
              blocks: result.blocks!,
              updatedAt: new Date().toISOString()
            };
          });
          setIsDirty(true);
          
          toast.success(`Pracovní list vytvořen z "${fileInfo.fileName}"`, {
            description: `Vygenerováno ${result.blocks.length} bloků`
          });
          
          // Vyčistit sessionStorage
          sessionStorage.removeItem('worksheet-source-file');
        } else {
          throw new Error(result.error || 'AI nevygenerovala žádné bloky');
        }
      } catch (error) {
        console.error('Error generating worksheet from file:', error);
        toast.error('Chyba při generování', {
          description: error instanceof Error ? error.message : 'Neznámá chyba'
        });
      } finally {
        setIsGeneratingFromFile(false);
        setGenerationProgress('');
      }
    };
    
    generate();
  }, [worksheet, searchParams]);
  
  // Zpracování source=link - generování pracovního listu z odkazu (YouTube, Loom, atd.)
  const linkGenerationAttemptedRef = useRef(false);
  const [isGeneratingFromLink, setIsGeneratingFromLink] = useState(false);
  
  useEffect(() => {
    const source = searchParams.get('source');
    
    // Pouze pokud je source=link a ještě jsme to nezkoušeli
    if (source !== 'link' || linkGenerationAttemptedRef.current || !worksheet) return;
    
    // Označit že jsme to už zkusili (prevent double execution)
    linkGenerationAttemptedRef.current = true;
    
    // Získat info o odkazu ze sessionStorage
    const linkInfoStr = sessionStorage.getItem('worksheet-source-link');
    if (!linkInfoStr) {
      console.error('No link info in sessionStorage');
      toast.error('Chybí informace o odkazu');
      return;
    }
    
    const linkInfo = JSON.parse(linkInfoStr);
    console.log('Generating worksheet from link:', linkInfo);
    
    // Vyčistit sessionStorage hned
    sessionStorage.removeItem('worksheet-source-link');
    
    // Async generování
    const generateFromLink = async () => {
      setIsGeneratingFromLink(true);
      setGenerationProgress('Analyzuji video...');
      
      try {
        // Import dynamicky
        const { getYouTubeTranscript, generateWorksheetFromTranscript } = await import('../utils/youtube-transcript');
        
        let transcript: string;
        
        // Použít existující transcript pokud je k dispozici
        if (linkInfo.transcript && linkInfo.transcript.length > 100) {
          console.log('[LinkGen] Using existing transcript, length:', linkInfo.transcript.length);
          transcript = linkInfo.transcript;
          setGenerationProgress('Používám uložený přepis...');
        } else {
          // Získat transcript/obsah z API
          setGenerationProgress('Extrahuji obsah z videa...');
          const transcriptResult = await getYouTubeTranscript(linkInfo.url);
          
          if (!transcriptResult.success || !transcriptResult.transcript) {
            throw new Error(transcriptResult.error || 'Nepodařilo se získat obsah z videa');
          }
          
          console.log('[LinkGen] Got transcript from API, length:', transcriptResult.transcript.length);
          transcript = transcriptResult.transcript;
        }
        
        // Generovat pracovní list
        setGenerationProgress('Generuji komplexní pracovní list...');
        const worksheetResult = await generateWorksheetFromTranscript(
          transcript,
          linkInfo.title,
          linkInfo.url // Předáme URL pro QR kód
        );
        
        if (!worksheetResult.success || !worksheetResult.blocks) {
          throw new Error(worksheetResult.error || 'Nepodařilo se vygenerovat pracovní list');
        }
        
        // Aktualizovat worksheet
        setWorksheet(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            title: worksheetResult.title || `Pracovní list: ${linkInfo.title}`,
            blocks: worksheetResult.blocks!,
            updatedAt: new Date().toISOString()
          };
        });
        
        setIsDirty(true);
        toast.success('Pracovní list vytvořen!', {
          description: `Vygenerováno ${worksheetResult.blocks.length} bloků z videa`
        });
        
      } catch (error) {
        console.error('[LinkGen] Error:', error);
        toast.error('Chyba při generování', {
          description: error instanceof Error ? error.message : 'Neznámá chyba'
        });
        
        // Fallback - vytvořit alespoň základní pracovní list s QR kódem
        setWorksheet(prev => {
          if (!prev) return prev;
          const fallbackText = `Tento pracovní list byl vytvořen z videa. Nepodařilo se automaticky vygenerovat obsah - můžete přidat vlastní bloky pomocí tlačítka "Přidat blok".`;
          return {
            ...prev,
            title: `Pracovní list: ${linkInfo.title}`,
            blocks: [
              {
                id: Date.now().toString(),
                type: 'heading' as const,
                order: 0,
                width: 'full' as const,
                content: { text: linkInfo.title, level: 'h1' as const }
              },
              {
                id: (Date.now() + 1).toString(),
                type: 'qr-code' as const,
                order: 1,
                width: 'half' as const,
                content: {
                  url: linkInfo.url,
                  caption: '📺 Podívej se na video',
                  captionPosition: 'under' as const,
                  size: 150
                }
              },
              {
                id: (Date.now() + 2).toString(),
                type: 'paragraph' as const,
                order: 2,
                width: 'half' as const,
                content: {
                  text: fallbackText,
                  html: `<p>${fallbackText}</p>`
                }
              }
            ]
          };
        });
        setIsDirty(true);
      } finally {
        setIsGeneratingFromLink(false);
        setGenerationProgress('');
      }
    };
    
    generateFromLink();
    
  }, [worksheet, searchParams]);
  
  // Check if worksheet has been modified from placeholder state
  const isWorksheetModified = useCallback((ws: Worksheet | null) => {
    if (!ws) return false;
    
    // Title changed?
    if (ws.title !== 'Nový pracovní list') return true;
    
    // Number of blocks changed? (Initial has 4: header, h1, paragraph, multiple-choice)
    if (ws.blocks.length !== 4) return true;
    
    // Check if initial blocks content was changed
    const header = ws.blocks.find(b => b.type === 'header-footer');
    const h1 = ws.blocks.find(b => b.type === 'heading');
    const paragraph = ws.blocks.find(b => b.type === 'paragraph');
    const question = ws.blocks.find(b => b.type === 'multiple-choice');
    
    if (!header || !h1 || !paragraph || !question) return true;
    
    if (h1.content.text !== 'Nadpis pracovního listu') return true;
    if (paragraph.content.html !== '<p>Zde začněte psát text k tématu. Tento blok je nastaven na polovinu šířky stránky, aby mohl být vedle něj další obsah.</p>') return true;
    if (question.content.question !== 'Zde zadejte otázku, která se vztahuje k textu vlevo...') return true;
    
    return false;
  }, []);

  // Autosave s debounce
  useEffect(() => {
    if (!worksheet || !isDirty || !isWorksheetModified(worksheet)) return;
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    setSaveStatus('unsaved');
    
    autoSaveTimerRef.current = setTimeout(() => {
      performSave();
    }, 2000);
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [worksheet, isDirty, isWorksheetModified]);
  
  // Varování před odchodem pokud jsou neuložené změny
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((saveStatus === 'unsaved' || isDirty) && isWorksheetModified(worksheet)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus, isDirty, worksheet, isWorksheetModified]);
  
  // Uložit při unmountu
  useEffect(() => {
    return () => {
      if (worksheetRef.current && isDirty && isWorksheetModified(worksheetRef.current)) {
        saveToStorage(worksheetRef.current);
      }
    };
  }, [isWorksheetModified]);
  
  // Perform save
  const performSave = useCallback(() => {
    if (!worksheet) return;
    
    setSaveStatus('saving');
    
    const updated: Worksheet = {
      ...worksheet,
      updatedAt: new Date().toISOString(),
    };
    
    saveToStorage(updated);
    
    setTimeout(() => {
      setSaveStatus('saved');
      setIsDirty(false);
    }, 500);
  }, [worksheet]);
  
  // Manuální uložení
  const handleManualSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    performSave();
  }, [performSave]);
  
  // Update worksheet - using functional updates for stability
  const updateWorksheet = useCallback((updates: Partial<Worksheet> | ((prev: Worksheet) => Worksheet)) => {
    setWorksheet(prev => {
      if (!prev) return prev;
      const updated = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
      return { ...updated, updatedAt: new Date().toISOString() };
    });
    setIsDirty(true);
  }, []); // Stable callback

  // Block operations
  const addBlock = useCallback((type: BlockType, afterBlockId?: string) => {
    updateWorksheet(prev => {
      const newBlock = createEmptyBlock(type, prev.blocks.length);
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
    
    // We can't easily get the new ID here because of functional update,
    // but the ID generator is timestamp based so it should be fine to re-generate or handle elsewhere
  }, [updateWorksheet]);

  const insertBlockAtIndex = useCallback((type: BlockType, index: number) => {
    updateWorksheet(prev => {
      const safeIndex = Math.max(0, Math.min(index, prev.blocks.length));
      const newBlock = createEmptyBlock(type, safeIndex);
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
      
      const safeIndex = Math.max(0, targetIndex);
      const newBlock = createEmptyBlock(pendingInsertType, safeIndex);
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
      const index = prev.blocks.length;
      const newBlock = createEmptyBlock(pendingInsertType, index);
      const newBlocks = [...prev.blocks, newBlock].map((b, i) => ({ ...b, order: i }));
      return { ...prev, blocks: newBlocks };
    });
    setPendingInsertType(null);
    setActivePanel('structure');
  }, [pendingInsertType, updateWorksheet]);

  const cancelInsert = useCallback(() => {
    setPendingInsertType(null);
  }, []);
  
  const deleteBlock = useCallback((blockId: string) => {
    updateWorksheet(prev => {
      const newBlocks = prev.blocks
        .filter(b => b.id !== blockId)
        .map((b, i) => ({ ...b, order: i }));
      
      return { ...prev, blocks: newBlocks };
    });
    
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  }, [selectedBlockId, updateWorksheet]);
  
  const updateBlock = useCallback((blockId: string, content: any) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId ? { ...b, content } : b
      )
    }));
  }, [updateWorksheet]);
  
  const updateBlockWidth = useCallback((blockId: string, width: BlockWidth, widthPercent?: number) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId 
          ? { ...b, width, ...(widthPercent !== undefined && { widthPercent }) } 
          : b
      )
    }));
  }, [updateWorksheet]);

  const updateBlockMargin = useCallback((blockId: string, marginBottom: number) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId 
          ? { ...b, marginBottom } 
          : b
      )
    }));
  }, [updateWorksheet]);

  const updateBlockMarginStyle = useCallback((blockId: string, marginStyle: 'empty' | 'dotted' | 'lined') => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId
          ? { ...b, marginStyle }
          : b
      )
    }));
  }, [updateWorksheet]);

  const updateBlockImage = useCallback((blockId: string, image: BlockImage | undefined) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId
          ? { ...b, image }
          : b
      )
    }));
  }, [updateWorksheet]);

  const updateBlockVisualStyles = useCallback((blockId: string, visualStyles: any) => {
    updateWorksheet(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId
          ? { ...b, visualStyles }
          : b
      )
    }));
  }, [updateWorksheet]);

  const duplicateBlock = useCallback((blockId: string) => {
    updateWorksheet(prev => {
      const blockIndex = prev.blocks.findIndex(b => b.id === blockId);
      if (blockIndex === -1) return prev;
      
      const originalBlock = prev.blocks[blockIndex];
      const newBlock: WorksheetBlock = {
        ...JSON.parse(JSON.stringify(originalBlock)),
        id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      
      const newBlocks = [
        ...prev.blocks.slice(0, blockIndex + 1),
        newBlock,
        ...prev.blocks.slice(blockIndex + 1),
      ].map((b, i) => ({ ...b, order: i }));
      
      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  // Move block (for drag & drop)
  const moveBlock = useCallback((activeId: string, overId: string) => {
    updateWorksheet(prev => {
      if (activeId === overId) return prev;
      
      const oldIndex = prev.blocks.findIndex(b => b.id === activeId);
      const newIndex = prev.blocks.findIndex(b => b.id === overId);
      
      if (oldIndex === -1 || newIndex === -1) return prev;
      
      const newBlocks = arrayMove(prev.blocks, oldIndex, newIndex)
        .map((b, i) => ({ ...b, order: i }));
      
      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  // Move block up
  const moveBlockUp = useCallback((blockId: string) => {
    updateWorksheet(prev => {
      const currentIndex = prev.blocks.findIndex(b => b.id === blockId);
      if (currentIndex <= 0) return prev;
      
      const newBlocks = arrayMove(prev.blocks, currentIndex, currentIndex - 1)
        .map((b, i) => ({ ...b, order: i }));
      
      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  // Move block down
  const moveBlockDown = useCallback((blockId: string) => {
    updateWorksheet(prev => {
      const currentIndex = prev.blocks.findIndex(b => b.id === blockId);
      if (currentIndex === -1 || currentIndex >= prev.blocks.length - 1) return prev;
      
      const newBlocks = arrayMove(prev.blocks, currentIndex, currentIndex + 1)
        .map((b, i) => ({ ...b, order: i }));
      
      return { ...prev, blocks: newBlocks };
    });
  }, [updateWorksheet]);

  // Drag & Drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Drag state
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

  // Handle block selection - open overlay or deselect
  const handleSelectBlock = useCallback((blockId: string | null) => {
    setForceAIOpen(false); // Reset AI force open state
    if (blockId === null) {
      // Deselect - close overlay and clear selection
      setSelectedBlockId(null);
      setIsBlockSettingsOpen(false);
    } else {
      // Select block and open overlay
      setSelectedBlockId(blockId);
      setIsBlockSettingsOpen(true);
    }
  }, []);

  // Close block settings overlay
  const handleCloseBlockSettings = useCallback(() => {
    setIsBlockSettingsOpen(false);
    setSelectedBlockId(null);
    setForceAIOpen(false); // Reset AI force open state
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (saveStatus === 'saving') return;
    
    // Uložit před odchodem pokud jsou změny a není to jen placeholder
    if (isDirty && worksheet && isWorksheetModified(worksheet)) {
      saveToStorage(worksheet);
    }
    
    navigate('/library/my-content');
  }, [saveStatus, isDirty, worksheet, navigate, isWorksheetModified]);

  // Get selected block
  const selectedBlock = worksheet?.blocks.find(b => b.id === selectedBlockId);
  
  if (!worksheet) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }
  
  // Loading overlay pro generování z PDF nebo videa
  if (isGeneratingFromFile || isGeneratingFromLink) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-4 text-center">
          <div className="mb-6">
            <div className="relative inline-flex">
              <FileText className="h-16 w-16 text-purple-500" />
              <Sparkles className="h-6 w-6 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Vytvářím pracovní list
          </h2>
          <p className="text-slate-500 mb-6">
            {generationProgress || 'Zpracovávám...'}
          </p>
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
          <p className="text-xs text-slate-400 mt-6">
            {isGeneratingFromLink 
              ? 'AI analyzuje video a vytváří cvičení...' 
              : 'AI analyzuje dokument a vytváří cvičení...'}
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen bg-slate-100 flex overflow-hidden worksheet-editor-root">
      {/* Main content wrapped in DndContext */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex overflow-hidden relative worksheet-editor-main">
          {/* Mini Sidebar - hidden when AI is active */}
          {activePanel !== 'ai' && (
            <MiniSidebar
              activePanel={activePanel}
              onPanelChange={setActivePanel}
              saveStatus={saveStatus === 'error' ? 'unsaved' : saveStatus}
              onOpenHistory={() => setShowVersionHistory(true)}
              hasUnsavedVersions={versionHistory.hasUnsavedChanges}
            />
          )}
          
          {/* Main Panel - 320px fixed width, hidden when AI is active */}
          {activePanel !== 'ai' && (
            <aside data-sidebar data-print-hide="true" className="w-[320px] min-w-[320px] max-w-[320px] flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto pages-settings print:!hidden">
              {activePanel === 'settings' && (
                <SettingsPanel
                  worksheet={worksheet}
                  onUpdateWorksheet={updateWorksheet}
                />
              )}
              
              {activePanel === 'structure' && (
                <StructurePanel
                  worksheet={worksheet}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={handleSelectBlock}
                  onHoverBlock={handleHoverBlock}
                  onAddBlock={addBlock}
                  onUpdateColumns={(columns) => {
                    setWorksheet(prev => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        metadata: { ...prev.metadata, columns },
                        // Set all blocks to half-width when 2 columns, full-width when 1 column
                        blocks: prev.blocks.map(block => ({
                          ...block,
                          width: columns === 2 ? 'half' : 'full',
                          widthPercent: columns === 2 ? 50 : undefined,
                        }))
                      };
                    });
                  }}
                  onUpdateGlobalFontSize={(globalFontSize) => {
                    setWorksheet(prev => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        metadata: { ...prev.metadata, globalFontSize }
                      };
                    });
                  }}
                />
              )}
              
              {activePanel === 'add' && (
                <AddContentPanel
                  onAddBlock={(type) => {
                    // Enter insert mode instead of inserting immediately
                    setPendingInsertType(type);
                  }}
                  pendingInsertType={pendingInsertType}
                  onInsertAtEnd={insertAtEnd}
                  onCancelInsert={cancelInsert}
                />
              )}
            </aside>
          )}
          
          {/* AI Panel - Replaces sidebar when active */}
          {activePanel === 'ai' && (
<aside
              data-sidebar
              data-print-hide="true"
              className="flex-shrink-0 border-r border-slate-200 bg-white flex flex-col right-toolbar print:!hidden"
              style={{ width: '420px', minWidth: '420px', maxWidth: '420px' }}
            >
              {/* AI Chat Panel - has its own back/close buttons */}
              <div className="flex-1 overflow-hidden">
                <AIChatPanel
                  worksheet={worksheet}
                  onAddBlocks={(blocks) => {
                    if (!worksheet) return;
                    
                    // Debug: log incoming blocks
                    console.log('[onAddBlocks] Received:', blocks.map(b => `${b.type}(${b.width})`).join(', '));
                    
                    // VALIDATION: Ensure half-width blocks are always in valid pairs
                    const validateBlockPairs = (inputBlocks: typeof blocks): typeof blocks => {
                      const result: typeof blocks = [];
                      let i = 0;
                      
                      while (i < inputBlocks.length) {
                        const block = { ...inputBlocks[i] };
                        const nextBlock = i + 1 < inputBlocks.length ? { ...inputBlocks[i + 1] } : null;
                        
                        if (block.width === 'half' && nextBlock && nextBlock.width === 'half') {
                          // Valid pair - keep both as half and skip both
                          const thisIsImage = block.type === 'image';
                          const nextIsImage = nextBlock.type === 'image';
                          
                          if (thisIsImage || nextIsImage) {
                            console.log('[Validate] Valid PAIR:', block.type, '+', nextBlock.type);
                            result.push(block);
                            result.push(nextBlock);
                            i += 2; // Skip both blocks!
                            continue;
                          }
                        }
                        
                        // Not a valid pair - convert to full if half
                        if (block.width === 'half') {
                          console.log('[Validate] Orphan half-width, converting to full:', block.type);
                          block.width = 'full';
                        }
                        result.push(block);
                        i++;
                      }
                      
                      return result;
                    };
                    
                    const validatedBlocks = validateBlockPairs(blocks);
                    console.log('[onAddBlocks] After validation:', validatedBlocks.map(b => `${b.type}(${b.width})`).join(', '));
                    
                    const startOrder = worksheet.blocks.length;
                    const newBlocks = validatedBlocks.map((block, idx) => ({
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
                    // Replace all blocks with new ones (for edit mode)
                    updateWorksheet({ blocks });
                  }}
                  onClose={() => setActivePanel('structure')}
                />
              </div>
            </aside>
          )}
          
          {/* Top Bar - VividBoard style */}
          <div 
            className="absolute top-4 right-4 z-50 flex items-center gap-2 print:hidden"
          >
            {/* Undo/Redo buttons */}
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className={`w-10 h-10 rounded-lg transition-colors flex items-center justify-center ${
                historyIndex > 0 
                  ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' 
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
              title="Zpět (Ctrl+Z)"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className={`w-10 h-10 rounded-lg transition-colors flex items-center justify-center ${
                historyIndex < history.length - 1 
                  ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' 
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
              title="Vpřed (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-5 h-5" />
            </button>

            {/* History button */}
            <div className="relative">
              <button
                onClick={() => setShowVersionHistory(true)}
                className="w-10 h-10 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors flex items-center justify-center"
                title="Historie verzí"
              >
                <History className="w-5 h-5" />
              </button>
              {versionHistory.hasUnsavedChanges && (
                <span 
                  className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-amber-500 border-2 border-slate-200 rounded-full"
                  title="Máte neuložené verze"
                />
              )}
            </div>
            
            {/* Preview button */}
            <button
              onClick={() => worksheet && handleExport(worksheet)}
              disabled={isExporting}
              className="w-10 h-10 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors flex items-center justify-center"
              title="Náhled"
            >
              <Eye className="w-5 h-5" />
            </button>

            {/* Assign Task button - Green with popup - MAIN CTA */}
            <div className="relative">
              <button
                onClick={async () => {
                  setShowAssignPopup(true);
                  setAssignStep('select-class');
                  setSelectedClass(null);
                  // Load classes
                  if (classes.length === 0) {
                    setIsLoadingClasses(true);
                    try {
                      const loadedClasses = await getClasses();
                      setClasses(loadedClasses);
                    } catch (error) {
                      console.error('Error loading classes:', error);
                      toast.error('Nepodařilo se načíst třídy');
                    } finally {
                      setIsLoadingClasses(false);
                    }
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white transition-all hover:scale-105"
                style={{ backgroundColor: '#22c55e' }}
              >
                <ClipboardList className="w-5 h-5" />
                <span>Zadat úkol</span>
              </button>
              
              {/* Assign Task Popup */}
              {showAssignPopup && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setShowAssignPopup(false);
                      setAssignStep('select-class');
                      setSelectedClass(null);
                    }}
                  />
                  
                  {/* Popup */}
                  <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {assignStep === 'select-type' && (
                          <button
                            onClick={() => {
                              setAssignStep('select-class');
                              setSelectedClass(null);
                            }}
                            className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4 text-slate-500" />
                          </button>
                        )}
                        <h3 className="font-semibold text-slate-800">
                          {assignStep === 'select-class' ? 'Vyberte třídu' : 'Typ zadání'}
                        </h3>
                      </div>
                      <button 
                        onClick={() => {
                          setShowAssignPopup(false);
                          setAssignStep('select-class');
                          setSelectedClass(null);
                        }}
                        className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                    
                    {/* Step 1: Select Class */}
                    {assignStep === 'select-class' && (
                      <div className="p-3">
                        {isLoadingClasses ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                          </div>
                        ) : classes.length === 0 ? (
                          <div className="text-center py-8">
                            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">Zatím nemáte žádné třídy</p>
                            <button
                              onClick={() => {
                                setShowAssignPopup(false);
                                navigate('/library/my-classes');
                              }}
                              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Vytvořit třídu →
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {classes.map((cls) => (
                              <button
                                key={cls.id}
                                onClick={() => {
                                  setSelectedClass(cls);
                                  setAssignStep('select-type');
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                              >
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center flex-shrink-0 font-bold">
                                  {cls.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-slate-800 truncate">{cls.name}</div>
                                  <div className="text-sm text-slate-500">{cls.students_count || 0} žáků</div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Step 2: Select Assignment Type */}
                    {assignStep === 'select-type' && selectedClass && (
                      <div className="p-3 space-y-2">
                        {/* Selected class info */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200 mb-3">
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-700 font-medium">{selectedClass.name}</span>
                        </div>
                        
                        {/* Option 1: Convert to Board */}
                        <button
                          onClick={() => {
                            setShowAssignPopup(false);
                            if (worksheet) {
                              saveToStorage(worksheet);
                              toast.info('Připravuji board z pracovního listu...');
                              navigate(`/quiz/new?fromWorksheet=${worksheet.id}&classId=${selectedClass.id}`);
                            }
                          }}
                          className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                            <LayoutGrid className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">Board z pracovního listu</div>
                            <div className="text-sm text-slate-500">Žáci vyplní online jako interaktivní kvíz</div>
                          </div>
                        </button>
                        
                        {/* Option 2: Paper Test with AI Grading */}
                        <button
                          onClick={() => {
                            setShowAssignPopup(false);
                            if (worksheet) {
                              saveToStorage(worksheet);
                              navigate(`/worksheet/paper-test/${worksheet.id}?classId=${selectedClass.id}`);
                            }
                          }}
                          className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors">
                            <Camera className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">Papírový test s AI hodnocením</div>
                            <div className="text-sm text-slate-500">Vytiskněte, nafoťte vyplněné testy a AI vyhodnotí</div>
                          </div>
                        </button>
                      </div>
                    )}
                    
                    {/* Footer hint */}
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                      <p className="text-xs text-slate-400 text-center">
                        Výsledky se uloží do statistik třídy
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Print button - Orange - Secondary action */}
            <button
              onClick={() => worksheet && handleExport(worksheet)}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white transition-all hover:scale-105"
              style={{ backgroundColor: '#f97316' }}
              title="Tisk pracovního listu"
            >
              <Printer className="w-5 h-5" />
              <span>Tisk</span>
            </button>
          </div>
          
          {/* Center Panel - Draggable Canvas, own scroll */}
          <DraggableCanvas
            blocks={worksheet.blocks}
            selectedBlockId={selectedBlockId}
            hoveredBlockId={hoveredBlockId}
            onSelectBlock={handleSelectBlock}
            onUpdateBlock={updateBlock}
            onUpdateBlockWidth={updateBlockWidth}
            onUpdateBlockMargin={updateBlockMargin}
            onDeleteBlock={deleteBlock}
            onDuplicateBlock={duplicateBlock}
            onMoveBlockUp={moveBlockUp}
            onMoveBlockDown={moveBlockDown}
            onAddBlock={addBlock}
            onSwitchToAI={() => setActivePanel('ai')}
            onOpenAddPanel={() => setActivePanel('add')}
            onOpenAI={() => {
              // Open block settings which contains AI assistant
              setForceAIOpen(true);
            }}
            columns={worksheet.metadata.columns}
            globalFontSize={worksheet.metadata.globalFontSize}
            pendingInsertType={pendingInsertType}
            onInsertBefore={confirmInsertBefore}
          />
          
          {/* Block Settings Overlay - absolute positioned within relative container */}
          {isBlockSettingsOpen && selectedBlock && (
            <BlockSettingsOverlay
              block={selectedBlock}
              allBlocks={worksheet.blocks}
              onClose={handleCloseBlockSettings}
              onUpdateBlock={updateBlock}
              onUpdateBlockWidth={updateBlockWidth}
              onUpdateBlockMarginStyle={updateBlockMarginStyle}
              onUpdateBlockImage={updateBlockImage}
              onUpdateBlockVisualStyles={updateBlockVisualStyles}
              onDeleteBlock={deleteBlock}
              onDuplicateBlock={duplicateBlock}
              onMoveUp={moveBlockUp}
              onMoveDown={moveBlockDown}
              canMoveUp={worksheet.blocks.findIndex(b => b.id === selectedBlock.id) > 0}
              canMoveDown={worksheet.blocks.findIndex(b => b.id === selectedBlock.id) < worksheet.blocks.length - 1}
              forceOpenAI={forceAIOpen}
            />
          )}
        </div>
      </DndContext>
      
      {/* Hidden printable worksheet for PDF export */}
      {worksheet && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0, opacity: 0, pointerEvents: 'none' }}>
          <PrintableWorksheet ref={printRef} worksheet={worksheet} />
        </div>
      )}
      
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
    </div>
  );
}
