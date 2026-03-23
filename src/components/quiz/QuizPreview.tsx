/**
 * Quiz Preview Component
 * 
 * Uses the EXACT same design as QuizViewPage
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuizNavigation } from '../../hooks/quiz/useQuizNavigation';
import { useSlidePreload } from '../../hooks/quiz/useSlidePreload';
import { useSlideComments } from '../../hooks/quiz/useSlideComments';
import { getQuiz } from '../../utils/quiz-storage';
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Menu,
  PanelLeftClose,
  PanelLeft,
  ExternalLink,
  Globe,
  Youtube,
  MessageSquare,
  Send,
  User,
  Loader2,
} from 'lucide-react';
import { useDeviceDetect } from '../../hooks/useDeviceDetect';
import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  ExampleActivitySlide,
  BoardActivitySlide,
  VotingActivitySlide,
  ConnectPairsActivitySlide,
  FillBlanksActivitySlide,
  ImageHotspotsActivitySlide,
  VideoQuizActivitySlide,
  FlashcardActivitySlide,
  InfoSlide,
  SlideResponse,
  ToolsSlide,
  calculateQuizScore,
  getTemplateById,
} from '../../types/quiz';
import { MathText } from '../math/MathText';
import { AutoScaleQuestion } from './AutoScaleQuestion';
import { ExampleActivityView } from './ExampleActivityView';
import { BoardSlideView } from './slides/BoardSlideView';
import { VotingSlideView } from './slides/VotingSlideView';
import { ConnectPairsView } from './slides/ConnectPairsView';
import { FillBlanksView } from './slides/FillBlanksView';
import { ImageHotspotsView } from './slides/ImageHotspotsView';
import { VideoQuizView } from './slides/VideoQuizView';
import { FormView } from './slides/FormView';
import { CertificateView } from './slides/CertificateView';
import { FlashcardSlideView } from './slides/FlashcardSlideView';
import { checkMathAnswer } from '../../utils/math-compare';
import { evaluateABCAnswer, getABCSelectedAnswerIds } from '../../utils/abc-evaluation';
import { getContrastColor } from '../../utils/color-utils';
import { MathKeyboard } from '../math/MathKeyboard';
import { BlockLayoutView, LottieBlockPreview } from './BlockLayoutView';
import { OsnovaPanel, OsnovaIcon } from './OsnovaPanel';

const NoteIcon = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size * (13/6)} 
    viewBox="0 0 6 13" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ height: size }}
  >
    <g clipPath="url(#clip0_note_icon_preview)">
      <path d="M1.91903 5.57928C1.91903 5.19451 1.80615 5.06625 1.5965 5.05021C1.43524 5.05021 1.27398 5.08228 1.11272 5.21054C0.886947 5.40293 0.677305 5.70754 0.661179 5.89993C0.645052 6.09232 0.661179 6.34884 0.596673 6.50916C0.532168 6.62139 0.43541 6.63742 0.354779 6.63742C0.12901 6.62139 0 6.46107 0 6.18852C0 5.06625 0.935326 4.29669 1.8384 3.96001C2.25768 3.79969 2.69309 3.71952 2.96724 3.71952C3.41878 3.71952 3.77356 4.18446 3.77356 4.66544C3.77356 5.17847 3.6768 5.46706 3.30589 7.87192C3.14463 8.898 2.93499 10.0042 2.93499 10.5814C2.93499 10.9501 3.08012 11.1746 3.48328 11.1746C4.01545 11.1746 4.40248 10.3409 4.43473 9.9882C4.46699 9.73168 4.56374 9.58739 4.74113 9.58739C4.93465 9.58739 5.14429 9.76375 5.14429 10.0042C5.14429 10.405 4.88627 11.2227 4.07996 11.848C3.69292 12.1526 3.17688 12.4251 2.54796 12.4251C1.64488 12.4251 1.08046 11.8159 1.08046 11.0143C1.08046 10.2768 1.19335 9.57136 1.532 8.00018C1.79002 6.84585 1.9029 6.02819 1.9029 5.61135L1.91903 5.57928ZM3.30589 0C3.91869 0 4.30572 0.368746 4.30572 0.945913C4.30572 1.65134 3.61229 2.18041 2.88661 2.18041C2.24156 2.18041 1.85453 1.79563 1.85453 1.25053C1.85453 0.480973 2.61246 0 3.28977 0L3.30589 0Z" fill="currentColor"/>
    </g>
    <defs>
      <clipPath id="clip0_note_icon_preview">
        <rect width="5.12817" height="12.3931" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

interface QuizPreviewProps {
  quiz: Quiz;
  onClose?: () => void;
  isLive?: boolean;
  onComplete?: (responses: SlideResponse[]) => void;
  initialSlideIndex?: number;
  // Public mode for commenting
  isPublicMode?: boolean;
  boardId?: string;
}

// ============================================
// SLIDE RENDERERS - Same as QuizViewPage
// ============================================

function ABCSlideView({ 
  slide, 
  showSolution, 
  selectedAnswer, 
  onSelectAnswer,
  onSubmit,
  hasAnswered,
}: { 
  slide: ABCActivitySlide;
  showSolution: boolean;
  selectedAnswer?: string;
  onSelectAnswer?: (id: string) => void;
  onSubmit?: () => void;
  hasAnswered?: boolean;
}) {
  const hasImage = !!slide.media?.url;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  const answerType = (slide as any).answerType;
  const isBubblesMode = answerType === 'bubbles' || answerType === 'squares';
  const isSquaresStyle = answerType === 'squares';
  const isSquareMode = answerType === 'image' || answerType === 'emoji';
  const optionCount = slide.options.length;
  const bubbleColors = ['#93C5FD', '#7DD3FC', '#A5B4FC', '#BAE6FD', '#C7D2FE', '#E0F2FE'];
  
  // Dynamic size based on option count: 2 options = large, 4+ = smaller
  // Increased by 20% for better visibility
  const getSquareSize = () => {
    if (isMobile) return optionCount <= 2 ? '168px' : '120px';
    if (optionCount <= 2) return '240px';
    if (optionCount <= 3) return '192px';
    return '168px';
  };
  
  // Seeded random for consistent playful positioning
  const seeded = (i: number, salt: number) => {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // Render bubble option with playful rotation/offset
  const renderBubbleOption = (option: any, idx: number) => {
    const isSelected = selectedAnswer === option.id;
    const isCorrect = showSolution && option.isCorrect;
    const isWrong = showSolution && isSelected && !option.isCorrect;
    const color = bubbleColors[idx % bubbleColors.length];
    const size = isMobile ? 130 : optionCount <= 3 ? 220 : 180;
    const rotation = (seeded(idx, 1) - 0.5) * (isMobile ? 14 : 28);
    const offsetX = (seeded(idx, 2) - 0.5) * (isMobile ? 10 : 40);
    const offsetY = (seeded(idx, 3) - 0.5) * (isMobile ? 10 : 40);
    const scaleJitter = 0.95 + seeded(idx, 4) * 0.10;

    return (
      <button
        key={option.id}
        onClick={() => onSelectAnswer?.(option.id)}
        disabled={showSolution}
        className="flex items-center justify-center font-bold transition-all"
        style={{
          width: size,
          height: size,
          borderRadius: isSquaresStyle ? (isMobile ? 20 : 28) : '50%',
          backgroundColor: isCorrect ? '#10B981' : isWrong ? '#EF4444' : color,
          color: (isCorrect || isWrong) ? '#fff' : '#1e3a5f',
          fontSize: isMobile ? 18 : size > 180 ? 32 : 26,
          border: isSelected && !showSolution ? '4px solid #1e40af' : isCorrect ? '4px solid #059669' : isWrong ? '4px solid #DC2626' : '4px solid transparent',
          boxShadow: isSelected ? '0 6px 24px rgba(59,130,246,0.3)' : '0 3px 12px rgba(59,130,246,0.15)',
          transform: `translate(${offsetX}px, ${offsetY}px) rotate(${isSelected ? 0 : rotation}deg) scale(${isSelected ? 1.1 : scaleJitter})`,
          lineHeight: 1.2,
          textAlign: 'center',
          padding: isMobile ? 10 : 12,
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transform: isSquaresStyle ? undefined : `rotate(${isSelected ? 0 : -rotation}deg)` }}>
          <span style={{ fontSize: isMobile ? 11 : 13, fontWeight: 800, opacity: 0.5, letterSpacing: 1 }}>{String.fromCharCode(65 + idx)}</span>
          <MathText>{option.textContent || option.content || option.label}</MathText>
          {(isCorrect || isWrong) && (
            <span style={{ fontSize: isMobile ? 18 : 24 }}>{isCorrect ? '✓' : '✗'}</span>
          )}
        </span>
      </button>
    );
  };

  // Render option button
  const renderOption = (option: any) => {
    const isSelected = selectedAnswer === option.id;
    const isCorrect = showSolution && option.isCorrect;
    const isWrong = showSolution && isSelected && !option.isCorrect;
    
    return (
      <button
        key={option.id}
        onClick={() => onSelectAnswer?.(option.id)}
        disabled={showSolution}
        className={`
          relative p-3 md:p-4 rounded-2xl text-left transition-all border-2 
          ${isSquareMode ? 'flex flex-col items-center justify-center' : 'flex items-center gap-3 md:gap-4'}
          ${isCorrect ? 'bg-green-50 border-green-500' : ''}
          ${isWrong ? 'bg-red-50 border-red-500' : ''}
          ${!showSolution && isSelected ? 'border-indigo-500 bg-indigo-50' : ''}
          ${!showSolution && !isSelected ? 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md' : ''}
          ${!isCorrect && !isWrong && !isSelected && showSolution ? 'bg-white border-slate-100 opacity-50' : ''}
        `}
        style={isSquareMode ? { width: getSquareSize(), height: getSquareSize() } : {}}
      >
        {/* Label */}
        <span 
          style={{
            width: isMobile ? '28px' : '36px',
            height: isMobile ? '28px' : '36px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: isMobile ? '12px' : '14px',
            flexShrink: 0,
            transition: 'all 0.2s',
            backgroundColor: isCorrect ? '#bbf7d0' : isWrong ? '#fecaca' : (!showSolution && isSelected) ? '#c7d2fe' : '#cbd5e1',
            color: isCorrect ? '#166534' : isWrong ? '#991b1b' : (!showSolution && isSelected) ? '#3730a3' : '#475569',
            position: isSquareMode ? 'absolute' : 'relative',
            top: isSquareMode ? '6px' : 'auto',
            left: isSquareMode ? '6px' : 'auto',
          }}
        >
          {option.label || option.id?.toUpperCase() || '?'}
        </span>
        
        {/* Content based on answer type - strictly separated */}
        {answerType === 'image' ? (
          // IMAGE MODE - show image or placeholder
          option.imageUrl ? (
            <img 
              src={option.imageUrl} 
              alt={option.label}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <span className="text-4xl">🖼️</span>
            </div>
          )
        ) : answerType === 'emoji' ? (
          // EMOJI MODE - show emoji only
          <span 
            className="text-center"
            style={{ 
              fontSize: isMobile ? '40px' : optionCount <= 2 ? '72px' : '56px',
              fontFamily: 'Apple Color Emoji, Segoe UI Emoji, sans-serif' 
            }}
          >
            {option.emojiContent || '😊'}
          </span>
        ) : (
          // TEXT MODE - show text only
          <span className="text-base md:text-xl font-medium text-[#4E5871] flex-1">
            <MathText>{option.textContent || option.content || ''}</MathText>
          </span>
        )}
        
        {/* Correct/Wrong indicators */}
        {isCorrect && (
          <CheckCircle className={`w-5 h-5 md:w-6 md:h-6 text-green-600 ${isSquareMode ? 'absolute bottom-2 right-2' : ''}`} />
        )}
        {isWrong && (
          <XCircle className={`w-5 h-5 md:w-6 md:h-6 text-red-500 ${isSquareMode ? 'absolute bottom-2 right-2' : ''}`} />
        )}
      </button>
    );
  };

  // Bubbles layout - always two-column (question left, bubbles right)
  if (isBubblesMode) {
    return (
      <div className={isMobile ? "flex flex-col h-full p-4 overflow-auto" : "flex h-full p-6 gap-6"}>
        {/* Left/Top: Question + Image (identical to regular ABC) */}
        {isMobile ? (
          <>
            <div className="flex-1 flex items-center justify-center py-6 px-2">
              <h1 className="text-2xl font-bold leading-relaxed text-center" style={{ color: '#4E5871' }}>
                <MathText>{slide.question || ''}</MathText>
              </h1>
            </div>
            {hasImage && (
              <div className="flex justify-center py-4">
                <img src={slide.media!.url} alt="" className="max-w-full max-h-40 object-contain" />
              </div>
            )}
          </>
        ) : hasImage ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-center p-4" style={{ height: '50%' }}>
              <AutoScaleQuestion targetFill={0.85} maxFontSize={120}>{slide.question || ''}</AutoScaleQuestion>
            </div>
            <div className="flex items-center justify-center overflow-hidden" style={{ height: '50%' }}>
              <img src={slide.media!.url} alt="" className="max-w-full max-h-full object-contain" />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <AutoScaleQuestion targetFill={0.85} maxFontSize={150}>{slide.question || ''}</AutoScaleQuestion>
          </div>
        )}
        {/* Right/Bottom: Bubbles + submit */}
        {/* Right/Bottom: Bubbles + submit */}
        <div
          className="flex flex-col items-center justify-center"
          style={{
            flex: isMobile ? undefined : '0 0 45%',
            minHeight: isMobile ? undefined : '100%',
            padding: isMobile ? '4px 8px 16px' : 24,
            gap: isMobile ? 10 : 16,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: isMobile ? 8 : 20,
              width: '100%',
              justifyItems: 'center',
              overflow: 'visible',
            }}
          >
            {slide.options.map((opt, i) => renderBubbleOption(opt, i))}
          </div>
          {onSubmit && !hasAnswered && !showSolution && (
            <button
              onClick={onSubmit}
              disabled={!selectedAnswer}
              className="flex items-center gap-2 rounded-xl text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ backgroundColor: '#4F46E5', boxShadow: '0 6px 12px rgba(99,102,241,0.25)', padding: isMobile ? '8px 20px' : '12px 32px', fontSize: isMobile ? 14 : 18 }}
            >
              Odpovědět
            </button>
          )}
        </div>
        {showSolution && slide.explanation && (
          <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-800"><MathText>{slide.explanation}</MathText></p>
          </div>
        )}
      </div>
    );
  }

  // Mobile layout - always vertical
  if (isMobile) {
    return (
      <div className="flex flex-col h-full p-4 overflow-auto">
        {/* Question - more space around it */}
        <div className="flex-1 flex items-center justify-center py-6 px-2">
          <h1 className="text-2xl font-bold leading-relaxed text-center" style={{ color: '#4E5871' }}>
            <MathText>{slide.question || ''}</MathText>
          </h1>
        </div>
        
        {/* Image if present */}
        {hasImage && (
          <div className="flex justify-center py-4">
            <img 
              src={slide.media!.url} 
              alt="Obrázek k otázce"
              className="max-w-full max-h-40 object-contain"
            />
          </div>
        )}
        
        {/* Options - mobile: vertical for text, 2x2 for image/emoji */}
        <div className={isSquareMode ? 'grid grid-cols-2 gap-2 pb-4' : 'flex flex-col gap-2 pb-4'}>
          {slide.options.map(renderOption)}
        </div>
        
        {/* Explanation */}
        {showSolution && slide.explanation && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 mb-4">
            <p className="text-sm text-blue-800"><MathText>{slide.explanation}</MathText></p>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout WITH image: Left side (question + image) | Right side (options)
  if (hasImage) {
    return (
      <div className="flex h-full p-6 gap-6 overflow-hidden">
        {/* Left side - Question and Image */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Question - 50% height */}
          <div className="flex items-center justify-center p-4" style={{ height: '50%' }}>
            <AutoScaleQuestion targetFill={0.85} maxFontSize={120}>{slide.question || ''}</AutoScaleQuestion>
          </div>
          
          {/* Image - 50% height */}
          <div className="flex items-center justify-center overflow-hidden" style={{ height: '50%' }}>
            <img 
              src={slide.media!.url} 
              alt="Obrázek k otázce"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
        
        {/* Right side - Options */}
        <div className={isSquareMode
          ? 'flex-shrink-0 flex flex-wrap gap-3 justify-center items-center'
          : 'w-80 flex-shrink-0 flex flex-col gap-3 justify-center'
        }>
          {slide.options.map(renderOption)}
        </div>
        
        {/* Explanation */}
        {showSolution && slide.explanation && (
          <div className="absolute bottom-4 left-6 right-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-blue-800"><MathText>{slide.explanation}</MathText></p>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout WITHOUT image: Question on top (70%), Options below (30%)
  return (
    <div className="flex flex-col h-full">
      {/* Question - takes 65% of height for maximum visibility on projector */}
      <div className="flex items-center justify-center p-6" style={{ height: '65%' }}>
        <AutoScaleQuestion targetFill={0.85} maxFontSize={150}>{slide.question || ''}</AutoScaleQuestion>
      </div>
      
      {/* Options - row for image/emoji on desktop, 2x2 for text */}
      <div className="flex-1 flex items-end pb-6">
        <div className={isSquareMode
          ? 'flex gap-4 px-6 justify-center mx-auto'
          : 'grid grid-cols-2 gap-4 px-6 max-w-4xl mx-auto w-full'
        }>
          {slide.options.map(renderOption)}
        </div>
      </div>
      
      {/* Explanation */}
      {showSolution && slide.explanation && (
        <div className="mx-6 mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-blue-800"><MathText>{slide.explanation}</MathText></p>
        </div>
      )}
    </div>
  );
}

function OpenSlideView({ 
  slide, 
  textAnswer, 
  setTextAnswer,
  showResult,
  response,
  onSubmit
}: { 
  slide: OpenActivitySlide;
  textAnswer: string;
  setTextAnswer: (text: string) => void;
  showResult: boolean;
  response?: SlideResponse;
  onSubmit?: () => void;
}) {
  return (
    <div className="flex flex-col h-full items-center justify-center p-8">
      <h1 
        className="text-4xl md:text-5xl font-bold text-center leading-tight mb-8"
        style={{ overflowWrap: 'normal', wordBreak: 'normal', hyphens: 'none', color: 'inherit' }}
      >
        <MathText>{slide.question || 'Otevřená otázka...'}</MathText>
      </h1>
      <div className="w-full max-w-2xl">
        <input
          type="text"
          value={textAnswer}
          onChange={(e) => setTextAnswer(e.target.value)}
          disabled={showResult}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && textAnswer.trim() && onSubmit) {
              onSubmit();
            }
          }}
          className={`
            w-full px-6 py-4 text-xl text-center rounded-2xl border-2 outline-none transition-all
            ${showResult 
              ? response?.isCorrect 
                ? 'bg-green-50 border-green-500' 
                : 'bg-red-50 border-red-500'
              : 'border-slate-200 focus:border-indigo-400'
            }
          `}
          placeholder="Napište svou odpověď..."
        />
        
        {/* Result */}
        {showResult && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {response?.isCorrect ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-500" />
                <span className="font-medium text-green-600">Správně!</span>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-red-500" />
                <span className="font-medium text-red-600">
                  Správná odpověď: {slide.correctAnswers[0]}
                </span>
              </>
            )}
          </div>
        )}
        
        {/* Explanation */}
        {showResult && slide.explanation && (
          <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-blue-800"><MathText>{slide.explanation}</MathText></p>
          </div>
        )}
      </div>
    </div>
  );
}

// ExampleSlideView has been moved to shared ExampleActivityView component

function InfoSlideView({ slide }: { slide: InfoSlide }) {
  // If slide has new block-based layout, render it
  if (slide.layout && slide.layout.blocks.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
        <BlockLayoutView slide={slide} />
      </div>
    );
  }

  // Fallback to legacy format
  return (
    <div className="flex flex-col flex-1 h-full p-8">
      {slide.title && (
        <h1 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: 'inherit' }}>
          <MathText>{slide.title}</MathText>
        </h1>
      )}
      <div 
        className="prose prose-lg max-w-none flex-1"
        dangerouslySetInnerHTML={{ __html: slide.content }}
      />
      {slide.media && slide.media.type === 'image' && (
        <img 
          src={slide.media.url} 
          alt={slide.media.caption || ''} 
          className="mt-6 rounded-xl max-w-full mx-auto"
        />
      )}
      {slide.media && slide.media.type === 'lottie' && (
        <div className="mt-6 w-full max-w-md mx-auto aspect-square">
          <LottieBlockPreview url={slide.media.url} loop={true} autoplay={true} />
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function QuizPreview({ quiz, onClose, isLive = false, onComplete, initialSlideIndex = 0, isPublicMode = false, boardId }: QuizPreviewProps) {
  const [responses, setResponses] = useState<SlideResponse[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | string[] | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [formAnswer, setFormAnswer] = useState<Record<string, string | string[]>>({});
  const [showResult, setShowResult] = useState(false);
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const [showNotePanel, setShowNotePanel] = useState(false);
  const [showMathPanel, setShowMathPanel] = useState(false);
  const [showOsnovaPanel, setShowOsnovaPanel] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const sidebarRef = React.useRef<HTMLDivElement>(null);

  // Live worksheetMap — updates when thumbnails are generated in the background
  const [worksheetMap, setWorksheetMap] = React.useState(quiz.worksheetMap);
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ quizId: string }>).detail;
      if (detail?.quizId !== quiz.id) return;
      const fresh = getQuiz(quiz.id);
      if (fresh?.worksheetMap) setWorksheetMap(fresh.worksheetMap);
    };
    window.addEventListener('quiz-thumbnails-updated', handler);
    return () => window.removeEventListener('quiz-thumbnails-updated', handler);
  }, [quiz.id]);
  
  // Device detection - better than just screen width
  const { isMobile: isMobileDevice, isTablet, isTouchDevice } = useDeviceDetect();
  const isMobile = isMobileDevice || isTablet;

  // Navigation hook — must be called before deriving currentSlide
  const {
    currentSlideIndex, setCurrentSlideIndex,
    prevSlideIndex, setPrevSlideIndex,
    isAnimating, setIsAnimating,
    isCompleted, setIsCompleted,
    goToNextSlide,
    goToPrevSlide,
  } = useQuizNavigation({
    slideCount: quiz.slides.length,
    initialSlideIndex,
    allowBack: quiz?.settings?.allowBack ?? true,
    responses,
    onComplete,
  });

  const currentSlide = quiz.slides[currentSlideIndex];
  const currentResponse = responses.find(r => r.slideId === currentSlide?.id);
  const hasAnswered = !!currentResponse;

  // Preload adjacent slide images
  useSlidePreload(currentSlideIndex, quiz.slides);

  // Comments hook (public mode only)
  const {
    showCommentsPanel, setShowCommentsPanel,
    slideComments,
    commentAuthorName, setCommentAuthorName,
    commentContent, setCommentContent,
    submittingComment,
    commentSuccess,
    submitComment,
  } = useSlideComments(isPublicMode, boardId, currentSlide?.id);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        goToPrevSlide();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        if (!isLive || hasAnswered || currentSlide?.type !== 'activity') {
          goToNextSlide();
        }
      } else if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextSlide, goToPrevSlide, isLive, hasAnswered, currentSlide, onClose]);

  // Get chapters from slides with chapterName
  const chapters = quiz.slides
    .map((slide, index) => ({
      index,
      name: (slide as InfoSlide).chapterName,
    }))
    .filter(ch => ch.name);

  const score = calculateQuizScore(responses, quiz.slides);

  // Outer background color (area around slide)
  const bgColor = '#F0F1F8';

  // Slide background color — flashcard uses its own cardColor, others use slideBackground
  const slideBgColor = (currentSlide as any)?.activityType === 'flashcard'
    ? ((currentSlide as any)?.cardColor || '#6366f1')
    : ((currentSlide as any)?.slideBackground?.color || '#ffffff');
  const slideTextColor = getContrastColor(slideBgColor);

  // Reset on slide change
  useEffect(() => {
    setSelectedOption(null);
    setTextAnswer('');
    setShowResult(false);
  }, [currentSlideIndex]);
  
  // Submit answer
  const submitAnswer = () => {
    if (!currentSlide || currentSlide.type !== 'activity') return;
    
    let isCorrect = false;
    let answer: string | string[] = '';
    
    if (currentSlide.activityType === 'abc') {
      const abcSlide = currentSlide as ABCActivitySlide;
      isCorrect = evaluateABCAnswer(abcSlide, selectedOption);
      const selectedIds = getABCSelectedAnswerIds(selectedOption);
      answer = abcSlide.allowMultipleCorrect ? selectedIds : (selectedIds[0] || '');
    } else if (currentSlide.activityType === 'open') {
      const openSlide = currentSlide as OpenActivitySlide;
      // Use mathematical comparison for numeric answers
      isCorrect = checkMathAnswer(textAnswer, openSlide.correctAnswers);
      answer = textAnswer;
    } else if (currentSlide.activityType === 'example') {
      const exampleSlide = currentSlide as ExampleActivitySlide;
      // Use mathematical comparison for example answers (including alternatives)
      const correctAnswers = [
        ...(exampleSlide.finalAnswer ? [exampleSlide.finalAnswer] : []),
        ...(exampleSlide.alternativeAnswers || []).filter(Boolean),
      ];
      isCorrect = checkMathAnswer(textAnswer, correctAnswers);
      answer = textAnswer;
    }
    
    const response: SlideResponse = {
      slideId: currentSlide.id,
      activityType: currentSlide.activityType as any,
      answer,
      isCorrect,
      points: isCorrect ? (currentSlide as any).points || 1 : 0,
      answeredAt: new Date().toISOString(),
      timeSpent: 0,
    };
    
    setResponses([...responses, response]);
    setShowResult(true);
  };
  
  // Restart
  const restart = () => {
    setCurrentSlideIndex(0);
    setPrevSlideIndex(0);
    setResponses([]);
    setIsCompleted(false);
    setSelectedOption(null);
    setTextAnswer('');
    setShowResult(false);
  };
  
  // Simple progress bar - EXACT copy from QuizStudentView (for public mode)
  const renderSimpleProgressBar = () => {
    return (
      <>
        {currentSlideIndex >= 0 && (
          <div
            className="rounded-full"
            style={{ 
              height: '8px',
              backgroundColor: '#475569',
              flex: currentSlideIndex + 1
            }}
          />
        )}
        {quiz.slides.slice(currentSlideIndex + 1).map((_, idx) => (
          <div
            key={idx}
            className="flex-1 rounded-full"
            style={{ 
              height: '8px',
              backgroundColor: '#CBD5E1'
            }}
          />
        ))}
      </>
    );
  };

  // Progress bar renderer
  const renderProgressBar = () => {
    const totalSlides = quiz.slides.length;
    const useSimplifiedBar = totalSlides > 30;
    
    if (useSimplifiedBar) {
      // Simplified progress bar for 30+ slides - just one completed and one remaining segment
      const progressPercent = ((currentSlideIndex + 1) / totalSlides) * 100;
      
      return (
        <div 
          className="flex-1 flex rounded-full overflow-hidden cursor-pointer"
          style={{ height: '8px' }}
          onClick={(e) => {
            if (!isAnimating) {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPercent = (e.clientX - rect.left) / rect.width;
              const targetIndex = Math.floor(clickPercent * totalSlides);
              const clampedIndex = Math.max(0, Math.min(targetIndex, totalSlides - 1));
              
              setIsAnimating(true);
              setPrevSlideIndex(currentSlideIndex);
              setCurrentSlideIndex(clampedIndex);
              setTimeout(() => setIsAnimating(false), 400);
            }
          }}
        >
          {/* Completed part */}
          <div
            className="h-full transition-all duration-300"
            style={{ 
              width: `${progressPercent}%`,
              backgroundColor: '#475569'
            }}
          />
          {/* Remaining part */}
          <div
            className="h-full flex-1"
            style={{ 
              backgroundColor: '#CBD5E1'
            }}
          />
        </div>
      );
    }
    
    // Original segmented progress bar for 30 or fewer slides
    return (
      <>
        {currentSlideIndex >= 0 && (
          <div
            className="rounded-full cursor-pointer hover:opacity-80"
            style={{ 
              height: '8px',
              backgroundColor: '#475569',
              flex: currentSlideIndex + 1
            }}
            onClick={() => {
              if (!isAnimating && currentSlideIndex > 0) {
                setIsAnimating(true);
                setPrevSlideIndex(currentSlideIndex);
                setCurrentSlideIndex(0);
                setTimeout(() => setIsAnimating(false), 400);
              }
            }}
          />
        )}
        {quiz.slides.slice(currentSlideIndex + 1).map((_, idx) => {
          const actualIndex = currentSlideIndex + 1 + idx;
          return (
            <div
              key={actualIndex}
              onClick={() => {
                if (!isAnimating) {
                  setIsAnimating(true);
                  setPrevSlideIndex(currentSlideIndex);
                  setCurrentSlideIndex(actualIndex);
                  setTimeout(() => setIsAnimating(false), 400);
                }
              }}
              className="flex-1 rounded-full cursor-pointer hover:opacity-80"
              style={{ 
                height: '8px',
                backgroundColor: '#CBD5E1'
              }}
            />
          );
        })}
      </>
    );
  };
  
  // Render slide view
  const renderSlideView = (slide: QuizSlide) => {
    switch (slide.type) {
      case 'info':
        return <InfoSlideView slide={slide as InfoSlide} />;
      case 'activity':
        switch ((slide as any).activityType) {
          case 'abc':
            return (
              <ABCSlideView 
                slide={slide as ABCActivitySlide} 
                showSolution={showResult}
                selectedAnswer={selectedOption || undefined}
                onSelectAnswer={setSelectedOption}
                onSubmit={(slide as any).answerType === 'bubbles' ? submitAnswer : undefined}
                hasAnswered={hasAnswered}
              />
            );
          case 'open':
            return (
              <OpenSlideView 
                slide={slide as OpenActivitySlide}
                textAnswer={textAnswer}
                setTextAnswer={setTextAnswer}
                showResult={showResult}
                response={currentResponse}
                onSubmit={submitAnswer}
              />
            );
          case 'example':
            return (
              <ExampleActivityView 
                slide={slide as ExampleActivitySlide}
                textAnswer={textAnswer}
                setTextAnswer={setTextAnswer}
                hasAnswered={showResult}
                response={currentResponse}
                showResults={showResult}
                showExplanation={true}
                onSubmit={submitAnswer}
                customKeys={quiz?.settings?.customKeys}
                extraKeys={quiz?.settings?.extraKeys}
              />
            );
          case 'board':
            return (
              <BoardSlideView 
                slide={slide as BoardActivitySlide}
                posts={[]} // Preview mode - no live posts
                readOnly={true}
                isTeacher={true}
              />
            );
          case 'voting':
            return (
              <VotingSlideView 
                slide={slide as VotingActivitySlide}
                isTeacher={false}
                voteCounts={{}} // Preview mode - no live votes
                totalVoters={0}
                readOnly={false}
              />
            );
          case 'connect-pairs':
            return (
              <ConnectPairsView 
                slide={slide as ConnectPairsActivitySlide}
                isTeacher={false}
                readOnly={false}
              />
            );
          case 'fill-blanks':
            return (
              <FillBlanksView 
                slide={slide as FillBlanksActivitySlide}
                isTeacher={false}
                readOnly={false}
              />
            );
          case 'image-hotspots':
            return (
              <ImageHotspotsView 
                slide={slide as ImageHotspotsActivitySlide}
                isTeacher={false}
                readOnly={false}
              />
            );
          case 'video-quiz':
            return (
              <VideoQuizView 
                slide={slide as VideoQuizActivitySlide}
                isTeacher={false}
                readOnly={false}
              />
            );
          case 'form':
            return (
              <FormView 
                slide={slide as any}
                answer={formAnswer}
                onAnswerChange={(answer) => {
                  setFormAnswer(answer);
                  // Also store as text answer for saving
                  setTextAnswer(JSON.stringify(answer));
                }}
                isReadOnly={false}
              />
            );
          case 'flashcard':
            return (
              <div className="w-full h-full">
                <FlashcardSlideView
                  slide={slide as FlashcardActivitySlide}
                  startFlipped={false}
                />
              </div>
            );
          default:
            return <div className="text-slate-500 text-center">Nepodporovaný typ aktivity</div>;
        }
      case 'tools':
        const toolsSlide = slide as ToolsSlide;
        switch (toolsSlide.toolType) {
          case 'certificate':
            return (
              <CertificateView 
                slide={toolsSlide}
                quiz={quiz}
                isPreview={true}
              />
            );
          default:
            return <div className="text-slate-500 text-center">Nepodporovaný typ nástroje</div>;
        }
      default:
        return <div className="text-slate-500 text-center">Nepodporovaný typ slidu</div>;
    }
  };
  
  // Completed screen
  if (isCompleted) {
    return (
      <div className="fixed inset-0 flex flex-col z-50" style={{ backgroundColor: bgColor }}>
        {/* Header */}
        <div className="flex items-center px-4 py-3">
          {onClose && (
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* Results */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Kvíz dokončen!</h2>
            
            <div className="bg-slate-50 rounded-2xl p-6 my-6">
              <div className="text-5xl font-bold text-indigo-600 mb-2">{score.percentage}%</div>
              <p className="text-slate-600">
                {score.correctCount} z {score.correctCount + score.incorrectCount} správně
              </p>
              <div className="flex justify-center gap-4 mt-4">
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>{score.correctCount}</span>
                </div>
                <div className="flex items-center gap-1 text-red-500">
                  <XCircle className="w-4 h-4" />
                  <span>{score.incorrectCount}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={restart}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Znovu
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
                >
                  Zavřít
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 flex z-50" style={{ backgroundColor: bgColor }}>
      
      {/* Sidebar Area - Desktop - ONLY when sidebar is OPEN - takes space in flex layout */}
      {(showChapterMenu || showNotePanel || showCommentsPanel || showOsnovaPanel) && (
        <div className="hidden lg:flex h-full flex-shrink-0 relative" ref={sidebarRef}>
          {/* Sidebar content */}
          <div className="flex flex-col flex-shrink-0 bg-white/95 backdrop-blur-sm z-30 border-r border-slate-100" style={{ width: sidebarWidth, minWidth: 240, maxWidth: 600 }}>
            {showOsnovaPanel && worksheetMap ? (
              <div className="flex-1 overflow-hidden">
                <OsnovaPanel
                  worksheetMap={worksheetMap}
                  slides={quiz.slides}
                  selectedSlideId={quiz.slides[currentSlideIndex]?.id ?? null}
                  onSlideSelect={(id) => {
                    const idx = quiz.slides.findIndex(s => s.id === id);
                    if (idx >= 0) {
                      setIsAnimating(true);
                      setPrevSlideIndex(currentSlideIndex);
                      setCurrentSlideIndex(idx);
                      setTimeout(() => setIsAnimating(false), 400);
                    }
                  }}
                  headerPaddingTop={16}
                />
              </div>
            ) : (
            <div className="flex-1 overflow-y-auto px-5 py-10" style={{ paddingTop: 100 }}>
              <div className="mb-8">
                <h2 className="text-slate-800 text-lg font-bold leading-tight">{quiz.title}</h2>
              </div>
          
              {showChapterMenu ? (
                /* Chapter list */
                <div className="flex flex-col gap-4">
                  <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-2">Osnova:</h3>
                  {chapters.map((chapter, idx) => {
                    const name = chapter.name || '';
                    const isJustNumber = /^\d+\.?$/.test(name.trim());
                    const displayName = isJustNumber ? `Úloha ${name.replace('.', '')}` : name;
                    
                    return (
                      <button
                        key={chapter.index}
                        onClick={() => {
                          if (!isAnimating) {
                            setIsAnimating(true);
                            setPrevSlideIndex(currentSlideIndex);
                            setCurrentSlideIndex(chapter.index);
                            setTimeout(() => setIsAnimating(false), 400);
                          }
                        }}
                        className={`w-full text-left text-base transition-colors ${
                          currentSlideIndex >= chapter.index && 
                          (idx === chapters.length - 1 || currentSlideIndex < chapters[idx + 1].index)
                            ? 'font-bold text-slate-800' 
                            : 'text-slate-600 hover:text-slate-800 font-medium'
                        }`}
                      >
                        <span className="mr-2">{idx + 1}.</span>
                        {displayName}
                      </button>
                    );
                  })}
                </div>
              ) : showNotePanel ? (
                /* Note content */
                <div className="flex flex-col gap-4">
                  <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-2">Poznámka:</h3>
                  <p className="text-[#4E5871] text-lg font-medium leading-relaxed">
                    {currentSlide?.note}
                  </p>
                </div>
              ) : showCommentsPanel ? (
                /* Comments panel - public mode */
                <div className="flex flex-col gap-4">
                  <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-2">Komentáře:</h3>
                  
                  {/* Previous comments */}
                  {slideComments.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {slideComments.map((comment) => (
                        <div key={comment.id} className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs font-medium text-slate-600">
                              {comment.author_name || 'Anonymní'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(comment.created_at).toLocaleDateString('cs-CZ')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add comment form */}
                  {commentSuccess ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700 font-medium">Komentář odeslán!</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={commentAuthorName}
                        onChange={(e) => setCommentAuthorName(e.target.value)}
                        placeholder="Vaše jméno (volitelné)"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <textarea
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        placeholder="Napište komentář..."
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                      <button
                        onClick={submitComment}
                        disabled={!commentContent.trim() || submittingComment}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2"
                      >
                        {submittingComment ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Odeslat
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            )}
          </div>
          {/* Subtle edge line only */}
          <div className="absolute top-0 h-full w-px bg-slate-200 z-30" style={{ right: -1 }} />
        </div>
      )}

      {/* Control column - always visible on desktop */}
      <div className="hidden lg:flex flex-col items-center flex-shrink-0 h-full relative" style={{ width: 64, paddingTop: 20, gap: 0 }}>
        {/* Buttons group at top */}
        <div className="flex flex-col items-center gap-3">
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.8)', color: '#64748b', border: 'none' }}
              title="Zavřít"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Panel toggle button */}
          {(chapters.length > 0 || (worksheetMap && worksheetMap.pages.length > 0) || currentSlide?.note || isPublicMode) && (() => {
            const isOpen = showChapterMenu || showOsnovaPanel || showNotePanel || showCommentsPanel;
            return (
              <button
                onClick={() => {
                  if (isOpen) {
                    setShowChapterMenu(false); setShowOsnovaPanel(false); setShowNotePanel(false); setShowCommentsPanel(false);
                  } else if (worksheetMap && worksheetMap.pages.length > 0) {
                    setShowOsnovaPanel(true);
                  } else if (chapters.length > 0) {
                    setShowChapterMenu(true);
                  } else if (currentSlide?.note) {
                    setShowNotePanel(true);
                  }
                }}
                className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors"
                style={{ backgroundColor: isOpen ? '#334155' : 'rgba(255,255,255,0.8)', color: isOpen ? 'white' : '#64748b', border: 'none' }}
                title={isOpen ? 'Zavřít panel' : 'Otevřít panel'}
              >
                {isOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
              </button>
            );
          })()}

          {/* Chapter menu button */}
          {chapters.length > 0 && (
            <button
              onClick={() => { setShowNotePanel(false); setShowCommentsPanel(false); setShowOsnovaPanel(false); setShowChapterMenu(!showChapterMenu); }}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors"
              style={{ backgroundColor: showChapterMenu ? '#334155' : 'rgba(255,255,255,0.8)', color: showChapterMenu ? 'white' : '#64748b', border: 'none' }}
              title="Obsah"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Worksheet Osnova button */}
          {worksheetMap && worksheetMap.pages.length > 0 && (
            <button
              onClick={() => { setShowChapterMenu(false); setShowNotePanel(false); setShowCommentsPanel(false); setShowOsnovaPanel(!showOsnovaPanel); }}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors"
              style={{ backgroundColor: showOsnovaPanel ? '#334155' : 'rgba(255,255,255,0.8)', border: 'none' }}
              title="Osnova pracovního listu"
            >
              <OsnovaIcon active={showOsnovaPanel} />
            </button>
          )}

          {/* Note button */}
          {currentSlide?.note && (
            <button
              onClick={() => { setShowChapterMenu(false); setShowCommentsPanel(false); setShowOsnovaPanel(false); setShowNotePanel(!showNotePanel); }}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors"
              style={{ backgroundColor: showNotePanel ? '#334155' : 'rgba(255,255,255,0.8)', color: showNotePanel ? 'white' : '#64748b', border: 'none' }}
              title="Poznámka"
            >
              <NoteIcon size={20} />
            </button>
          )}

          {/* Comments button - public mode only */}
          {isPublicMode && (
            <button
              onClick={() => { setShowChapterMenu(false); setShowNotePanel(false); setShowOsnovaPanel(false); setShowCommentsPanel(!showCommentsPanel); }}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors"
              style={{ backgroundColor: showCommentsPanel ? '#6366f1' : 'rgba(255,255,255,0.8)', color: showCommentsPanel ? 'white' : '#64748b', border: 'none' }}
              title="Komentáře"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Resize grip — visible only when sidebar panel is open */}
        {(showChapterMenu || showNotePanel || showCommentsPanel || showOsnovaPanel) && (
          <div
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 cursor-col-resize group z-50"
            style={{ top: '70%', transform: 'translate(-50%, -50%)' }}
            title="Přetáhnout pro změnu šířky"
            onMouseDown={(e) => {
              e.preventDefault();
              const sidebar = sidebarRef.current?.querySelector(':first-child') as HTMLElement | null;
              if (!sidebar) return;
              const startX = e.clientX;
              const startW = sidebar.getBoundingClientRect().width;
              const onMove = (mv: MouseEvent) => {
                const newW = Math.min(600, Math.max(240, startW + mv.clientX - startX));
                sidebar.style.width = `${newW}px`;
              };
              const onUp = (mv: MouseEvent) => {
                const newW = Math.min(600, Math.max(240, startW + mv.clientX - startX));
                setSidebarWidth(newW);
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          >
            {[0,1,2,3,4].map(i => (
              <div
                key={i}
                className="rounded-full transition-colors group-hover:bg-indigo-400"
                style={{ width: 5, height: 5, backgroundColor: '#94a3b8' }}
              />
            ))}
          </div>
        )}

        {/* Arrow - absolutely centered in the column */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <button
            onClick={goToPrevSlide}
            disabled={currentSlideIndex === 0 || !(quiz?.settings?.allowBack ?? true)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out bg-[#CBD5E1] text-slate-600 ${
              currentSlideIndex === 0 || !(quiz?.settings?.allowBack ?? true) ? 'opacity-30 cursor-not-allowed' : 'hover:h-28'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        
        {/* Score - Desktop - temporarily hidden, will be added back via settings */}
        {/* {quiz.settings.showScore && (
          <div className="hidden lg:flex absolute top-0 right-0 z-20 items-center gap-4 p-4">
            <div className="flex items-center gap-1 text-red-500">
              <XCircle className="w-5 h-5" />
              <span className="font-bold">{score.incorrectCount}</span>
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-bold">{score.correctCount}</span>
            </div>
          </div>
        )} */}
      
        {/* Mobile: Top navigation - EXACT copy from QuizStudentView */}
        <div className="flex lg:hidden items-center gap-3 px-4 py-4" style={{ backgroundColor: '#F0F1F8' }}>
          {/* Comment button for public mode - same style as other buttons */}
          {isPublicMode && (
            <button
              onClick={() => setShowCommentsPanel(!showCommentsPanel)}
              className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                showCommentsPanel 
                  ? 'bg-indigo-500 text-white' 
                  : 'bg-[#CBD5E1] text-slate-600'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          )}
          
          {/* Menu button for chapters - only when NOT in public mode */}
          {chapters.length > 0 && !isPublicMode && (
            <button
              onClick={() => setShowChapterMenu(!showChapterMenu)}
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-[#CBD5E1] text-slate-600"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
      
          {/* Left arrow - exact copy from QuizStudentView */}
          <button
            onClick={goToPrevSlide}
            disabled={currentSlideIndex === 0 || !(quiz?.settings?.allowBack ?? true)}
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${currentSlideIndex === 0 || !(quiz?.settings?.allowBack ?? true) ? 'opacity-30 cursor-not-allowed' : ''} bg-[#CBD5E1] text-slate-600`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        
          {/* Progress bar - use simple version for public mode (same as QuizStudentView) */}
          <div className="flex-1 flex items-center gap-1.5">
            {isPublicMode ? renderSimpleProgressBar() : renderProgressBar()}
          </div>
        
          {/* Right arrow - exact copy from QuizStudentView */}
          <button
            onClick={() => {
              if (!isLive || hasAnswered || currentSlide?.type !== 'activity') {
                goToNextSlide();
              } else if (getABCSelectedAnswerIds(selectedOption).length > 0 || textAnswer.trim()) {
                submitAnswer();
              }
            }}
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white"
            style={{ backgroundColor: '#7C3AED' }}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      
      {/* Main content area with arrows - exact copy from QuizStudentView */}
      <div 
        className="flex-1 flex flex-col overflow-hidden" 
        style={{ 
          backgroundColor: '#F0F1F8',
          minHeight: 0,
        }}
      >
        {/* Desktop: Segmented progress bar - above slide, within 40px top margin */}
        <div 
          className="hidden lg:flex items-end justify-center flex-shrink-0"
          style={{ height: 40, paddingBottom: 8 }}
        >
          <div className="w-1/2 max-w-xl flex items-center gap-1.5">
            {renderProgressBar()}
          </div>
        </div>
        
        {/* Content with arrows - with bottom padding */}
        <div className="flex-1 flex items-stretch overflow-hidden" style={{ 
          minHeight: 0, 
          paddingBottom: isMobile ? 8 : 5,
        }}>
          {/* Slide content - fills remaining space */}
          <div 
            className="flex-1"
            style={{ 
              minHeight: 0,
              overflowY: isMobile ? 'auto' : 'hidden',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              // Padding for shadow visibility
              padding: isMobile ? 8 : 16,
            }}
          >
            {/* Slide card - exact copy from QuizStudentView */}
            <div 
              className={`
                w-full rounded-3xl shadow-md overflow-hidden flex flex-col
                ${currentSlide?.type !== 'info' ? 'max-w-5xl mx-auto' : ''}
                ${currentSlideIndex > prevSlideIndex && isAnimating ? 'animate-slide-in' : ''}
                ${currentSlideIndex < prevSlideIndex && isAnimating ? 'animate-slide-in-left' : ''}
              `}
              style={{
                // Fill available space - on mobile, use minHeight to ensure background extends
                height: isMobile ? 'auto' : '100%',
                minHeight: isMobile ? 'calc(100vh - 140px)' : undefined,
                // Dynamic background and text color based on slide settings
                backgroundColor: slideBgColor,
                color: slideTextColor,
              }}
              key={currentSlideIndex}
            >
              {currentSlide ? (
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                }}>
                  {renderSlideView(currentSlide)}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <p className="text-xl">Žádné slidy</p>
                </div>
              )}
              
              {/* Submit button for activities (except example and bubbles ABC - they have their own) */}
              {currentSlide?.type === 'activity' && currentSlide.activityType !== 'example' && !((currentSlide as any).activityType === 'abc' && ((currentSlide as any).answerType === 'bubbles' || (currentSlide as any).answerType === 'squares')) && !hasAnswered && (
                // Show for regular activities when answer is provided
                (currentSlide.activityType !== 'form' && (getABCSelectedAnswerIds(selectedOption).length > 0 || textAnswer.trim())) ||
                // Show for form when it has fields
                (currentSlide.activityType === 'form' && (currentSlide as any).fields?.length > 0)
              ) && (
                <div className="p-6 flex justify-center border-t border-slate-100">
                  <button
                    onClick={submitAnswer}
                    disabled={
                      currentSlide.activityType === 'form' && 
                      ((currentSlide as any).fields || []).some((field: any) => 
                        field.required && (
                          !formAnswer[field.id] || 
                          (Array.isArray(formAnswer[field.id]) && (formAnswer[field.id] as string[]).length === 0) ||
                          (typeof formAnswer[field.id] === 'string' && !(formAnswer[field.id] as string).trim())
                        )
                      )
                    }
                    className="px-8 py-3 rounded-xl font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {currentSlide.activityType === 'form' ? 'Odeslat formulář' : 'Odpovědět'}
                  </button>
                </div>
              )}
            </div>
            
            {/* Mobile: Extra space at bottom for scrolling */}
            {isMobile && (
              <div style={{ height: '120px', flexShrink: 0 }} />
            )}
          </div>
          
          {/* Desktop: Right arrow */}
          <div className="hidden lg:flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
            <button
              onClick={() => {
                // In preview mode (not live), allow free navigation
                if (!isLive || hasAnswered || currentSlide?.type !== 'activity') {
                  goToNextSlide();
                } else if (getABCSelectedAnswerIds(selectedOption).length > 0 || textAnswer.trim()) {
                  submitAnswer();
                }
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-out hover:h-28"
              style={{ backgroundColor: '#7C3AED' }}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      </div> {/* End of Main content wrapper */}
      
      {/* Mobile Chapter Sidebar - overlay */}
      {showChapterMenu && chapters.length > 0 && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20"
            onClick={() => setShowChapterMenu(false)}
          />
          
          {/* Sidebar - mobile */}
          <div className="relative bg-white shadow-2xl flex flex-col" style={{ width: '75vw', maxWidth: '320px' }}>
            {/* Header */}
            <div className="p-4 flex items-center gap-3 border-b border-slate-100">
              <button
                onClick={() => setShowChapterMenu(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="font-semibold text-slate-700 text-base">Kapitoly</span>
            </div>
            
            {/* Chapter list */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {chapters.map((chapter, idx) => {
                // Format chapter name - if it's just a number, add "Úloha" prefix
                const name = chapter.name || '';
                const isJustNumber = /^\d+\.?$/.test(name.trim());
                const displayName = isJustNumber ? `Úloha ${name.replace('.', '')}` : name;
                
                return (
                <button
                  key={chapter.index}
                  onClick={() => {
                    if (!isAnimating) {
                      setIsAnimating(true);
                      setPrevSlideIndex(currentSlideIndex);
                      setCurrentSlideIndex(chapter.index);
                      setTimeout(() => setIsAnimating(false), 400);
                    }
                    setShowChapterMenu(false);
                  }}
                    className={`w-full text-left py-2 text-base transition-colors ${
                    currentSlideIndex >= chapter.index && 
                    (idx === chapters.length - 1 || currentSlideIndex < chapters[idx + 1].index)
                      ? 'font-semibold text-slate-800' 
                      : 'text-slate-600'
                  }`}
                >
                  <span className="text-slate-400 mr-2">{idx + 1}.</span>
                    {displayName}
                </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Comments Panel - simple overlay matching student view style */}
      {showCommentsPanel && isPublicMode && isMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header - simple like chapter menu */}
          <div className="flex items-center gap-3 p-4 border-b border-slate-100 flex-shrink-0">
            <button
              onClick={() => setShowCommentsPanel(false)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="font-semibold text-slate-700 text-base">Komentáře ({currentSlideIndex + 1}/{quiz.slides.length})</span>
          </div>
          
          {/* Comments list */}
          <div className="flex-1 overflow-y-auto p-4">
            {slideComments.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-base">Zatím žádné komentáře</p>
              </div>
            ) : (
              <div className="space-y-3">
                {slideComments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-600">
                        {comment.author_name || 'Anonym'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(comment.created_at).toLocaleDateString('cs-CZ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Add comment form */}
          <div className="p-4 border-t border-slate-100 flex-shrink-0 bg-white">
            {commentSuccess ? (
              <div className="text-center py-4 text-green-600">
                <CheckCircle className="w-8 h-8 mx-auto mb-1" />
                <p className="text-sm font-medium">Komentář odeslán!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={commentAuthorName}
                  onChange={(e) => setCommentAuthorName(e.target.value)}
                  placeholder="Vaše jméno (volitelné)"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <textarea
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="Napište komentář..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <button
                  onClick={submitComment}
                  disabled={!commentContent.trim() || submittingComment}
                  className={`w-full py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 ${
                    commentContent.trim() && !submittingComment
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {submittingComment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Odesílám...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Odeslat komentář
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Old math panel removed - calculator is now inline in ExampleSlideView */}
    </div>
  );
}

export default QuizPreview;
