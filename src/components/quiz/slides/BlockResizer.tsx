/**
 * BlockResizer
 * 
 * Draggable handle for resizing blocks in slide layouts.
 * Shows a blue line with a handle in the middle.
 * Works for both horizontal (columns) and vertical (rows) resizing.
 */

import React, { useRef, useState, useCallback } from 'react';
import { ArrowLeftRight, ArrowUpDown, Merge } from 'lucide-react';

interface BlockResizerProps {
  direction: 'horizontal' | 'vertical';
  value: number; // Current percentage (0-100)
  onChange: (newValue: number) => void; // Called in realtime during drag
  onSwap?: () => void; // Called when swap button is clicked
  onMerge?: () => void; // Called when merge button is clicked
  min?: number; // Minimum percentage
  max?: number; // Maximum percentage
  snapTo?: number[]; // Snap points (e.g. [50] to snap to 50%)
  snapThreshold?: number; // How close to snap point to trigger snap
  backgroundColor?: string; // Background color to determine line contrast
}

export function BlockResizer({
  direction,
  value,
  onChange,
  onSwap,
  onMerge,
  min = 15,
  max = 85,
  snapTo = [50],
  snapThreshold = 3,
  backgroundColor,
}: BlockResizerProps) {
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState<number | null>(null);

  // Use local value during drag for smooth visuals
  const displayValue = localValue !== null ? localValue : value;

  // Determine if background is light or dark for contrast
  const isLightBackground = useCallback(() => {
    if (!backgroundColor) return true; // Default to light
    // Simple luminance check for hex colors
    const hex = backgroundColor.replace('#', '');
    if (hex.length !== 6) return true;
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }, [backgroundColor]);

  const lineColor = isLightBackground() ? 'rgb(59, 130, 246)' : 'rgb(147, 197, 253)'; // blue-500 or blue-300
  const lineColorHover = isLightBackground() ? 'rgb(37, 99, 235)' : 'rgb(191, 219, 254)'; // blue-600 or blue-200

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

      const roundedValue = Math.round(newValue);
      setLocalValue(roundedValue);
      
      // Call onChange for realtime update
      onChange(roundedValue);
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
        group relative flex items-center justify-center overflow-visible
        ${isHorizontal ? 'w-4 cursor-col-resize' : 'h-4 cursor-row-resize'}
      `}
      style={{
        ...(isHorizontal 
          ? { minWidth: 16, maxWidth: 16, marginLeft: -8, marginRight: -8 } 
          : { minHeight: 16, maxHeight: 16, marginTop: -8, marginBottom: -8 }
        ),
        zIndex: isDragging ? 9999999 : 999999, // Force absolute top using inline style
        position: 'relative',
      }}
    >
      {/* Visible line - goes through center of handle */}
      <div
        className="absolute transition-all shadow-sm"
        style={{
          backgroundColor: isDragging ? lineColorHover : lineColor,
          ...(isHorizontal 
            ? { width: 2, height: '100%', zIndex: 1 } 
            : { width: '100%', height: 2, zIndex: 1 }
          ),
        }}
      />
      
      {/* Handle bubble */}
      <div 
        className={`
          absolute rounded-full transition-all shadow-md
          ${isHorizontal ? 'w-5 h-12' : 'w-12 h-5'}
          ${isDragging ? 'scale-110' : ''}
        `}
        style={{
          backgroundColor: isDragging ? lineColor : 'white',
          border: `2px solid ${isDragging ? lineColorHover : lineColor}`,
          zIndex: 10, // Higher than the line
        }}
      />
      
      {/* Percentage indicator during drag */}
      {isDragging && (
        <div
          className="absolute text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-lg"
          style={{
            backgroundColor: lineColorHover,
            ...(isHorizontal ? { top: -32 } : { left: -48 }),
            zIndex: 20,
          }}
        >
          {displayValue}%
        </div>
      )}

      {/* Swap and Merge buttons - visible on hover */}
      {!isDragging && (onSwap || onMerge) && (
        <div 
          className="absolute opacity-0 group-hover:opacity-100 transition-all flex gap-2"
          style={{
            zIndex: 100,
            ...(isHorizontal 
              ? { left: '50%', top: 'calc(50% + 36px)', transform: 'translateX(-50%)' } 
              : { top: '50%', left: 'calc(50% + 42px)', transform: 'translateY(-50%)' }
            ),
          }}
        >
          {onMerge && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onMerge();
              }}
              className="w-7 h-7 bg-white text-blue-500 rounded-full shadow-lg border-2 border-blue-500 flex items-center justify-center hover:scale-110 transition-transform"
              title="Spojit bloky"
            >
              <Merge className="w-3.5 h-3.5" />
            </button>
          )}

          {onSwap && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSwap();
              }}
              className="w-9 h-9 bg-blue-500 text-white rounded-full shadow-lg border-2 border-white flex items-center justify-center hover:scale-110 transition-transform"
              title="Prohodit bloky"
            >
              {isHorizontal ? (
                <ArrowLeftRight className="w-4.5 h-4.5" />
              ) : (
                <ArrowUpDown className="w-4.5 h-4.5" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default BlockResizer;

