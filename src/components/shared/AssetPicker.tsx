/**
 * Asset Picker Component
 * 
 * Univerzální komponenta pro výběr médií:
 * - Nahrát: Upload vlastního obrázku
 * - Moje knihovna: Vlastní nahrané soubory
 * - Gify: Integrace Giphy API
 * - Google: Google Images search (TODO)
 * - Vividbooks: Animace, obrázky, nálepky, symboly od Vividbooks
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  FolderOpen,
  Image as ImageIcon,
  Sparkles,
  Search,
  Loader2,
  Film,
  Sticker,
  Shapes,
  ExternalLink,
  Check,
  AlertCircle,
  HardDrive,
  Database,
} from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { useFileStorage } from '../../hooks/useFileStorage';
import { useVividbooksAssets } from '../../hooks/useVividbooksAssets';
import { getMediaFolderId, ensureMediaFolderExists, MEDIA_FOLDER_ID, MEDIA_FOLDER_NAME } from '../../utils/folder-storage';
import type { 
  AssetPickerConfig, 
  AssetPickerResult, 
  AssetPickerTab,
  AssetType,
  VividbooksAsset,
  GiphyGif,
} from '../../types/assets';
import { toast } from 'sonner';

// ============================================
// CONSTANTS
// ============================================

const GIPHY_API_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'; // Public API key
const GIPHY_LIMIT = 25;

const ASSET_TYPE_ICONS: Record<AssetType, React.ReactNode> = {
  animation: <Film className="w-4 h-4" />,
  image: <ImageIcon className="w-4 h-4" />,
  sticker: <Sticker className="w-4 h-4" />,
  symbol: <Shapes className="w-4 h-4" />,
};

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  animation: 'Animace',
  image: 'Obrázky',
  sticker: 'Nálepky',
  symbol: 'Symboly',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================
// SUB-COMPONENTS
// ============================================

// Tab pro nahrání souboru
function UploadTab({ 
  onSelect, 
  usage 
}: { 
  onSelect: (result: AssetPickerResult) => void;
  usage: { used: number; total: number; percentage: number };
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading } = useFileStorage();

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validace typu
    if (!file.type.startsWith('image/')) {
      toast.error('Podporovány jsou pouze obrázky');
      return;
    }

    // Validace velikosti (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Maximální velikost souboru je 10 MB');
      return;
    }

    console.log('[AssetPicker] Uploading file:', file.name, file.type, file.size);
    
    try {
      // Ensure media folder exists and upload to it
      ensureMediaFolderExists();
      const mediaFolderId = getMediaFolderId();
      
      const result = await uploadFile(file, { folderId: mediaFolderId });
      console.log('[AssetPicker] Upload result:', result);
      
      if (result.success && result.file) {
        // filePath už obsahuje celou URL, ne jen path
        const url = result.file.filePath;
        
        console.log('[AssetPicker] File uploaded successfully to Média folder:', url);
        
        onSelect({
          type: 'upload',
          url,
          name: file.name,
          mimeType: file.type,
        });
        toast.success('Obrázek nahrán do složky Média');
      } else {
        console.error('[AssetPicker] Upload failed:', result.error);
        toast.error(result.error || 'Chyba při nahrávání');
      }
    } catch (err) {
      console.error('[AssetPicker] Upload exception:', err);
      toast.error('Neočekávaná chyba při nahrávání');
    }
  }, [uploadFile, onSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) return;
    
    setIsLoadingUrl(true);
    try {
      // Validovat URL
      const url = new URL(urlInput.trim());
      
      // Zkontrolovat, zda je to obrázek
      const response = await fetch(url.toString(), { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      
      if (!contentType?.startsWith('image/')) {
        toast.error('URL neodkazuje na obrázek');
        return;
      }

      onSelect({
        type: 'upload',
        url: url.toString(),
        mimeType: contentType,
      });
      toast.success('Obrázek přidán');
    } catch (err) {
      toast.error('Neplatná URL adresa');
    } finally {
      setIsLoadingUrl(false);
    }
  }, [urlInput, onSelect]);

  // Handle paste
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const fileList = new DataTransfer();
            fileList.items.add(file);
            handleFileSelect(fileList.files);
            break;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleFileSelect]);

  return (
    <div className="p-6 space-y-6">
      {/* Storage usage indicator */}
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
        <HardDrive className="w-5 h-5 text-slate-400" />
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-600">Využité místo</span>
            <span className="text-slate-500">
              {formatFileSize(usage.used)} / {formatFileSize(usage.total)}
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${Math.min(usage.percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
          ${isDragOver 
            ? 'border-indigo-500 bg-indigo-50' 
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }
        `}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            <p className="text-slate-600">Nahrávání...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className={`w-12 h-12 ${isDragOver ? 'text-indigo-500' : 'text-slate-300'}`} />
            <div>
              <p className="text-slate-600 font-medium">
                Přetáhněte obrázek sem nebo použijte CTRL + V
              </p>
              <p className="text-sm text-slate-400 mt-1">
                PNG, JPG, GIF, WEBP • Max 10 MB
              </p>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>

      {/* URL input */}
      <div className="space-y-2">
        <p className="text-center text-sm text-slate-400">Nebo</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
            placeholder="Zadat URL adresu"
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
          />
          <button
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim() || isLoadingUrl}
            className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoadingUrl ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Stáhnout'}
          </button>
        </div>
      </div>

      {/* File picker button */}
      <div className="text-center">
        <p className="text-sm text-slate-400 mb-2">Nebo</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
        >
          Vybrat z počítače
        </button>
      </div>
    </div>
  );
}

// Folder SVG paths (matching MyContentLayout exactly)
const FOLDER_BACK_PATH = "M6.31652 12.5701C6.31652 5.62783 11.9444 0 18.8866 0H60.976C65.4295 0 69.5505 2.35648 71.8093 6.19466L73.4384 8.96289C75.6972 12.8011 79.8183 15.1575 84.2718 15.1575H156.69C163.632 15.1575 169.26 20.7854 169.26 27.7277V133.953C169.26 140.895 163.632 146.523 156.69 146.523H18.8867C11.9444 146.523 6.31652 140.895 6.31652 133.953V12.5701Z";

// Tab pro knihovnu uživatele s podporou složek
function LibraryTab({ onSelect }: { onSelect: (result: AssetPickerResult) => void }) {
  const { files, loading, getFilesInFolder, getRootFiles } = useFileStorage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Start in Média folder by default
  const MEDIA_FOLDER_ID = 'folder-media-library';
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(MEDIA_FOLDER_ID);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([
    { id: MEDIA_FOLDER_ID, name: 'Média' }
  ]);
  const [folders, setFolders] = useState<any[]>([]);

  // Load folders from localStorage
  useEffect(() => {
    const loadFolders = () => {
      try {
        const stored = localStorage.getItem('vivid-my-folders');
        if (stored) {
          const parsed = JSON.parse(stored);
          setFolders(parsed);
        }
      } catch (e) {
        console.error('Error loading folders:', e);
      }
    };
    loadFolders();
    
    // Listen for folder changes
    const handleFolderChange = () => loadFolders();
    window.addEventListener('folderStorageChange', handleFolderChange);
    return () => window.removeEventListener('folderStorageChange', handleFolderChange);
  }, []);

  // Get current folder's subfolders
  const getCurrentSubfolders = useCallback(() => {
    if (!currentFolderId) {
      // Root level - show top-level folders (like "Média")
      return folders.filter(f => f.type === 'folder');
    }
    // Find current folder and return its children
    const findFolder = (items: any[], id: string): any | null => {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.children) {
          const found = findFolder(item.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    const current = findFolder(folders, currentFolderId);
    return current?.children?.filter((c: any) => c.type === 'folder') || [];
  }, [folders, currentFolderId]);

  // Get files in current folder
  const currentFiles = useMemo(() => {
    const allFiles = currentFolderId ? getFilesInFolder(currentFolderId) : getRootFiles();
    return allFiles.filter(f => f.mimeType?.startsWith('image/'));
  }, [files, currentFolderId, getFilesInFolder, getRootFiles]);

  const subfolders = getCurrentSubfolders();

  const handleSelect = useCallback((file: typeof files[0]) => {
    const url = file.filePath || '';
    onSelect({
      type: 'library',
      url,
      name: file.fileName,
      mimeType: file.mimeType,
    });
  }, [onSelect]);

  const navigateToFolder = (folder: any) => {
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  };

  const navigateBack = () => {
    if (folderPath.length > 0) {
      const newPath = [...folderPath];
      newPath.pop();
      setFolderPath(newPath);
      setCurrentFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
    }
  };

  const navigateToRoot = () => {
    setFolderPath([]);
    setCurrentFolderId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const hasContent = subfolders.length > 0 || currentFiles.length > 0;

  if (!hasContent && folderPath.length === 1 && currentFolderId === MEDIA_FOLDER_ID) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <FolderOpen className="w-16 h-16 text-slate-200 mb-4" />
        <p className="text-slate-500 font-medium">Složka Média je prázdná</p>
        <p className="text-sm text-slate-400 mt-1">
          Nahrajte obrázky v záložce "Nahrát" nebo importujte PDF
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Breadcrumb navigation - only show if deeper than Média folder */}
      {folderPath.length > 1 && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          {folderPath.map((folder, index) => (
            <React.Fragment key={folder.id}>
              {index > 0 && <span className="text-slate-400">/</span>}
              <button
                onClick={() => {
                  const newPath = folderPath.slice(0, index + 1);
                  setFolderPath(newPath);
                  setCurrentFolderId(folder.id);
                }}
                className={`${index === folderPath.length - 1 ? 'text-slate-700' : 'text-indigo-600 hover:text-indigo-800'} font-medium`}
              >
                {folder.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Back button when deeper than Média folder */}
      {folderPath.length > 1 && (
        <button
          onClick={navigateBack}
          className="flex items-center gap-2 mb-4 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zpět
        </button>
      )}

      {/* Folders grid */}
      {subfolders.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-6">
          {subfolders.map((folder: any) => {
            // System folders (like "Moje obrázky") are always light gray
            const isMediaFolder = folder.id === MEDIA_FOLDER_ID || folder.isSystemFolder;
            const color = isMediaFolder ? '#e2e8f0' : (folder.color || '#8b5cf6');
            const displayName = folder.id === MEDIA_FOLDER_ID ? MEDIA_FOLDER_NAME : folder.name;
            const clipId = `clip-asset-${folder.id}`;
            const filterId = `filter-asset-${folder.id}`;
            
            return (
              <div
                key={folder.id}
                onClick={() => navigateToFolder(folder)}
                className="flex flex-col items-center gap-2 group cursor-pointer transition-all duration-200"
                style={{ width: '126px' }}
              >
                <div className="relative w-full transition-transform group-hover:-translate-y-1 duration-200" style={{ aspectRatio: '173/147' }}>
                  <svg 
                    viewBox="0 0 173.049 146.714" 
                    className="w-full h-full overflow-visible"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <filter 
                        id={filterId}
                        colorInterpolationFilters="sRGB" 
                        filterUnits="userSpaceOnUse" 
                        height="140.537" 
                        width="192.137" 
                        x="-9.54412" 
                        y="18.4489"
                      >
                        <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                        <feOffset dy="2.72689"/>
                        <feGaussianBlur stdDeviation="4.77206"/>
                        <feComposite in2="hardAlpha" operator="out"/>
                        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0"/>
                        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
                        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
                      </filter>
                    </defs>
                    
                    <g>
                      {/* Back part - 50% opacity */}
                      <path 
                        d={FOLDER_BACK_PATH} 
                        fill={color} 
                        fillOpacity="0.5" 
                      />
                      
                      {/* Front part with shadow */}
                      <g filter={`url(#${filterId})`}>
                        <rect 
                          y="25.2661" 
                          width="173.049" 
                          height="121.448" 
                          rx="15" 
                          fill={color} 
                        />
                      </g>
                    </g>
                  </svg>
                  
                  {/* System folder icon (e.g., "Moje obrázky") */}
                  {isMediaFolder && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{ top: '25%' }}
                    >
                      <svg 
                        width="32" 
                        height="32" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="#94a3b8" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        style={{ opacity: 0.6 }}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  )}
                </div>
              
              <span className="text-xs font-medium text-slate-700 text-center px-2 line-clamp-2 max-w-full">
                {displayName}
              </span>
            </div>
          );
        })}
        </div>
      )}

      {/* Files grid */}
      {currentFiles.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {currentFiles.map((file) => {
            const url = file.filePath || '';
            return (
              <div
                key={file.id}
                onClick={() => handleSelect(file)}
                className={`
                  relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all
                  ${selectedId === file.id 
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                    : 'border-transparent hover:border-slate-200'
                  }
                `}
              >
                <img
                  src={url}
                  alt={file.fileName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
                {selectedId === file.id && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty folder message - only show when deeper than Média */}
      {folderPath.length > 1 && currentFiles.length === 0 && subfolders.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <FolderOpen className="w-12 h-12 text-slate-200 mb-3" />
          <p className="text-slate-500 text-sm">Složka je prázdná</p>
        </div>
      )}
    </div>
  );
}

// Přednastavené kategorie GIFů pro matematické vzdělávání
const GIPHY_QUICK_CATEGORIES = [
  { 
    id: 'correct', 
    label: 'Správně', 
    emoji: '✅',
    searchTerm: 'success celebration thumbs up',
    description: 'Štěstí, úspěch'
  },
  { 
    id: 'wrong', 
    label: 'Špatně', 
    emoji: '😔',
    searchTerm: 'sad disappointed fail',
    description: 'Smutek, zklamání'
  },
  { 
    id: 'amazing', 
    label: 'Paráda', 
    emoji: '🎉',
    searchTerm: 'excited amazing yay happy dance',
    description: 'Super excited'
  },
  { 
    id: 'thinking', 
    label: 'Hmm', 
    emoji: '🤔',
    searchTerm: 'thinking hmm confused',
    description: 'Přemýšlí'
  },
  { 
    id: 'ok', 
    label: 'Dobře', 
    emoji: '👍',
    searchTerm: 'ok good nice nod yes',
    description: 'V pořádku'
  },
  { 
    id: 'party', 
    label: 'Hurá', 
    emoji: '🥳',
    searchTerm: 'party celebration confetti hooray',
    description: 'Slavení, párty'
  },
];

// Tab pro Giphy
function GiphyTab({ onSelect }: { onSelect: (result: AssetPickerResult) => void }) {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const searchGiphy = useCallback(async (query: string, newOffset = 0) => {
    setLoading(true);
    try {
      const endpoint = query.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${GIPHY_LIMIT}&offset=${newOffset}`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${GIPHY_LIMIT}&offset=${newOffset}`;
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (newOffset === 0) {
        setGifs(data.data || []);
      } else {
        setGifs(prev => [...prev, ...(data.data || [])]);
      }
      setOffset(newOffset);
    } catch (err) {
      console.error('Giphy error:', err);
      toast.error('Chyba při načítání GIFů');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load trending on mount
  useEffect(() => {
    searchGiphy('');
  }, [searchGiphy]);

  const handleCategoryClick = useCallback((category: typeof GIPHY_QUICK_CATEGORIES[0]) => {
    setActiveCategory(category.id);
    setSearch(category.searchTerm);
    searchGiphy(category.searchTerm);
  }, [searchGiphy]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    // Zrušit aktivní kategorii při manuálním vyhledávání
    if (activeCategory) {
      setActiveCategory(null);
    }
  }, [activeCategory]);

  const handleSelect = useCallback((gif: GiphyGif) => {
    onSelect({
      type: 'giphy',
      url: gif.images.original.url,
      thumbnailUrl: gif.images.fixed_height.url,
      name: gif.title,
      mimeType: 'image/gif',
      width: parseInt(gif.images.original.width),
      height: parseInt(gif.images.original.height),
    });
  }, [onSelect]);

  return (
    <div className="flex flex-col h-full">
      {/* Quick categories for math education */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-2 flex-wrap">
          {GIPHY_QUICK_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category)}
              title={category.description}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all
                ${activeCategory === category.id
                  ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }
              `}
            >
              <span className="text-base">{category.emoji}</span>
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-4 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchGiphy(search)}
            placeholder="Hledat GIFy..."
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setActiveCategory(null);
                searchGiphy('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && gifs.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Category header */}
            {activeCategory && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">
                  {GIPHY_QUICK_CATEGORIES.find(c => c.id === activeCategory)?.emoji}
                </span>
                <span className="text-sm text-slate-600 font-medium">
                  {GIPHY_QUICK_CATEGORIES.find(c => c.id === activeCategory)?.label}
                </span>
                <span className="text-xs text-slate-400">
                  – {GIPHY_QUICK_CATEGORIES.find(c => c.id === activeCategory)?.description}
                </span>
              </div>
            )}

            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
              {gifs.map((gif) => (
                <div
                  key={gif.id}
                  onClick={() => handleSelect(gif)}
                  className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                >
                  <img
                    src={gif.images.fixed_height.url}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            
            {/* Load more */}
            {gifs.length > 0 && (
              <button
                onClick={() => searchGiphy(search, offset + GIPHY_LIMIT)}
                disabled={loading}
                className="w-full mt-4 py-3 text-indigo-600 font-medium hover:bg-indigo-50 rounded-xl transition-colors"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Načíst další'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Giphy attribution */}
      <div className="p-3 border-t border-slate-100 text-center">
        <a 
          href="https://giphy.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-slate-400 hover:text-slate-500 flex items-center justify-center gap-1"
        >
          Powered by GIPHY <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// Tab pro Vividbooks assets
function VividbooksTab({ onSelect }: { onSelect: (result: AssetPickerResult) => void }) {
  const [search, setSearch] = useState('');
  const [assetType, setAssetType] = useState<AssetType | 'all'>('all');
  const { assets, loading, error, loadAssets, checkAssetLicense } = useVividbooksAssets();

  // Load assets on mount and filter change
  useEffect(() => {
    loadAssets({ search, assetType });
  }, [loadAssets, search, assetType]);

  const handleSelect = useCallback(async (asset: VividbooksAsset) => {
    // Zkontrolovat licenci
    const hasLicense = await checkAssetLicense(asset.id);
    
    if (!hasLicense && asset.licenseRequired) {
      toast.error('Pro tento obsah nemáte licenci', {
        description: 'Kontaktujte svého správce pro rozšíření licence.'
      });
      return;
    }

    onSelect({
      type: 'vividbooks',
      url: asset.fileUrl,
      thumbnailUrl: asset.thumbnailUrl,
      name: asset.name,
      mimeType: asset.mimeType,
      assetId: asset.id,
      assetType: asset.assetType,
      width: asset.width,
      height: asset.height,
    });
  }, [onSelect, checkAssetLicense]);

  return (
    <div className="flex flex-col h-full">
      {/* Search and filters */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat v obsahu Vividbooks..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setAssetType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              assetType === 'all'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Vše
          </button>
          {(Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((type) => (
            <button
              key={type}
              onClick={() => setAssetType(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                assetType === type
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {ASSET_TYPE_ICONS[type]}
              {ASSET_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-300 mb-4" />
            <p className="text-red-500 font-medium">Chyba při načítání</p>
            <p className="text-sm text-red-400 mt-1 max-w-md">
              {error.includes('42P01') 
                ? 'Tabulka vividbooks_assets neexistuje. Spusťte migraci: supabase/migrations/20260110_vividbooks_assets.sql'
                : error
              }
            </p>
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Sparkles className="w-16 h-16 text-slate-200 mb-4" />
            <p className="text-slate-500 font-medium">Žádný obsah nenalezen</p>
            <p className="text-sm text-slate-400 mt-1">
              Zkuste jiné vyhledávání nebo filtr
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => handleSelect(asset)}
                className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-indigo-500 transition-all bg-slate-100"
              >
                {/* Thumbnail */}
                <img
                  src={asset.thumbnailUrl || asset.fileUrl}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-white text-xs font-medium truncate">{asset.name}</p>
                    <div className="flex items-center gap-1 text-white/70 text-xs">
                      {ASSET_TYPE_ICONS[asset.assetType]}
                      <span>{ASSET_TYPE_LABELS[asset.assetType]}</span>
                    </div>
                  </div>
                </div>

                {/* Type badge */}
                <div className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg">
                  {ASSET_TYPE_ICONS[asset.assetType]}
                </div>

                {/* License indicator */}
                {asset.licenseRequired && asset.licenseTier !== 'basic' && (
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-amber-500 text-white text-xs font-bold rounded">
                    {asset.licenseTier === 'premium' ? 'PRO' : 'ENT'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Tab pro obrázky z linked datasetu
function DatasetTab({
  images,
  onSelect,
}: {
  images: Array<{ url: string; title?: string; alt?: string }>;
  onSelect: (result: AssetPickerResult) => void;
}) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Database className="w-16 h-16 text-slate-200 mb-4" />
        <p className="text-slate-500 font-medium">Dataset nemá žádné obrázky</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="text-xs text-slate-400 mb-4">
        Obrázky z datasetu propojeného s tímto pracovním listem
      </p>
      <div className="grid grid-cols-4 gap-3">
        {images.map((img, i) => (
          <div
            key={i}
            onClick={() =>
              onSelect({
                type: 'library',
                url: img.url,
                name: img.title || img.alt || `Obrázek ${i + 1}`,
              })
            }
            className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-indigo-500 transition-all bg-slate-100"
          >
            <img
              src={img.url}
              alt={img.alt || img.title || ''}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-white text-xs font-medium truncate">
                  {img.title || img.alt || `Obrázek ${i + 1}`}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Generated AI Gallery Tab ──────────────────────────────────────────────────
interface GeneratedImage {
  url: string;
  name: string;
  type: 'illustration' | 'photo';
  topic: string;
  subjectCode?: string;
  grade?: number;
  dataSetId: string;
  styleId?: string;
}

function GeneratedTab({ onSelect }: { onSelect: (result: AssetPickerResult) => void }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'illustration' | 'photo'>('all');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadImages = useCallback(async (searchTerm: string) => {
    setLoading(true);
    try {
      // Dotaz na topic_data_sets - hledáme datasety podle tématu
      let query = supabase
        .from('topic_data_sets')
        .select('id, topic, subject_code, grade, media')
        .not('media', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(40);

      if (searchTerm.trim()) {
        query = query.ilike('topic', `%${searchTerm.trim()}%`);
      }

      const { data, error } = await query;
      if (error || !data) { setImages([]); return; }

      // Extrahovat obrázky z media JSON
      const result: GeneratedImage[] = [];
      for (const ds of data) {
        const media = ds.media as any;
        if (!media) continue;

        const illustrations: any[] = media.generatedIllustrations || [];
        const photos: any[] = media.generatedPhotos || [];

        for (const ill of illustrations) {
          if (!ill?.url) continue;
          const name = ill.name || ill.title || 'Ilustrace';
          if (searchTerm.trim() && !name.toLowerCase().includes(searchTerm.toLowerCase()) && !ds.topic.toLowerCase().includes(searchTerm.toLowerCase())) continue;
          result.push({ url: ill.url, name, type: 'illustration', topic: ds.topic, subjectCode: ds.subject_code, grade: ds.grade, dataSetId: ds.id, styleId: ill.style });
        }
        for (const photo of photos) {
          if (!photo?.url) continue;
          const name = photo.name || photo.title || 'Fotka';
          if (searchTerm.trim() && !name.toLowerCase().includes(searchTerm.toLowerCase()) && !ds.topic.toLowerCase().includes(searchTerm.toLowerCase())) continue;
          result.push({ url: photo.url, name, type: 'photo', topic: ds.topic, subjectCode: ds.subject_code, grade: ds.grade, dataSetId: ds.id });
        }
      }
      setImages(result);
    } catch (err) {
      console.error('[GeneratedTab] Error loading images:', err);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages('');
  }, [loadImages]);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadImages(val), 400);
  }, [loadImages]);

  const filtered = typeFilter === 'all' ? images : images.filter(img => img.type === typeFilter);

  return (
    <div className="flex flex-col h-full">
      {/* Search + filter */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Hledat podle tématu nebo názvu obrázku…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
          />
          {search && (
            <button onClick={() => { setSearch(''); loadImages(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {(['all', 'illustration', 'photo'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === t ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {t === 'all' ? '🖼️ Vše' : t === 'illustration' ? '🎨 Ilustrace' : '📷 Fotky'}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400 self-center">{filtered.length} obrázků</span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Sparkles className="w-16 h-16 text-slate-200 mb-4" />
            <p className="text-slate-500 font-medium">Zatím žádné generované obrázky</p>
            <p className="text-sm text-slate-400 mt-1">Obrázky se zobrazí po vygenerování v Curriculum Factory</p>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {filtered.map((img, i) => (
              <div
                key={`${img.dataSetId}-${i}`}
                onClick={() => onSelect({ type: 'generated', url: img.url, name: img.name })}
                className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-purple-500 transition-all bg-slate-100"
              >
                <img src={img.url} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-white text-xs font-semibold truncate">{img.name}</p>
                    <p className="text-white/60 text-xs truncate">{img.topic}</p>
                  </div>
                </div>
                <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: img.type === 'illustration' ? 'rgba(147,51,234,0.85)' : 'rgba(245,158,11,0.85)', color: 'white' }}>
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

// Placeholder pro Google tab
function GoogleTab({ onSelect }: { onSelect: (result: AssetPickerResult) => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <AlertCircle className="w-16 h-16 text-slate-200 mb-4" />
      <p className="text-slate-500 font-medium">Připravujeme</p>
      <p className="text-sm text-slate-400 mt-1">
        Integrace Google Images bude brzy dostupná
      </p>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface AssetPickerProps extends AssetPickerConfig {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: AssetPickerResult) => void;
  showGenerated?: boolean;
}

export function AssetPicker({
  isOpen,
  onClose,
  onSelect,
  showUpload = true,
  showLibrary = true,
  showGiphy = true,
  showGoogle = true,
  showVividbooks = true,
  showGenerated = true,
  defaultTab = 'upload',
  datasetImages,
}: AssetPickerProps) {
  const [activeTab, setActiveTab] = useState<AssetPickerTab>(defaultTab);
  const { usage } = useFileStorage();

  // Reset tab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  const handleSelect = useCallback((result: AssetPickerResult) => {
    onSelect(result);
    onClose();
  }, [onSelect, onClose]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'upload' as const, label: 'Nahrát', icon: Upload, show: showUpload },
    { id: 'library' as const, label: 'Moje obrázky', icon: FolderOpen, show: showLibrary },
    { id: 'giphy' as const, label: 'Gify', icon: Film, show: showGiphy },
    { id: 'google' as const, label: 'Google', icon: Search, show: showGoogle },
    { id: 'vividbooks' as const, label: 'Vividbooks', icon: Sparkles, show: showVividbooks },
    { id: 'generated' as const, label: 'AI galerie', icon: Sparkles, show: showGenerated },
    { id: 'dataset' as const, label: 'Z datasetu', icon: Database, show: !!datasetImages?.length },
  ].filter(tab => tab.show);

  return createPortal(
    <div 
      className="fixed inset-0 flex items-end justify-center pb-4"
      style={{ zIndex: 99999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop - covers everything */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className="relative bg-[#4E5871] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ 
          width: '900px', 
          maxWidth: 'calc(100% - 32px)', 
          height: '85vh',
          maxHeight: '85vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-[#4E5871]">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-white font-semibold text-lg">Vybrat obrázek</h2>
          </div>
          <span className="text-white/50 text-sm">ESC pro zavření</span>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex gap-1 px-6 border-b border-white/10 bg-[#4E5871]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all relative
                  ${activeTab === tab.id 
                    ? 'text-white' 
                    : 'text-white/50 hover:text-white/70'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white overflow-y-auto">
          {activeTab === 'upload' && <UploadTab onSelect={handleSelect} usage={usage} />}
          {activeTab === 'library' && <LibraryTab onSelect={handleSelect} />}
          {activeTab === 'giphy' && <GiphyTab onSelect={handleSelect} />}
          {activeTab === 'google' && <GoogleTab onSelect={handleSelect} />}
          {activeTab === 'vividbooks' && <VividbooksTab onSelect={handleSelect} />}
          {activeTab === 'generated' && <GeneratedTab onSelect={handleSelect} />}
          {activeTab === 'dataset' && (
            <DatasetTab images={datasetImages ?? []} onSelect={handleSelect} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default AssetPicker;

