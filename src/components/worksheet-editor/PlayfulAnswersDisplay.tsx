/**
 * PlayfulAnswersDisplay - Renderuje odpovědi ABC jako hravé tvary
 * 
 * Odpovědi jsou zobrazeny jako SVG tvary (kolečka, čtverce, bobánky)
 * s náhodným rozmístěním a rotací pro vizuálně atraktivní vzhled.
 * 
 * Podporuje:
 * - 3 typy tvarů: circle, square, pill
 * - 2 styly: stroke (obrys), fill (výplň)
 * - Náhodné pozice a rotace (uložené v datech pro konzistenci)
 * - SVG export pro kvalitní tisk
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  ChoiceOption,
  PlayfulAnswerSettings,
  PlayfulAnswerPosition,
  PlayfulAnswerShape,
} from '../../types/worksheet';

interface PlayfulAnswersDisplayProps {
  options: ChoiceOption[];
  settings: PlayfulAnswerSettings;
  containerWidth: number;
  containerHeight: number;
  selectedAnswers?: string[];
  onSelectAnswer?: (optionId: string) => void;
  isEditing?: boolean;
  onEditOption?: (optionId: string, newText: string) => void;
  /** Callback to update position of an answer */
  onUpdatePosition?: (index: number, position: PlayfulAnswerPosition) => void;
  /** Base font size from global settings (e.g. "12pt") */
  baseFontSize?: string;
}

// All available shapes for 'mix' mode
const ALL_SHAPES: Exclude<PlayfulAnswerShape, 'mix'>[] = ['circle', 'square', 'pill', 'bubble', 'heart', 'hexagon', 'diamond', 'cloud'];

// Helper to get contrasting text color for fill style
function getContrastingTextColor(backgroundColor: string): string {
  // Parse hex color
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1e293b' : '#ffffff';
}

// Helper to render shape as SVG
function renderShape(
  shape: PlayfulAnswerShape,
  width: number,
  height: number,
  style: 'stroke' | 'fill',
  color: string,
  strokeWidth: number = 2
): React.ReactNode {
  const commonProps = {
    fill: style === 'fill' ? color : '#ffffff',
    stroke: style === 'stroke' ? color : 'none',
    strokeWidth: style === 'stroke' ? strokeWidth : 0,
  };

  // For 'mix', default to circle (actual shape should come from position.shape)
  const actualShape = shape === 'mix' ? 'circle' : shape;

  switch (actualShape) {
    case 'circle':
      return (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2 - strokeWidth}
          ry={height / 2 - strokeWidth}
          {...commonProps}
        />
      );
    case 'square':
      return (
        <rect
          x={strokeWidth / 2}
          y={strokeWidth / 2}
          width={width - strokeWidth}
          height={height - strokeWidth}
          rx={6}
          ry={6}
          {...commonProps}
        />
      );
    case 'pill':
      return (
        <rect
          x={strokeWidth / 2}
          y={strokeWidth / 2}
          width={width - strokeWidth}
          height={height - strokeWidth}
          rx={height / 2}
          ry={height / 2}
          {...commonProps}
        />
      );
    case 'bubble': {
      // Comic speech bubble - rounded rectangle with tail
      const padding = strokeWidth;
      const tailSize = Math.min(width, height) * 0.15;
      const rx = Math.min(width, height) * 0.2;
      const bodyHeight = height - tailSize - padding;
      const d = `
        M ${padding + rx},${padding}
        L ${width - padding - rx},${padding}
        Q ${width - padding},${padding} ${width - padding},${padding + rx}
        L ${width - padding},${bodyHeight - rx}
        Q ${width - padding},${bodyHeight} ${width - padding - rx},${bodyHeight}
        L ${width * 0.45},${bodyHeight}
        L ${width * 0.3},${height - padding}
        L ${width * 0.35},${bodyHeight}
        L ${padding + rx},${bodyHeight}
        Q ${padding},${bodyHeight} ${padding},${bodyHeight - rx}
        L ${padding},${padding + rx}
        Q ${padding},${padding} ${padding + rx},${padding}
        Z
      `;
      return <path d={d} {...commonProps} />;
    }
    case 'heart': {
      // Heart shape using bezier curves
      const cx = width / 2;
      const scale = Math.min(width, height) / 60;
      const d = `M ${cx},${height * 0.85} 
        C ${cx - 25 * scale},${height * 0.6} ${cx - 30 * scale},${height * 0.25} ${cx},${height * 0.35}
        C ${cx + 30 * scale},${height * 0.25} ${cx + 25 * scale},${height * 0.6} ${cx},${height * 0.85} Z`;
      return <path d={d} {...commonProps} />;
    }
    case 'hexagon': {
      // Regular hexagon
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width, height) / 2 - strokeWidth;
      const points: string[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 30) * (Math.PI / 180);
        points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      return <polygon points={points.join(' ')} {...commonProps} />;
    }
    case 'diamond': {
      // Diamond/rhombus shape
      const cx = width / 2;
      const cy = height / 2;
      const rx = width / 2 - strokeWidth;
      const ry = height / 2 - strokeWidth;
      const points = `${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry} ${cx - rx},${cy}`;
      return <polygon points={points} {...commonProps} />;
    }
    case 'cloud': {
      // Cloud shape with multiple circles
      const cx = width / 2;
      const cy = height / 2;
      const scale = Math.min(width, height) / 70;
      const d = `M ${cx - 20 * scale},${cy + 10 * scale}
        a ${12 * scale} ${12 * scale} 0 0 1 ${-10 * scale} ${-20 * scale}
        a ${15 * scale} ${15 * scale} 0 0 1 ${15 * scale} ${-12 * scale}
        a ${18 * scale} ${18 * scale} 0 0 1 ${25 * scale} ${5 * scale}
        a ${14 * scale} ${14 * scale} 0 0 1 ${12 * scale} ${15 * scale}
        a ${10 * scale} ${10 * scale} 0 0 1 ${-8 * scale} ${12 * scale}
        z`;
      return <path d={d} {...commonProps} />;
    }
    default:
      return (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2 - strokeWidth}
          ry={height / 2 - strokeWidth}
          {...commonProps}
        />
      );
  }
}

export function PlayfulAnswersDisplay({
  options,
  settings,
  containerWidth,
  containerHeight,
  selectedAnswers = [],
  onSelectAnswer,
  isEditing = false,
  onEditOption,
  onUpdatePosition,
  baseFontSize = '12pt',
}: PlayfulAnswersDisplayProps) {
  // Parse base font size to number (e.g. "12pt" -> 12)
  const baseFontNum = parseInt(baseFontSize.replace(/[^\d]/g, ''), 10) || 12;
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragState, setDragState] = useState<{
    index: number;
    type: 'move' | 'rotate';
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    startRotation: number;
  } | null>(null);

  // Ensure we have positions for all options
  const positions = useMemo(() => {
    if (settings.positions && settings.positions.length >= options.length) {
      return settings.positions;
    }
    // Fallback: generate basic grid positions
    const cols = options.length <= 4 ? 2 : options.length <= 6 ? 3 : 4;
    const rows = Math.ceil(options.length / cols);
    const cellWidth = 100 / cols;
    const cellHeight = 100 / rows;
    
    return options.map((_, i) => ({
      x: (i % cols) * cellWidth + cellWidth / 2,
      y: Math.floor(i / cols) * cellHeight + cellHeight / 2,
      rotation: 0,
      scale: 100,
    }));
  }, [options, settings.positions]);

  // Handle mouse move for drag/rotate
  useEffect(() => {
    if (!dragState || !onUpdatePosition) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      
      if (dragState.type === 'move') {
        // Calculate new position in percentages
        const newX = ((e.clientX - rect.left) / rect.width) * 100;
        const newY = ((e.clientY - rect.top) / rect.height) * 100;
        
        // Clamp to container bounds
        const clampedX = Math.max(5, Math.min(95, newX));
        const clampedY = Math.max(5, Math.min(95, newY));
        
        onUpdatePosition(dragState.index, {
          ...positions[dragState.index],
          x: clampedX,
          y: clampedY,
        });
      } else if (dragState.type === 'rotate') {
        // Calculate rotation based on mouse position relative to object center
        const pos = positions[dragState.index];
        const centerX = (pos.x / 100) * rect.width;
        const centerY = (pos.y / 100) * rect.height;
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate angle from center to mouse
        const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI);
        
        // Snap to 15 degrees if Shift is held
        let newRotation = angle + 90; // Offset so 0 is up
        if (e.shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        }
        
        // Clamp rotation to reasonable range
        newRotation = ((newRotation % 360) + 360) % 360;
        if (newRotation > 180) newRotation -= 360;
        
        onUpdatePosition(dragState.index, {
          ...positions[dragState.index],
          rotation: Math.round(newRotation),
        });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, positions, onUpdatePosition]);

  // Start drag
  const startDrag = useCallback((
    e: React.MouseEvent,
    index: number,
    type: 'move' | 'rotate'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    const pos = positions[index];
    setDragState({
      index,
      type,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      startRotation: pos.rotation,
    });
    setSelectedIndex(index);
  }, [positions]);

  // Calculate shape dimensions based on text length and shape type
  // Supports multiline text (split by newline)
  // Uses baseFontNum from global settings
  const getShapeDimensions = (text: string, shape: PlayfulAnswerShape, scale: number) => {
    const lines = text.split('\n');
    const maxLineLength = Math.max(...lines.map(l => l.length));
    const lineCount = lines.length;
    
    // Scale base size and text metrics based on font size (12pt = 1.0)
    const fontScale = baseFontNum / 12;
    const baseSize = 80 * fontScale;
    const scaleFactor = scale / 100;
    
    // Text dimensions - scaled by font size
    const charWidth = 8 * fontScale; // approx character width
    const lineHeight = baseFontNum * 1.5;
    const textWidth = Math.max(maxLineLength * charWidth, 50 * fontScale);
    const textHeight = lineCount * lineHeight + 12 * fontScale;
    
    // For 'mix', use circle sizing as default (actual shape comes from position)
    const actualShape = shape === 'mix' ? 'circle' : shape;
    
    // Multipliers: star/heart/cloud need +55%, others +25%
    const normalMult = 1.25;
    const specialMult = 1.55;
    
    switch (actualShape) {
      case 'circle':
        const diameter = Math.max(baseSize, textWidth + 24, textHeight + 32) * scaleFactor * normalMult;
        return { width: diameter, height: diameter };
      case 'square':
        const size = Math.max(baseSize, textWidth + 24, textHeight + 24) * scaleFactor * normalMult;
        return { width: size, height: size };
      case 'pill':
        return { 
          width: Math.max(textWidth + 40, 100) * scaleFactor * normalMult, 
          height: Math.max(textHeight + 20, 48) * scaleFactor * normalMult 
        };
      case 'bubble':
        // Speech bubble - wider with tail
        return { 
          width: Math.max(textWidth + 50, 100) * scaleFactor * normalMult, 
          height: Math.max(textHeight + 45, 70) * scaleFactor * normalMult 
        };
      case 'heart':
        // Heart - +40%
        const heartWidth = Math.max(baseSize + 20, textWidth + 50, textHeight + 40) * scaleFactor * specialMult;
        return { width: heartWidth, height: heartWidth * 0.95 };
      case 'hexagon':
        const hexSize = Math.max(baseSize, textWidth + 24, textHeight + 32) * scaleFactor * normalMult;
        return { width: hexSize, height: hexSize };
      case 'diamond':
        // Diamond needs to be larger because usable area is smaller
        const diamondSize = Math.max(baseSize + 15, textWidth + 40, textHeight + 40) * scaleFactor * normalMult;
        return { width: diamondSize, height: diamondSize };
      case 'cloud':
        // Cloud - +40% pro lepší viditelnost
        return { 
          width: Math.max(textWidth + 120, 200) * scaleFactor * specialMult, 
          height: Math.max(textHeight + 80, 130) * scaleFactor * specialMult 
        };
      default:
        const defaultSize = Math.max(baseSize, textWidth + 24, textHeight + 24) * scaleFactor * normalMult;
        return { width: defaultSize, height: defaultSize };
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: containerHeight,
        minHeight: 200,
      }}
      onClick={() => setSelectedIndex(null)}
    >
      {/* SVG layer for print-quality shapes */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${containerWidth} ${containerHeight}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'visible',
        }}
        className="print:block"
      >
        {options.map((option, index) => {
          const pos = positions[index] || { x: 50, y: 50, rotation: 0, scale: 100 };
          
          // For 'mix' mode, use the shape from position, otherwise use global setting
          const actualShape = settings.shape === 'mix' 
            ? (pos.shape || ALL_SHAPES[index % ALL_SHAPES.length])
            : settings.shape;
          
          const dims = getShapeDimensions(option.text, actualShape, pos.scale);
          
          // Convert percentage position to pixels
          const pixelX = (pos.x / 100) * containerWidth;
          const pixelY = (pos.y / 100) * containerHeight;
          
          const isCorrect = selectedAnswers.includes(option.id);
          
          // Determine shape color: correct answer green, random colors if enabled, otherwise primary color
          let shapeColor = settings.primaryColor;
          if (isCorrect) {
            shapeColor = '#10b981';
          } else if (settings.randomColors && pos.color) {
            shapeColor = pos.color;
          }
          
          // For fill style, use contrasting text color; for stroke, use the shape color
          const textColor = settings.style === 'fill' 
            ? getContrastingTextColor(shapeColor)
            : shapeColor;
          
          return (
            <g
              key={option.id}
              transform={`translate(${pixelX - dims.width / 2}, ${pixelY - dims.height / 2}) rotate(${pos.rotation}, ${dims.width / 2}, ${dims.height / 2})`}
              style={{ cursor: onSelectAnswer ? 'pointer' : 'default' }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnswer?.(option.id);
              }}
            >
              {renderShape(
                actualShape,
                dims.width,
                dims.height,
                settings.style,
                shapeColor,
                settings.strokeWidth
              )}
              
              {/* Text inside shape - supports multiline */}
              <foreignObject
                x={0}
                y={0}
                width={dims.width}
                height={dims.height}
                style={{ pointerEvents: 'none' }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    color: textColor,
                    fontSize: `${baseFontNum}pt`,
                    fontWeight: 600,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    lineHeight: 1.3,
                    padding: '4px 8px',
                    userSelect: 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxSizing: 'border-box',
                  }}
                >
                  {option.text}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>

      {/* Interactive overlay for editing (HTML layer) - only in editing mode */}
      {isEditing && onUpdatePosition && (
        <div
          className="print:hidden"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {options.map((option, index) => {
            const pos = positions[index] || { x: 50, y: 50, rotation: 0, scale: 100 };
            const dims = getShapeDimensions(option.text, settings.shape, pos.scale);
            
            // Use percentage-based positioning for responsiveness
            const isItemSelected = selectedIndex === index;
            const isDragging = dragState?.index === index;
            
            // Bigger grab area
            const grabPadding = 12;
            
            return (
              <div
                key={option.id}
                style={{
                  position: 'absolute',
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  // Center the element and apply rotation
                  transform: `translate(-50%, -50%) rotate(${pos.rotation}deg)`,
                  // Exact size as the SVG shape
                  width: dims.width,
                  height: dims.height,
                  pointerEvents: 'auto',
                  cursor: isDragging && dragState?.type === 'move' ? 'grabbing' : 'grab',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex(index);
                }}
                onMouseDown={(e) => {
                  if (e.button === 0) {
                    startDrag(e, index, 'move');
                  }
                }}
              >
                {/* Invisible expanded grab area */}
                <div
                  style={{
                    position: 'absolute',
                    inset: -grabPadding,
                    borderRadius: settings.shape === 'circle' ? '50%' : settings.shape === 'pill' ? (dims.height + grabPadding * 2) / 2 : 12,
                    // Debug: uncomment to see grab area
                    // background: 'rgba(255,0,0,0.1)',
                  }}
                />
                
                {/* Selection border - exactly on the shape */}
                {isItemSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: -3,
                      border: '2px dashed #3b82f6',
                      borderRadius: settings.shape === 'circle' ? '50%' : settings.shape === 'pill' ? (dims.height + 6) / 2 : 8,
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* Rotation handle - only show when selected */}
                {isItemSelected && (
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      startDrag(e, index, 'rotate');
                    }}
                    style={{
                      position: 'absolute',
                      top: -28,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 22,
                      height: 22,
                      backgroundColor: '#3b82f6',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'grab',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                      border: '2px solid white',
                      zIndex: 10,
                    }}
                  >
                    <RotateCcw size={11} color="white" />
                  </div>
                )}

                {/* Rotation line */}
                {isItemSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -24,
                      left: '50%',
                      width: 2,
                      height: 24,
                      backgroundColor: '#3b82f6',
                      transform: 'translateX(-50%)',
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* Textarea for multiline text editing - exactly on shape */}
                {isItemSelected && onEditOption && (
                  <textarea
                    value={option.text}
                    onChange={(e) => onEditOption(option.id, e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    rows={option.text.split('\n').length || 1}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      textAlign: 'center',
                      background: 'rgba(255,255,255,0.95)',
                      border: '2px solid #3b82f6',
                      borderRadius: settings.shape === 'circle' ? '50%' : settings.shape === 'pill' ? dims.height / 2 : 6,
                      outline: 'none',
                      color: '#1e293b',
                      fontSize: Math.min(16, Math.min(dims.width, dims.height) * 0.18),
                      fontWeight: 500,
                      padding: settings.shape === 'circle' ? `${dims.height * 0.2}px` : '8px 12px',
                      resize: 'none',
                      lineHeight: 1.3,
                      boxSizing: 'border-box',
                    }}
                    autoFocus
                  />
                )}

                {/* Rotation indicator when dragging */}
                {isDragging && dragState?.type === 'rotate' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -50,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#1e293b',
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}
                  >
                    {Math.round(pos.rotation)}°
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Generates SVG string for print export
 */
export function generatePlayfulAnswersSVG(
  options: ChoiceOption[],
  settings: PlayfulAnswerSettings,
  width: number,
  height: number
): string {
  const positions = settings.positions || [];
  
  const getShapeDimensions = (text: string, shape: PlayfulAnswerShape, scale: number) => {
    const lines = text.split('\n');
    const maxLineLength = Math.max(...lines.map(l => l.length));
    const lineCount = lines.length;
    
    const baseSize = 80;
    const scaleFactor = scale / 100;
    const textWidth = Math.max(maxLineLength * 12, 50);
    const textHeight = lineCount * 20 + 16;
    
    // For 'mix', use circle sizing as default
    const actualShape = shape === 'mix' ? 'circle' : shape;
    
    // Multipliers: star/heart/cloud need +55%, others +25%
    const normalMult = 1.25;
    const specialMult = 1.55;
    
    switch (actualShape) {
      case 'circle':
        const diameter = Math.max(baseSize, textWidth + 24, textHeight + 32) * scaleFactor * normalMult;
        return { width: diameter, height: diameter };
      case 'square':
        const size = Math.max(baseSize, textWidth + 24, textHeight + 24) * scaleFactor * normalMult;
        return { width: size, height: size };
      case 'pill':
        return { 
          width: Math.max(textWidth + 40, 100) * scaleFactor * normalMult, 
          height: Math.max(textHeight + 20, 48) * scaleFactor * normalMult 
        };
      case 'bubble':
        // Speech bubble - wider with tail
        return { 
          width: Math.max(textWidth + 50, 100) * scaleFactor * normalMult, 
          height: Math.max(textHeight + 45, 70) * scaleFactor * normalMult 
        };
      case 'heart':
        // Heart - +40%
        const heartWidth = Math.max(baseSize + 20, textWidth + 50, textHeight + 40) * scaleFactor * specialMult;
        return { width: heartWidth, height: heartWidth * 0.95 };
      case 'hexagon':
        const hexSize = Math.max(baseSize, textWidth + 24, textHeight + 32) * scaleFactor * normalMult;
        return { width: hexSize, height: hexSize };
      case 'diamond':
        // Diamond needs to be larger because usable area is smaller
        const diamondSize = Math.max(baseSize + 15, textWidth + 40, textHeight + 40) * scaleFactor * normalMult;
        return { width: diamondSize, height: diamondSize };
      case 'cloud':
        // Cloud - +40% pro lepší viditelnost
        return { 
          width: Math.max(textWidth + 120, 200) * scaleFactor * specialMult, 
          height: Math.max(textHeight + 80, 130) * scaleFactor * specialMult 
        };
      default:
        const defaultSize = Math.max(baseSize, textWidth + 24, textHeight + 24) * scaleFactor * normalMult;
        return { width: defaultSize, height: defaultSize };
    }
  };

  const getShapeSVG = (
    shape: PlayfulAnswerShape,
    w: number,
    h: number,
    style: 'stroke' | 'fill',
    color: string,
    strokeWidth: number
  ): string => {
    const fill = style === 'fill' ? color : '#ffffff';
    const stroke = style === 'stroke' ? color : 'none';
    const sw = style === 'stroke' ? strokeWidth : 0;
    
    // For 'mix', default to circle (actual shape comes from position)
    const actualShape = shape === 'mix' ? 'circle' : shape;
    
    switch (actualShape) {
      case 'circle':
        return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - sw}" ry="${h / 2 - sw}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      case 'square':
        return `<rect x="${sw / 2}" y="${sw / 2}" width="${w - sw}" height="${h - sw}" rx="6" ry="6" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      case 'pill':
        return `<rect x="${sw / 2}" y="${sw / 2}" width="${w - sw}" height="${h - sw}" rx="${h / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      case 'bubble': {
        // Comic speech bubble - rounded rectangle with tail
        const tailSize = Math.min(w, h) * 0.15;
        const rx = Math.min(w, h) * 0.2;
        const bodyHeight = h - tailSize - sw;
        const d = `
          M ${sw + rx},${sw}
          L ${w - sw - rx},${sw}
          Q ${w - sw},${sw} ${w - sw},${sw + rx}
          L ${w - sw},${bodyHeight - rx}
          Q ${w - sw},${bodyHeight} ${w - sw - rx},${bodyHeight}
          L ${w * 0.45},${bodyHeight}
          L ${w * 0.3},${h - sw}
          L ${w * 0.35},${bodyHeight}
          L ${sw + rx},${bodyHeight}
          Q ${sw},${bodyHeight} ${sw},${bodyHeight - rx}
          L ${sw},${sw + rx}
          Q ${sw},${sw} ${sw + rx},${sw}
          Z
        `;
        return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      }
      case 'heart': {
        const cx = w / 2;
        const scale = Math.min(w, h) / 60;
        const d = `M ${cx},${h * 0.85} C ${cx - 25 * scale},${h * 0.6} ${cx - 30 * scale},${h * 0.25} ${cx},${h * 0.35} C ${cx + 30 * scale},${h * 0.25} ${cx + 25 * scale},${h * 0.6} ${cx},${h * 0.85} Z`;
        return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      }
      case 'hexagon': {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - sw;
        const points: string[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i * 60 - 30) * (Math.PI / 180);
          points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        return `<polygon points="${points.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      }
      case 'diamond': {
        const cx = w / 2;
        const cy = h / 2;
        const rx = w / 2 - sw;
        const ry = h / 2 - sw;
        return `<polygon points="${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry} ${cx - rx},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      }
      case 'cloud': {
        const cx = w / 2;
        const cy = h / 2;
        const scale = Math.min(w, h) / 70;
        const d = `M ${cx - 20 * scale},${cy + 10 * scale} a ${12 * scale} ${12 * scale} 0 0 1 ${-10 * scale} ${-20 * scale} a ${15 * scale} ${15 * scale} 0 0 1 ${15 * scale} ${-12 * scale} a ${18 * scale} ${18 * scale} 0 0 1 ${25 * scale} ${5 * scale} a ${14 * scale} ${14 * scale} 0 0 1 ${12 * scale} ${15 * scale} a ${10 * scale} ${10 * scale} 0 0 1 ${-8 * scale} ${12 * scale} z`;
        return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      }
      default:
        return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - sw}" ry="${h / 2 - sw}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    }
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  
  options.forEach((option, index) => {
    const pos = positions[index] || { x: 50, y: 50, rotation: 0, scale: 100 };
    
    // For 'mix' mode, use the shape from position
    const actualShape = settings.shape === 'mix' 
      ? (pos.shape || ALL_SHAPES[index % ALL_SHAPES.length])
      : settings.shape;
    
    const dims = getShapeDimensions(option.text, actualShape, pos.scale);
    
    const pixelX = (pos.x / 100) * width;
    const pixelY = (pos.y / 100) * height;
    
    // For fill style, use contrasting text color
    const textColor = settings.style === 'fill' 
      ? getContrastingTextColor(settings.primaryColor)
      : settings.textColor;
    
    svg += `<g transform="translate(${pixelX - dims.width / 2}, ${pixelY - dims.height / 2}) rotate(${pos.rotation}, ${dims.width / 2}, ${dims.height / 2})">`;
    svg += getShapeSVG(actualShape, dims.width, dims.height, settings.style, settings.primaryColor, settings.strokeWidth);
    
    // Multiline text support using tspan
    const lines = option.text.split('\n');
    const fontSize = Math.min(18, dims.height * 0.22);
    const lineHeight = fontSize * 1.3;
    const startY = dims.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    
    svg += `<text x="${dims.width / 2}" text-anchor="middle" fill="${textColor}" font-size="${fontSize}" font-weight="600" font-family="Inter, system-ui, sans-serif">`;
    lines.forEach((line, lineIndex) => {
      svg += `<tspan x="${dims.width / 2}" y="${startY + lineIndex * lineHeight}" dominant-baseline="central">${line}</tspan>`;
    });
    svg += '</text>';
    svg += '</g>';
  });
  
  svg += '</svg>';
  return svg;
}
