/**
 * Connect Pairs Slide View (Spojovačka)
 * 
 * Student view for matching pair activities
 * Click to select, click again to connect - works on mobile and desktop
 * Immediate evaluation with curved connecting lines
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Check,
  X,
  Link2,
  RotateCcw,
} from 'lucide-react';
import { ConnectPairsActivitySlide, ConnectPairItem } from '../../../types/quiz';

interface ConnectPairsViewProps {
  slide: ConnectPairsActivitySlide;
  isTeacher?: boolean;
  readOnly?: boolean;
  onSubmit?: (result: { correct: number; total: number; connections: Record<string, string> }) => void;
  showResults?: boolean;
}

// Shuffle array helper
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Connection with evaluation status
interface Connection {
  leftId: string;
  rightId: string;
  isCorrect: boolean;
  isLocked: boolean; // Once evaluated, can't be changed
}

// Item display component
function PairItemDisplay({
  item,
  isSelected,
  connection,
  onClick,
  disabled,
  itemRef,
  minHeight,
}: {
  item: ConnectPairItem;
  isSelected: boolean;
  connection?: Connection;
  onClick: () => void;
  disabled: boolean;
  itemRef: (el: HTMLButtonElement | null) => void;
  minHeight?: number;
}) {
  const isConnected = !!connection;
  const isLocked = connection?.isLocked || false;
  const isCorrect = connection?.isCorrect;

  const getBorderColor = () => {
    if (isLocked) {
      return isCorrect ? '#22c55e' : '#ef4444';
    }
    if (isSelected) return '#7C3AED';
    if (isConnected) return '#a855f7';
    return '#e2e8f0';
  };

  const getBackgroundColor = () => {
    if (isLocked) {
      return isCorrect ? '#dcfce7' : '#fee2e2';
    }
    if (isSelected) return '#f3e8ff';
    if (isConnected) return '#faf5ff';
    return '#ffffff';
  };

  return (
    <button
      ref={itemRef}
      onClick={onClick}
      disabled={disabled || isLocked}
      className="w-full rounded-xl border-2 transition-all flex items-center justify-center"
      style={{
        position: 'relative',
        borderColor: getBorderColor(),
        backgroundColor: getBackgroundColor(),
        cursor: disabled || isLocked ? 'default' : 'pointer',
        boxShadow: isSelected ? '0 0 0 3px rgba(124, 58, 237, 0.2)' : 'none',
        minHeight: minHeight ? `${minHeight}px` : '50px',
        padding: '12px 16px',
        overflow: 'visible',
      }}
    >
      {item.type === 'image' ? (
        <img
          src={item.content}
          alt=""
          className="w-full object-cover rounded-lg"
          style={{ maxHeight: minHeight ? `${minHeight - 24}px` : '60px' }}
        />
      ) : (
        <span className="text-[#4E5871] font-medium text-base md:text-lg text-center block">
          {item.content}
        </span>
      )}

      {/* Result indicator - positioned at the top-left corner */}
      {isLocked && (
        <div 
          style={{
            position: 'absolute',
            top: '-10px',
            left: '-10px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isCorrect ? '#22c55e' : '#ef4444',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 20,
          }}
        >
          {isCorrect ? (
            <Check className="w-4 h-4 text-white" />
          ) : (
            <X className="w-4 h-4 text-white" />
          )}
        </div>
      )}
    </button>
  );
}

export function ConnectPairsView({
  slide,
  isTeacher = false,
  readOnly = false,
  onSubmit,
}: ConnectPairsViewProps) {
  // Connections with immediate evaluation
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  
  // Refs for drawing lines
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [linePositions, setLinePositions] = useState<Array<{
    x1: number; y1: number; x2: number; y2: number; isCorrect: boolean; isLocked: boolean;
  }>>([]);

  // Store shuffled items in ref to prevent re-shuffling on re-renders
  const shuffledDataRef = useRef<{
    leftItems: Array<ConnectPairItem & { pairId: string }>;
    rightItems: Array<ConnectPairItem & { pairId: string }>;
    correctMap: Record<string, string>;
    slideId: string;
  } | null>(null);

  // Only shuffle once per slide
  if (!shuffledDataRef.current || shuffledDataRef.current.slideId !== slide.id) {
    const left = slide.pairs.map(p => ({ ...p.left, pairId: p.id }));
    const right = slide.pairs.map(p => ({ ...p.right, pairId: p.id }));
    
    // Create correct mapping (leftId -> rightId for same pair)
    const correct: Record<string, string> = {};
    slide.pairs.forEach(pair => {
      correct[pair.left.id] = pair.right.id;
    });

    shuffledDataRef.current = {
      leftItems: shuffleArray(left),
      rightItems: shuffleArray(right),
      correctMap: correct,
      slideId: slide.id,
    };
  }

  const { leftItems, rightItems, correctMap } = shuffledDataRef.current;

  // Calculate line positions
  useEffect(() => {
    const updateLines = () => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newLines: typeof linePositions = [];

      connections.forEach(conn => {
        const leftEl = leftRefs.current[conn.leftId];
        const rightEl = rightRefs.current[conn.rightId];
        
        if (leftEl && rightEl) {
          const leftRect = leftEl.getBoundingClientRect();
          const rightRect = rightEl.getBoundingClientRect();
          
          newLines.push({
            x1: leftRect.right - containerRect.left,
            y1: leftRect.top + leftRect.height / 2 - containerRect.top,
            x2: rightRect.left - containerRect.left,
            y2: rightRect.top + rightRect.height / 2 - containerRect.top,
            isCorrect: conn.isCorrect,
            isLocked: conn.isLocked,
          });
        }
      });

      setLinePositions(newLines);
    };

    updateLines();
    window.addEventListener('resize', updateLines);
    return () => window.removeEventListener('resize', updateLines);
  }, [connections]);

  // Get connection for an item
  const getConnectionForLeft = (leftId: string) => 
    connections.find(c => c.leftId === leftId);
  
  const getConnectionForRight = (rightId: string) => 
    connections.find(c => c.rightId === rightId);

  // Check if item is already connected
  const isLeftConnected = (leftId: string) => 
    connections.some(c => c.leftId === leftId);
  
  const isRightConnected = (rightId: string) => 
    connections.some(c => c.rightId === rightId);

  // Make a connection and immediately evaluate
  const makeConnection = useCallback((leftId: string, rightId: string) => {
    const isCorrect = correctMap[leftId] === rightId;
    
    const newConnection: Connection = {
      leftId,
      rightId,
      isCorrect,
      isLocked: true, // Immediately lock and evaluate
    };

    setConnections(prev => [...prev, newConnection]);
    setSelectedLeft(null);
    setSelectedRight(null);
  }, [correctMap]);

  // Handle item click
  const handleLeftClick = useCallback((itemId: string) => {
    if (readOnly) return;

    // If already connected, can't disconnect locked connections
    const existingConn = getConnectionForLeft(itemId);
    if (existingConn?.isLocked) return;

    // If we have a right selected that's not connected, make connection
    if (selectedRight && !isRightConnected(selectedRight)) {
      makeConnection(itemId, selectedRight);
    } else {
      // Toggle selection
      setSelectedLeft(itemId === selectedLeft ? null : itemId);
      setSelectedRight(null);
    }
  }, [selectedRight, selectedLeft, readOnly, makeConnection, connections]);

  const handleRightClick = useCallback((itemId: string) => {
    if (readOnly) return;

    // If already connected, can't disconnect locked connections
    const existingConn = getConnectionForRight(itemId);
    if (existingConn?.isLocked) return;

    // If we have a left selected that's not connected, make connection
    if (selectedLeft && !isLeftConnected(selectedLeft)) {
      makeConnection(selectedLeft, itemId);
    } else {
      // Toggle selection
      setSelectedRight(itemId === selectedRight ? null : itemId);
      setSelectedLeft(null);
    }
  }, [selectedLeft, selectedRight, readOnly, makeConnection, connections]);

  // Calculate score
  const score = useMemo(() => {
    const correct = connections.filter(c => c.isCorrect).length;
    return { correct, total: slide.pairs.length };
  }, [connections, slide.pairs.length]);

  // Check if all pairs are connected
  const allConnected = connections.length === slide.pairs.length;

  // Submit when all connected
  useEffect(() => {
    if (allConnected && onSubmit) {
      const connectionsMap: Record<string, string> = {};
      connections.forEach(c => {
        connectionsMap[c.leftId] = c.rightId;
      });
      onSubmit({ correct: score.correct, total: score.total, connections: connectionsMap });
    }
  }, [allConnected, connections, score, onSubmit]);

  // Reset
  const handleReset = () => {
    setConnections([]);
    setSelectedLeft(null);
    setSelectedRight(null);
  };

  // Generate curved path
  const generateCurvedPath = (x1: number, y1: number, x2: number, y2: number) => {
    const midX = (x1 + x2) / 2;
    const controlOffset = Math.min(80, (x2 - x1) * 0.3);
    return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-violet-50/30 rounded-3xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="text-center flex-shrink-0 pb-4 px-6" style={{ paddingTop: '48px' }}>
        <h2 className="text-2xl md:text-3xl font-bold text-[#4E5871] mb-3">
          {slide.instruction || 'Spoj správné dvojice'}
        </h2>
        
        {/* Progress */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
            <Link2 className="w-4 h-4 text-violet-500" />
            <span className="font-medium text-slate-600">
              {connections.length} / {slide.pairs.length}
            </span>
          </div>
          
          {connections.length > 0 && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-sm ${
              score.correct === connections.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <Check className="w-4 h-4" />
              <span className="font-bold">{score.correct} správně</span>
            </div>
          )}
        </div>
      </div>

      {/* Connection area - fills remaining height */}
      <div ref={containerRef} className="relative flex-1 px-6 md:px-12 pb-4 min-h-0">
        {/* SVG for curved lines */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ overflow: 'visible' }}
        >
          {linePositions.map((line, i) => (
            <path
              key={i}
              d={generateCurvedPath(line.x1, line.y1, line.x2, line.y2)}
              fill="none"
              stroke={line.isCorrect ? '#22c55e' : '#ef4444'}
              strokeWidth={3}
              strokeLinecap="round"
              className="transition-all duration-300"
              style={{
                filter: `drop-shadow(0 2px 4px ${line.isCorrect ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'})`,
              }}
            />
          ))}
        </svg>

        {/* Two columns - wider and stretch to fill height */}
        {(() => {
          // Calculate dynamic height per item based on count
          const itemCount = slide.pairs.length;
          const baseHeight = itemCount <= 3 ? 80 : itemCount <= 5 ? 65 : itemCount <= 7 ? 55 : 45;
          
          return (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'stretch',
              height: '100%',
            }}>
              {/* Left column */}
              <div style={{ width: '45%', maxWidth: '360px', minWidth: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
                {leftItems.map((item) => {
                  const conn = getConnectionForLeft(item.id);
                  return (
                    <div key={item.id} style={{ padding: '4px 0' }}>
                      <PairItemDisplay
                        item={item}
                        isSelected={selectedLeft === item.id}
                        connection={conn}
                        onClick={() => handleLeftClick(item.id)}
                        disabled={readOnly || isLeftConnected(item.id)}
                        itemRef={(el) => { leftRefs.current[item.id] = el; }}
                        minHeight={baseHeight}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Right column */}
              <div style={{ width: '45%', maxWidth: '360px', minWidth: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
                {rightItems.map((item) => {
                  const conn = getConnectionForRight(item.id);
                  return (
                    <div key={item.id} style={{ padding: '4px 0' }}>
                      <PairItemDisplay
                        item={item}
                        isSelected={selectedRight === item.id}
                        connection={conn}
                        onClick={() => handleRightClick(item.id)}
                        disabled={readOnly || isRightConnected(item.id)}
                        itemRef={(el) => { rightRefs.current[item.id] = el; }}
                        minHeight={baseHeight}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Footer - Actions and results */}
      <div className="flex-shrink-0 px-6 pb-6">
        {/* Actions */}
        {!readOnly && !isTeacher && (
          <div className="flex justify-center gap-4 mb-4">
            <button
              onClick={handleReset}
              disabled={connections.length === 0}
              className="px-6 py-3 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Začít znovu
            </button>
          </div>
        )}

        {/* Final result */}
        {allConnected && (
          <div className="text-center">
            <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl ${
              score.correct === score.total ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {score.correct === score.total ? (
                <Check className="w-5 h-5" />
              ) : null}
              <span className="font-bold text-lg">
                {score.correct === score.total 
                  ? 'Výborně! Vše správně!' 
                  : `${score.correct} z ${score.total} správně`}
              </span>
            </div>
          </div>
        )}

        {/* Teacher view - show all connections */}
        {isTeacher && (
          <div className="p-4 bg-slate-50 rounded-xl">
            <h3 className="font-medium text-slate-700 mb-3">Správné odpovědi:</h3>
            <div className="space-y-2">
              {slide.pairs.map((pair, i) => (
                <div key={pair.id} className="flex items-center gap-3 text-sm">
                  <span className="text-slate-500">{i + 1}.</span>
                  <span className="font-medium">
                    {pair.left.type === 'image' ? '🖼️' : pair.left.content}
                  </span>
                  <span className="text-violet-500">↔</span>
                  <span className="font-medium">
                    {pair.right.type === 'image' ? '🖼️' : pair.right.content}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConnectPairsView;
