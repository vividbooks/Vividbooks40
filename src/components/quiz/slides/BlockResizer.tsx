/**
 * BlockResizer
 * 
 * Draggable handle for resizing blocks in slide layouts.
 * Shows a blue line with a handle in the middle.
 * Works for both horizontal (columns) and vertical (rows) resizing.
 */

import React, { useState, useRef, useCallback } from 'react';

interface BlockResizerProps {
  direction: 'horizontal' | 'vertical';
  value: number; // Current percentage (0-100)
  onChange: (newValue: number) => void;
  min?: number; // Minimum percentage
  max?: number; // Maximum percentage
  snapTo?: number[]; // Snap points (e.g. [50] to snap to 50%)
  snapThreshold?: number; // How close to snap point to trigger snap
}

export function BlockResizer({
  direction,
  value,
  onChange,
  min = 15,
  max = 85,
  snapTo = [50],
  snapThreshold = 3,
}: BlockResizerProps) {
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState<number | null>(null);

  // Use local value during drag for smooth visuals
  const displayValue = localValue !== null ? localValue : value;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const container = resizerRef.current?.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerSize = direction === 'horizontal' 
      ? containerRect.width 
      : containerRect.height;
    
    if (containerSize <= 0) return;

    setIsDragging(true);
    setLocalValue(value);

    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const startValue = value;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      const deltaPercent = (delta / containerSize) * 100;
      
      let newValue = startValue + deltaPercent;
      
      // Clamp to min/max
      newValue = Math.max(min, Math.min(max, newValue));
      
      // Snap to points
      for (const snapPoint of snapTo) {
        if (Math.abs(newValue - snapPoint) < snapThreshold) {
          newValue = snapPoint;
          break;
        }
      }

      setLocalValue(Math.round(newValue));
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? upEvent.clientX : upEvent.clientY;
      const delta = currentPos - startPos;
      const deltaPercent = (delta / containerSize) * 100;
      
      let finalValue = startValue + deltaPercent;
      finalValue = Math.max(min, Math.min(max, finalValue));
      
      for (const snapPoint of snapTo) {
        if (Math.abs(finalValue - snapPoint) < snapThreshold) {
          finalValue = snapPoint;
          break;
        }
      }

      onChange(Math.round(finalValue));
      setIsDragging(false);
      setLocalValue(null);
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction, value, min, max, snapTo, snapThreshold, onChange]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      ref={resizerRef}
      onMouseDown={handleMouseDown}
      className={`
        group relative flex items-center justify-center
        ${isHorizontal ? 'w-6 cursor-col-resize' : 'h-6 cursor-row-resize'}
        ${isDragging ? 'z-50' : 'z-10'}
      `}
      style={isHorizontal 
        ? { minWidth: 24, maxWidth: 24 } 
        : { minHeight: 24, maxHeight: 24 }
      }
    >
      {/* Invisible hit area */}
      <div 
        className={`
          absolute 
          ${isHorizontal ? 'w-6 h-full' : 'w-full h-6'}
        `}
      />
      
      {/* Visible line */}
      <div
        className={`
          absolute transition-all
          ${isHorizontal 
            ? 'w-0.5 h-full' 
            : 'w-full h-0.5'
          }
          ${isDragging 
            ? 'bg-blue-500' 
            : 'bg-slate-300 group-hover:bg-blue-400'
          }
        `}
      />
      
      {/* Handle bubble */}
      <div
        className={`
          absolute rounded-full border-2 transition-all
          ${isHorizontal ? 'w-3 h-8' : 'w-8 h-3'}
          ${isDragging 
            ? 'bg-blue-500 border-blue-500 scale-110' 
            : 'bg-white border-slate-300 group-hover:border-blue-400 group-hover:bg-blue-50'
          }
        `}
      />
      
      {/* Percentage indicator during drag */}
      {isDragging && (
        <div
          className={`
            absolute bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap
            ${isHorizontal ? '-top-8' : '-left-12'}
          `}
        >
          {displayValue}%
        </div>
      )}
    </div>
  );
}

export default BlockResizer;

