import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ChevronDown, 
  ChevronRight,
  FileText,
  SlidersHorizontal,
  Palette,
  Bookmark,
  MessageSquare,
  Zap,
  Info,
  HelpCircle,
  User,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { 
  QuizSlide, 
  InfoSlide, 
  SlideLayoutType, 
  createSlideLayout, 
  SLIDE_TEMPLATES, 
  SlideTemplate, 
  getTemplateById,
} from '../../../types/quiz';
import { SLIDE_TYPES, SlideTypeOption } from '../slide-types';
import { BackgroundPicker } from './BackgroundPicker';
import { getContrastColor } from '../../../utils/color-utils';

const ColorIcon = ({ className = "w-5 h-5 text-slate-500" }: { className?: string }) => (
  <svg width="21" height="19" viewBox="0 0 21 19" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g>
      <path d="M4.15823 17.3472H0.835443C0.379747 17.3472 0 17.7186 0 18.1644C0 18.6101 0.379747 18.9816 0.835443 18.9816H4.13924C4.59494 18.9816 4.97468 18.6101 4.97468 18.1644C4.97468 17.7186 4.59494 17.3472 4.13924 17.3472H4.15823Z" fill="currentColor"/>
      <path d="M16.6899 0L14.1076 5.99902C14.1076 5.99902 14.1646 5.99902 14.2025 5.99902C15.8734 5.99902 17.3544 6.70479 18.3987 7.80059L20.981 1.78299L16.6709 0.0185728L16.6899 0Z" fill="currentColor"/>
      <path d="M14.2025 7.52197C11.8861 7.52197 10.0063 9.36068 10.0063 11.6266C10.0063 14.3939 9.91138 17.4027 6.70252 17.4213C6.2848 17.4213 5.94302 17.7556 5.94302 18.1828C5.94302 18.6099 6.2848 18.9257 6.70252 18.9443C15.8544 18.9443 18.3987 13.911 18.3987 11.6451C18.3987 9.37925 16.519 7.54055 14.2025 7.54055V7.52197Z" fill="currentColor"/>
    </g>
  </svg>
);

const NoteIcon = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size * (13/6)} 
    viewBox="0 0 6 13" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ height: size }}
  >
    <g clipPath="url(#clip0_note_icon_preview)">
      <path d="M1.91903 5.57928C1.91903 5.19451 1.80615 5.06625 1.5965 5.05021C1.43524 5.05021 1.27398 5.08228 1.11272 5.21054C0.886947 5.40293 0.677305 5.70754 0.661179 5.89993C0.645052 6.09232 0.661179 6.34884 0.596673 6.50916C0.532168 6.62139 0.43541 6.63742 0.354779 6.63742C0.12901 6.62139 0 6.46107 0 6.18852C0 5.06625 0.935326 4.29669 1.8384 3.96001C2.25768 3.79969 2.69309 3.71952 2.96724 3.71952C3.41878 3.71952 3.77356 4.18446 3.77356 4.66544C3.77356 5.17847 3.6768 5.46706 3.30589 7.87192C3.14463 8.898 2.93499 10.0042 2.93499 10.5814C2.93499 10.9501 3.08012 11.1746 3.48328 11.1746C4.01545 11.1746 4.40248 10.3409 4.43473 9.9882C4.46699 9.73168 4.56374 9.58739 4.74113 9.58739C4.93465 9.58739 5.14429 9.76375 5.14429 10.0042C5.14429 10.405 4.88627 11.2227 4.07996 11.848C3.69292 12.1526 3.17688 12.4251 2.54796 12.4251C1.64488 12.4251 1.08046 11.8159 1.08046 11.0143C1.08046 10.2768 1.19335 9.57136 1.532 8.00018C1.79002 6.84585 1.9029 6.02819 1.9029 5.61135L1.91903 5.57928ZM3.30589 0C3.91869 0 4.30572 0.368746 4.30572 0.945913C4.30572 1.65134 3.61229 2.18041 2.88661 2.18041C2.24156 2.18041 1.85453 1.79563 1.85453 1.25053C1.85453 0.480973 2.61246 0 3.28977 0L3.30589 0Z" fill="currentColor"/>
    </g>
    <defs>
      <clipPath id="clip0_note_icon_preview">
        <rect width="5.12817" height="12.3931" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

// Import BoardComment type and functions
import { BoardComment, markSlideCommentsAsRead, deleteComment as deleteBoardComment, addBoardComment } from '../../../utils/supabase/board-comments';
import { Send, Loader2 } from 'lucide-react';

interface PageSettingsPanelProps {
  slide: QuizSlide;
  onClose: () => void;
  onUpdate: (updates: Partial<QuizSlide>) => void;
  onTypeChange?: (typeOption: SlideTypeOption) => void;
  initialSection?: SectionId; // Which section to expand initially
  initialShowActivitiesList?: boolean;
  // Comments functionality
  comments?: BoardComment[];
  boardId?: string;
  onCommentsUpdated?: () => void;
}

type SectionId = 'type' | 'layout' | 'background' | 'chapter' | 'note' | 'comments';

// AccordionSection moved outside to prevent re-creation on each render
interface AccordionSectionProps {
  id: SectionId;
  icon: React.ElementType;
  title: string;
  value: React.ReactNode;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: (id: SectionId) => void;
}

function AccordionSection({ id, icon: Icon, title, value, children, isExpanded, onToggle }: AccordionSectionProps) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-slate-500" />
          <span className="font-medium text-slate-700">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{value}</span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="px-5 pb-4 bg-slate-50/50">
          {children}
        </div>
      )}
    </div>
  );
}

// SVG Layout Icons
export const LayoutIcon = ({ type, size = 'normal' }: { type: string, size?: 'small' | 'normal' }) => {
  const colors = {
    title: '#c7d2fe',   // light indigo
    block1: '#a5b4fc',  // indigo
    block2: '#818cf8',  // darker indigo
    block3: '#6366f1',  // even darker
  };
  
  const svgProps = size === 'small' 
    ? { width: 32, height: 24, viewBox: '0 0 48 36' }
    : { width: 48, height: 36, viewBox: '0 0 48 36' };
  
  switch (type) {
    case 'single':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="44" height="32" rx="2" fill={colors.block1} />
        </svg>
      );
    case 'title-content':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="44" height="8" rx="2" fill={colors.title} />
          <rect x="2" y="12" width="44" height="22" rx="2" fill={colors.block1} />
        </svg>
      );
    case 'title-2cols':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="44" height="8" rx="2" fill={colors.title} />
          <rect x="2" y="12" width="21" height="22" rx="2" fill={colors.block1} />
          <rect x="25" y="12" width="21" height="22" rx="2" fill={colors.block2} />
        </svg>
      );
    case 'title-3cols':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="44" height="8" rx="2" fill={colors.title} />
          <rect x="2" y="12" width="13" height="22" rx="2" fill={colors.block1} />
          <rect x="17" y="12" width="14" height="22" rx="2" fill={colors.block2} />
          <rect x="33" y="12" width="13" height="22" rx="2" fill={colors.block3} />
        </svg>
      );
    case '2cols':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="21" height="32" rx="2" fill={colors.block1} />
          <rect x="25" y="2" width="21" height="32" rx="2" fill={colors.block2} />
        </svg>
      );
    case '3cols':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="13" height="32" rx="2" fill={colors.block1} />
          <rect x="17" y="2" width="14" height="32" rx="2" fill={colors.block2} />
          <rect x="33" y="2" width="13" height="32" rx="2" fill={colors.block3} />
        </svg>
      );
    case 'left-large-right-split':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="28" height="32" rx="2" fill={colors.block1} />
          <rect x="32" y="2" width="14" height="15" rx="2" fill={colors.block2} />
          <rect x="32" y="19" width="14" height="15" rx="2" fill={colors.block3} />
        </svg>
      );
    case 'right-large-left-split':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="14" height="15" rx="2" fill={colors.block1} />
          <rect x="2" y="19" width="14" height="15" rx="2" fill={colors.block2} />
          <rect x="18" y="2" width="28" height="32" rx="2" fill={colors.block3} />
        </svg>
      );
    case 'grid-2x2':
      return (
        <svg {...svgProps}>
          <rect x="2" y="2" width="22" height="15" rx="2" fill={colors.block1} />
          <rect x="26" y="2" width="20" height="15" rx="2" fill={colors.block2} />
          <rect x="2" y="19" width="22" height="15" rx="2" fill={colors.block3} />
          <rect x="26" y="19" width="20" height="15" rx="2" fill={colors.block4 || colors.block1} />
        </svg>
      );
    default:
      return null;
  }
};

const LAYOUTS = [
  { id: 'single', label: 'Přes celou stránku' },
  { id: 'title-content', label: 'Nadpis + obsah' },
  { id: 'title-2cols', label: 'Nadpis + 2 sloupce' },
  { id: 'title-3cols', label: 'Nadpis + 3 sloupce' },
  { id: '2cols', label: '2 sloupce' },
  { id: '3cols', label: '3 sloupce' },
  { id: 'left-large-right-split', label: 'Levý velký' },
  { id: 'right-large-left-split', label: 'Pravý velký' },
  { id: 'grid-2x2', label: 'Mřížka 2x2' },
];

export function PageSettingsPanel({ slide, onClose, onUpdate, onTypeChange, initialSection, initialShowActivitiesList, comments = [], boardId, onCommentsUpdated }: PageSettingsPanelProps) {
  const [expandedSection, setExpandedSection] = useState<SectionId | null>(initialSection || null);
  const [showActivitiesList, setShowActivitiesList] = useState(initialShowActivitiesList || false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  // Filter comments for current slide
  const slideComments = comments.filter(c => c.slide_id === slide.id);
  const unreadCount = slideComments.filter(c => !c.is_read).length;
  
  // Handle adding new comment
  const handleAddComment = async () => {
    if (!boardId || !newCommentContent.trim()) return;
    
    setSubmittingComment(true);
    try {
      const result = await addBoardComment({
        board_id: boardId,
        slide_id: slide.id,
        author_name: 'Autor', // Could be made configurable
        content: newCommentContent.trim(),
      });
      
      if (result) {
        setNewCommentContent('');
        onCommentsUpdated?.();
      }
    } catch (e) {
      console.error('Error adding comment:', e);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Update expanded section when initialSection changes
  useEffect(() => {
    if (initialSection) {
      setExpandedSection(initialSection);
    }
  }, [initialSection]);

  // Update showActivitiesList when initialShowActivitiesList changes
  useEffect(() => {
    setShowActivitiesList(!!initialShowActivitiesList);
  }, [initialShowActivitiesList]);

  const toggleSection = (sectionId: SectionId) => {
    setExpandedSection(prev => prev === sectionId ? null : sectionId);
    if (sectionId !== 'type') setShowActivitiesList(false);
  };

  const getSlideTypeName = () => {
    const typeInfo = SLIDE_TYPES.find(t => 
      t.type === slide.type && 
      (slide.type !== 'activity' || t.activityType === (slide as any).activityType)
    ) || SLIDE_TYPES[0];
    return typeInfo.label;
  };

  const getLayoutName = () => {
    if (slide.type !== 'info') return '-';
    const slideLayout = (slide as InfoSlide).layout;
    const layoutOption = LAYOUTS.find(l => l.id === slideLayout?.type);
    return layoutOption?.label || 'Nadpis + obsah';
  };

  const getBackgroundPreview = () => {
    const bg = (slide as any).slideBackground;
    if (!bg) return 'Bílá';
    if (typeof bg === 'string') return bg;
    if (bg.type === 'color' && bg.color) {
      return (
        <span 
          className="inline-block w-4 h-4 rounded-full border border-slate-300"
          style={{ backgroundColor: bg.color }}
        />
      );
    }
    if (bg.type === 'image') return 'Obrázek';
    return 'Bílá';
  };

  return (
    <div 
      className="flex flex-col overflow-hidden"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '420px',
        height: '100%',
        backgroundColor: 'white',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        zIndex: 999999,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800">Nastavení stránky</h2>
      </div>
      
      {/* Accordion Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* 1. Stránka */}
        <AccordionSection 
          id="type" 
          icon={FileText} 
          title="Stránka" 
          value={getSlideTypeName()}
          isExpanded={expandedSection === 'type'}
          onToggle={toggleSection}
        >
          <div className="space-y-2 pt-2">
            {!showActivitiesList ? (
              <>
                {/* Informace */}
                <button
                  onClick={() => {
                    const infoType = SLIDE_TYPES.find(t => t.id === 'info');
                    if (infoType && onTypeChange) onTypeChange(infoType);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    slide.type === 'info'
                      ? 'border-[#4E5871] bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: slide.type === 'info' ? '#4E587125' : '#4E587115', color: '#4E5871' }}
                  >
                    {SLIDE_TYPES.find(t => t.id === 'info')?.icon}
                  </div>
                  <div className="text-left flex-1">
                    <div className={`font-semibold ${slide.type === 'info' ? 'text-slate-900' : 'text-slate-700'}`}>
                      Informace
                    </div>
                    <div className="text-xs text-slate-500">Text, obrázky, video</div>
                  </div>
                </button>

                {/* Aktivity - opens list */}
                <button
                  onClick={() => setShowActivitiesList(true)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    slide.type === 'activity'
                      ? 'border-[#03CA90] bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: slide.type === 'activity' ? '#03CA9025' : '#03CA9015', color: '#03CA90' }}
                  >
                    {SLIDE_TYPES.find(t => t.type === 'activity')?.icon}
                  </div>
                  <div className="text-left flex-1">
                    <div className={`font-semibold ${slide.type === 'activity' ? 'text-emerald-700' : 'text-slate-700'}`}>
                      Aktivita
                    </div>
                    <div className="text-xs text-slate-500">Interaktivní úkoly</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Nástroje */}
                <button
                  onClick={() => {
                    const toolType = SLIDE_TYPES.find(t => t.type === 'tools');
                    if (toolType && onTypeChange) onTypeChange(toolType);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    slide.type === 'tools'
                      ? 'border-[#FF8158] bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: slide.type === 'tools' ? '#FF815825' : '#FF815815', color: '#FF8158' }}
                  >
                    {SLIDE_TYPES.find(t => t.type === 'tools')?.icon}
                  </div>
                  <div className="text-left flex-1">
                    <div className={`font-semibold ${slide.type === 'tools' ? 'text-orange-700' : 'text-slate-700'}`}>
                      Nástroje
                    </div>
                    <div className="text-xs text-slate-500">Kalkulačka, grafy, stopky</div>
                  </div>
                </button>
              </>
            ) : (
              /* Submenu for activities grouped by category */
              <div className="space-y-6">
                <button
                  onClick={() => setShowActivitiesList(false)}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-2 px-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">Zpět</span>
                </button>
                
                {/* Vyhodnotitelné */}
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-emerald-600 mb-2 px-1 tracking-wider text-left">Aktivity vyhodnotitelné</h4>
                  <div className="space-y-2">
                    {SLIDE_TYPES.filter(t => t.type === 'activity' && t.category === 'evaluable').map((type) => {
                      const isActive = slide.type === 'activity' && (slide as any).activityType === type.activityType;
                      return (
                        <button
                          key={type.id}
                          onClick={() => onTypeChange?.(type)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left ${
                            isActive
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 hover:border-emerald-300 hover:bg-white'
                          }`}
                        >
                          <div 
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: isActive ? `${type.color}25` : `${type.color}15`, color: type.color }}
                          >
                            {type.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold text-sm leading-tight truncate ${isActive ? 'text-emerald-700' : 'text-slate-700'}`}>
                              {type.label}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">{type.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Nevyhodnotitelné */}
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-violet-600 mb-2 px-1 tracking-wider text-left">Nevyhodnotitelné</h4>
                  <div className="space-y-2">
                    {SLIDE_TYPES.filter(t => t.type === 'activity' && t.category === 'non-evaluable').map((type) => {
                      const isActive = slide.type === 'activity' && (slide as any).activityType === type.activityType;
                      return (
                        <button
                          key={type.id}
                          onClick={() => onTypeChange?.(type)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left ${
                            isActive
                              ? 'border-violet-500 bg-violet-50'
                              : 'border-slate-200 hover:border-violet-300 hover:bg-white'
                          }`}
                        >
                          <div 
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: isActive ? `${type.color}25` : `${type.color}15`, color: type.color }}
                          >
                            {type.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold text-sm leading-tight truncate ${isActive ? 'text-violet-700' : 'text-slate-700'}`}>
                              {type.label}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">{type.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Živé */}
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-red-600 mb-2 px-1 tracking-wider text-left">Živé aktivity</h4>
                  <div className="space-y-2">
                    {SLIDE_TYPES.filter(t => t.type === 'activity' && t.category === 'live').map((type) => {
                      const isActive = slide.type === 'activity' && (slide as any).activityType === type.activityType;
                      return (
                        <button
                          key={type.id}
                          onClick={() => onTypeChange?.(type)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left ${
                            isActive
                              ? 'border-red-500 bg-red-50'
                              : 'border-slate-200 hover:border-red-300 hover:bg-white'
                          }`}
                        >
                          <div 
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: isActive ? `${type.color}25` : `${type.color}15`, color: type.color }}
                          >
                            {type.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold text-sm leading-tight truncate ${isActive ? 'text-red-700' : 'text-slate-700'}`}>
                              {type.label}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">{type.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* 3. Rozložení (only for info slides) */}
        {slide.type === 'info' && (
          <AccordionSection 
            id="layout" 
            icon={SlidersHorizontal} 
            title="Rozložení" 
            value={getLayoutName()}
            isExpanded={expandedSection === 'layout'}
            onToggle={toggleSection}
          >
            <div className="space-y-4 pt-2">
              {/* Layout grid - 3 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {LAYOUTS.map((layoutOption) => (
                  <button
                    key={layoutOption.id}
                    onClick={() => {
                      const currentSlide = slide as InfoSlide;
                      const oldBlocks = currentSlide.layout?.blocks || [];
                      const savedBlocks = currentSlide.savedBlocks || [];
                      const newLayout = createSlideLayout(layoutOption.id as SlideLayoutType);
                      
                      // Calculate default contrast color based on slide background
                      const slideBgColor = currentSlide.slideBackground?.type === 'color' 
                        ? currentSlide.slideBackground.color 
                        : '#ffffff';
                      const defaultContrastColor = getContrastColor(slideBgColor || '#ffffff');
                      
                      // Combine old blocks with saved blocks for maximum content preservation
                      const allOldBlocks = [...oldBlocks, ...savedBlocks];
                      
                      // Preserve content from old blocks
                      const updatedBlocks = newLayout.blocks.map((newBlock, index) => {
                        const oldBlock = allOldBlocks[index];
                        if (oldBlock && (oldBlock.content || oldBlock.gallery?.length)) {
                          return {
                            ...newBlock,
                            type: oldBlock.type,
                            content: oldBlock.content,
                            title: oldBlock.title,
                            background: oldBlock.background,
                            textAlign: oldBlock.textAlign,
                            fontSize: oldBlock.fontSize,
                            fontWeight: oldBlock.fontWeight,
                            fontStyle: oldBlock.fontStyle,
                            textDecoration: oldBlock.textDecoration,
                            textColor: oldBlock.textColor || defaultContrastColor, // Use existing or default contrast
                            highlightColor: oldBlock.highlightColor,
                            textOverflow: oldBlock.textOverflow,
                            imageFit: oldBlock.imageFit,
                            imageScale: oldBlock.imageScale,
                            imagePositionX: oldBlock.imagePositionX,
                            imagePositionY: oldBlock.imagePositionY,
                            imageCaption: oldBlock.imageCaption,
                            imageLink: oldBlock.imageLink,
                            gallery: oldBlock.gallery,
                            galleryIndex: oldBlock.galleryIndex,
                            galleryNavType: oldBlock.galleryNavType,
                          };
                        }
                        // For new empty blocks, set default contrast color
                        return {
                          ...newBlock,
                          textColor: defaultContrastColor
                        };
                      });
                      
                      // Save blocks that don't fit in new layout
                      const newSavedBlocks = allOldBlocks
                        .slice(newLayout.blocks.length)
                        .filter(b => b.content || b.gallery?.length);
                      
                      onUpdate({ 
                        layout: { ...newLayout, blocks: updatedBlocks },
                        savedBlocks: newSavedBlocks.length > 0 ? newSavedBlocks : undefined
                      } as any);
                    }}
                    className={`p-2 rounded-lg border-2 flex flex-col items-center transition-all ${
                      (slide as InfoSlide).layout?.type === layoutOption.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <LayoutIcon type={layoutOption.id} />
                    <span className="text-[13px] font-medium text-[#4E5871] mt-1.5 text-center leading-tight px-1">
                      {layoutOption.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Gap and Radius dropdowns - side by side */}
              <div className="flex gap-3 pt-2">
                {/* Gap dropdown */}
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Mezera</label>
                    <select
                      value={(slide as InfoSlide).blockGap ?? getTemplateById((slide as InfoSlide).templateId || '')?.defaultGap ?? 11}
                      onChange={(e) => onUpdate({ blockGap: parseInt(e.target.value) } as any)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                    >
                      <option value={0}>Žádná</option>
                      <option value={4}>Malá (4px)</option>
                      <option value={11}>Střední (11px)</option>
                      <option value={16}>Velká (16px)</option>
                      <option value={24}>Extra (24px)</option>
                    </select>
                </div>

                {/* Border radius dropdown */}
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Zakulacení</label>
                  <select
                    value={(slide as InfoSlide).blockRadius ?? getTemplateById((slide as InfoSlide).templateId || '')?.defaultRadius ?? 8}
                    onChange={(e) => onUpdate({ blockRadius: parseInt(e.target.value) } as any)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                  >
                    <option value={0}>Žádné</option>
                    <option value={4}>Malé (4px)</option>
                    <option value={8}>Střední (8px)</option>
                    <option value={16}>Velké (16px)</option>
                    <option value={24}>Extra (24px)</option>
                  </select>
                </div>
              </div>
            </div>
          </AccordionSection>
        )}

        {/* 4. Barva pozadí a Šablona */}
        <AccordionSection 
          id="background" 
          icon={ColorIcon} 
          title="Barva pozadí" 
          value={
            <div className="flex items-center gap-2">
              {slide.type === 'info' && (slide as InfoSlide).templateId && (
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight mr-1">
                  Šablona
                </span>
              )}
              {getBackgroundPreview()}
            </div>
          }
          isExpanded={expandedSection === 'background'}
          onToggle={toggleSection}
        >
          <div className="pt-2 space-y-6">
            <BackgroundPicker
              value={(slide as any).slideBackground || { type: 'color', color: '#ffffff' }}
              onChange={(bg) => {
                const updates: Partial<QuizSlide> = { slideBackground: bg } as any;
                
                // If it's a color background, auto-update text color for all blocks in info slides
                if (bg.type === 'color' && bg.color && slide.type === 'info') {
                  const infoSlide = slide as InfoSlide;
                  if (infoSlide.layout) {
                    const contrastColor = getContrastColor(bg.color);
                    const newBlocks = infoSlide.layout.blocks.map(block => ({
                      ...block,
                      textColor: contrastColor
                    }));
                    (updates as any).layout = {
                      ...infoSlide.layout,
                      blocks: newBlocks
                    };
                  }
                }
                
                onUpdate(updates);
              }}
              onClose={() => {}}
              showUpload={true}
              showOpacity={true}
              showBlur={false}
              inline={true}
            />

            {/* Template dropdown (only for info slides) */}
            {slide.type === 'info' && (
              <div className="pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Šablona</label>
                <select
                  value={(slide as InfoSlide).templateId || ''}
                  onChange={(e) => onUpdate({ templateId: e.target.value || undefined } as any)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                  <option value="">Žádná</option>
                  {SLIDE_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.font})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-2 italic px-1">
                  Šablona nastavuje písmo a výchozí barvy bloků.
                </p>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* 5. Jméno kapitoly */}
        <AccordionSection 
          id="chapter" 
          icon={Bookmark} 
          title="Jméno kapitoly" 
          value={(slide as any).chapterName || '-'}
          isExpanded={expandedSection === 'chapter'}
          onToggle={toggleSection}
        >
          <div className="pt-2">
            <input
              type="text"
              value={(slide as any).chapterName || ''}
              onChange={(e) => onUpdate({ chapterName: e.target.value } as any)}
              placeholder="Např. Úvod do fyziky"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-700"
            />
            <p className="text-xs text-slate-500 mt-2">
              Kapitola pomáhá organizovat slidy do logických celků
            </p>
          </div>
        </AccordionSection>

        {/* 6. Poznámka ke stránce */}
        <AccordionSection 
          id="note" 
          icon={NoteIcon} 
          title="Poznámka ke stránce" 
          value={(slide as any).note ? 'Přidána' : '-'}
          isExpanded={expandedSection === 'note'}
          onToggle={toggleSection}
        >
          <div className="pt-2">
            <textarea
              value={(slide as any).note || ''}
              onChange={(e) => onUpdate({ note: e.target.value } as any)}
              placeholder="Soukromá poznámka pro učitele..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-700 resize-none"
            />
            <p className="text-xs text-slate-500 mt-2">
              Poznámka je viditelná pouze pro učitele, studenti ji neuvidí
            </p>
          </div>
        </AccordionSection>

        {/* 7. Komentáře od návštěvníků */}
        <AccordionSection 
          id="comments" 
          icon={MessageSquare} 
          title="Komentáře" 
          value={
            <span className="flex items-center gap-1.5">
              {slideComments.length || '-'}
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {unreadCount}
                </span>
              )}
            </span>
          }
          isExpanded={expandedSection === 'comments'}
          onToggle={(id) => {
            toggleSection(id);
            // Mark comments as read when opening
            if (id === 'comments' && boardId && unreadCount > 0) {
              markSlideCommentsAsRead(boardId, slide.id).then(() => {
                onCommentsUpdated?.();
              });
            }
          }}
        >
          <div className="pt-2 space-y-3">
            {/* Add new comment form */}
            <div className="space-y-2">
              <textarea
                value={newCommentContent}
                onChange={(e) => setNewCommentContent(e.target.value)}
                placeholder="Napište komentář..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <button
                onClick={handleAddComment}
                disabled={!newCommentContent.trim() || submittingComment}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {submittingComment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Přidat komentář
                  </>
                )}
              </button>
            </div>
            
            {/* Mark all as read button */}
            {unreadCount > 0 && (
              <button
                onClick={async () => {
                  if (boardId) {
                    await markSlideCommentsAsRead(boardId, slide.id);
                    onCommentsUpdated?.();
                  }
                }}
                className="w-full py-2 px-3 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Označit vše jako přečtené
              </button>
            )}
            
            {/* Comments list */}
            {slideComments.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {slideComments.map((comment) => (
                  <div 
                    key={comment.id}
                    className={`p-3 rounded-xl border ${
                      comment.is_read 
                        ? 'bg-white border-slate-200' 
                        : 'bg-indigo-50 border-indigo-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          {comment.author_name || 'Anonymní'}
                        </span>
                        {!comment.is_read && (
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">
                          {new Date(comment.created_at).toLocaleDateString('cs-CZ')}
                        </span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setDeletingCommentId(comment.id);
                            await deleteBoardComment(comment.id);
                            setDeletingCommentId(null);
                            onCommentsUpdated?.();
                          }}
                          disabled={deletingCommentId === comment.id}
                          className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                          title="Smazat komentář"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-slate-400 py-4">
                Žádné komentáře k tomuto slidu
              </p>
            )}
          </div>
        </AccordionSection>
      </div>
    </div>
  );
}

export default PageSettingsPanel;

