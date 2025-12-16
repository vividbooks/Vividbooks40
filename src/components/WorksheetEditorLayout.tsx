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
import { Loader2, FileText, Sparkles } from 'lucide-react';
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
import { saveWorksheet as saveToStorage, getWorksheet } from '../utils/worksheet-storage';
import { generateWorksheetFromText } from '../utils/pdf-worksheet-generator';
import { supabase } from '../utils/supabase/client';
import { extractTextFromPDF } from '../utils/pdf-text-extractor';
import { extractTextFromPPTX, isPPTX, isLegacyPPT } from '../utils/pptx-text-extractor';
import { STORAGE_LIMITS } from '../types/file-storage';
import { useAnalytics } from '../hooks/useAnalytics';

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
  
  // Panel state - default to 'structure'
  const [activePanel, setActivePanel] = useState<ActivePanel>('structure');

  // Insert mode (after picking a block type from AddContentPanel)
  const [pendingInsertType, setPendingInsertType] = useState<BlockType | null>(null);
  
  // Block settings overlay state
  const [isBlockSettingsOpen, setIsBlockSettingsOpen] = useState(false);
  
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
        
        // Získat transcript/obsah
        setGenerationProgress('Extrahuji obsah z videa...');
        const transcriptResult = await getYouTubeTranscript(linkInfo.url);
        
        if (!transcriptResult.success || !transcriptResult.transcript) {
          throw new Error(transcriptResult.error || 'Nepodařilo se získat obsah z videa');
        }
        
        console.log('[LinkGen] Got transcript, length:', transcriptResult.transcript.length);
        
        // Generovat pracovní list
        setGenerationProgress('Generuji pracovní list...');
        const worksheetResult = await generateWorksheetFromTranscript(
          transcriptResult.transcript,
          linkInfo.title
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
        
        // Fallback - vytvořit alespoň základní pracovní list
        setWorksheet(prev => {
          if (!prev) return prev;
          const fallbackText = `Tento pracovní list byl vytvořen z videa: ${linkInfo.url}\n\nNepodařilo se automaticky vygenerovat obsah. Můžete přidat vlastní bloky pomocí tlačítka "Přidat blok".`;
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
                type: 'paragraph' as const,
                order: 1,
                width: 'full' as const,
                content: {
                  text: fallbackText,
                  html: `<p>${fallbackText.replace(/\n/g, '<br/>')}</p>`
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
  
  // Autosave s debounce
  useEffect(() => {
    if (!worksheet || !isDirty) return;
    
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
  }, [worksheet, isDirty]);
  
  // Varování před odchodem pokud jsou neuložené změny
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'unsaved' || isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus, isDirty]);
  
  // Uložit při unmountu
  useEffect(() => {
    return () => {
      if (worksheetRef.current && isDirty) {
        saveToStorage(worksheetRef.current);
      }
    };
  }, []);
  
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
  
  // Update worksheet
  const updateWorksheet = useCallback((updates: Partial<Worksheet>) => {
    if (!worksheet) return;
    setWorksheet({ ...worksheet, ...updates });
    setIsDirty(true);
  }, [worksheet]);
  
  // Block operations
  const addBlock = useCallback((type: BlockType, afterBlockId?: string) => {
    if (!worksheet) return;
    
    const newBlock = createEmptyBlock(type, worksheet.blocks.length);
    let newBlocks: WorksheetBlock[];
    
    if (afterBlockId) {
      const index = worksheet.blocks.findIndex(b => b.id === afterBlockId);
      newBlocks = [
        ...worksheet.blocks.slice(0, index + 1),
        newBlock,
        ...worksheet.blocks.slice(index + 1),
      ];
    } else {
      newBlocks = [...worksheet.blocks, newBlock];
    }
    
    newBlocks = newBlocks.map((b, i) => ({ ...b, order: i }));
    
    updateWorksheet({ blocks: newBlocks });
    setSelectedBlockId(newBlock.id);
    setIsBlockSettingsOpen(true); // Auto-open settings panel
  }, [worksheet, updateWorksheet]);

  const insertBlockAtIndex = useCallback((type: BlockType, index: number) => {
    if (!worksheet) return;
    const safeIndex = Math.max(0, Math.min(index, worksheet.blocks.length));
    const newBlock = createEmptyBlock(type, safeIndex);
    const newBlocks = [
      ...worksheet.blocks.slice(0, safeIndex),
      newBlock,
      ...worksheet.blocks.slice(safeIndex),
    ].map((b, i) => ({ ...b, order: i }));

    updateWorksheet({ blocks: newBlocks });
    setSelectedBlockId(newBlock.id);
    setIsBlockSettingsOpen(true); // Auto-open settings panel
  }, [worksheet, updateWorksheet]);

  const confirmInsertBefore = useCallback((targetBlockId: string) => {
    if (!worksheet || !pendingInsertType) return;
    const targetIndex = worksheet.blocks.findIndex(b => b.id === targetBlockId);
    if (targetIndex === -1) return;
    insertBlockAtIndex(pendingInsertType, targetIndex);
    setPendingInsertType(null);
    setActivePanel('structure');
  }, [worksheet, pendingInsertType, insertBlockAtIndex]);

  const insertAtEnd = useCallback(() => {
    if (!worksheet || !pendingInsertType) return;
    insertBlockAtIndex(pendingInsertType, worksheet.blocks.length);
    setPendingInsertType(null);
    setActivePanel('structure');
  }, [worksheet, pendingInsertType, insertBlockAtIndex]);

  const cancelInsert = useCallback(() => {
    setPendingInsertType(null);
  }, []);
  
  const deleteBlock = useCallback((blockId: string) => {
    if (!worksheet) return;
    
    const newBlocks = worksheet.blocks
      .filter(b => b.id !== blockId)
      .map((b, i) => ({ ...b, order: i }));
    
    updateWorksheet({ blocks: newBlocks });
    
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  }, [worksheet, selectedBlockId, updateWorksheet]);
  
  const updateBlock = useCallback((blockId: string, content: any) => {
    if (!worksheet) return;
    
    const newBlocks = worksheet.blocks.map(b =>
      b.id === blockId ? { ...b, content } : b
    );
    
    updateWorksheet({ blocks: newBlocks });
  }, [worksheet, updateWorksheet]);
  
  const updateBlockWidth = useCallback((blockId: string, width: BlockWidth, widthPercent?: number) => {
    if (!worksheet) return;
    
    const newBlocks = worksheet.blocks.map(b =>
      b.id === blockId 
        ? { ...b, width, ...(widthPercent !== undefined && { widthPercent }) } 
        : b
    );
    
    updateWorksheet({ blocks: newBlocks });
  }, [worksheet, updateWorksheet]);

  const updateBlockMargin = useCallback((blockId: string, marginBottom: number) => {
    if (!worksheet) return;
    
    const newBlocks = worksheet.blocks.map(b =>
      b.id === blockId 
        ? { ...b, marginBottom } 
        : b
    );
    
    updateWorksheet({ blocks: newBlocks });
  }, [worksheet, updateWorksheet]);

  const updateBlockMarginStyle = useCallback((blockId: string, marginStyle: 'empty' | 'dotted' | 'lined') => {
    if (!worksheet) return;

    const newBlocks = worksheet.blocks.map(b =>
      b.id === blockId
        ? { ...b, marginStyle }
        : b
    );

    updateWorksheet({ blocks: newBlocks });
  }, [worksheet, updateWorksheet]);

  const updateBlockImage = useCallback((blockId: string, image: BlockImage | undefined) => {
    if (!worksheet) return;

    const newBlocks = worksheet.blocks.map(b =>
      b.id === blockId
        ? { ...b, image }
        : b
    );

    updateWorksheet({ blocks: newBlocks });
  }, [worksheet, updateWorksheet]);

  const duplicateBlock = useCallback((blockId: string) => {
    if (!worksheet) return;
    
    const blockIndex = worksheet.blocks.findIndex(b => b.id === blockId);
    if (blockIndex === -1) return;
    
    const originalBlock = worksheet.blocks[blockIndex];
    const newBlock: WorksheetBlock = {
      ...JSON.parse(JSON.stringify(originalBlock)),
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    const newBlocks = [
      ...worksheet.blocks.slice(0, blockIndex + 1),
      newBlock,
      ...worksheet.blocks.slice(blockIndex + 1),
    ].map((b, i) => ({ ...b, order: i }));
    
    updateWorksheet({ blocks: newBlocks });
    setSelectedBlockId(newBlock.id);
  }, [worksheet, updateWorksheet]);

  // Move block (for drag & drop)
  const moveBlock = useCallback((activeId: string, overId: string) => {
    if (!worksheet || activeId === overId) return;
    
    const oldIndex = worksheet.blocks.findIndex(b => b.id === activeId);
    const newIndex = worksheet.blocks.findIndex(b => b.id === overId);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const newBlocks = arrayMove(worksheet.blocks, oldIndex, newIndex)
      .map((b, i) => ({ ...b, order: i }));
    
    updateWorksheet({ blocks: newBlocks });
  }, [worksheet, updateWorksheet]);

  // Move block up
  const moveBlockUp = useCallback((blockId: string) => {
    if (!worksheet) return;
    const currentIndex = worksheet.blocks.findIndex(b => b.id === blockId);
    if (currentIndex <= 0) return;
    
    const newBlocks = arrayMove(worksheet.blocks, currentIndex, currentIndex - 1)
      .map((b, i) => ({ ...b, order: i }));
    
    updateWorksheet({ blocks: newBlocks });
  }, [worksheet, updateWorksheet]);

  // Move block down
  const moveBlockDown = useCallback((blockId: string) => {
    if (!worksheet) return;
    const currentIndex = worksheet.blocks.findIndex(b => b.id === blockId);
    if (currentIndex === -1 || currentIndex >= worksheet.blocks.length - 1) return;
    
    const newBlocks = arrayMove(worksheet.blocks, currentIndex, currentIndex + 1)
      .map((b, i) => ({ ...b, order: i }));
    
    updateWorksheet({ blocks: newBlocks });
  }, [worksheet, updateWorksheet]);

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
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (saveStatus === 'saving') return;
    
    // Uložit před odchodem pokud jsou změny
    if (isDirty && worksheet) {
      saveToStorage(worksheet);
    }
    
    navigate('/library/my-content');
  }, [saveStatus, isDirty, worksheet, navigate]);

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
              onExport={() => worksheet && handleExport(worksheet)}
              saveStatus={saveStatus}
              isExporting={isExporting}
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
                    setWorksheet(prev => ({
                      ...prev,
                      metadata: { ...prev.metadata, columns }
                    }));
                  }}
                  onUpdateGlobalFontSize={(globalFontSize) => {
                    setWorksheet(prev => ({
                      ...prev,
                      metadata: { ...prev.metadata, globalFontSize }
                    }));
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
            onSwitchToAI={() => setActivePanel('add')}
            columns={worksheet.metadata.columns}
            globalFontSize={worksheet.metadata.globalFontSize}
            pendingInsertType={pendingInsertType}
            onInsertBefore={confirmInsertBefore}
          />
          
          {/* Block Settings Overlay - absolute positioned within relative container */}
          {isBlockSettingsOpen && selectedBlock && (
            <BlockSettingsOverlay
              block={selectedBlock}
              onClose={handleCloseBlockSettings}
              onUpdateBlock={updateBlock}
              onUpdateBlockWidth={updateBlockWidth}
              onUpdateBlockMarginStyle={updateBlockMarginStyle}
              onUpdateBlockImage={updateBlockImage}
              onDeleteBlock={deleteBlock}
              onDuplicateBlock={duplicateBlock}
              onMoveUp={moveBlockUp}
              onMoveDown={moveBlockDown}
              canMoveUp={worksheet.blocks.findIndex(b => b.id === selectedBlock.id) > 0}
              canMoveDown={worksheet.blocks.findIndex(b => b.id === selectedBlock.id) < worksheet.blocks.length - 1}
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
    </div>
  );
}
