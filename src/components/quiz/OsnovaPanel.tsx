import React, { useState } from 'react';
import { WorksheetMap, QuizSlide } from '../../types/quiz';

export function OsnovaIcon({ active }: { active: boolean }) {
  const color = active ? '#ffffff' : '#4E5871';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 25 22"
      width="22"
      height="20"
      fill={color}
    >
      <path d="M23.2,8.9l-4.1-7h0c-.5-.6-1.2-1-2.1-1s-.5,0-.6,0h0c-2.3.2-4.7,1.5-6.1,3.3,0,0,0,.2-.2.3-.3,0-.6-.2-.8-.2h-1.8c-1.8,0-3.6.9-5,2.1h0c-.2.2-.6.4-.7.6-.6.6-.6,1.3-.6,1.7v.2h0l.2.6h0c-.2.2-.4.6-.3.7h0l4.9,10.1c.2.4.5.6.9.5.3,0,1-.9,1.4-1.1,1.7-1.5,4-2.1,6.3-2h1.2c.4,0,.6-.5.9-.6,1.2-1.1,2.9-1.6,4.5-1.7.4,0,1.4,0,1.2-.6,0-.3-.9-1.4-.8-1.5.3,0,1.5,0,1.7-.2h0v-.6c0-.3-.4-.7-.6-1.1.3-.2.4-.2.6-.7s0-1.7,0-1.7h-.1ZM2.9,7.2c1.2-1.1,2.8-1.7,4.4-1.8h1.6c.3,0,.7,0,.9.4l4.6,9h0c0,.3,0,.4-.3.4s0,0,0,0c-.6,0-1.2-.2-1.8-.3h-.6c-1.5,0-2.9.3-4.1.9s-.8.6-1.2.6-.4,0-.5-.3l-3.7-7.7c0-.3,0-.5.3-.7.2-.2.3-.4.5-.5h0ZM20.7,10.7c-1.5.5-2.9,1.6-4,2.7-.3.4-.4.7-.6,1h-.2s0,0,0,0h0c-.3-.5-5-9.3-4.8-9.5,1.2-1.6,3.2-2.7,5.2-2.8h.6c.5,0,.9,0,1.2.5l4.1,7v.5c0,.6-1,.6-1.5.7h0Z"/>
    </svg>
  );
}

const REGION_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

interface OsnovaPanelProps {
  worksheetMap: WorksheetMap;
  slides: QuizSlide[];
  selectedSlideId: string | null;
  onSlideSelect: (id: string) => void;
  /** Override header top padding (default 160px for editor layout) */
  headerPaddingTop?: number;
}

function getSlideChapterName(slide: QuizSlide): string {
  return (slide as any).chapterName || (slide as any).title || '';
}

export function OsnovaPanel({ worksheetMap, slides, selectedSlideId, onSlideSelect, headerPaddingTop = 160 }: OsnovaPanelProps) {
  const [hoveredSlideIndex, setHoveredSlideIndex] = useState<number | null>(null);
  const [hoveredPageIdx, setHoveredPageIdx] = useState<number | null>(null);

  const selectedSlideIndex = selectedSlideId
    ? slides.findIndex(s => s.id === selectedSlideId)
    : -1;

  return (
    <div className="flex flex-col h-full bg-[#F2F5F9]">

      {/* Pages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col" style={{ gap: 40 }}>
        {worksheetMap.pages.map((page, pageIdx) => (
          <div key={pageIdx}>
            {worksheetMap.pages.length > 1 && (
              <div className="text-xl font-semibold text-slate-400 mb-1.5 px-1">
                Strana {page.pageNumber || pageIdx + 1}
              </div>
            )}

            {/* Thumbnail with clickable regions */}
            <div
              className="relative rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white"
              style={{ aspectRatio: '210 / 297' }}
              onMouseEnter={() => setHoveredPageIdx(pageIdx)}
              onMouseLeave={() => setHoveredPageIdx(null)}
            >
              {page.thumbnailUrl ? (
                <img
                  src={page.thumbnailUrl}
                  alt={`Strana ${pageIdx + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs">
                  Náhled není k dispozici
                </div>
              )}

              {/* Regions */}
              {page.regions.map((region, regionIdx) => {
                if (region.slideIndex < 0 || region.slideIndex >= slides.length) return null;
                const slide = slides[region.slideIndex];
                const isSelected = selectedSlideIndex === region.slideIndex;
                const isHovered = hoveredSlideIndex === region.slideIndex;
                const color = region.color || REGION_COLORS[regionIdx % REGION_COLORS.length];
                // Use original chapterIndex for the badge (so ch7 missing → ch8 still shows "8")
                const badgeLabel = region.chapterIndex ?? (region.slideIndex + 1);
                const chapterName = getSlideChapterName(slide);

                const pageHovered = hoveredPageIdx === pageIdx;
                const visible = isSelected || pageHovered;

                return (
                  <button
                    key={regionIdx}
                    onClick={() => onSlideSelect(slide.id)}
                    onMouseEnter={() => setHoveredSlideIndex(region.slideIndex)}
                    onMouseLeave={() => setHoveredSlideIndex(null)}
                    title={chapterName || `Kapitola ${badgeLabel}`}
                    style={{
                      position: 'absolute',
                      left: `${region.xPct}%`,
                      top: `${region.yPct}%`,
                      width: `${region.wPct}%`,
                      height: `${region.hPct}%`,
                      backgroundColor: isSelected
                        ? `${color}55`
                        : isHovered
                        ? `${color}33`
                        : `${color}18`,
                      border: `2px solid ${color}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'opacity 0.15s, background-color 0.15s',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      padding: '2px 4px',
                      opacity: visible ? 1 : 0,
                      pointerEvents: visible ? 'auto' : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '8px',
                        fontWeight: 700,
                        color: '#fff',
                        backgroundColor: color,
                        borderRadius: '3px',
                        padding: '0 3px',
                        lineHeight: '14px',
                        pointerEvents: 'none',
                        flexShrink: 0,
                      }}
                    >
                      {badgeLabel}
                    </span>
                  </button>
                );
              })}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
