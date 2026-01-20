/**
 * LayoutSelector
 * 
 * Panel for selecting slide layout type.
 * Shows visual previews of each layout option.
 */

import React from 'react';
import { SlideLayoutType } from '../../../types/quiz';

interface LayoutSelectorProps {
  selectedLayout: SlideLayoutType | undefined;
  onSelectLayout: (layout: SlideLayoutType) => void;
}

interface LayoutOption {
  type: SlideLayoutType;
  label: string;
  icon: React.ReactNode;
}

// Visual representations of each layout
function LayoutIcon({ type }: { type: SlideLayoutType }) {
  const baseClass = "w-full h-full rounded-sm";
  const blockClass = "bg-slate-300 rounded-[2px]";
  const titleClass = "bg-slate-400 rounded-[2px]";

  switch (type) {
    case 'single':
      return (
        <div className={`${baseClass} flex p-0.5`}>
          <div className={`${blockClass} flex-1`} />
        </div>
      );

    case 'title-content':
      return (
        <div className={`${baseClass} flex flex-col gap-0.5 p-0.5`}>
          <div className={`${titleClass} h-[20%]`} />
          <div className={`${blockClass} flex-1`} />
        </div>
      );
    
    case 'title-2cols':
      return (
        <div className={`${baseClass} flex flex-col gap-0.5 p-0.5`}>
          <div className={`${titleClass} h-[20%]`} />
          <div className="flex-1 flex gap-0.5">
            <div className={`${blockClass} flex-1`} />
            <div className={`${blockClass} flex-1`} />
          </div>
        </div>
      );
    
    case 'title-3cols':
      return (
        <div className={`${baseClass} flex flex-col gap-0.5 p-0.5`}>
          <div className={`${titleClass} h-[20%]`} />
          <div className="flex-1 flex gap-0.5">
            <div className={`${blockClass} flex-1`} />
            <div className={`${blockClass} flex-1`} />
            <div className={`${blockClass} flex-1`} />
          </div>
        </div>
      );
    
    case '2cols':
      return (
        <div className={`${baseClass} flex gap-0.5 p-0.5`}>
          <div className={`${blockClass} flex-1`} />
          <div className={`${blockClass} flex-1`} />
        </div>
      );
    
    case '3cols':
      return (
        <div className={`${baseClass} flex gap-0.5 p-0.5`}>
          <div className={`${blockClass} flex-1`} />
          <div className={`${blockClass} flex-1`} />
          <div className={`${blockClass} flex-1`} />
        </div>
      );
    
    case 'left-large-right-split':
      return (
        <div className={`${baseClass} flex gap-0.5 p-0.5`}>
          <div className={`${blockClass} w-[60%]`} />
          <div className="w-[40%] flex flex-col gap-0.5">
            <div className={`${blockClass} flex-1`} />
            <div className={`${blockClass} flex-1`} />
          </div>
        </div>
      );
    
    case 'right-large-left-split':
      return (
        <div className={`${baseClass} flex gap-0.5 p-0.5`}>
          <div className="w-[40%] flex flex-col gap-0.5">
            <div className={`${blockClass} flex-1`} />
            <div className={`${blockClass} flex-1`} />
          </div>
          <div className={`${blockClass} w-[60%]`} />
        </div>
      );
    
    case 'grid-2x2':
      return (
        <div className={`${baseClass} flex flex-col gap-0.5 p-0.5`}>
          <div className="flex-1 flex gap-0.5">
            <div className={`${blockClass} flex-1`} />
            <div className={`${blockClass} flex-1`} />
          </div>
          <div className="flex-1 flex gap-0.5">
            <div className={`${blockClass} flex-1`} />
            <div className={`${blockClass} flex-1`} />
          </div>
        </div>
      );
    
    default:
      return null;
  }
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  { type: 'single', label: 'Přes celou stránku', icon: null },
  { type: 'title-content', label: 'Nadpis + obsah', icon: null },
  { type: 'title-2cols', label: 'Nadpis + 2 sloupce', icon: null },
  { type: 'title-3cols', label: 'Nadpis + 3 sloupce', icon: null },
  { type: '2cols', label: '2 sloupce', icon: null },
  { type: '3cols', label: '3 sloupce', icon: null },
  { type: 'left-large-right-split', label: 'Levý velký', icon: null },
  { type: 'right-large-left-split', label: 'Pravý velký', icon: null },
  { type: 'grid-2x2', label: 'Mřížka 2x2', icon: null },
];

export function LayoutSelector({ selectedLayout, onSelectLayout }: LayoutSelectorProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
        Rozložení
      </h3>
      
      <div className="grid grid-cols-2 gap-2">
        {LAYOUT_OPTIONS.map((option) => (
          <button
            key={option.type}
            onClick={() => onSelectLayout(option.type)}
            className={`
              relative p-2 rounded-xl border-2 transition-all
              ${selectedLayout === option.type
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }
            `}
          >
            {/* Layout preview */}
            <div className="aspect-[4/3] w-full bg-slate-100 rounded-lg mb-2 overflow-hidden">
              <LayoutIcon type={option.type} />
            </div>
            
            {/* Label */}
            <span className={`text-[11px] font-semibold leading-tight block ${
              selectedLayout === option.type ? 'text-blue-700' : 'text-[#4E5871]'
            }`}>
              {option.label}
            </span>
            
            {/* Selected indicator */}
            {selectedLayout === option.type && (
              <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default LayoutSelector;

