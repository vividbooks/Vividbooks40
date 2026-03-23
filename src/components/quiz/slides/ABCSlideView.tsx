import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { MathText } from '../../math/MathText';
import { AutoScaleQuestion } from '../AutoScaleQuestion';
import { ABCActivitySlide, QuizSlide } from '../../../types/quiz';
import { isABCAnswerSelected, toggleABCAnswerSelection } from '../../../utils/abc-evaluation';

export interface SlideViewProps {
  slide: QuizSlide;
  showHint: boolean;
  showSolution: boolean;
  selectedAnswer?: string | string[];
  onSelectAnswer?: (answerId: string | string[]) => void;
}

// Maximally distinct colors — evenly spread around the hue wheel, no pure green/red
export const VOTE_COLORS = ['#6366f1', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#a855f7'];

export function ABCSlideView({ slide, showHint, showSolution, selectedAnswer, onSelectAnswer, voteCounts }: SlideViewProps & { slide: ABCActivitySlide; voteCounts?: Record<string, number> }) {
  const hasImage = !!slide.media?.url;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const answerType = (slide as any).answerType;
  const isBubblesMode = answerType === 'bubbles' || answerType === 'squares';
  const isSquaresStyle = answerType === 'squares';
  const isSquareMode = answerType === 'image' || answerType === 'emoji';
  const optionCount = slide.options.length;
  const bubbleColors = ['#93C5FD', '#7DD3FC', '#A5B4FC', '#BAE6FD', '#C7D2FE', '#E0F2FE'];

  const getSquareSize = () => {
    if (isMobile) return optionCount <= 2 ? '168px' : '120px';
    if (optionCount <= 2) return '240px';
    if (optionCount <= 3) return '192px';
    return '168px';
  };

  const seeded = (i: number, salt: number) => {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const renderBubbleOption = (option: any, idx: number) => {
    const isSelected = isABCAnswerSelected(selectedAnswer, option.id);
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
        onClick={() => onSelectAnswer?.(toggleABCAnswerSelection(selectedAnswer, option.id, slide.allowMultipleCorrect))}
        disabled={showSolution}
        className="flex items-center justify-center font-bold transition-all"
        style={{
          width: size, height: size,
          borderRadius: isSquaresStyle ? (isMobile ? 20 : 28) : '50%',
          backgroundColor: isCorrect ? '#10B981' : isWrong ? '#EF4444' : color,
          color: (isCorrect || isWrong) ? '#fff' : '#1e3a5f',
          fontSize: isMobile ? 18 : size > 180 ? 32 : 26,
          border: isSelected && !showSolution ? '4px solid #1e40af' : isCorrect ? '4px solid #059669' : isWrong ? '4px solid #DC2626' : '4px solid transparent',
          boxShadow: isSelected ? '0 6px 24px rgba(59,130,246,0.3)' : '0 3px 12px rgba(59,130,246,0.15)',
          transform: `translate(${offsetX}px, ${offsetY}px) rotate(${isSelected ? 0 : rotation}deg) scale(${isSelected ? 1.1 : scaleJitter})`,
          lineHeight: 1.2, textAlign: 'center', padding: isMobile ? 10 : 12,
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transform: isSquaresStyle ? undefined : `rotate(${isSelected ? 0 : -rotation}deg)` }}>
          <span style={{ fontSize: isMobile ? 11 : 13, fontWeight: 800, opacity: 0.5, letterSpacing: 1 }}>{String.fromCharCode(65 + idx)}</span>
          <MathText>{option.textContent || option.content || option.label}</MathText>
          {(isCorrect || isWrong) && <span style={{ fontSize: isMobile ? 18 : 24 }}>{isCorrect ? '✓' : '✗'}</span>}
        </span>
      </button>
    );
  };

  const renderOption = (option: any, idx: number) => {
    const isSelected = isABCAnswerSelected(selectedAnswer, option.id);
    const isCorrect = showSolution && option.isCorrect;
    const isWrong = showSolution && isSelected && !option.isCorrect;
    const isPresentMode = !!voteCounts;
    const hasVotes = isPresentMode && (voteCounts![option.id] ?? 0) > 0;
    const optionAccent = VOTE_COLORS[idx % VOTE_COLORS.length];

    const presentBorderColor = showSolution
      ? (isCorrect ? '#16a34a' : hasVotes ? '#dc2626' : '#94a3b8')
      : optionAccent;
    const presentBgColor = showSolution
      ? (isCorrect ? '#f0fdf4' : hasVotes ? '#fef2f2' : 'transparent')
      : `${optionAccent}14`;

    return (
      <button
        key={option.id}
        onClick={() => onSelectAnswer?.(toggleABCAnswerSelection(selectedAnswer, option.id, slide.allowMultipleCorrect))}
        disabled={showSolution}
        className={`
          relative p-3 md:p-4 rounded-2xl text-left transition-all border-2 
          ${isSquareMode ? 'flex flex-col items-center justify-center' : 'flex items-center gap-3 md:gap-4'}
          ${isPresentMode ? '' : isCorrect ? 'bg-green-50 border-green-500' : ''}
          ${isPresentMode ? '' : isWrong ? 'bg-red-50 border-red-500' : ''}
          ${isPresentMode ? '' : !showSolution && isSelected ? 'border-indigo-500 bg-indigo-50' : ''}
          ${isPresentMode ? '' : !showSolution && !isSelected ? 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md' : ''}
          ${isPresentMode ? '' : !isCorrect && !isWrong && !isSelected && showSolution ? 'bg-white border-slate-100 opacity-50' : ''}
        `}
        style={{
          ...(isSquareMode ? { width: getSquareSize(), height: getSquareSize() } : {}),
          ...(isPresentMode ? {
            borderColor: presentBorderColor,
            backgroundColor: presentBgColor,
            opacity: (isPresentMode && showSolution && isWrong && !hasVotes) ? 0.35 : 1,
            transition: 'border-color 0.3s, background-color 0.3s, opacity 0.3s',
          } : {}),
        }}
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
            backgroundColor: isPresentMode
              ? (showSolution ? (isCorrect ? '#16a34a' : hasVotes ? '#dc2626' : '#94a3b8') : optionAccent)
              : (isCorrect ? '#bbf7d0' : (showSolution && isSelected && !option.isCorrect) ? '#fecaca' : (!showSolution && isSelected) ? '#c7d2fe' : '#cbd5e1'),
            color: isPresentMode
              ? '#fff'
              : (isCorrect ? '#166534' : (showSolution && isSelected && !option.isCorrect) ? '#991b1b' : (!showSolution && isSelected) ? '#3730a3' : '#475569'),
            position: isSquareMode ? 'absolute' : 'relative',
            top: isSquareMode ? '6px' : 'auto',
            left: isSquareMode ? '6px' : 'auto',
          }}
        >
          {option.label || option.id?.toUpperCase() || '?'}
        </span>

        {/* Content based on answer type - strictly separated */}
        {answerType === 'image' ? (
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

        {/* Vote count circle (present mode) */}
        {voteCounts && (
          <span
            style={{
              position: isSquareMode ? 'absolute' : 'relative',
              top: isSquareMode ? 6 : 'auto',
              right: isSquareMode ? 6 : 'auto',
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: showSolution ? (isCorrect ? '#16a34a' : hasVotes ? '#dc2626' : '#94a3b8') : optionAccent,
              color: '#fff',
              fontWeight: 800,
              fontSize: 17,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 2px 8px ${showSolution ? 'rgba(0,0,0,0.2)' : optionAccent + '55'}`,
            }}
          >
            {voteCounts[option.id] ?? 0}
          </span>
        )}
      </button>
    );
  };

  // Bubbles layout - two-column (question left, bubbles right)
  if (isBubblesMode) {
    return (
      <div className={isMobile ? "flex flex-col h-full p-4 overflow-auto" : "flex h-full p-6 gap-6"}>
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
        {/* Right/Bottom: Bubbles */}
        <div
          className="flex flex-col items-center justify-center"
          style={{
            flex: isMobile ? undefined : '0 0 45%',
            minHeight: isMobile ? undefined : '100%',
            gap: isMobile ? 6 : 20,
            padding: isMobile ? '4px 8px 16px' : 24,
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
        <div className="flex-1 flex items-center justify-center py-6 px-2">
          <h1 className="text-2xl font-bold leading-relaxed text-center" style={{ color: '#4E5871' }}>
            <MathText>{slide.question || ''}</MathText>
          </h1>
        </div>

        {hasImage && (
          <div className="flex justify-center py-4">
            <img
              src={slide.media!.url}
              alt="Obrázek k otázce"
              className="max-w-full max-h-40 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        <div className={isSquareMode ? 'grid grid-cols-2 gap-2 pb-4' : 'flex flex-col gap-2 pb-4'}>
          {slide.options.map((opt, idx) => renderOption(opt, idx))}
        </div>

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
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-center p-4" style={{ height: '50%' }}>
            <AutoScaleQuestion targetFill={0.85} maxFontSize={120}>{slide.question || ''}</AutoScaleQuestion>
          </div>
          <div className="flex items-center justify-center overflow-hidden" style={{ height: '50%' }}>
            <img
              src={slide.media!.url}
              alt="Obrázek k otázce"
              className="max-w-full max-h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        </div>

        <div className={isSquareMode
          ? 'flex-shrink-0 flex flex-wrap gap-3 justify-center items-center'
          : 'w-80 flex-shrink-0 flex flex-col gap-3 justify-center'
        }>
          {slide.options.map((opt, idx) => renderOption(opt, idx))}
        </div>

        {showSolution && slide.explanation && (
          <div className="absolute bottom-4 left-6 right-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-blue-800"><MathText>{slide.explanation}</MathText></p>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout WITHOUT image
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center p-6" style={{ height: '65%' }}>
        <AutoScaleQuestion targetFill={0.85} maxFontSize={150}>{slide.question || ''}</AutoScaleQuestion>
      </div>

      <div className="flex-1 flex items-end pb-6">
        <div className={isSquareMode
          ? 'flex gap-4 px-6 justify-center mx-auto'
          : 'grid grid-cols-2 gap-4 px-6 max-w-4xl mx-auto w-full'
        }>
          {slide.options.map((opt, idx) => renderOption(opt, idx))}
        </div>
      </div>

      {showSolution && slide.explanation && (
        <div className="mx-6 mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-blue-800"><MathText>{slide.explanation}</MathText></p>
        </div>
      )}
    </div>
  );
}
