/**
 * PlayfulImagesDisplay - Renderuje odpovědi jako obrázky v hravých tvarech
 * 
 * Obrázky jsou oříznuté do různých tvarů (kolečka, hvězdy, srdce atd.)
 * s náhodným rozmístěním a rotací. Obsahuje zaškrtávací kolečko pro výběr.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { RotateCcw, Check, ImageIcon } from 'lucide-react';
import {
  ChoiceOption,
  PlayfulAnswerSettings,
  PlayfulAnswerPosition,
  PlayfulAnswerShape,
} from '../../types/worksheet';

interface PlayfulImagesDisplayProps {
  options: ChoiceOption[];
  settings: PlayfulAnswerSettings;
  containerWidth: number;
  containerHeight: number;
  selectedAnswers?: string[];
  onSelectAnswer?: (optionId: string) => void;
  isEditing?: boolean;
  onEditOption?: (optionId: string, newText: string) => void;
  onUpdatePosition?: (index: number, position: PlayfulAnswerPosition) => void;
  onUploadImage?: (optionId: string) => void;
}

// All available shapes for 'mix' mode
const ALL_SHAPES: Exclude<PlayfulAnswerShape, 'mix'>[] = ['circle', 'square', 'pill', 'bubble', 'heart', 'hexagon', 'diamond', 'cloud'];

// Generate CSS clip-path for each shape
function getClipPath(shape: PlayfulAnswerShape): string {
  switch (shape) {
    case 'circle':
      return 'ellipse(50% 50% at 50% 50%)';
    case 'square':
      return 'inset(0 round 8px)';
    case 'pill':
      return 'inset(0 round 50%)';
    case 'bubble':
      return 'inset(0 round 20%)';
    case 'heart':
      return 'path("M50,88 C20,65 0,45 0,25 C0,10 15,0 30,0 C40,0 48,8 50,15 C52,8 60,0 70,0 C85,0 100,10 100,25 C100,45 80,65 50,88 Z")';
    case 'hexagon':
      return 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)';
    case 'diamond':
      return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
    case 'cloud':
      return 'ellipse(50% 50% at 50% 50%)'; // Fallback to circle for cloud
    default:
      return 'ellipse(50% 50% at 50% 50%)';
  }
}

// Generate SVG mask for shapes that need it
function getShapeMask(shape: PlayfulAnswerShape, size: number): string {
  const half = size / 2;
  
  switch (shape) {
    case 'bubble': {
      // Bubble is a simple rounded rect - no complex mask needed
      const rx = size * 0.2;
      return `<rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="${rx}" ry="${rx}" fill="white"/>`;
    }
    case 'heart': {
      const scale = size / 100;
      return `<path d="M${50*scale},${85*scale} C${20*scale},${60*scale} 0,${40*scale} 0,${22*scale} C0,${8*scale} ${15*scale},0 ${30*scale},0 C${42*scale},0 ${48*scale},${8*scale} ${50*scale},${18*scale} C${52*scale},${8*scale} ${58*scale},0 ${70*scale},0 C${85*scale},0 ${100*scale},${8*scale} ${100*scale},${22*scale} C${100*scale},${40*scale} ${80*scale},${60*scale} ${50*scale},${85*scale} Z" fill="white"/>`;
    }
    case 'hexagon': {
      const r = half * 0.95;
      const points: string[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 30) * (Math.PI / 180);
        points.push(`${half + r * Math.cos(angle)},${half + r * Math.sin(angle)}`);
      }
      return `<polygon points="${points.join(' ')}" fill="white"/>`;
    }
    case 'diamond':
      return `<polygon points="${half},2 ${size-2},${half} ${half},${size-2} 2,${half}" fill="white"/>`;
    default:
      return '';
  }
}

export function PlayfulImagesDisplay({
  options,
  settings,
  containerWidth,
  containerHeight,
  selectedAnswers = [],
  onSelectAnswer,
  isEditing = false,
  onEditOption,
  onUpdatePosition,
  onUploadImage,
}: PlayfulImagesDisplayProps) {
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
        const newX = ((e.clientX - rect.left) / rect.width) * 100;
        const newY = ((e.clientY - rect.top) / rect.height) * 100;
        
        const clampedX = Math.max(10, Math.min(90, newX));
        const clampedY = Math.max(10, Math.min(90, newY));
        
        onUpdatePosition(dragState.index, {
          ...positions[dragState.index],
          x: clampedX,
          y: clampedY,
        });
      } else if (dragState.type === 'rotate') {
        const pos = positions[dragState.index];
        const centerX = (pos.x / 100) * rect.width;
        const centerY = (pos.y / 100) * rect.height;
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI);
        
        let newRotation = angle + 90;
        if (e.shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        }
        
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

  // Fixed image size based on shape
  const getImageSize = (shape: PlayfulAnswerShape) => {
    // Bigger sizes for special shapes
    switch (shape) {
      case 'bubble':
      case 'heart':
      case 'cloud':
        return 140;
      case 'diamond':
        return 120;
      default:
        return 110;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: containerHeight,
        minHeight: 250,
      }}
      onClick={() => setSelectedIndex(null)}
    >
      {options.map((option, index) => {
        const pos = positions[index] || { x: 50, y: 50, rotation: 0, scale: 100 };
        
        // For 'mix' mode, use the shape from position
        const actualShape = settings.shape === 'mix' 
          ? (pos.shape || ALL_SHAPES[index % ALL_SHAPES.length])
          : settings.shape;
        
        const size = getImageSize(actualShape) * (pos.scale / 100);
        const isSelected = selectedAnswers.includes(option.id);
        const isItemSelected = selectedIndex === index;
        const isDragging = dragState?.index === index;
        
        // Determine border color
        let borderColor = settings.randomColors && pos.color 
          ? pos.color 
          : settings.primaryColor;
        if (isSelected) {
          borderColor = '#10b981';
        }
        
        const hasImage = option.imageUrl && option.imageUrl.trim() !== '';
        
        // Create unique mask ID
        const maskId = `shape-mask-${option.id}-${index}`;
        
        return (
          <div
            key={option.id}
            style={{
              position: 'absolute',
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: `translate(-50%, -50%) rotate(${pos.rotation}deg)`,
              width: size,
              height: size,
              cursor: isEditing ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!isEditing) {
                onSelectAnswer?.(option.id);
              } else {
                setSelectedIndex(index);
              }
            }}
            onMouseDown={(e) => {
              if (isEditing && e.button === 0) {
                startDrag(e, index, 'move');
              }
            }}
          >
            {/* Shape container with clipping */}
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                borderRadius: actualShape === 'circle' ? '50%' : actualShape === 'square' ? '12px' : actualShape === 'pill' ? '50%' : 0,
                overflow: 'hidden',
                border: `3px solid ${borderColor}`,
                backgroundColor: '#f1f5f9',
                boxShadow: isSelected ? `0 0 0 4px ${borderColor}40` : '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              {/* SVG mask for complex shapes */}
              {['bubble', 'heart', 'hexagon', 'diamond'].includes(actualShape) && (
                <svg
                  style={{
                    position: 'absolute',
                    width: 0,
                    height: 0,
                  }}
                >
                  <defs>
                    <mask id={maskId}>
                      <rect width="100%" height="100%" fill="black" />
                      <g dangerouslySetInnerHTML={{ __html: getShapeMask(actualShape, size) }} />
                    </mask>
                  </defs>
                </svg>
              )}
              
              {/* Image or placeholder */}
              {hasImage ? (
                <img
                  src={option.imageUrl}
                  alt={option.text || ''}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    clipPath: ['bubble', 'heart', 'hexagon', 'diamond'].includes(actualShape) 
                      ? getClipPath(actualShape)
                      : undefined,
                  }}
                  draggable={false}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#e2e8f0',
                    color: '#64748b',
                    clipPath: ['bubble', 'heart', 'hexagon', 'diamond'].includes(actualShape) 
                      ? getClipPath(actualShape)
                      : undefined,
                  }}
                  onClick={(e) => {
                    if (isEditing && onUploadImage) {
                      e.stopPropagation();
                      onUploadImage(option.id);
                    }
                  }}
                >
                  <ImageIcon size={24} />
                  {isEditing && <span style={{ fontSize: 10, marginTop: 4 }}>Klikni</span>}
                </div>
              )}
              
              {/* Shape border overlay for complex shapes */}
              {['bubble', 'heart', 'hexagon', 'diamond'].includes(actualShape) && (
                <svg
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                  viewBox={`0 0 ${size} ${size}`}
                >
                  <g 
                    dangerouslySetInnerHTML={{ 
                      __html: getShapeMask(actualShape, size).replace('fill="white"', `fill="none" stroke="${borderColor}" stroke-width="3"`) 
                    }} 
                  />
                </svg>
              )}
            </div>
            
            {/* Checkbox for selection */}
            <div
              style={{
                position: 'absolute',
                bottom: -8,
                right: -8,
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: isSelected ? '#10b981' : 'white',
                border: `2px solid ${isSelected ? '#10b981' : '#cbd5e1'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                zIndex: 10,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnswer?.(option.id);
              }}
            >
              {isSelected && <Check size={16} color="white" strokeWidth={3} />}
            </div>
            
            {/* Selection border for editing */}
            {isEditing && isItemSelected && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    inset: -6,
                    border: '2px dashed #3b82f6',
                    borderRadius: actualShape === 'circle' ? '50%' : 16,
                    pointerEvents: 'none',
                  }}
                />
                
                {/* Rotation handle */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startDrag(e, index, 'rotate');
                  }}
                  style={{
                    position: 'absolute',
                    top: -32,
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
                
                {/* Rotation line */}
                <div
                  style={{
                    position: 'absolute',
                    top: -28,
                    left: '50%',
                    width: 2,
                    height: 24,
                    backgroundColor: '#3b82f6',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                  }}
                />
                
                {/* Rotation indicator */}
                {isDragging && dragState?.type === 'rotate' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -55,
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
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
