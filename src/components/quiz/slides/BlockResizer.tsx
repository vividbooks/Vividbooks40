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
  backgroundColor?: string; // Background color to determine line contrast
}

export function BlockResizer({
  direction,
  value,
  onChange,
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
        ${isHorizontal ? 'w-4 cursor-col-resize' : 'h-4 cursor-row-resize'}
        ${isDragging ? 'z-50' : 'z-10'}
      `}
      style={isHorizontal 
        ? { minWidth: 16, maxWidth: 16 } 
        : { minHeight: 16, maxHeight: 16 }
      }
    >
      {/* Visible line - goes through center of handle */}
      <div
        className="absolute transition-all"
        style={{
          backgroundColor: isDragging ? lineColorHover : lineColor,
          ...(isHorizontal 
            ? { width: 2, height: '100%' } 
            : { width: '100%', height: 2 }
          ),
        }}
      />
      
      {/* Handle bubble - transparent center so line shows through */}
      <div
        className={`
          absolute flex items-center justify-center transition-all
          ${isHorizontal ? 'w-5 h-12' : 'w-12 h-5'}
          ${isDragging ? 'scale-110' : ''}
        `}
      >
        {/* Outer pill shape */}
        <div 
          className={`
            absolute rounded-full transition-all shadow-md
            ${isHorizontal ? 'w-5 h-12' : 'w-12 h-5'}
          `}
          style={{
            backgroundColor: isDragging ? lineColor : 'white',
            border: `2px solid ${isDragging ? lineColorHover : lineColor}`,
          }}
        />
        {/* Inner line through the middle */}
        <div
          className="absolute transition-all"
          style={{
            backgroundColor: isDragging ? 'white' : lineColor,
            ...(isHorizontal 
              ? { width: 2, height: '70%' } 
              : { width: '70%', height: 2 }
            ),
          }}
        />
      </div>
      
      {/* Percentage indicator during drag */}
      {isDragging && (
        <div
          className="absolute text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-lg"
          style={{
            backgroundColor: lineColorHover,
            ...(isHorizontal ? { top: -32 } : { left: -48 }),
          }}
        >
          {displayValue}%
        </div>
      )}
    </div>
  );
}

export default BlockResizer;

