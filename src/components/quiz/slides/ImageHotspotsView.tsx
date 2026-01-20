/**
 * Image Hotspots Slide View (Poznávačka)
 * 
 * Student view for image identification activities
 * Click on hotspot to open dropdown with options or numeric keypad
 * Large image with clickable hotspots
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Check,
  X,
  MapPin,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';
import { ImageHotspotsActivitySlide, ImageHotspot, HotspotMarkerStyle } from '../../../types/quiz';

interface ImageHotspotsViewProps {
  slide: ImageHotspotsActivitySlide;
  isTeacher?: boolean;
  readOnly?: boolean;
  onSubmit?: (result: { correct: number; total: number; answers: Record<string, string> }) => void;
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

// Get marker size based on style (base size before multiplier)
function getMarkerSize(style: HotspotMarkerStyle): number {
  switch (style) {
    case 'circle-medium': return 36;
    case 'pin': return 40;
    case 'question-mark': return 36;
    default: return 36;
  }
}

// Clickable hotspot marker with different styles
function HotspotMarker({
  hotspot,
  index,
  isAnswered,
  isCorrect,
  showResult,
  isOpen,
  onClick,
  markerStyle,
  markerSize = 1,
  displayValue,
}: {
  hotspot: ImageHotspot;
  index: number;
  isAnswered: boolean;
  isCorrect?: boolean;
  showResult: boolean;
  isOpen: boolean;
  onClick: () => void;
  markerStyle: HotspotMarkerStyle;
  markerSize?: number;
  displayValue?: string; // For showing selected number/answer
}) {
  const baseSize = getMarkerSize(markerStyle);
  const size = Math.round(baseSize * markerSize);
  
  const getBackgroundColor = () => {
    if (showResult && isAnswered) {
      return isCorrect ? '#22c55e' : '#ef4444';
    }
    if (isOpen) return '#7C3AED';
    if (isAnswered) return '#14b8a6';
    return '#64748b';
  };

  const renderMarkerContent = () => {
    // Show result icons
    if (showResult && isAnswered) {
      return isCorrect ? <Check className="w-5 h-5 text-white" /> : <X className="w-5 h-5 text-white" />;
    }

    // Show selected value (for numeric answers)
    if (displayValue && isAnswered) {
      const fontSize = Math.max(12, size * 0.5);
      return <span className="text-white font-bold" style={{ fontSize: `${fontSize}px` }}>{displayValue}</span>;
    }

    switch (markerStyle) {
      case 'question-mark':
        return <HelpCircle style={{ width: `${size * 0.5}px`, height: `${size * 0.5}px` }} className="text-violet-600" />;
      case 'pin':
        return <MapPin style={{ width: `${size * 0.5}px`, height: `${size * 0.5}px` }} className="text-white" />;
      default:
        return <span className="text-white font-bold" style={{ fontSize: `${Math.max(12, size * 0.4)}px` }}>{index + 1}</span>;
    }
  };

  const getMarkerStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      left: `${hotspot.x}%`,
      top: `${hotspot.y}%`,
      width: `${size}px`,
      height: `${size}px`,
      zIndex: isOpen ? 100 : 10,
    };

    if (markerStyle === 'question-mark') {
      // If answered, use filled background to show the number
      if (isAnswered) {
        return {
          ...base,
          backgroundColor: getBackgroundColor(),
          border: 'none',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        };
      }
      return {
        ...base,
        backgroundColor: 'white',
        border: '2px solid #7C3AED',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      };
    }

    if (markerStyle === 'pin') {
      return {
        ...base,
        backgroundColor: getBackgroundColor(),
        borderRadius: '50% 50% 50% 0',
        transform: 'translate(-50%, -50%) rotate(-45deg)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      };
    }

    // Circle styles
    return {
      ...base,
      backgroundColor: getBackgroundColor(),
      borderRadius: '50%',
      boxShadow: isOpen 
        ? '0 0 0 4px rgba(124, 58, 237, 0.3), 0 4px 12px rgba(0,0,0,0.3)' 
        : '0 2px 8px rgba(0,0,0,0.3)',
    };
  };

  return (
    <button
      onClick={onClick}
      className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110 flex items-center justify-center"
      style={getMarkerStyle()}
    >
      {markerStyle === 'pin' ? (
        <div style={{ transform: 'rotate(45deg)' }}>
          {renderMarkerContent()}
        </div>
      ) : (
        renderMarkerContent()
      )}
    </button>
  );
}

// Popup dropdown for ABC answers
function ABCPopup({
  options,
  selectedOption,
  onSelect,
  onClose,
  position,
}: {
  options: Array<{ id: string; content: string; isCorrect: boolean }>;
  selectedOption?: string;
  onSelect: (optionId: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const getPopupStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: 'absolute',
      zIndex: 1000,
      minWidth: '200px',
      maxWidth: '280px',
    };

    if (position.y > 60) {
      style.bottom = `${100 - position.y + 5}%`;
    } else {
      style.top = `${position.y + 5}%`;
    }

    if (position.x > 50) {
      style.right = `${100 - position.x + 2}%`;
    } else {
      style.left = `${position.x + 2}%`;
    }

    return style;
  };

  return (
    <div
      ref={popupRef}
      className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
      style={getPopupStyle()}
    >
      <div className="p-3 bg-slate-50 border-b border-slate-200">
        <p className="font-medium text-slate-700 text-sm">Vyber správnou odpověď:</p>
      </div>
      <div className="p-2">
        {options.map((option) => {
          const isSelected = selectedOption === option.id;
          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className="w-full p-3 rounded-lg text-left transition-all flex items-center gap-2 mb-1 last:mb-0"
              style={{
                backgroundColor: isSelected ? '#f0fdf4' : '#f8fafc',
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: isSelected ? '#14b8a6' : 'transparent',
              }}
            >
              <span className="font-medium text-slate-700 flex-1">{option.content}</span>
              {isSelected && <Check className="w-4 h-4 text-teal-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Numeric keypad popup
function NumericKeypad({
  onSelect,
  onClose,
  position,
  selectedValue,
}: {
  onSelect: (value: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
  selectedValue?: string;
}) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const getPopupStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: 'absolute',
      zIndex: 1000,
    };

    if (position.y > 50) {
      style.bottom = `${100 - position.y + 5}%`;
    } else {
      style.top = `${position.y + 5}%`;
    }

    if (position.x > 50) {
      style.right = `${100 - position.x + 2}%`;
    } else {
      style.left = `${position.x + 2}%`;
    }

    return style;
  };

  const keys = [
    ['7', '8', '9', ':'],
    ['4', '5', '6', '.'],
    ['1', '2', '3', '-'],
    ['0', ',', '=', '+'],
  ];

  return (
    <div
      ref={popupRef}
      style={{
        ...getPopupStyle(),
        backgroundColor: '#e2e8f0',
        borderRadius: '32px',
        padding: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {keys.flat().map((key) => {
          const isSelected = selectedValue === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 500,
                border: isSelected ? 'none' : '1px solid #cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: isSelected ? '#5B5FC7' : '#f8fafc',
                color: isSelected ? 'white' : '#4E5871',
                boxShadow: isSelected 
                  ? '0 4px 12px rgba(91, 95, 199, 0.4)' 
                  : '4px 4px 8px rgba(0, 0, 0, 0.06), -4px -4px 8px rgba(255, 255, 255, 0.8)',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Smart text comparison - normalizes text and evaluates math
function smartCompare(userAnswer: string, correctAnswer: string): boolean {
  // Normalize both strings
  const normalize = (str: string): string => {
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '') // Remove all spaces
      .replace(/[.,;:!?'"]/g, '') // Remove punctuation
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
  };

  const normalizedUser = normalize(userAnswer);
  const normalizedCorrect = normalize(correctAnswer);

  // Direct match
  if (normalizedUser === normalizedCorrect) return true;

  // Try to evaluate as math expression
  try {
    // Check if both can be evaluated as numbers or fractions
    const evalMath = (str: string): number | null => {
      // Handle fractions like 8/8, 1/2, etc.
      const fractionMatch = str.match(/^(-?\d+)\/(-?\d+)$/);
      if (fractionMatch) {
        const [, num, den] = fractionMatch;
        if (parseInt(den) === 0) return null;
        return parseInt(num) / parseInt(den);
      }
      
      // Try parsing as number
      const num = parseFloat(str.replace(',', '.'));
      if (!isNaN(num)) return num;
      
      return null;
    };

    const userVal = evalMath(normalizedUser);
    const correctVal = evalMath(normalizedCorrect);

    if (userVal !== null && correctVal !== null) {
      // Compare with small epsilon for floating point
      return Math.abs(userVal - correctVal) < 0.0001;
    }
  } catch {
    // Ignore math evaluation errors
  }

  return false;
}

// Text input popup
function TextInputPopup({
  correctAnswer,
  onSubmit,
  onClose,
  position,
}: {
  correctAnswer: string;
  onSubmit: (isCorrect: boolean, userAnswer: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const getPopupStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: 'absolute',
      zIndex: 1000,
      minWidth: '220px',
    };

    if (position.y > 60) {
      style.bottom = `${100 - position.y + 5}%`;
    } else {
      style.top = `${position.y + 5}%`;
    }

    if (position.x > 50) {
      style.right = `${100 - position.x + 2}%`;
    } else {
      style.left = `${position.x + 2}%`;
    }

    return style;
  };

  const handleSubmit = () => {
    if (!value.trim()) return;
    const isCorrect = smartCompare(value, correctAnswer);
    onSubmit(isCorrect, value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div
      ref={popupRef}
      className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
      style={getPopupStyle()}
    >
      <div className="p-3 bg-slate-50 border-b border-slate-200">
        <p className="font-medium text-slate-700 text-sm">Napiš odpověď:</p>
      </div>
      <div className="p-3">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tvá odpověď..."
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-teal-500 outline-none text-base"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="w-full mt-2 py-2 rounded-lg font-medium text-white transition-all disabled:opacity-50"
          style={{ backgroundColor: value.trim() ? '#14b8a6' : '#94a3b8' }}
        >
          Potvrdit
        </button>
      </div>
    </div>
  );
}

export function ImageHotspotsView({
  slide,
  isTeacher = false,
  readOnly = false,
  onSubmit,
  showResults = false,
}: ImageHotspotsViewProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [openHotspotId, setOpenHotspotId] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [currentHotspotIndex, setCurrentHotspotIndex] = useState(0);

  // Determine if we're in sequential mode
  const showAllHotspots = slide.showAllHotspots !== false; // default to true

  // Store shuffled hotspots order in ref (shuffle once on mount)
  // In sequential mode (!showAllHotspots), always shuffle
  const shuffledHotspotsRef = useRef<ImageHotspot[] | null>(null);
  if (!shuffledHotspotsRef.current) {
    const shouldShuffle = !showAllHotspots || slide.randomizeOrder;
    shuffledHotspotsRef.current = shouldShuffle 
      ? shuffleArray(slide.hotspots) 
      : [...slide.hotspots];
  }
  const orderedHotspots = shuffledHotspotsRef.current;

  // In sequential mode, get the current hotspot
  const currentHotspot = orderedHotspots[currentHotspotIndex];

  // Get marker style and size (use slide settings or defaults)
  const markerStyle = slide.markerStyle || 'circle-medium';
  const markerSize = slide.markerSize || 1;
  const answerType = slide.answerType || 'abc';

  // Get display value for a hotspot (for numeric answers)
  const getDisplayValue = (hotspotId: string): string | undefined => {
    const answer = answers[hotspotId];
    if (!answer || answerType !== 'numeric') return undefined;
    
    // Extract the value from 'correct' or 'wrong-X' format
    if (answer === 'correct') {
      const hotspot = orderedHotspots.find(h => h.id === hotspotId);
      return hotspot?.label;
    }
    if (answer.startsWith('wrong-')) {
      return answer.replace('wrong-', '');
    }
    return undefined;
  };

  // Generate options for a hotspot (ABC mode)
  const getOptionsForHotspot = useMemo(() => {
    return (hotspot: ImageHotspot) => {
      const allLabels = slide.hotspots.map(h => h.label);
      const correctLabel = hotspot.label;
      const wrongLabels = allLabels.filter(l => l !== correctLabel);
      const shuffledWrong = shuffleArray(wrongLabels).slice(0, 3);
      
      return shuffleArray([
        { id: 'correct', content: correctLabel, isCorrect: true },
        ...shuffledWrong.map((label, i) => ({
          id: `wrong-${i}`,
          content: label,
          isCorrect: false,
        })),
      ]);
    };
  }, [slide.hotspots]);

  // Store options per hotspot (generate once)
  const optionsMapRef = useRef<Record<string, Array<{ id: string; content: string; isCorrect: boolean }>>>({});
  
  const getOptions = (hotspot: ImageHotspot) => {
    if (!optionsMapRef.current[hotspot.id]) {
      optionsMapRef.current[hotspot.id] = getOptionsForHotspot(hotspot);
    }
    return optionsMapRef.current[hotspot.id];
  };

  // Advance to next hotspot in sequential mode
  const advanceToNext = () => {
    if (!showAllHotspots && currentHotspotIndex < orderedHotspots.length - 1) {
      setCurrentHotspotIndex(prev => prev + 1);
    }
  };

  // Handle hotspot click
  const handleHotspotClick = (hotspotId: string) => {
    if (readOnly || showResult || showResults) return;
    // In sequential mode, only allow clicking the current hotspot
    if (!showAllHotspots && hotspotId !== currentHotspot?.id) return;
    setOpenHotspotId(openHotspotId === hotspotId ? null : hotspotId);
  };

  // Handle option select (ABC mode)
  const handleOptionSelect = (hotspotId: string, optionId: string) => {
    if (readOnly || showResult || showResults) return;
    
    setAnswers(prev => ({
      ...prev,
      [hotspotId]: optionId,
    }));
    setOpenHotspotId(null);
    
    // Auto-advance in sequential mode
    setTimeout(advanceToNext, 300);
  };

  // Handle numeric select
  const handleNumericSelect = (hotspotId: string, value: string) => {
    if (readOnly || showResult || showResults) return;
    
    const hotspot = orderedHotspots.find(h => h.id === hotspotId);
    const isCorrect = hotspot?.label === value;
    
    setAnswers(prev => ({
      ...prev,
      [hotspotId]: isCorrect ? 'correct' : `wrong-${value}`,
    }));
    setOpenHotspotId(null);
    
    // Auto-advance in sequential mode
    setTimeout(advanceToNext, 300);
  };

  // Handle text input submit
  const handleTextSubmit = (hotspotId: string, isCorrect: boolean, userAnswer: string) => {
    if (readOnly || showResult || showResults) return;
    
    setAnswers(prev => ({
      ...prev,
      [hotspotId]: isCorrect ? 'correct' : `wrong-${userAnswer}`,
    }));
    setOpenHotspotId(null);
    
    // Auto-advance in sequential mode
    setTimeout(advanceToNext, 300);
  };

  // Calculate score
  const score = useMemo(() => {
    let correct = 0;
    orderedHotspots.forEach(h => {
      if (answers[h.id] === 'correct') {
        correct++;
      }
    });
    return { correct, total: orderedHotspots.length };
  }, [orderedHotspots, answers]);

  // Check if all answered
  const allAnswered = Object.keys(answers).length === orderedHotspots.length;

  // Submit results
  const handleSubmit = () => {
    setShowResult(true);
    onSubmit?.({
      correct: score.correct,
      total: score.total,
      answers,
    });
  };

  // Reset
  const handleReset = () => {
    setAnswers({});
    setOpenHotspotId(null);
    setShowResult(false);
    setCurrentHotspotIndex(0);
    optionsMapRef.current = {};
  };

  const showResultsNow = showResults || showResult;

  // If no hotspots, show message
  if (slide.hotspots.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-3xl">
        <div className="text-center text-slate-500">
          <MapPin className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Žádné body k identifikaci</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-teal-50/30 rounded-3xl flex flex-col overflow-hidden">
      {/* Compact Header - title left, buttons right */}
      <div className="flex-shrink-0 px-5 py-4 flex items-center justify-between" style={{ paddingTop: '20px' }}>
        {/* Left: Title and progress */}
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-[#4E5871]">
            {slide.instruction || 'Poznávačka'}
          </h2>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
            <MapPin className="w-5 h-5 text-teal-500" />
            <span className="font-medium text-slate-600">
              {Object.keys(answers).length}/{orderedHotspots.length}
            </span>
          </div>
          {showResultsNow && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-sm ${
              score.correct === score.total ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <Check className="w-5 h-5" />
              <span className="font-bold">{score.correct} správně</span>
            </div>
          )}
        </div>

        {/* Right: Buttons */}
        <div className="flex items-center gap-3">
          {!showResultsNow && !isTeacher && (
            <>
              <button
                onClick={handleReset}
                disabled={Object.keys(answers).length === 0}
                className="px-5 py-2.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Reset
              </button>
              <button
                onClick={handleSubmit}
                disabled={!allAnswered}
                className="px-6 py-2.5 rounded-xl font-bold text-white transition-all hover:scale-105 disabled:opacity-50 disabled:transform-none"
                style={{
                  background: allAnswered 
                    ? 'linear-gradient(to right, #14b8a6, #0ea5e9)' 
                    : '#94a3b8',
                }}
              >
                Vyhodnotit
              </button>
            </>
          )}
          {showResultsNow && !isTeacher && (
            <button
              onClick={handleReset}
              className="px-5 py-2.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Zkusit znovu
            </button>
          )}
        </div>
      </div>

      {/* Image container - takes all remaining space */}
      <div className="flex-1 px-2 pb-2 min-h-0 flex items-center justify-center">
        <div className="relative w-full h-full flex items-center justify-center">
          <div className="relative max-w-full max-h-full">
            <img
              src={slide.imageUrl}
              alt="Obrázek"
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: 'calc(100vh - 120px)' }}
            />
            
            {/* Hotspot markers */}
            {orderedHotspots.map((hotspot, idx) => {
              // In sequential mode, only show current and answered hotspots
              if (!showAllHotspots && !showResultsNow) {
                const isCurrentOrAnswered = idx === currentHotspotIndex || !!answers[hotspot.id];
                if (!isCurrentOrAnswered) return null;
              }
              
              return (
                <HotspotMarker
                  key={hotspot.id}
                  hotspot={hotspot}
                  index={idx}
                  isAnswered={!!answers[hotspot.id]}
                  isCorrect={answers[hotspot.id] === 'correct'}
                  showResult={showResultsNow}
                  isOpen={openHotspotId === hotspot.id}
                  onClick={() => handleHotspotClick(hotspot.id)}
                  markerStyle={markerStyle}
                  markerSize={markerSize}
                  displayValue={getDisplayValue(hotspot.id)}
                />
              );
            })}

            {/* Popup for open hotspot */}
            {openHotspotId && !showResultsNow && (
              (() => {
                const hotspot = orderedHotspots.find(h => h.id === openHotspotId);
                if (!hotspot) return null;
                
                if (answerType === 'numeric') {
                  return (
                    <NumericKeypad
                      onSelect={(value) => handleNumericSelect(hotspot.id, value)}
                      onClose={() => setOpenHotspotId(null)}
                      position={{ x: hotspot.x, y: hotspot.y }}
                      selectedValue={answers[hotspot.id]?.replace('wrong-', '')}
                    />
                  );
                }

                if (answerType === 'text') {
                  return (
                    <TextInputPopup
                      correctAnswer={hotspot.label}
                      onSubmit={(isCorrect, userAnswer) => handleTextSubmit(hotspot.id, isCorrect, userAnswer)}
                      onClose={() => setOpenHotspotId(null)}
                      position={{ x: hotspot.x, y: hotspot.y }}
                    />
                  );
                }
                
                return (
                  <ABCPopup
                    options={getOptions(hotspot)}
                    selectedOption={answers[hotspot.id]}
                    onSelect={(optionId) => handleOptionSelect(hotspot.id, optionId)}
                    onClose={() => setOpenHotspotId(null)}
                    position={{ x: hotspot.x, y: hotspot.y }}
                  />
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* Teacher view - show all answers */}
      {isTeacher && (
        <div className="flex-shrink-0 px-4 pb-4">
          <div className="p-3 bg-slate-50 rounded-xl">
            <h3 className="font-medium text-slate-700 mb-2 text-sm">Správné odpovědi:</h3>
            <div className="flex flex-wrap gap-2">
              {slide.hotspots.map((hotspot, i) => (
                <div key={hotspot.id} className="flex items-center gap-1.5 text-sm bg-white px-2 py-1 rounded-lg">
                  <span className="w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center font-bold text-xs">
                    {i + 1}
                  </span>
                  <span className="font-medium text-slate-700">{hotspot.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageHotspotsView;
