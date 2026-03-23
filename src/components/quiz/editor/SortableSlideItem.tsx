import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Copy, Trash2 } from 'lucide-react';
import { QuizSlide } from '../../../types/quiz';
import { SlidePreviewThumbnail } from './SlidePreviewThumbnail';

interface SortableSlideItemProps {
  slide: QuizSlide;
  index: number;
  selectedSlideId: string | null;
  setSelectedSlideId: (id: string) => void;
  multiSelectedIds: string[];
  setMultiSelectedIds: (ids: string[]) => void;
  typeInfo: { icon: React.ReactNode; color: string };
  chapterName?: string;
  chapterCount?: number;
  showSlidePreviews: boolean;
  duplicateSlide: (id: string) => void;
  deleteSlide: (id: string) => void;
  getSlideTitle: (slide: QuizSlide) => string;
}

export function SortableSlideItem({
  slide,
  index,
  selectedSlideId,
  setSelectedSlideId,
  multiSelectedIds,
  setMultiSelectedIds,
  typeInfo,
  chapterName,
  chapterCount,
  showSlidePreviews,
  duplicateSlide,
  deleteSlide,
  getSlideTitle,
}: SortableSlideItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  });

  const isActive = selectedSlideId === slide.id;
  const isMultiSelected = multiSelectedIds.includes(slide.id);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : isActive ? 10 : isMultiSelected ? 5 : 0,
    position: 'relative' as const,
  };

  const handleItemClick = (e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      if (isMultiSelected) {
        setMultiSelectedIds(multiSelectedIds.filter((id) => id !== slide.id));
      } else {
        setMultiSelectedIds([...multiSelectedIds, slide.id]);
      }
    } else {
      setSelectedSlideId(slide.id);
      setMultiSelectedIds([]);
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} data-slide-id={slide.id} className="outline-none">
      {!showSlidePreviews ? (
        <div
          onClick={handleItemClick}
          className={`
            group relative flex flex-col rounded-xl cursor-pointer transition-all border-2
            ${isActive
              ? 'border-indigo-600 ring-1 ring-indigo-600 shadow-xl z-[10] bg-white'
              : isMultiSelected
              ? 'border-blue-400 border-dashed shadow-md z-[5] bg-white'
              : 'border-slate-200 hover:border-indigo-200 hover:shadow-sm z-0 bg-white'
            }
          `}
        >
          {chapterName && (
            <div className="px-3 py-2 flex items-center gap-2.5 bg-transparent border-b border-slate-50">
              <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {chapterCount}
              </div>
              <span className="text-[11px] font-bold truncate text-indigo-700">{chapterName}</span>
            </div>
          )}
          <div className="flex items-center gap-2.5 py-2 px-3">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold w-4 text-center ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                {index + 1}
              </span>
              <div className={`rounded p-1 ${isActive ? 'text-indigo-400 hover:bg-indigo-50' : 'text-slate-300 hover:bg-slate-50'}`}>
                <GripVertical className="w-3 h-3" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                  style={{ color: isActive ? '#4f46e5' : typeInfo.color }}
                >
                  {React.cloneElement(typeInfo.icon as React.ReactElement, { className: 'w-[18px] h-[18px]' })}
                </div>
                <p className={`text-[13px] font-semibold truncate leading-snug ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                  {getSlideTitle(slide) || <span className="text-slate-400 italic font-normal">Bez názvu</span>}
                </p>
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); duplicateSlide(slide.id); }}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
                title="Duplikovat"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                title="Smazat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={handleItemClick}
          className={`
            group relative rounded-xl cursor-pointer transition-all border-2 overflow-hidden
            ${isActive
              ? 'border-indigo-600 ring-1 ring-indigo-600 shadow-2xl z-[10] bg-white'
              : isMultiSelected
              ? 'border-blue-400 border-dashed shadow-lg z-[5] bg-white'
              : 'border-slate-200 hover:border-indigo-300 hover:shadow-md z-0 bg-white'
            }
          `}
        >
          {chapterName && (
            <div className="px-2.5 py-1.5 flex items-center gap-2 border-b border-slate-50 bg-transparent">
              <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {chapterCount}
              </div>
              <span className="text-[10px] font-bold truncate text-indigo-700">{chapterName}</span>
            </div>
          )}
          <div className={`flex items-center gap-2 px-2 py-1.5 border-b ${isActive ? 'bg-indigo-50/30 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`rounded p-0.5 ${isActive ? 'text-indigo-400 hover:bg-indigo-50' : 'text-slate-300 hover:bg-slate-200'}`}>
              <GripVertical className="w-3 h-3" />
            </div>
            <span className={`text-xs font-bold ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>{index + 1}</span>
            <div
              className="w-5 h-5 rounded flex items-center justify-center shrink-0"
              style={{ color: isActive ? '#4f46e5' : typeInfo.color }}
            >
              {React.cloneElement(typeInfo.icon as React.ReactElement, { className: 'w-3.5 h-3.5' })}
            </div>
            <span className={`text-[11px] font-bold flex-1 truncate ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
              {getSlideTitle(slide) || <span className="text-slate-400 italic font-normal">Bez názvu</span>}
            </span>
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); duplicateSlide(slide.id); }}
                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-indigo-600"
                title="Duplikovat"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
                className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
                title="Smazat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded" style={{ aspectRatio: '16/9', width: '100%' }}>
            <SlidePreviewThumbnail slide={slide} />
          </div>
        </div>
      )}
    </div>
  );
}
