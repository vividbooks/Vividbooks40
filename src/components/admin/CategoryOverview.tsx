import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Lottie from "lottie-react";
import { projectId, publicAnonKey } from '../../utils/supabase/info.tsx';
import { DOCUMENT_TYPES } from '../../types/document-types';
import * as quizStorage from '../../utils/quiz-storage';
import { 
  BookOpen, List, FileText, ArrowLeft, Filter, 
  LayoutGrid, ChevronDown,
  Users, Plus, Layers, BarChart3
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogClose,
  DialogDescription
} from "../../components/ui/dialog";

interface WorkbookBonus {
  id: string;
  label: string;
  url?: string;
  type?: 'link' | 'pdf' | 'file';
}

interface MenuItem {
  id: string;
  label: string;
  slug?: string;
  type?: string;
  icon?: string;
  color?: string;
  textColor?: string; // Barva textu v hlavičce složky (světlá/tmavá)
  coverImage?: string;
  viewMode?: 'classic' | 'rich'; // Vzhled položky v seznamu
  layoutMode?: 'standard' | 'overview'; // Zobrazení obsahu uvnitř složky (legacy)
  contentView?: 'files' | 'overview'; // Zobrazení obsahu uvnitř složky (new)
  children?: MenuItem[];
  externalUrl?: string;
  // Workbook metadata
  author?: string;
  eshopUrl?: string;
  bonuses?: WorkbookBonus[];
}

// Helper function to handle external URLs including board:// protocol
const handleExternalUrl = (externalUrl: string, navigate: (path: string) => void): boolean => {
  if (!externalUrl) return false;
  
  // Handle board:// URLs - navigate to Vividboard view
  if (externalUrl.startsWith('board://')) {
    const boardId = externalUrl.replace('board://', '');
    navigate(`/quiz/view/${boardId}`);
    return true;
  }
  
  // Handle regular external URLs
  window.open(externalUrl, '_blank');
  return true;
};

// Helper function to check if a board exists for an item and navigate to it
const tryNavigateToBoard = (itemSlug: string | undefined, navigate: (path: string) => void): boolean => {
  if (!itemSlug) return false;
  
  // Check for board with standard ID pattern (board_{slug})
  const expectedBoardId = `board_${itemSlug}`;
  const quiz = quizStorage.getQuiz(expectedBoardId);
  
  if (quiz) {
    navigate(`/quiz/view/${expectedBoardId}`);
    return true;
  }
  
  return false;
};

interface CategoryOverviewProps {
  category: string;
  isAdmin?: boolean;
  folderSlug?: string;
  viewMode?: 'folders' | 'workbooks';
  preloadedMenu?: MenuItem[];
  isStudentMode?: boolean;
}

const FOLDER_BACK_PATH = "M6.31652 12.5701C6.31652 5.62783 11.9444 0 18.8866 0H60.976C65.4295 0 69.5505 2.35648 71.8093 6.19466L73.4384 8.96289C75.6972 12.8011 79.8183 15.1575 84.2718 15.1575H156.69C163.632 15.1575 169.26 20.7854 169.26 27.7277V133.953C169.26 140.895 163.632 146.523 156.69 146.523H18.8867C11.9444 146.523 6.31652 140.895 6.31652 133.953V12.5701Z";

// Filter Types Configuration
const CONTENT_TYPES = [
  { id: 'all', label: 'Celý obsah', icon: LayoutGrid },
  ...DOCUMENT_TYPES.map(type => ({
    id: type.id,
    label: type.label,
    icon: type.icon
  }))
];

// Helper to determine if an item is a folder (not a document)
const DOCUMENT_TYPE_IDS = ['lesson', 'worksheet', 'textbook', 'practice', 'test', 'exam', 'methodology', 'interactive', 'bonus', 'ucebni-text', 'board', 'link', 'experiment', 'workbook'];
const isItemFolder = (item: MenuItem): boolean => {
  // If item has a known document type, it's NOT a folder
  if (item.type && DOCUMENT_TYPE_IDS.includes(item.type)) {
    return false;
  }
  // Otherwise, use traditional folder detection
  return !item.slug || item.type === 'group' || item.type === 'folder' || (item.children && item.children.length > 0);
};

const getFolderStats = (item: MenuItem) => {
  const stats: Record<string, number> = {};

  if (item.children) {
    item.children.forEach(child => {
      let type = child.type;
      const icon = child.icon;

      // Normalize legacy types/icons
      if (type === 'textbook') {
         // keep as textbook
      } else if (type === 'workbook' || icon === 'book' || icon === 'workbook') {
         type = 'workbook';
      } else if (!type || type === 'document' || type === 'lesson' || icon === 'message-square') {
         type = 'lesson';
      }
      
      // Count it
      if (type) {
        stats[type] = (stats[type] || 0) + 1;
      }
    });
  }
  return stats;
};

// Standard Folder Card (SVG)
const FolderCard = ({ item, onClick, inheritedColor }: { item: MenuItem; onClick: () => void; inheritedColor?: string }) => {
  const color = item.color || inheritedColor || '#bbf7d0'; 
  const clipId = `clip-${item.id}`;
  const filterId = `filter-${item.id}`;
  
  return (
    <div 
      onClick={onClick}
      className="flex flex-col items-center gap-3 group cursor-pointer w-[173px]"
    >
      <div className="relative w-full aspect-[173/147] transition-transform group-hover:-translate-y-1 duration-200">
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
                {item.coverImage && (
                  <clipPath id={clipId}>
                     <rect 
                        y="25.2661" 
                        width="173.049" 
                        height="121.448" 
                        rx="15" 
                      />
                  </clipPath>
                )}
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
                  {item.coverImage && (
                    <image
                      href={item.coverImage}
                      x="0"
                      y="25.2661"
                      width="173.049"
                      height="121.448"
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#${clipId})`}
                    />
                  )}
               </g>
             </g>
          </svg>
          
          {/* Icon overlay for standard folder - show only if no image */}
          {!item.coverImage && (
            <div className="absolute inset-0 top-6 flex items-center justify-center pointer-events-none">
               <LayoutGrid className="w-10 h-10 text-black/10" />
            </div>
          )}
      </div>
      <span className="text-sm text-center font-medium text-[#4E5871] line-clamp-2 px-1 tracking-wide" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
        {item.label}
      </span>
    </div>
  );
};

// Improved Rich Folder Card
const RichFolderCard = ({ item, onClick, onFilterClick, inheritedColor, parentTextColor }: { item: MenuItem; onClick: () => void; onFilterClick: (e: React.MouseEvent, type: string, count: number) => void; inheritedColor?: string; parentTextColor?: string }) => {
  const stats = getFolderStats(item);
  const statEntries = Object.entries(stats);
  const hasStats = statEntries.length > 0;
  
  const [isHovered, setIsHovered] = useState(false);
  const lottieRef = useRef<any>(null);
  const [animationData, setAnimationData] = useState<any>(null);
  const [isLoadingLottie, setIsLoadingLottie] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setAnimationData(null);
    setIsLoadingLottie(false);
    
    if (!item.coverImage) return;

    // Check extensions
    const isJsonUrl = item.coverImage.toLowerCase().endsWith('.json');
    const isImgUrl = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.coverImage);

    if (isImgUrl) return; // Treat as image

    setIsLoadingLottie(true);
    fetch(item.coverImage)
      .then(res => {
        if (res.ok) {
           // Check content type or try to parse
           const contentType = res.headers.get('content-type');
           if (isJsonUrl || contentType?.includes('application/json')) {
               return res.json();
           }
           // Try parsing anyway
           return res.clone().text().then(text => {
               try { return JSON.parse(text); } catch { return null; }
           });
        }
        return null;
      })
      .then(data => {
        if (data && (data.v || data.layers)) {
           setAnimationData(data);
        }
      })
      .catch(() => {
        // Ignore errors, render as image
      })
      .finally(() => {
        setIsLoadingLottie(false);
      });
  }, [item.coverImage]);

  useEffect(() => {
    if (isHovered) {
      lottieRef.current?.play();
    } else {
      lottieRef.current?.stop();
    }
  }, [isHovered]);

  const showImage = item.coverImage && !imageError;

  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex flex-col group cursor-pointer w-[340px] bg-white rounded-[20px] border border-slate-100 p-3 shadow-sm hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] transition-all duration-300"
    >
      {/* Image / Header Section - only show if there's actual content */}
      {(isLoadingLottie || animationData || showImage) && (
      <div className="relative aspect-[2/1] w-full shrink-0 overflow-hidden rounded-[12px] bg-slate-50">
        {isLoadingLottie ? (
           <div className="w-full h-full flex items-center justify-center bg-slate-50">
               <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-300"></div>
           </div>
        ) : animationData ? (
          <div className="w-full h-full">
            <div className={`w-full h-full transition-opacity duration-300 opacity-100`}>
               <Lottie
                 lottieRef={lottieRef}
                 animationData={animationData}
                 loop={true}
                 autoplay={false}
                 className="w-full h-full"
                 style={{ width: '100%', height: '100%' }}
                 rendererSettings={{
                    preserveAspectRatio: 'xMidYMid slice'
                 }}
               />
            </div>
          </div>
        ) : showImage ? (
          <img 
            src={item.coverImage} 
            alt={item.label}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          ) : null}
        
        {/* Subtle inner border for definition */}
        <div className="absolute inset-0 border border-black/5 rounded-[12px] pointer-events-none" />
      </div>
      )}

      {/* Content Section */}
      <div className="px-2 pt-4 pb-2 flex flex-col gap-3 flex-1">
        <h3 className="font-bold text-[#4E5871] leading-snug tracking-tight" style={{ fontFamily: "'Fenomen Sans', sans-serif", fontSize: '29px' }}>
          {item.label}
        </h3>
        
        {/* Stats Row - Clickable Filters */}
        {hasStats ? (
          <div className="flex flex-wrap gap-2 mt-auto pt-1">
            {statEntries
              .sort((a, b) => {
                 const typeA = a[0];
                 const typeB = b[0];
                 
                 // Učební text always first
                 if (typeA === 'ucebni-text') return -1;
                 if (typeB === 'ucebni-text') return 1;
                 
                 // Textbook second
                 if (typeA === 'textbook') return -1;
                 if (typeB === 'textbook') return 1;
                 
                 // Use order from CONTENT_TYPES for others
                 const indexA = CONTENT_TYPES.findIndex(t => t.id === typeA);
                 const indexB = CONTENT_TYPES.findIndex(t => t.id === typeB);
                 
                 // If both found, compare indices
                 if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                 
                 // If one found, it goes first
                 if (indexA !== -1) return -1;
                 if (indexB !== -1) return 1;
                 
                 return 0;
              })
              .map(([type, count]) => {
               const typeInfo = CONTENT_TYPES.find(t => t.id === type) || { label: type === 'guide' ? 'Návod' : type, icon: LayoutGrid };
               const Icon = typeInfo.icon;
               const hasParentColor = inheritedColor && parentTextColor;
               const isDarkText = parentTextColor && parentTextColor !== '#ffffff' && parentTextColor !== '#fff';
               return (
                  <button 
                    key={type}
                    onClick={(e) => onFilterClick(e, type, count)}
                    className={`flex items-center gap-2.5 text-[15px] font-medium px-4 py-3 rounded-xl transition-colors ${
                      hasParentColor ? '' : 'text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                    style={hasParentColor ? {
                      backgroundColor: `${inheritedColor}25`,
                      color: parentTextColor,
                    } : undefined}
                    onMouseEnter={(e) => {
                      if (hasParentColor) {
                        e.currentTarget.style.backgroundColor = `${inheritedColor}40`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (hasParentColor) {
                        e.currentTarget.style.backgroundColor = `${inheritedColor}25`;
                      }
                    }}
                  >
                    <Icon className="w-5 h-5" strokeWidth={2} />
                    <span>{typeInfo.label}: {count}</span>
                  </button>
               );
            })}
          </div>
        ) : (
          <div className="mt-auto pt-1">
             <span className="text-xs text-slate-400 font-medium">Žádný obsah</span>
          </div>
        )}
      </div>
    </div>
  );
};

const DocumentCard = ({ item, onClick }: { item: MenuItem; onClick: () => void }) => {
  // Map icon string to component if needed, or use default
  const docType = DOCUMENT_TYPES.find(t => t.id === item.type);
  let Icon = docType?.icon || FileText;

  // Fallback for legacy mappings if type didn't match
  if (!docType) {
     if (item.type === 'lesson') {
       const lessonType = DOCUMENT_TYPES.find(t => t.id === 'lesson');
       if (lessonType) Icon = lessonType.icon;
     }
  }

  const [imageError, setImageError] = useState(false);
  const hasCoverImage = item.coverImage && !imageError;

  return (
    <div 
      onClick={onClick}
      className="flex flex-col items-center gap-3 group cursor-pointer w-[173px]"
    >
      <div className="relative w-full aspect-[1/1.2] bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden transition-transform group-hover:-translate-y-1 duration-200">
         {hasCoverImage ? (
           <img 
             src={item.coverImage} 
             alt={item.label}
             onError={() => setImageError(true)}
             className="w-full h-full object-cover"
           />
         ) : (
           <div className="w-full h-full flex items-center justify-center">
         <Icon className="w-8 h-8 text-gray-400" />
           </div>
         )}
         {/* Corner fold effect */}
         <div className="absolute top-0 right-0 w-6 h-6">
            <div className="absolute top-0 right-0 w-0 h-0 border-l-[24px] border-b-[24px] border-l-transparent border-b-gray-100 shadow-sm" />
         </div>
      </div>
      <span className="text-sm text-center font-medium text-[#4E5871] line-clamp-2 px-1 tracking-wide" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
        {item.label}
      </span>
    </div>
  );
};

const WorkbookCard = ({ item, onClick }: { item: MenuItem; onClick: () => void }) => {
  return (
    <div 
      onClick={onClick}
      className="flex flex-col items-center gap-3 group cursor-pointer w-[173px]"
    >
      <div className="relative w-full aspect-[0.7/1] shadow-[0px_8px_18px_-4px_#a1b1da] rounded overflow-hidden transition-transform group-hover:-translate-y-1 duration-200 bg-white">
        {item.coverImage ? (
          <img 
            src={item.coverImage} 
            alt={item.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
            <BookOpen className="w-12 h-12 opacity-20" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
      </div>
      <span className="text-sm text-center font-medium text-[#4E5871] line-clamp-2 px-1 tracking-wide" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
        {item.label}
      </span>
    </div>
  );
};

const FilterDropdown = ({ 
  activeFilter, 
  activeFilterLabel, 
  counts, 
  allStats,
  totalCount,
  onSelect,
  variant = 'default',
  textColor
}: { 
  activeFilter: string, 
  activeFilterLabel: string, 
  counts: number,
  allStats?: Record<string, number>,
  totalCount?: number,
  onSelect: (id: string) => void,
  variant?: 'default' | 'transparent',
  textColor?: string
}) => {
  const [open, setOpen] = useState(false);

  const isTransparent = variant === 'transparent';
  const isDarkText = textColor && textColor !== '#ffffff' && textColor !== '#fff';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button 
          className={`
            flex items-center gap-3 px-6 py-3.5 rounded-xl transition-all duration-200 border group shadow-sm backdrop-blur-sm
          ${isTransparent 
              ? 'hover:bg-white/20' 
            : activeFilter !== 'all' 
              ? 'bg-white border-blue-200 text-blue-700 hover:border-blue-300' 
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}
          `}
          style={isTransparent ? {
            backgroundColor: textColor ? `${textColor}1a` : 'rgba(255,255,255,0.1)',
            borderColor: textColor ? `${textColor}33` : 'rgba(255,255,255,0.2)',
            color: textColor || '#ffffff'
          } : undefined}
        >
          <Filter className="w-5 h-5" style={isTransparent ? { color: textColor ? `${textColor}e6` : 'rgba(255,255,255,0.9)' } : undefined} />
          <span className="font-medium text-[15px]">Filtr: {activeFilterLabel}</span>
          {activeFilter !== 'all' && (
            <div 
              className={`${!isTransparent ? (isDarkText ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700') : ''} text-xs min-w-[24px] h-6 px-2 rounded-full flex items-center justify-center font-bold ml-1`}
              style={isTransparent ? { backgroundColor: textColor || '#ffffff', color: isDarkText ? '#ffffff' : '#3b82f6' } : undefined}
            >
              {counts}
            </div>
          )}
          <ChevronDown className="w-5 h-5 ml-1 transition-transform duration-200" style={isTransparent ? { color: textColor ? `${textColor}99` : 'rgba(255,255,255,0.6)', transform: open ? 'rotate(180deg)' : 'none' } : { transform: open ? 'rotate(180deg)' : 'none' }} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2" align="start">
        <div className="flex flex-col gap-1">
          {CONTENT_TYPES.map(type => {
            const Icon = type.icon;
            const isActive = activeFilter === type.id;
            
            // Determine count for this type
            let typeCount = 0;
            if (type.id === 'all') {
               typeCount = totalCount || 0;
            } else if (allStats) {
               typeCount = allStats[type.id] || 0;
            }

            // Only show if it has content or is 'all'
            if (typeCount === 0 && type.id !== 'all') return null;
            
            return (
              <button
                key={type.id}
                onClick={() => {
                  onSelect(type.id);
                  setOpen(false);
                }}
                className={`
                  flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : 'hover:bg-slate-50 text-slate-600'}
                `}
              >
                <div className={`
                  p-2 rounded-lg
                  ${isActive ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-500'}
                `}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[15px] leading-tight flex-1">{type.label}</span>
                
                {/* Count Badge inside dropdown */}
                {typeCount > 0 && (
                   <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isActive ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                      {typeCount}
                   </span>
                )}
                
                {isActive && <div className="ml-2 w-2 h-2 rounded-full bg-blue-500" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Helper to determine if item matches filter
const isItemMatchingFilter = (item: MenuItem, filterType: string): boolean => {
  const hasChildren = item.children && item.children.length > 0;
  let type = item.type;
  const icon = item.icon;

  // Normalize type logic (mirroring calculateAllStats)
  if (type === 'workbook' || icon === 'book' || icon === 'workbook') type = 'workbook';
  else if (type === 'worksheet' || icon === 'file-edit') type = 'worksheet';
  else if (type === 'textbook') type = 'textbook';
  else if (type === 'experiment') type = 'experiment';
  else if (type === 'test') type = 'test';
  else if (type === 'exam') type = 'exam';
  else if (type === 'methodology') type = 'methodology';
  else if (type === 'exercise' || type === 'practice') type = 'practice';
  else if ((!type && !hasChildren) || type === 'lesson' || type === 'document' || icon === 'message-square') type = 'lesson';

  // Special handling for 'all'
  if (filterType === 'all') return true;

  return type === filterType;
};

// Helper function to recursively find matching items in subfolders
const findMatchingItems = (items: MenuItem[], filterType: string): MenuItem[] => {
  let results: MenuItem[] = [];
  
  items.forEach(item => {
    if (isItemMatchingFilter(item, filterType)) {
      results.push(item);
    }
    
    // Always recurse if it has children
    if (item.children && item.children.length > 0) {
       results = [...results, ...findMatchingItems(item.children, filterType)];
    }
  });
  
  return results;
};

// Helper to find path to item
const findPathToItem = (items: MenuItem[], targetId: string): string[] | null => {
  for (const item of items) {
    if (item.id === targetId) {
      return [item.slug || item.id];
    }
    if (item.children && item.children.length > 0) {
      const subPath = findPathToItem(item.children, targetId);
      if (subPath) {
        return [item.slug || item.id, ...subPath];
      }
    }
  }
  return null;
};

// Helper to calculate stats recursively for all types
const calculateAllStats = (items: MenuItem[]) => {
  const stats: Record<string, number> = {};
  
  const recurse = (nodes: MenuItem[]) => {
    nodes.forEach(node => {
      // Determine type
      let type = node.type;
      const hasChildren = node.children && node.children.length > 0;

      if (type === 'workbook' || node.icon === 'book' || node.icon === 'workbook') type = 'workbook';
      else if (type === 'worksheet' || node.icon === 'file-edit') type = 'worksheet';
      else if (type === 'textbook') type = 'textbook';
      else if (type === 'experiment') type = 'experiment';
      else if (type === 'test') type = 'test';
      else if (type === 'exam') type = 'exam';
      else if (type === 'methodology') type = 'methodology';
      else if (type === 'exercise' || type === 'practice') type = 'practice';
      else if (type === 'interactive') type = 'interactive';
      else if (type === 'bonus') type = 'bonus';
      else if (type === 'ucebni-text') type = 'ucebni-text';
      else if ((!type && !hasChildren) || type === 'lesson' || type === 'document' || node.icon === 'message-square') type = 'lesson';

      if (type) {
        stats[type] = (stats[type] || 0) + 1;
      }
      
      if (hasChildren) {
        recurse(node.children);
      }
    });
  };

  recurse(items);
  return stats;
};

// Helper to extract difficulty level from item name (1, 2, 3 at the end)
const extractLevelFromLabel = (label: string): number => {
  const match = label.match(/\s+(\d)$/);
  return match ? parseInt(match[1]) : 0;
};

// Level badge colors
const LEVEL_COLORS = {
  1: { bg: 'bg-amber-400', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
  2: { bg: 'bg-cyan-400', iconBg: 'bg-cyan-100', iconColor: 'text-cyan-600' },
  3: { bg: 'bg-rose-400', iconBg: 'bg-rose-100', iconColor: 'text-rose-600' },
};

// Compact Pill Card for Filtered Items
const PillCard = ({ item, onClick, showLevel = false }: { item: MenuItem; onClick: () => void; showLevel?: boolean }) => {
  // Determine icon
  let Icon = FileText;
  
  // Try to find matching type
  const docType = DOCUMENT_TYPES.find(t => t.id === item.type);
  if (docType) {
    Icon = docType.icon;
  } else {
    // Fallbacks for legacy/unknown types
    if (item.type === 'lesson' || !item.type || item.icon === 'message-square') {
       const lessonType = DOCUMENT_TYPES.find(t => t.id === 'lesson');
       if (lessonType) Icon = lessonType.icon;
    }
    else if (item.type === 'worksheet' || item.icon === 'file-edit') {
       const sheetType = DOCUMENT_TYPES.find(t => t.id === 'worksheet');
       if (sheetType) Icon = sheetType.icon;
    }
    else if (item.type === 'workbook' || item.icon === 'book') {
       const bookType = DOCUMENT_TYPES.find(t => t.id === 'workbook') || DOCUMENT_TYPES.find(t => t.id === 'textbook');
       if (bookType) Icon = bookType.icon;
    }
  }
  
  // Handle generic folder
  if ((!item.type || item.type === 'group') && item.children && item.children.length > 0) {
     Icon = LayoutGrid; // Or Folder icon
  }

  // Extract level for practice items
  const level = showLevel ? extractLevelFromLabel(item.label) : 0;

  // Get badge color based on level (using inline styles to avoid Tailwind purge issues)
  const getBadgeColor = (lvl: number) => {
    switch (lvl) {
      case 1: return '#fbbf24'; // amber
      case 2: return '#22d3ee'; // cyan
      case 3: return '#fb7185'; // rose
      default: return null;
    }
  };
  
  const badgeColor = showLevel && level > 0 ? getBadgeColor(level) : null;

  return (
    <button 
      onClick={onClick}
      className="inline-flex items-center gap-3 px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors duration-200 text-left group w-fit max-w-[320px]"
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-200">
      <Icon className="w-5 h-5 text-slate-500 group-hover:text-slate-700 flex-shrink-0" />
      </div>
      {badgeColor && (
        <div 
          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
          style={{ backgroundColor: badgeColor }}
        >
          {level}
        </div>
      )}
      <span className="font-medium text-slate-700 group-hover:text-slate-900 text-[15px] line-clamp-1">
        {item.label}
      </span>
    </button>
  );
};

// Folder Section Component for Overview Mode
const FolderSection = ({ 
  folder, 
  navigate, 
  basePath, 
  category,
  isAdmin,
  onFilterClick,
  parentSlug,
  parentTitle,
  initialFilter = 'all',
  viewType = 'list',
  sectionIndex = 0,
  totalSections = 1
}: { 
  folder: MenuItem; 
  navigate: any; 
  basePath: string; 
  category: string;
  isAdmin: boolean;
  onFilterClick: (e: React.MouseEvent, type: string, slug: string) => void;
  parentSlug?: string;
  parentTitle?: string;
  initialFilter?: string;
  viewType?: 'cards' | 'list';
  sectionIndex?: number;
  totalSections?: number;
}) => {
  // Build the folder path including parent (use id as fallback if no slug)
  const folderSlugOrId = folder.slug || folder.id;
  const folderPath = parentSlug ? `${parentSlug}/${folderSlugOrId}` : folderSlugOrId;
  
  // Use the global filter passed from parent (initialFilter)
  const localFilter = initialFilter;
  
  const items = folder.children || [];
  
  // Calculate stats for the filter dropdown
  const folderStats = calculateAllStats(items);
  const totalItemsCount = Object.values(folderStats).reduce((a, b) => a + b, 0);

  // Calculate content based on filter
  let currentFilterCount = 0;
  const groups: { id: string; label: string; items: MenuItem[] }[] = [];
  const rootMatches: MenuItem[] = [];

  if (localFilter === 'all') {
    currentFilterCount = totalItemsCount;
  } else {
    // Grouping logic
    items.forEach(child => {
      // 1. Check if the child itself matches (e.g. a document at this level)
      if (isItemMatchingFilter(child, localFilter)) {
        rootMatches.push(child);
        currentFilterCount++;
      }
      
      // 2. Check descendants if it's a folder
      if (child.children && child.children.length > 0) {
        const descendants = findMatchingItems(child.children, localFilter);
        if (descendants.length > 0) {
          groups.push({
            id: child.id,
            label: child.label,
            items: descendants
          });
          currentFilterCount += descendants.length;
        }
      }
    });
  }

  const activeFilterLabel = CONTENT_TYPES.find(t => t.id === localFilter)?.label || 'Celý obsah';

  if (items.length === 0) return null;

  // Don't show folder title if it's the same as parent title
  const showFolderTitle = !parentTitle || folder.label !== parentTitle;

  return (
    <div id={`section-${folder.id}`} className="scroll-mt-32 mb-16">
       {showFolderTitle && (
         <>
           {/* Show separator line above H2 in list view when there are multiple sections and this is not the first */}
           {viewType === 'list' && totalSections > 1 && sectionIndex > 0 && (
             <div className="mb-8 mt-4" style={{ borderTop: '2px solid #e2e8f0' }} />
           )}
           <div className="flex items-center gap-4 mb-6">
             <h2 className="font-bold text-[#4E5871] tracking-tight" style={{ fontFamily: "'Fenomen Sans', sans-serif", fontSize: '28px' }}>
               {folder.label}
             </h2>
          </div>
         </>
       )}
       
       {/* CARDS VIEW - Big previews with DocumentCard/RichFolderCard */}
       {localFilter === 'all' && viewType === 'cards' ? (
         <div className="flex flex-wrap gap-12 gap-y-16">
            {items.map(item => {
               const isFolder = isItemFolder(item);
               
               if (!isFolder) {
                  return (
                    <DocumentCard
                      key={item.id}
                      item={item}
                      onClick={() => {
                         if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(item.type || '')) {
                            if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                            if (tryNavigateToBoard(item.slug, navigate)) return;
                         }
                         if (item.slug) {
                            navigate(`${basePath}/${category}/${folderPath}/${item.slug}`);
                         }
                      }}
                    />
                  );
               }

               const inheritedColor = folder.color;
               const inheritedTextColor = folder.textColor;
                  return (
                    <RichFolderCard 
                      key={item.id} 
                      item={item} 
                      inheritedColor={inheritedColor}
                      parentTextColor={inheritedTextColor}
                      onClick={() => {
                      if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(item.type || '')) {
                            if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                            if (tryNavigateToBoard(item.slug, navigate)) return;
                         }
                         const target = item.slug || item.id;
                         if (target) {
                            navigate(`${basePath}/${category}/${folderPath}/${target}`);
                         }
                      }}
                   onFilterClick={(e, type, count) => {
                      e.stopPropagation();
                      if (count === 1) {
                         const matches = findMatchingItems(item.children || [], type);
                         if (matches.length === 1) {
                            const match = matches[0];
                            if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(match.type || '')) {
                               if (match.externalUrl && handleExternalUrl(match.externalUrl, navigate)) return;
                               if (tryNavigateToBoard(match.slug, navigate)) return;
                            }
                            const pathSegments = findPathToItem(item.children || [], match.id);
                            if (pathSegments) {
                               navigate(`${basePath}/${category}/${folderPath}/${pathSegments.join('/')}`);
                               return;
                            }
                         }
                      }
                      onFilterClick(e, type, item.slug || item.id);
                   }}
                 />
               );
            })}
         </div>
       ) : localFilter === 'all' && viewType === 'list' ? (
         /* GROUPED PILL VIEW - Items grouped by type */
         <div className="space-y-8">
            {(() => {
               // Separate folders and direct items
               const folders = items.filter(item => isItemFolder(item) && item.children && item.children.length > 0);
               const directItems = items.filter(item => !isItemFolder(item) || !item.children || item.children.length === 0);
               
               // Group direct items by type
               const groupDirectItemsByType = (itemsToGroup: MenuItem[]) => {
                  return itemsToGroup.reduce((acc, item) => {
                     let type = item.type;
                     if (type === 'worksheet' || item.icon === 'file-edit') type = 'worksheet';
                     else if (type === 'methodology') type = 'methodology';
                     else if (type === 'test') type = 'test';
                     else if (type === 'exam') type = 'exam';
                     else if (type === 'exercise' || type === 'practice') type = 'practice';
                     else if (type === 'interactive') type = 'interactive';
                     else if (type === 'bonus') type = 'bonus';
                     else if (type === 'ucebni-text') type = 'ucebni-text';
                     else if (!type || type === 'lesson' || type === 'document') type = 'lesson';
                     
                     if (!acc[type]) acc[type] = [];
                     acc[type].push(item);
                     return acc;
                  }, {} as Record<string, MenuItem[]>);
               };
               
               const typeOrder = ['ucebni-text', 'lesson', 'worksheet', 'methodology', 'practice', 'interactive', 'test', 'exam', 'bonus'];
               
               // Render grouped direct items (if any)
               const directGrouped = groupDirectItemsByType(directItems);
               const directTypes = typeOrder.filter(t => directGrouped[t]?.length > 0);
               
                  return (
                  <>
                     {/* Direct items grouped by type */}
                     {directTypes.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-32 gap-y-16">
                           {directTypes.map(typeId => {
                              const typeItems = directGrouped[typeId];
                              const typeLabel = CONTENT_TYPES.find(t => t.id === typeId)?.label || typeId;
                              return (
                                 <div key={typeId}>
                                    <h4 className="text-sm font-bold text-[#4E5871] mb-2">{typeLabel}</h4>
                                    <div className="flex flex-col gap-2">
                                       {typeItems.map(item => (
                                          <PillCard
                      key={item.id} 
                      item={item} 
                      onClick={() => {
                                               if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(item.type || '')) {
                                                  if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                                  if (tryNavigateToBoard(item.slug, navigate)) return;
                                               }
                                               if (item.slug) {
                                                  navigate(`${basePath}/${category}/${folderPath}/${item.slug}`);
                         }
                      }} 
                    />
                                       ))}
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     )}
                     
                     {/* Subfolders - each as a section with grouped content */}
                     {folders.map((subFolder, subIdx) => {
                        const subItems = subFolder.children || [];
                        const subGrouped = groupDirectItemsByType(subItems);
                        const subTypes = typeOrder.filter(t => subGrouped[t]?.length > 0);
                        
                        if (subTypes.length === 0) return null;
                        
                        // Don't show subfolder title if it's the same as parent folder
                        const showSubFolderTitle = subFolder.label !== folder.label;
                        // Show line above subfolder if there are multiple and this is not the first
                        const showSubFolderLine = folders.length > 1 && subIdx > 0;
                        
                        return (
                           <div key={subFolder.id} className="pt-4">
                              {/* Separator line between subfolders */}
                              {showSubFolderLine && (
                                 <div className="mb-6 -mt-2" style={{ borderTop: '2px solid #e2e8f0' }} />
                              )}
                              {showSubFolderTitle && (
                                 <h3 className="font-bold text-[#4E5871] mb-4" style={{ fontFamily: "'Fenomen Sans', sans-serif", fontSize: '22px' }}>
                                    {subFolder.label}
                                 </h3>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-32 gap-y-16">
                                 {subTypes.map(typeId => {
                                    const typeItems = subGrouped[typeId];
                                    const typeLabel = CONTENT_TYPES.find(t => t.id === typeId)?.label || typeId;
                                    return (
                                       <div key={typeId}>
                                          <h4 className="text-sm font-bold text-[#4E5871] mb-2">{typeLabel}</h4>
                                          <div className="flex flex-col gap-2">
                                             {typeItems.map(item => (
                                                <PillCard
                                                  key={item.id}
                                                  item={item}
                                                  showLevel={typeId === 'practice'}
                                                  onClick={() => {
                                                     if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(item.type || '')) {
                                                        if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                                        if (tryNavigateToBoard(item.slug, navigate)) return;
                                                     }
                                                     if (item.slug) {
                                                        navigate(`${basePath}/${category}/${folderPath}/${subFolder.slug || subFolder.id}/${item.slug}`);
                                                     }
                                                  }}
                                                />
                                             ))}
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                           </div>
                        );
                     })}
                  </>
               );
            })()}
         </div>
       ) : (
         <div className="flex flex-col gap-4">
            {/* Special rendering for practice filter - show by levels */}
            {localFilter === 'practice' ? (
               <>
                  {/* Root level practice items - display by levels */}
                  {rootMatches.length > 0 && (() => {
                     const level1 = rootMatches.filter(item => extractLevelFromLabel(item.label) === 1);
                     const level2 = rootMatches.filter(item => extractLevelFromLabel(item.label) === 2);
                     const level3 = rootMatches.filter(item => extractLevelFromLabel(item.label) === 3);
                     const noLevel = rootMatches.filter(item => extractLevelFromLabel(item.label) === 0);
                     
                     const levelGroups = [
                        { level: 1, items: level1, color: 'bg-amber-50 border-amber-200', badge: 'bg-amber-400' },
                        { level: 2, items: level2, color: 'bg-cyan-50 border-cyan-200', badge: 'bg-cyan-400' },
                        { level: 3, items: level3, color: 'bg-rose-50 border-rose-200', badge: 'bg-rose-400' },
                     ].filter(g => g.items.length > 0);
                     
                     return (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                           {levelGroups.map(lg => (
                              <div key={lg.level} className={`rounded-2xl border p-5 ${lg.color}`}>
                                 <div className="flex items-center gap-2 mb-4">
                                    <div className={`w-7 h-7 rounded-full ${lg.badge} flex items-center justify-center text-white font-bold text-sm`}>
                                       {lg.level}
                                    </div>
                                    <span className="text-sm font-bold text-[#4E5871]">Úroveň {lg.level}</span>
                                 </div>
                                 <div className="flex flex-col gap-2">
                                    {lg.items.map(item => (
                                       <PillCard
                                         key={item.id}
                                         item={item}
                                         showLevel={true}
                                         onClick={() => {
                                            if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                            if (tryNavigateToBoard(item.slug, navigate)) return;
                                            if (item.slug) {
                                               navigate(`${basePath}/${category}/${folderPath}/${item.slug}`);
                                            }
                                         }}
                                       />
                                    ))}
                                 </div>
                              </div>
                           ))}
                           {noLevel.length > 0 && noLevel.map(item => (
                              <PillCard
                                key={item.id}
                                item={item}
                                onClick={() => {
                                   if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                   if (tryNavigateToBoard(item.slug, navigate)) return;
                                   if (item.slug) {
                                      navigate(`${basePath}/${category}/${folderPath}/${item.slug}`);
                                   }
                                }}
                              />
                           ))}
                        </div>
                     );
                  })()}

                  {/* Nested practice items from subfolders */}
                  {groups.map(group => {
                     const level1 = group.items.filter(item => extractLevelFromLabel(item.label) === 1);
                     const level2 = group.items.filter(item => extractLevelFromLabel(item.label) === 2);
                     const level3 = group.items.filter(item => extractLevelFromLabel(item.label) === 3);
                     const noLevel = group.items.filter(item => extractLevelFromLabel(item.label) === 0);
                     
                     const levelGroups = [
                        { level: 1, items: level1, color: 'bg-amber-50 border-amber-200', badge: 'bg-amber-400' },
                        { level: 2, items: level2, color: 'bg-cyan-50 border-cyan-200', badge: 'bg-cyan-400' },
                        { level: 3, items: level3, color: 'bg-rose-50 border-rose-200', badge: 'bg-rose-400' },
                     ].filter(g => g.items.length > 0);
                     
                     return (
                        <div key={group.id}>
                           <h3 className="text-xl font-bold text-slate-800 mb-4" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                              {group.label}
                           </h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {levelGroups.map(lg => (
                                 <div key={lg.level} className={`rounded-2xl border p-5 ${lg.color}`}>
                                    <div className="flex items-center gap-2 mb-4">
                                       <div className={`w-7 h-7 rounded-full ${lg.badge} flex items-center justify-center text-white font-bold text-sm`}>
                                          {lg.level}
                                       </div>
                                       <span className="text-sm font-bold text-[#4E5871]">Úroveň {lg.level}</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                       {lg.items.map(item => (
                                          <PillCard
                                            key={item.id}
                                            item={item}
                                            showLevel={true}
                                            onClick={() => {
                                               if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                               if (tryNavigateToBoard(item.slug, navigate)) return;
                                               if (item.slug) {
                                                  navigate(`${basePath}/${category}/${item.slug}`);
                                               }
                                            }}
                                          />
                                       ))}
                                    </div>
                                 </div>
                              ))}
                           </div>
                           {noLevel.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                 {noLevel.map(item => (
                                    <PillCard
                                      key={item.id}
                                      item={item}
                                      onClick={() => {
                                         if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                         if (tryNavigateToBoard(item.slug, navigate)) return;
                                         if (item.slug) {
                                            navigate(`${basePath}/${category}/${item.slug}`);
                                         }
                                      }}
                                    />
                                 ))}
                              </div>
                           )}
                        </div>
                     );
                  })}
               </>
            ) : (
               <>
            {/* Root level matches */}
            {rootMatches.length > 0 && (
               <div className="flex flex-wrap gap-3">
                  {rootMatches.map(item => (
                    <PillCard
                      key={item.id}
                      item={item}
                      onClick={() => {
                               if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(item.type || '')) {
                            if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                            if (tryNavigateToBoard(item.slug, navigate)) return;
                         }

                         if (item.slug) {
                             navigate(`${basePath}/${category}/${item.slug}`);
                         }
                      }}
                    />
                  ))}
               </div>
            )}

            {/* Grouped matches by subfolder */}
            {groups.map(group => (
              <div key={group.id}>
                 <h3 className="text-lg font-bold text-slate-700 mb-3" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                    {group.label}
                 </h3>
                 <div className="flex flex-wrap gap-3">
                    {group.items.map(item => (
                      <PillCard
                        key={item.id}
                        item={item}
                        onClick={() => {
                                 if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(item.type || '')) {
                              if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                              if (tryNavigateToBoard(item.slug, navigate)) return;
                           }

                           if (item.slug) {
                               navigate(`${basePath}/${category}/${item.slug}`);
                           }
                        }}
                      />
                    ))}
                 </div>
              </div>
            ))}
               </>
            )}

            {rootMatches.length === 0 && groups.length === 0 && (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                  <p className="text-slate-400">V této sekci není žádný obsah odpovídající filtru.</p>
              </div>
            )}
         </div>
       )}
    </div>
  );
};

export function CategoryOverview({ category, isAdmin = false, folderSlug, viewMode = 'folders', preloadedMenu, isStudentMode = false }: CategoryOverviewProps) {
  const [menu, setMenu] = useState<MenuItem[]>(preloadedMenu || []);
  const [loading, setLoading] = useState(!preloadedMenu);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [globalViewType, setGlobalViewType] = useState<'cards' | 'list'>('cards');
  const navigate = useNavigate();
  const location = useLocation();

  // Filter items that should be hidden for students
  // Students should NOT see: metodická inspirace, řešení pdf, testy, písemky
  const filterForStudentMode = (items: MenuItem[]): MenuItem[] => {
    if (!isStudentMode) return items;
    
    const hiddenKeywords = [
      'metodická inspirace', 'metodicka inspirace',
      'řešení', 'reseni', 'řešení pdf',
      'test', 'testy', 'písemka', 'písemky', 'pisemka', 'pisemky'
    ];
    
    const shouldHide = (label: string): boolean => {
      const normalized = label.toLowerCase();
      return hiddenKeywords.some(keyword => normalized.includes(keyword));
    };
    
    return items
      .filter(item => !shouldHide(item.label))
      .map(item => ({
        ...item,
        children: item.children ? filterForStudentMode(item.children) : undefined
      }));
  };

  useEffect(() => {
    if (location.state?.filter) {
      setActiveFilter(location.state.filter);
    } else {
      setActiveFilter('all');
    }
  }, [location.state, location.pathname]);

  // Use preloaded menu if available, otherwise fetch
  // When category changes, immediately clear menu and show loading to prevent showing items from previous category
  useEffect(() => {
    if (preloadedMenu && preloadedMenu.length > 0) {
      const filteredMenu = filterForStudentMode(preloadedMenu);
      setMenu(filteredMenu);
      setLoading(false);
    } else {
      // Immediately clear menu when preloadedMenu is empty (category changed)
      setMenu([]);
      setLoading(true);
      loadMenu();
    }
  }, [category, preloadedMenu]);

  const loadMenu = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/menu?category=${category}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        let loadedMenu = data.menu || [];
        
        // Helper to find worksheet by ID in the menu tree
        const findWorksheetById = (items: MenuItem[], id: string): MenuItem | null => {
          for (const menuItem of items) {
            if (menuItem.id === id) return menuItem;
            if (menuItem.children) {
              const found = findWorksheetById(menuItem.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        
        // Transform workbookPages to children for display
        // Use LIVE data from original worksheets (true references)
        const transformWorkbooks = (items: MenuItem[], allItems: MenuItem[]): MenuItem[] => {
          return items.map(item => {
            if (item.type === 'workbook' && (item as any).workbookPages && (item as any).workbookPages.length > 0) {
              const pages = (item as any).workbookPages as { id: string; pageNumber: number; worksheetId: string; worksheetSlug: string; worksheetLabel: string; worksheetCover?: string }[];
              const children: MenuItem[] = pages
                .sort((a, b) => a.pageNumber - b.pageNumber)
                .map(page => {
                  // Find the original worksheet to get LIVE data
                  const originalWorksheet = findWorksheetById(allItems, page.worksheetId);
                  const baseLabel = originalWorksheet?.label || page.worksheetLabel;
                  // Remove existing "str. XX" prefix if present to avoid duplication
                  const cleanLabel = baseLabel.replace(/^str\.?\s*\d+\s*/i, '').trim();
                  return {
                    id: page.worksheetId,
                    label: `str. ${page.pageNumber} ${cleanLabel}`,
                    slug: originalWorksheet?.slug || page.worksheetSlug,
                    type: 'worksheet',
                    coverImage: originalWorksheet?.coverImage || page.worksheetCover,
                  };
                });
              return { ...item, children };
            }
            if (item.children) {
              return { ...item, children: transformWorkbooks(item.children, allItems) };
            }
            return item;
          });
        };
        loadedMenu = transformWorkbooks(loadedMenu, loadedMenu);
        
        setMenu(filterForStudentMode(loadedMenu));
      }
    } catch (err) {
      console.error('Error loading menu:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to find item by slug or id recursively
  const findItem = (items: MenuItem[], slugOrId: string): MenuItem | null => {
    for (const item of items) {
      if (item.slug === slugOrId || item.id === slugOrId) return item;
      if (item.children) {
        const found = findItem(item.children, slugOrId);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper to find color from parent hierarchy
  const findParentColor = (items: MenuItem[], targetSlug: string, parentColor: string | null = null): string | null => {
    for (const item of items) {
      const currentColor = item.color || parentColor;
      if (item.slug === targetSlug || item.id === targetSlug) {
        return currentColor;
      }
      if (item.children) {
        const found = findParentColor(item.children, targetSlug, currentColor);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper to find textColor from parent hierarchy (inherit if not set)
  const findParentTextColor = (items: MenuItem[], targetSlug: string, parentTextColor: string | null = null): string | null => {
    for (const item of items) {
      const currentTextColor = item.textColor || parentTextColor;
      if (item.slug === targetSlug || item.id === targetSlug) {
        return currentTextColor;
      }
      if (item.children) {
        const found = findParentTextColor(item.children, targetSlug, currentTextColor);
        if (found) return found;
      }
    }
    return null;
  };

  // Get first folder's color as fallback
  const firstFolderColor = menu.find(item => item.color)?.color || '#3b82f6';

  // Determine current items based on folderSlug
  let currentItems = menu;
  let currentTitle = category.charAt(0).toUpperCase() + category.slice(1);
  let isSubFolder = false;
  let currentFolderItem: MenuItem | null = null;

  if (folderSlug) {
    const searchSlug = folderSlug.split('/').pop() || folderSlug;
    const folder = findItem(menu, searchSlug);
    if (folder) {
      currentFolderItem = folder;
      if (folder.children && folder.children.length > 0) {
        currentItems = folder.children;
        isSubFolder = true;
      } else {
         currentItems = [];
         isSubFolder = true;
      }
      currentTitle = folder.label;
    } else if (!loading) {
         currentItems = [];
    }
  }

  // HOTFIX: Filter out corrupted "Pracovní list" item that cannot be deleted
  currentItems = currentItems.filter(item => item.label !== 'Pracovní list');

  // Check if folder has subfolders (for showing/hiding view toggle)
  const hasSubfolders = currentItems.some(item => isItemFolder(item) && item.children && item.children.length > 0);

  // --- Filtering Logic ---
  // Fix: Ensure that items explicitly marked as 'textbook' are NOT treated as workbooks,
  // even if they have a 'book' icon (which is common for textbooks).
  const workbooks = currentItems.filter(item => 
    item.type !== 'textbook' && (item.type === 'workbook' || item.icon === 'book' || item.icon === 'workbook')
  );
  
  // Filter "others" (everything else) based on activeFilter
  let others = currentItems.filter(item => !workbooks.includes(item));
  
  if (activeFilter !== 'all') {
    others = others.filter(item => {
       // If filtering, we match the item type against the active filter ID
       // We map generic types or use exact match
       if (activeFilter === 'lesson') {
          // Match explicit lessons OR generic documents (fallback logic same as stats)
          return item.type === 'lesson' || item.icon === 'message-square' || !item.type || item.type === 'document';
       }
       if (activeFilter === 'worksheet') return item.type === 'worksheet' || item.icon === 'file-edit';
       if (activeFilter === 'textbook') return item.type === 'textbook';
       // Add more mappings as data becomes available
       return item.type === activeFilter; 
    });
  }

  // When inside a folder/workbook (isSubFolder), show all content regardless of viewMode
  // viewMode only affects the root level display
  const mainContentItems = (viewMode === 'workbooks' && !isSubFolder) ? [] : others;
  
  // In filter mode, we might want to hide workbooks if they don't match the filter?
  // The filter UI has "Učebnice" (textbooks) but not explicitly "Workbooks" (Pracovní sešity).
  // But let's assume filter applies to main content primarily.
  // If filter is set, we should probably hide the separate "Workbooks" section and include them if they match?
  // For now, keeping Workbooks separate as they have a distinct section design.

  // Calculate stats for the current view
  const currentViewStats = useMemo(() => calculateAllStats(currentItems), [currentItems]);
  const totalCurrentViewCount = Object.values(currentViewStats).reduce((a, b) => a + b, 0);
  const activeFilterCount = activeFilter === 'all' ? totalCurrentViewCount : (currentViewStats[activeFilter] || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const basePadding = isAdmin
    ? (isSubFolder && currentFolderItem ? 'px-1 pt-1' : 'p-6')
    : (isSubFolder && currentFolderItem ? 'px-6 pt-4' : 'p-6');

  const activeFilterLabel = CONTENT_TYPES.find(t => t.id === activeFilter)?.label || 'Celý obsah';

   // Determine folder depth: 
   // - depth 1 = root book folder (e.g., "6-rocnik-1-dil")
   // - depth 2+ = nested folder (e.g., "6-rocnik-1-dil/necela-racionalni-cisla")
   const folderDepth = folderSlug ? folderSlug.split('/').length : 0;
   const isRootBookFolder = folderDepth === 1;
   const isNestedFolder = folderDepth >= 2;
   
   // Show overview when we're inside a subfolder AND it has subfolders
   // The display differs based on depth:
   // - Root book folder: Always use FolderSection (sections under each other)
   // - Nested folder: Use RichFolderCard in CARDS mode, FolderSection in LIST mode
   const showOverview = isSubFolder && hasSubfolders;

  // Loading skeleton
  if (loading) {
    return (
      <div className={`w-full mx-auto pb-20 ${basePadding}`}>
        {/* Skeleton Banner */}
        <div className="w-full rounded-3xl mb-8 p-8 md:p-10 min-h-[160px] bg-slate-200 animate-pulse" />
        
        {/* Skeleton Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8 pl-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="space-y-3">
              <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
              <div className="space-y-2">
                <div className="h-12 w-48 bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-12 w-40 bg-slate-100 rounded-xl animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full mx-auto pb-20 ${basePadding}`}>
      
      {/* Header / Banner */}
      {isSubFolder && currentFolderItem ? (() => {
        // Inherit color and textColor from parent hierarchy
        const effectiveColor = currentFolderItem.color || findParentColor(menu, currentFolderItem.slug || currentFolderItem.id, null) || firstFolderColor;
        const effectiveTextColor = currentFolderItem.textColor || findParentTextColor(menu, currentFolderItem.slug || currentFolderItem.id, null) || '#ffffff';
        
        return showOverview ? (
          <div 
            className={`w-full relative overflow-hidden rounded-3xl mb-8 p-8 md:p-10 flex flex-col ${folderSlug?.includes('/') ? 'justify-between' : 'justify-center'} min-h-[180px] shadow-sm group`}
            style={{ backgroundColor: effectiveColor }}
          >
              <div className="z-10 relative">
                  <h1 
                    className="text-2xl md:text-4xl max-w-2xl leading-tight"
                    style={{ fontFamily: "'Cooper Light', serif", color: effectiveTextColor }}
                  >
                    {currentTitle}
                  </h1>
                  
                  {/* Workbook Metadata (author, eshop, bonuses) for overview mode */}
                  {currentFolderItem.type === 'workbook' && (currentFolderItem.author || currentFolderItem.eshopUrl || (currentFolderItem.bonuses && currentFolderItem.bonuses.length > 0)) && (
                    <div className="flex flex-wrap items-center gap-4 mt-4">
                      {currentFolderItem.author && (
                        <span className="text-sm flex items-center gap-2" style={{ color: `${effectiveTextColor}e6` }}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {currentFolderItem.author}
                        </span>
                      )}
                      {currentFolderItem.eshopUrl && (
                        <a 
                          href={currentFolderItem.eshopUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-full text-sm flex items-center gap-2 transition-colors"
                          style={{ 
                            backgroundColor: `${effectiveTextColor}33`,
                            color: effectiveTextColor
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Koupit sešit
                        </a>
                      )}
                      {currentFolderItem.bonuses && currentFolderItem.bonuses.length > 0 && (
                        <div className="relative group">
                          <button 
                            className="px-3 py-1.5 rounded-full text-sm flex items-center gap-2 transition-colors"
                            style={{ 
                              backgroundColor: `${effectiveTextColor}33`,
                              color: effectiveTextColor
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                            </svg>
                            Bonusy ({currentFolderItem.bonuses.length})
                          </button>
                          <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[200px]">
                            {currentFolderItem.bonuses.map(bonus => (
                              <a
                                key={bonus.id}
                                href={bonus.url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                              >
                                {bonus.label || 'Bonus'}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Filter and view toggle - always visible */}
                  <div className="flex items-center gap-4 mt-6">
                      <FilterDropdown 
                        activeFilter={activeFilter}
                        activeFilterLabel={activeFilterLabel}
                        counts={activeFilterCount}
                        allStats={currentViewStats}
                        totalCount={totalCurrentViewCount}
                        onSelect={setActiveFilter}
                        variant="transparent"
                        textColor={effectiveTextColor}
                      />
                    
                    {/* Global view type toggle - only show if folder has subfolders */}
                    {hasSubfolders && (() => {
                      const tc = effectiveTextColor;
                      const isDark = tc && tc !== '#ffffff' && tc !== '#fff';
                      return (
                        <div 
                          className="flex items-center gap-1 backdrop-blur-sm rounded-lg p-1"
                          style={{ backgroundColor: tc ? `${tc}1a` : 'rgba(255,255,255,0.1)' }}
                        >
                           <button
                              onClick={() => setGlobalViewType('list')}
                              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                 globalViewType === 'list' 
                                   ? 'shadow-sm' 
                                   : ''
                              }`}
                              style={{
                                backgroundColor: globalViewType === 'list' ? (tc || '#ffffff') : 'transparent',
                                color: globalViewType === 'list' ? (isDark ? '#ffffff' : '#1e293b') : (tc ? `${tc}b3` : 'rgba(255,255,255,0.7)')
                              }}
                              title="Seskupený seznam"
                           >
                              <List className="w-4 h-4" />
                           </button>
                           <button
                              onClick={() => setGlobalViewType('cards')}
                              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                 globalViewType === 'cards' 
                                   ? 'shadow-sm' 
                                   : ''
                              }`}
                              style={{
                                backgroundColor: globalViewType === 'cards' ? (tc || '#ffffff') : 'transparent',
                                color: globalViewType === 'cards' ? (isDark ? '#ffffff' : '#1e293b') : (tc ? `${tc}b3` : 'rgba(255,255,255,0.7)')
                              }}
                              title="Náhledy karet"
                           >
                              <LayoutGrid className="w-4 h-4" />
                           </button>
                    </div>
                      );
                    })()}
                  </div>
              </div>

              {currentFolderItem.coverImage && (
                 <div className="absolute right-0 bottom-0 h-full w-1/2 md:w-1/3 flex items-end justify-end pointer-events-none">
                     <img 
                       src={currentFolderItem.coverImage} 
                       alt="" 
                       className="max-h-[120%] object-contain origin-bottom-right"
                     />
                 </div>
              )}
          </div>
        ) : (
          <div 
            className="w-full relative overflow-hidden rounded-3xl mb-8 p-8 md:p-10 flex flex-col justify-between min-h-[160px] shadow-sm"
            style={{ backgroundColor: effectiveColor }}
          >
            <div className="z-10 relative">
              <h1 
                className="text-xl md:text-3xl max-w-2xl leading-tight mb-6"
                style={{ fontFamily: "'Cooper Light', serif", color: effectiveTextColor }}
              >
                {currentTitle}
              </h1>
              
              {/* Workbook Metadata (author, eshop, bonuses) */}
              {currentFolderItem.type === 'workbook' && (currentFolderItem.author || currentFolderItem.eshopUrl || (currentFolderItem.bonuses && currentFolderItem.bonuses.length > 0)) && (
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  {currentFolderItem.author && (
                    <span className="text-sm flex items-center gap-2" style={{ color: `${effectiveTextColor}e6` }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {currentFolderItem.author}
                    </span>
                  )}
                  {currentFolderItem.eshopUrl && (
                    <a 
                      href={currentFolderItem.eshopUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-full text-sm flex items-center gap-2 transition-colors"
                      style={{ 
                        backgroundColor: `${effectiveTextColor}33`,
                        color: effectiveTextColor
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Koupit sešit
                    </a>
                  )}
                  {currentFolderItem.bonuses && currentFolderItem.bonuses.length > 0 && (
                    <div className="relative group">
                      <button 
                        className="px-3 py-1.5 rounded-full text-sm flex items-center gap-2 transition-colors"
                        style={{ 
                          backgroundColor: `${effectiveTextColor}33`,
                          color: effectiveTextColor
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                        </svg>
                        Bonusy ({currentFolderItem.bonuses.length})
                      </button>
                      <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[200px]">
                        {currentFolderItem.bonuses.map(bonus => (
                          <a
                            key={bonus.id}
                            href={bonus.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                          >
                            {bonus.label || 'Bonus'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-4">
                <FilterDropdown 
                  activeFilter={activeFilter}
                  activeFilterLabel={activeFilterLabel}
                  counts={activeFilterCount}
                  allStats={currentViewStats}
                  totalCount={totalCurrentViewCount}
                  onSelect={setActiveFilter}
                  variant="transparent"
                  textColor={effectiveTextColor}
                />
                
                {/* Global view type toggle - only show if folder has subfolders */}
                {hasSubfolders && (() => {
                  const tc = effectiveTextColor;
                  const isDark = tc && tc !== '#ffffff' && tc !== '#fff';
                  return (
                    <div 
                      className="flex items-center gap-1 backdrop-blur-sm rounded-lg p-1"
                      style={{ backgroundColor: tc ? `${tc}1a` : 'rgba(255,255,255,0.1)' }}
                    >
                       <button
                          onClick={() => setGlobalViewType('list')}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                             globalViewType === 'list' 
                               ? 'shadow-sm' 
                               : ''
                          }`}
                          style={{
                            backgroundColor: globalViewType === 'list' ? (tc || '#ffffff') : 'transparent',
                            color: globalViewType === 'list' ? (isDark ? '#ffffff' : '#1e293b') : (tc ? `${tc}b3` : 'rgba(255,255,255,0.7)')
                          }}
                          title="Seskupený seznam"
                       >
                          <List className="w-4 h-4" />
                       </button>
                       <button
                          onClick={() => setGlobalViewType('cards')}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                             globalViewType === 'cards' 
                               ? 'shadow-sm' 
                               : ''
                          }`}
                          style={{
                            backgroundColor: globalViewType === 'cards' ? (tc || '#ffffff') : 'transparent',
                            color: globalViewType === 'cards' ? (isDark ? '#ffffff' : '#1e293b') : (tc ? `${tc}b3` : 'rgba(255,255,255,0.7)')
                          }}
                          title="Náhledy karet"
                       >
                          <LayoutGrid className="w-4 h-4" />
                       </button>
                  </div>
                  );
                })()}
              </div>
            </div>
            {currentFolderItem.coverImage && (
              <div className="absolute right-0 bottom-0 h-full w-1/3 flex items-end justify-end pointer-events-none">
                <img 
                  src={currentFolderItem.coverImage} 
                  alt="" 
                  className="max-h-[120%] object-contain origin-bottom-right"
                />
              </div>
            )}
          </div>
        );
      })() : (
        <div className="flex items-center gap-4 mb-6 pl-8">
           <h1 className="text-[48px] font-normal text-[#4e5871] tracking-wide" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
             {currentTitle}
           </h1>
        </div>
      )}

      {/* OVERVIEW MODE IMPLEMENTATION - Use FolderSection for nested overview folders */}
      {showOverview ? (
        <div className="pb-20 pl-8">
           {(() => {
              // Check if children are subfolders with their own children, or direct documents
              const subFoldersWithChildren = currentItems.filter(item => {
                 const isFolder = isItemFolder(item);
                 return isFolder && item.children && item.children.length > 0;
              });
              
              const hasSubFolders = subFoldersWithChildren.length > 0;
              const basePath = isAdmin ? '/admin' : '/docs';
              const parentPath = folderSlug ? `${folderSlug}/` : '';
              
              // If children are SUBFOLDERS with their own children
              if (hasSubFolders) {
                 // NESTED FOLDER + CARDS MODE: Show subfolders as RichFolderCards directly
                 if (isNestedFolder && globalViewType === 'cards') {
                    const inheritedColor = currentFolderItem?.color || findParentColor(menu, currentFolderItem?.slug || currentFolderItem?.id || '', null) || firstFolderColor;
                    const inheritedTextColor = currentFolderItem?.textColor || findParentTextColor(menu, currentFolderItem?.slug || currentFolderItem?.id || '', null);
                    
                    return (
                       <div className="flex flex-wrap gap-12 gap-y-16">
                          {subFoldersWithChildren.map((item) => (
                             <RichFolderCard 
                                key={item.id}
                                item={item} 
                                inheritedColor={inheritedColor}
                                parentTextColor={inheritedTextColor}
                                onClick={() => {
                                   const target = item.slug || item.id;
                                   if (target) {
                                      navigate(`${basePath}/${category}/${parentPath}${target}`);
                                   }
                                }}
                                onFilterClick={(e, type, count) => {
                                   e.stopPropagation();
                                   const matches = findMatchingItems(item.children || [], type);
                                   
                                   if (count === 1 || matches.length === 1) {
                                      const match = matches[0];
                                      if (match) {
                                         if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(match.type || '')) {
                                            if (match.externalUrl && handleExternalUrl(match.externalUrl, navigate)) return;
                                            if (tryNavigateToBoard(match.slug, navigate)) return;
                                         }
                                         const pathSegments = findPathToItem(item.children || [], match.id);
                                         if (pathSegments) {
                                            navigate(`${basePath}/${category}/${parentPath}${item.slug}/${pathSegments.join('/')}`);
                                            return;
                                         }
                                      }
                                   }
                                   const target = item.slug || item.id;
                                   if (target) {
                                      navigate(`${basePath}/${category}/${parentPath}${target}`, { state: { filter: type } });
                                   }
                                }}
                             />
                          ))}
                       </div>
                    );
                 }
                 
                 // ROOT BOOK FOLDER or LIST MODE: Use FolderSection for each subfolder
                 return (
                    <>
                       {subFoldersWithChildren.map((item, idx) => (
                          <FolderSection 
                             key={item.id}
                             folder={item}
                             navigate={navigate}
                             basePath={basePath}
                             category={category}
                             isAdmin={isAdmin}
                             initialFilter={activeFilter}
                             viewType={globalViewType}
                             parentTitle={currentTitle}
                             sectionIndex={idx}
                             totalSections={subFoldersWithChildren.length}
                             onFilterClick={(e, type, slug) => {
                                e.stopPropagation();
                                const matches = findMatchingItems(item.children || [], type);
                                
                                if (matches.length === 1) {
                                   const match = matches[0];
                                   if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(match.type || '')) {
                                      if (match.externalUrl && handleExternalUrl(match.externalUrl, navigate)) return;
                                      if (tryNavigateToBoard(match.slug, navigate)) return;
                                   }
                                   const pathSegments = findPathToItem(item.children || [], match.id);
                                   if (pathSegments) {
                                      navigate(`${basePath}/${category}/${parentPath}${slug}/${pathSegments.join('/')}`);
                                      return;
                                   }
                                }
                                navigate(`${basePath}/${category}/${parentPath}${slug}`, { state: { filter: type } });
                             }}
                             parentSlug={folderSlug}
                          />
                       ))}
                    </>
                 );
              }
              
              // If children are DIRECT DOCUMENTS (no subfolders), use Grouped Pill View
              // Group items by type
              const groupedItems = currentItems.reduce((acc, item) => {
                 let type = item.type;
                 const hasChildren = item.children && item.children.length > 0;
                 const isFolder = item.type === 'group' || item.type === 'folder' || (Array.isArray(item.children) && item.children.length > 0);
                 
                 // Logic to normalize type (same as in STANDARD GRID VIEW)
                 if (type === 'workbook' || item.icon === 'book' || item.icon === 'workbook') type = 'workbook';
                 else if (type === 'worksheet' || item.icon === 'file-edit') type = 'worksheet';
                 else if (type === 'textbook') type = 'textbook';
                 else if (type === 'experiment') type = 'experiment';
                 else if (type === 'methodology') type = 'methodology';
                 else if (type === 'test') type = 'test';
                 else if (type === 'exam') type = 'exam';
                 else if (type === 'exercise' || type === 'practice') type = 'practice';
                 else if (type === 'interactive') type = 'interactive';
                 else if (type === 'bonus') type = 'bonus';
                 else if (type === 'ucebni-text') type = 'ucebni-text';
                 else if (isFolder) type = 'folder';
                 else if ((!type) || type === 'lesson' || type === 'document' || item.icon === 'message-square') type = 'lesson';
                 
                 if (type) {
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(item);
                 }
                 return acc;
              }, {} as Record<string, MenuItem[]>);

              // Order keys: Textbook, Lesson, then others from CONTENT_TYPES, then Folder
              const typesToRender = [
                 'textbook', 
                 'ucebni-text',
                 'lesson', 
                 'worksheet', 
                 'experiment', 
                 'methodology', 
                 'practice', 
                 'interactive',
                 'test', 
                 'exam',
                 'bonus',
                 'folder'
              ];

              // Filter to only types that have items AND match the active filter
              const activeTypes = typesToRender.filter(typeId => {
                 if (!groupedItems[typeId]?.length) return false;
                 // If filter is active, only show the matching type
                 if (activeFilter !== 'all') {
                    return typeId === activeFilter;
                 }
                 return true;
              });

              // Helper to extract difficulty level from item name (1, 2, 3 at the end)
              const extractLevel = (label: string): number => {
                 const match = label.match(/\s+(\d)$/);
                 return match ? parseInt(match[1]) : 0;
              };

              // Special rendering for practice filter - group by difficulty level
              if (activeFilter === 'practice' && groupedItems['practice']?.length > 0) {
                 const practiceItems = groupedItems['practice'];
                 
                 // Group by level
                 const level1 = practiceItems.filter(item => extractLevel(item.label) === 1);
                 const level2 = practiceItems.filter(item => extractLevel(item.label) === 2);
                 const level3 = practiceItems.filter(item => extractLevel(item.label) === 3);
                 const noLevel = practiceItems.filter(item => extractLevel(item.label) === 0);

                 const levelGroups = [
                    { level: 1, items: level1, label: 'Úroveň 1', color: 'bg-amber-50 border-amber-200', badge: 'bg-amber-400' },
                    { level: 2, items: level2, label: 'Úroveň 2', color: 'bg-cyan-50 border-cyan-200', badge: 'bg-cyan-400' },
                    { level: 3, items: level3, label: 'Úroveň 3', color: 'bg-rose-50 border-rose-200', badge: 'bg-rose-400' },
                 ].filter(g => g.items.length > 0);

                 return (
                    <div className="space-y-8">
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {levelGroups.map(group => (
                             <div key={group.level} className={`rounded-2xl border p-5 ${group.color}`}>
                                <div className="flex items-center gap-2 mb-4">
                                   <div className={`w-7 h-7 rounded-full ${group.badge} flex items-center justify-center text-white font-bold text-sm`}>
                                      {group.level}
                                   </div>
                                   <h3 className="text-lg font-bold text-slate-700" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                                      {group.label}
                                   </h3>
                                </div>
                                <div className="flex flex-col gap-2">
                                   {group.items.map(item => (
                                      <PillCard
                                        key={item.id}
                                        item={item}
                                        showLevel={true}
                                        onClick={() => {
                                           if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                           if (tryNavigateToBoard(item.slug, navigate)) return;
                                           if (item.slug) {
                                              navigate(`${basePath}/${category}/${parentPath}${item.slug}`);
                                           } else if (item.id) {
                                              navigate(`${basePath}/${category}/${parentPath}${item.id}`);
                                           }
                                        }}
                                      />
                                   ))}
                                </div>
                             </div>
                          ))}
                       </div>
                       {/* Items without level number */}
                       {noLevel.length > 0 && (
                          <div>
                             <h3 className="text-lg font-bold text-slate-700 mb-3" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                                Ostatní procvičování
                             </h3>
                             <div className="flex flex-wrap gap-2">
                                {noLevel.map(item => (
                                   <PillCard
                                     key={item.id}
                                     item={item}
                                     onClick={() => {
                                        if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                        if (tryNavigateToBoard(item.slug, navigate)) return;
                                        if (item.slug) {
                                           navigate(`${basePath}/${category}/${parentPath}${item.slug}`);
                                        } else if (item.id) {
                                           navigate(`${basePath}/${category}/${parentPath}${item.id}`);
                                        }
                                     }}
                                   />
                                ))}
                             </div>
                          </div>
                       )}
                    </div>
                 );
              }

              return (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8" style={{ rowGap: '100px' }}>
                    {activeTypes.map(typeId => {
                       const items = groupedItems[typeId];
                       const typeLabel = CONTENT_TYPES.find(t => t.id === typeId)?.label || (typeId === 'folder' ? 'Složky a témata' : typeId);
                       
                       return (
                          <div key={typeId}>
                             <h3 className="text-lg font-bold text-slate-700 mb-3" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                                {typeLabel}
                             </h3>
                             <div className="flex flex-col gap-2 items-start">
                                {items.map(item => (
                                   <PillCard
                                     key={item.id}
                                     item={item}
                                     onClick={() => {
                                        if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(item.type || '')) {
                                           if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                           if (tryNavigateToBoard(item.slug, navigate)) return;
                                        }
                                        if (item.slug) {
                                           navigate(`${basePath}/${category}/${parentPath}${item.slug}`);
                                        } else if (item.id) {
                                           navigate(`${basePath}/${category}/${parentPath}${item.id}`);
                                        }
                                     }}
                                   />
                                ))}
                             </div>
                          </div>
              );
           })}
                 </div>
              );
           })()}
           
           {/* Then render remaining items (non-overview folders and documents) in a single flex container */}
           {(() => {
              // Check if we already rendered grouped pill view (when no subfolders)
              const subFoldersWithChildren = currentItems.filter(item => {
                 const isFolder = isItemFolder(item);
                 return isFolder && item.children && item.children.length > 0;
              });
              
              // If we rendered grouped pill view, don't render remaining items again
              if (subFoldersWithChildren.length === 0) return null;
              
              const regularItems = currentItems.filter(item => {
                 const isFolder = isItemFolder(item);
                 // Exclude items that are overview folders (they're rendered above)
                 return !(isFolder && item.children && item.children.length > 0);
              });
              
              if (regularItems.length === 0) return null;
              
              const basePath = isAdmin ? '/admin' : '/docs';
              const parentPath = folderSlug ? `${folderSlug}/` : '';
              const inheritedColor = currentFolderItem?.color || firstFolderColor;
              const inheritedTextColor = currentFolderItem?.textColor;
              
              return (
                 <div className="flex flex-wrap gap-12 gap-y-16">
                    {regularItems.map(item => {
                       const isFolder = isItemFolder(item);
                       
                       if (!isFolder) {
                          return (
                            <DocumentCard
                              key={item.id}
                              item={item}
                              onClick={() => {
                                 if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(item.type || '')) {
                                    if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                    if (tryNavigateToBoard(item.slug, navigate)) return;
                                 }
                                 if (item.slug) {
                                    navigate(`${basePath}/${category}/${parentPath}${item.slug}`);
                                 }
                              }}
                            />
                          );
                       }
                       
                       const showRichCard = item.coverImage && item.viewMode !== 'classic';
                       
                       if (showRichCard) {
                          return (
                            <RichFolderCard 
                              key={item.id}
                              item={item} 
                              inheritedColor={inheritedColor}
                              parentTextColor={inheritedTextColor}
                              onClick={() => {
                                 const target = item.slug || item.id;
                                 if (target) {
                                    navigate(`${basePath}/${category}/${parentPath}${target}`);
                                 }
                              }}
                              onFilterClick={(e, type, count) => {
                                 e.stopPropagation();
                                 const matches = findMatchingItems(item.children || [], type);
                                 
                                 // Auto-open if only 1 item matches (either count === 1 or matches.length === 1)
                                 if (count === 1 || matches.length === 1) {
                                    const match = matches[0];
                                    if (match) {
                                       if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(match.type || '')) {
                                        if (match.externalUrl && handleExternalUrl(match.externalUrl, navigate)) return;
                                        if (tryNavigateToBoard(match.slug, navigate)) return;
                                    }
                                    const pathSegments = findPathToItem(item.children || [], match.id);
                                    if (pathSegments) {
                                       navigate(`${basePath}/${category}/${parentPath}${item.slug}/${pathSegments.join('/')}`);
                                       return;
                                       }
                                    }
                                 }
                                 navigate(`${basePath}/${category}/${parentPath}${item.slug}`, { state: { filter: type } });
                              }}
                            />
                          );
                       } else {
                          return (
                            <FolderCard 
                              key={item.id}
                              item={item} 
                              inheritedColor={inheritedColor}
                              onClick={() => {
                                 const target = item.slug || item.id;
                                 if (target) {
                                    navigate(`${basePath}/${category}/${parentPath}${target}`);
                                 }
                              }} 
                            />
                          );
                       }
                    })}
                 </div>
              );
           })()}
        </div>
      ) : (
        <>
          {/* STANDARD GRID VIEW */}
          
          {/* Filter Warning if empty */}
          {activeFilter !== 'all' && mainContentItems.length === 0 && (activeFilter !== 'workbook' || workbooks.length === 0) && (
            <div className="text-center py-10">
              <p className="text-lg text-slate-500">Pro vybraný filtr nebyl nalezen žádn�� obsah.</p>
              <button 
                onClick={() => setActiveFilter('all')}
                className="mt-4 text-blue-500 hover:underline"
              >
                Zobrazit v��e
              </button>
            </div>
          )}

          {/* Main Content Section (Folders + Pages) */}
          {mainContentItems.length > 0 && (
            <div className="mb-10 pl-8">
              {!isSubFolder && (
                <div className="flex items-start gap-3 mb-4">
                  <List className="w-6 h-6 text-[#4e5871] mt-1" />
                  <div>
                    <h2 className="text-[28px] font-normal text-[#4e5871] leading-tight tracking-wide" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>Digitální učebnice</h2>
                    <p className="text-[15px] text-[#50586f] mt-1 tracking-wide" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>Řazení podle témat</p>
                  </div>
                </div>
              )}

              {/* Conditional Rendering based on Level */}
              {isSubFolder ? (
                /* Grouped Pill View for Subfolders - 3 Column Layout */
                <div>
                  {(() => {
                    // Group items by type
                    const groupedItems = mainContentItems.reduce((acc, item) => {
                      let type = item.type;
                      const hasChildren = item.children && item.children.length > 0;
                      const isFolder = item.type === 'group' || item.type === 'folder' || (Array.isArray(item.children) && item.children.length > 0);
                      
                      // Logic to normalize type (similar to calculateAllStats)
                      if (type === 'workbook' || item.icon === 'book' || item.icon === 'workbook') type = 'workbook';
                      else if (type === 'worksheet' || item.icon === 'file-edit') type = 'worksheet';
                      else if (type === 'textbook') type = 'textbook';
                      else if (type === 'experiment') type = 'experiment';
                      else if (type === 'methodology') type = 'methodology';
                      else if (type === 'test') type = 'test';
                      else if (type === 'exam') type = 'exam';
                      else if (type === 'exercise' || type === 'practice') type = 'practice';
                      else if (type === 'interactive') type = 'interactive';
                      else if (type === 'bonus') type = 'bonus';
                      else if (type === 'ucebni-text') type = 'ucebni-text';
                      else if (isFolder) type = 'folder';
                      else if ((!type) || type === 'lesson' || type === 'document' || item.icon === 'message-square') type = 'lesson';
                      
                      if (type) {
                         if (!acc[type]) acc[type] = [];
                         acc[type].push(item);
                      }
                      return acc;
                    }, {} as Record<string, MenuItem[]>);

                    // Order keys: Textbook, Lesson, then others from CONTENT_TYPES, then Folder
                    const typesToRender = [
                       'textbook', 
                       'ucebni-text',
                       'lesson', 
                       'worksheet', 
                       'experiment', 
                       'methodology', 
                       'practice', 
                       'interactive',
                       'test', 
                       'exam',
                       'bonus',
                       'folder'
                    ];

                    // Filter to only types that have items
                    const activeTypes = typesToRender.filter(typeId => groupedItems[typeId]?.length > 0);

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8" style={{ rowGap: '100px' }}>
                        {activeTypes.map(typeId => {
                          const items = groupedItems[typeId];
                          const typeLabel = CONTENT_TYPES.find(t => t.id === typeId)?.label || (typeId === 'folder' ? 'Složky a témata' : typeId);
                          
                          return (
                            <div key={typeId}>
                              <h3 className="text-lg font-bold text-slate-700 mb-3" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                                {typeLabel}
                              </h3>
                              <div className="flex flex-col gap-2 items-start">
                                {items.map(item => (
                                  <PillCard
                                    key={item.id}
                                    item={item}
                                    onClick={() => {
                                      const basePath = isAdmin ? '/admin' : '/docs';
                                      
                                      if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(item.type || '')) {
                                        if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                        if (tryNavigateToBoard(item.slug, navigate)) return;
                                      }

                                      const target = item.slug || item.id;
                                      if (target) {
                                        const parentPath = folderSlug ? `${folderSlug}/` : '';
                                        navigate(`${basePath}/${category}/${parentPath}${target}`);
                                      }
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Standard Grid View for Root Level (Subjects) */
                <div className="flex flex-wrap gap-12 gap-y-16">
                  {mainContentItems.map(item => {
                     const isFolder = isItemFolder(item);
                     const basePath = isAdmin ? '/admin' : '/docs';
                     const parentPath = folderSlug ? `${folderSlug}/` : '';
                     
                     // At root level, show ALL folders as cards (no expansion)
                     // Overview expansion only happens when you enter that folder
                     
                     if (!isFolder) {
                        return (
                          <DocumentCard
                            key={item.id}
                            item={item}
                            onClick={() => {
                               if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(item.type || '')) {
                                  if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                  if (tryNavigateToBoard(item.slug, navigate)) return;
                               }

                               if (item.slug) {
                                  navigate(`${basePath}/${category}/${parentPath}${item.slug}`);
                               }
                            }}
                          />
                        );
                     }

                     const showRichCard = item.coverImage && item.viewMode !== 'classic';
                     const inheritedColor = currentFolderItem?.color;
                     const inheritedTextColor = currentFolderItem?.textColor;

                     if (showRichCard) {
                        return (
                          <RichFolderCard 
                            key={item.id} 
                            item={item} 
                            inheritedColor={inheritedColor}
                            parentTextColor={inheritedTextColor}
                            onClick={() => {
                               if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(item.type || '')) {
                                  if (item.externalUrl && handleExternalUrl(item.externalUrl, navigate)) return;
                                  if (tryNavigateToBoard(item.slug, navigate)) return;
                               }

                               const target = item.slug || item.id;
                               if (target) {
                                  navigate(`${basePath}/${category}/${parentPath}${target}`);
                               }
                            }}
                            onFilterClick={(e, type, count) => {
                               e.stopPropagation();
                               
                               // Check for single item match to auto-open
                               const matches = findMatchingItems(item.children || [], type);
                               
                               if (count === 1 || matches.length === 1) {
                                  const match = matches[0];
                                  if (match) {
                                  // Check for external link or board
                                     if (['practice', 'test', 'exam', 'interactive', 'bonus'].includes(match.type || '')) {
                                      if (match.externalUrl && handleExternalUrl(match.externalUrl, navigate)) return;
                                      if (tryNavigateToBoard(match.slug, navigate)) return;
                                     }
                                     // Navigate directly to the item
                                     const pathSegments = findPathToItem(item.children || [], match.id);
                                     if (pathSegments) {
                                        navigate(`${basePath}/${category}/${parentPath}${item.slug}/${pathSegments.join('/')}`);
                                        return;
                                     }
                                  }
                               }

                               const target = item.slug || item.id;
                               if (target) {
                                  navigate(`${basePath}/${category}/${parentPath}${target}`, { state: { filter: type } });
                               }
                            }}
                          />
                        );
                     } else {
                        return (
                          <FolderCard 
                            key={item.id} 
                            item={item} 
                            inheritedColor={inheritedColor}
                            onClick={() => {
                               const target = item.slug || item.id;
                               if (target) {
                                  navigate(`${basePath}/${category}/${parentPath}${target}`);
                               }
                            }} 
                          />
                        );
                     }
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Workbooks Section - Always show unless specifically filtered out? 
          For now, showing them below, assuming filter affects them only if integrated.
          Since user requested "Filter", usually it means "Filter Everything".
          But workbooks are in a separate array.
      */}
      {workbooks.length > 0 && (activeFilter === 'all' || activeFilter === 'workbook') && (
        <div className="pl-8">
           <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <svg viewBox="0 0 37 33" className="w-12 h-12 text-[#4e5871] mt-1" fill="currentColor" preserveAspectRatio="xMidYMid meet">
                <path d="M34.2 15.7C34.4 15.2 34.7 14.4 34.2 13.4C34.2 13.3 34.2 13.2 34.2 13.2L28.1 2.9C27.4 1.9 26.4 1.5 25 1.5C23.6 1.5 24.3 1.5 24 1.5C20.6 1.8 17.2 3.7 15.1 6.3C15.1 6.4 14.9 6.5 14.9 6.7C14.5 6.5 14 6.5 13.7 6.4C13.7 6.4 13.7 6.4 13.6 6.4C13.1 6.4 12.5 6.3 11.9 6.3C11.6 6.3 11.2 6.3 10.9 6.3C8.2 6.5 5.6 7.6 3.4 9.5C3.4 9.5 3.4 9.5 3.3 9.6C3 9.9 2.6 10.2 2.3 10.6C1.6 11.5 1.6 12.3 1.7 12.9V13.1L1.8 13.3L2.1 13.9C1.8 14.1 1.6 14.5 1.6 14.8C1.6 14.8 1.6 14.9 1.6 15L8.7 29.8C9 30.3 9.4 30.6 10 30.5C10.4 30.5 11.6 29.2 12 28.8C14.6 26.7 18 25.7 21.3 25.8C21.4 25.8 21.5 25.8 21.6 25.8C21.6 25.8 21.8 25.8 21.9 25.8C21.9 25.8 21.9 25.8 22 25.8C22.2 25.8 22.4 25.8 22.6 25.8C22.7 25.8 22.8 25.8 23 25.8C23.5 25.9 24 25.1 24.3 24.8C26.1 23.2 28.6 22.5 30.9 22.3C31.5 22.3 32.9 22.5 32.7 21.4C32.7 21.1 31.4 19.4 31.5 19.3C31.9 19.1 33.6 19.3 33.9 19.1C33.9 19.1 34.1 18.8 34.1 18.3C34.1 17.9 33.6 17.2 33.2 16.7C33.6 16.5 33.9 16.2 34.2 15.7ZM4.4 10.7C6.2 9.1 8.5 8.1 10.9 8C11.2 8 11.5 8 11.7 8C12.2 8 12.7 8 13.2 8C13.7 8 14.3 8.1 14.6 8.5L21.4 21.8C21.4 21.8 21.4 21.9 21.4 22C21.4 22.3 21.4 22.5 21 22.5C20.2 22.5 19.2 22.2 18.3 22.1C18 22.1 17.7 22.1 17.4 22.1C15.3 22.1 13.1 22.5 11.3 23.5C10.7 23.8 10.1 24.4 9.5 24.4C8.9 24.4 9 24.3 8.8 24L3.2 12.4C3.2 12 3.3 11.7 3.6 11.4C3.8 11.1 4.1 10.9 4.4 10.7ZM30.6 15.8C28.4 16.5 26.3 18.1 24.7 19.7C24.2 20.2 24.2 20.7 23.8 21.1C23.7 21.2 23.6 21.3 23.5 21.3C23.4 21.3 23.4 21.3 23.3 21.3C22.9 20.7 16 7.6 16.3 7.2C18.1 4.9 21.1 3.3 24 3C24.3 3 24.6 3 24.9 3C25.6 3 26.2 3.1 26.6 3.7L32.7 14C32.8 14.3 32.8 14.5 32.7 14.7C32.5 15.4 31.3 15.5 30.5 15.7L30.6 15.8Z" />
              </svg>
              <div>
                <h2 className="text-[28px] font-normal text-[#4e5871] leading-tight tracking-wide" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>Pracovní sešity</h2>
                <p className="text-[15px] text-[#50586f] mt-1 tracking-wide" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>Řazení podle stran</p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 bg-[#dee4f1] px-4 py-2 rounded-full text-[#50586f] text-sm cursor-pointer hover:bg-[#d0d9e8] transition-colors tracking-wide" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
              <span>Řada: Krok za krokem</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
          </div>

          <div className="flex flex-wrap gap-12 gap-y-16">
             {workbooks.map(workbook => (
              <WorkbookCard 
                key={workbook.id} 
                item={workbook} 
                onClick={() => {
                  const basePath = isAdmin ? '/admin' : '/docs';
                  // Use slug if available, otherwise use id (for workbooks without dedicated pages)
                  const target = workbook.slug || workbook.id;
                  if (target) {
                    const parentPath = folderSlug ? `${folderSlug}/` : '';
                    navigate(`${basePath}/${category}/${parentPath}${target}`);
                  }
                }} 
              />
            ))}
          </div>
        </div>
      )}

      {mainContentItems.length === 0 && workbooks.length === 0 && activeFilter === 'all' && (
        <div className="text-center py-20 text-gray-400 tracking-wide" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
           <p>V této složce nejsou žádné položky.</p>
        </div>
      )}
    </div>
  );
}
