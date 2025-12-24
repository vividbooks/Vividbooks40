/**
 * Quiz Preview Component
 * 
 * Uses the EXACT same design as QuizViewPage
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  ExampleActivitySlide,
  InfoSlide,
  SlideResponse,
  calculateQuizScore,
  getTemplateById,
} from '../../types/quiz';
import { MathText } from '../math/MathText';

interface QuizPreviewProps {
  quiz: Quiz;
  onClose?: () => void;
  isLive?: boolean;
  onComplete?: (responses: SlideResponse[]) => void;
}

// ============================================
// SLIDE RENDERERS - Same as QuizViewPage
// ============================================

function ABCSlideView({ 
  slide, 
  showSolution, 
  selectedAnswer, 
  onSelectAnswer 
}: { 
  slide: ABCActivitySlide;
  showSolution: boolean;
  selectedAnswer?: string;
  onSelectAnswer?: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Question */}
      <div className="flex-1 flex items-center justify-center p-8">
        <h1 className="text-4xl md:text-5xl font-bold text-[#4E5871] text-center leading-tight">
          <MathText>{slide.question || 'Otázka...'}</MathText>
        </h1>
      </div>
      
      {/* Options */}
      <div className="grid grid-cols-2 gap-4 p-6 max-w-4xl mx-auto w-full">
        {slide.options.map((option) => {
          const isSelected = selectedAnswer === option.id;
          const isCorrect = showSolution && option.isCorrect;
          const isWrong = showSolution && isSelected && !option.isCorrect;
          
          return (
            <button
              key={option.id}
              onClick={() => onSelectAnswer?.(option.id)}
              disabled={showSolution}
              className={`
                relative p-4 rounded-2xl text-left transition-all border-2 flex items-center gap-4
                ${isCorrect ? 'bg-green-50 border-green-500' : ''}
                ${isWrong ? 'bg-red-50 border-red-500' : ''}
                ${!showSolution && isSelected ? 'border-indigo-500 bg-indigo-50' : ''}
                ${!showSolution && !isSelected ? 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md' : ''}
                ${!isCorrect && !isWrong && !isSelected && showSolution ? 'bg-white border-slate-100 opacity-50' : ''}
              `}
            >
              <span 
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                  backgroundColor: isCorrect ? '#bbf7d0' : isWrong ? '#fecaca' : (!showSolution && isSelected) ? '#c7d2fe' : '#E2E8F0',
                  color: isCorrect ? '#166534' : isWrong ? '#991b1b' : (!showSolution && isSelected) ? '#3730a3' : '#475569',
                }}
              >
                {option.label || option.id?.toUpperCase() || '?'}
              </span>
              <span className="text-xl font-medium text-[#4E5871] flex-1">
                <MathText>{option.content || ''}</MathText>
              </span>
              
              {isCorrect && (
                <CheckCircle className="w-6 h-6 text-green-600" />
              )}
              {isWrong && (
                <XCircle className="w-6 h-6 text-red-500" />
              )}
            </button>
          );
        })}
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
      <h1 className="text-4xl md:text-5xl font-bold text-[#4E5871] text-center leading-tight mb-8">
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

function ExampleSlideView({ slide }: { slide: ExampleActivitySlide }) {
  const [currentStep, setCurrentStep] = useState(0);
  
  return (
    <div className="flex flex-col h-full p-8">
      <h1 className="text-3xl font-bold text-[#4E5871] mb-6">
        <MathText>{slide.title || 'Příklad'}</MathText>
      </h1>
      
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-medium text-slate-600 mb-2">Zadání</h2>
        <p className="text-xl text-[#4E5871]"><MathText>{slide.problem}</MathText></p>
      </div>
      
      {slide.steps.length > 0 && (
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-medium text-slate-500">
              Krok {currentStep + 1} z {slide.steps.length}
            </span>
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${((currentStep + 1) / slide.steps.length) * 100}%` }}
              />
            </div>
          </div>
          
          <div className="bg-indigo-50 rounded-xl p-6 min-h-[200px]">
            <p className="text-lg text-[#4E5871]">
              <MathText>{slide.steps[currentStep]?.content || ''}</MathText>
            </p>
            {slide.steps[currentStep]?.hint && (
              <p className="text-sm text-slate-500 mt-4 italic">
                💡 <MathText>{slide.steps[currentStep].hint}</MathText>
              </p>
            )}
          </div>
          
          <div className="flex justify-between mt-4">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
            >
              Předchozí krok
            </button>
            {currentStep < slide.steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Další krok
              </button>
            ) : slide.finalAnswer ? (
              <div className="px-4 py-2 rounded-lg bg-green-100 text-green-800 font-medium">
                Výsledek: <MathText>{slide.finalAnswer}</MathText>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoSlideView({ slide }: { slide: InfoSlide }) {
  // If slide has new block-based layout, render it
  if (slide.layout && slide.layout.blocks.length > 0) {
    return <BlockLayoutView slide={slide} />;
  }

  // Fallback to legacy format
  return (
    <div className="flex flex-col h-full p-8">
      {slide.title && (
        <h1 className="text-3xl md:text-4xl font-bold text-[#4E5871] mb-6">
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
    </div>
  );
}

// Image block with gallery support for preview
function ImageBlockPreview({ block, borderRadius }: { block: any; borderRadius: number }) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);

  const hasGallery = block.gallery && block.gallery.length > 1;
  const imageScale = block.imageScale || 100;
  // If scale > 100%, use cover mode (crop), otherwise contain
  const imageFit = imageScale > 100 ? 'cover' : (block.imageFit || 'contain');
  const navType = block.galleryNavType || 'dots-bottom';
  
  // Calculate image position for cropped images
  const posX = block.imagePositionX || 0;
  const posY = block.imagePositionY || 0;
  const centerOffset = (100 - imageScale) / 2;
  const moveRange = (imageScale - 100) / 2;
  const imageLeft = centerOffset + (posX / 100) * moveRange;
  const imageTop = centerOffset + (posY / 100) * moveRange;

  // Get current image
  const currentImage = hasGallery
    ? (navType === 'solution' ? (showSolution ? block.gallery[1] : block.gallery[0]) : block.gallery[galleryIndex])
    : block.content;

  const goNext = () => {
    if (hasGallery) {
      setGalleryIndex((prev) => (prev + 1) % block.gallery.length);
    }
  };

  const goPrev = () => {
    if (hasGallery) {
      setGalleryIndex((prev) => (prev - 1 + block.gallery.length) % block.gallery.length);
    }
  };

  if (!currentImage) return null;

  const renderNavigation = () => {
    if (!hasGallery) return null;

    switch (navType) {
      case 'dots-bottom':
        return (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 px-3 py-2 rounded-full">
            {block.gallery.map((_: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setGalleryIndex(idx)}
                className={`w-3 h-3 rounded-full transition-all ${
                  idx === galleryIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        );

      case 'dots-side':
        return (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-black/30 px-2 py-3 rounded-full">
            {block.gallery.map((_: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setGalleryIndex(idx)}
                className={`w-3 h-3 rounded-full transition-all ${
                  idx === galleryIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        );

      case 'arrows':
        return (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full shadow-lg"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full shadow-lg"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        );

      case 'solution':
        return (
          <button
            onClick={() => setShowSolution(!showSolution)}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 px-5 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-2 shadow-lg z-30"
            style={{
              backgroundColor: showSolution ? '#334155' : '#4f46e5',
              color: 'white',
            }}
          >
            {showSolution ? 'Skrýt řešení' : 'Zobrazit řešení'}
          </button>
        );

      default:
        return null;
    }
  };

  const imageContent = (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ borderRadius }}>
      {imageFit === 'cover' ? (
        <img
          src={currentImage}
          alt={block.imageCaption || ''}
          className="absolute"
          style={{
            width: `${imageScale}%`,
            height: `${imageScale}%`,
            objectFit: 'cover',
            left: `${imageLeft}%`,
            top: `${imageTop}%`,
          }}
        />
      ) : (
        <img
          src={currentImage}
          alt={block.imageCaption || ''}
          className="transition-transform max-w-full max-h-full"
          style={{
            width: `${imageScale}%`,
            height: 'auto',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: Math.max(0, borderRadius - 4),
          }}
        />
      )}
      {renderNavigation()}
      {block.imageCaption && (
        <div className={`absolute ${hasGallery ? 'bottom-14' : 'bottom-0'} left-0 right-0 bg-black/50 text-white text-sm px-3 py-2 text-center`}>
          {block.imageCaption}
        </div>
      )}
    </div>
  );

  if (block.imageLink) {
    return (
      <a href={block.imageLink} target="_blank" rel="noopener noreferrer" className="h-full w-full block">
        {imageContent}
      </a>
    );
  }

  return imageContent;
}

// Block-based layout renderer for new info slides
function BlockLayoutView({ slide }: { slide: InfoSlide }) {
  const layout = slide.layout!;
  const blocks = layout.blocks;
  const titleHeight = layout.titleHeight || 15;
  const columnRatios = layout.columnRatios || [50, 50];
  const splitRatio = layout.splitRatio || 50;

  // Get template settings
  const template = slide.templateId ? getTemplateById(slide.templateId) : undefined;
  const blockGap = slide.blockGap ?? template?.defaultGap ?? 11;
  const blockRadius = slide.blockRadius ?? template?.defaultRadius ?? 8;
  const blockColors = template?.blockColors || [];
  const fontFamily = template?.font ? (template.font.includes(' ') ? `"${template.font}", sans-serif` : `${template.font}, sans-serif`) : 'inherit';

  // Get background style for slide
  const getSlideBackgroundStyle = (): React.CSSProperties => {
    if (!slide.slideBackground) return {};
    const bg = slide.slideBackground;
    if (bg.type === 'color' && bg.color) {
      return { backgroundColor: bg.color === 'transparent' ? 'transparent' : bg.color };
    }
    if (bg.type === 'image' && bg.imageUrl) {
      return {
        backgroundImage: `url(${bg.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    return {};
  };

  // Render a single block with template styling
  const renderBlock = (block: typeof blocks[0], blockIndex: number) => {
    const bgStyle: React.CSSProperties = {
      borderRadius: blockRadius,
    };
    
    // Use block background if set, otherwise template color
    if (block.background?.type === 'color' && block.background.color) {
      bgStyle.backgroundColor = block.background.color === 'transparent' ? 'transparent' : block.background.color;
    } else if (blockColors[blockIndex % blockColors.length]) {
      bgStyle.backgroundColor = blockColors[blockIndex % blockColors.length];
    }

    const textAlignClass = block.textAlign === 'center' ? 'text-center' : block.textAlign === 'right' ? 'text-right' : 'text-left';
    const fontSizeClass = block.fontSize === 'xlarge' ? 'text-3xl md:text-4xl' : 
                          block.fontSize === 'large' ? 'text-xl md:text-2xl' : 
                          block.fontSize === 'small' ? 'text-sm' : 'text-base md:text-lg';
    const fontWeightClass = block.fontWeight === 'bold' ? 'font-bold' : 'font-normal';

    if (block.type === 'image' && (block.content || (block.gallery && block.gallery.length > 0))) {
      return (
        <div className="h-full w-full overflow-hidden relative" style={bgStyle}>
          <ImageBlockPreview block={block} borderRadius={Math.max(0, blockRadius - 4)} />
        </div>
      );
    }

    if (block.type === 'link' && block.content) {
      return (
        <div className="h-full flex items-center justify-center p-4" style={bgStyle}>
          <a href={block.content} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
            {block.title || block.content}
          </a>
        </div>
      );
    }

    // Text block
    return (
      <div className={`h-full p-4 ${textAlignClass} ${fontSizeClass} ${fontWeightClass} text-slate-800`} style={bgStyle}>
        <MathText>{block.content}</MathText>
      </div>
    );
  };

  // Render based on layout type - with dynamic gap
  const renderLayout = () => {
    const gapStyle = { gap: blockGap };
    
    switch (layout.type) {
      case 'title-content':
        return (
          <div className="h-full flex flex-col" style={gapStyle}>
            <div style={{ height: `${titleHeight}%`, minHeight: 60 }}>{renderBlock(blocks[0], 0)}</div>
            <div className="flex-1">{renderBlock(blocks[1], 1)}</div>
          </div>
        );

      case 'title-2cols':
        return (
          <div className="h-full flex flex-col" style={gapStyle}>
            <div style={{ height: `${titleHeight}%`, minHeight: 60 }}>{renderBlock(blocks[0], 0)}</div>
            <div className="flex-1 flex" style={gapStyle}>
              <div style={{ width: `${columnRatios[0]}%` }}>{renderBlock(blocks[1], 1)}</div>
              <div style={{ width: `${columnRatios[1]}%` }}>{renderBlock(blocks[2], 2)}</div>
            </div>
          </div>
        );

      case 'title-3cols':
        return (
          <div className="h-full flex flex-col" style={gapStyle}>
            <div style={{ height: `${titleHeight}%`, minHeight: 60 }}>{renderBlock(blocks[0], 0)}</div>
            <div className="flex-1 flex" style={gapStyle}>
              <div style={{ width: `${columnRatios[0]}%` }}>{renderBlock(blocks[1], 1)}</div>
              <div style={{ width: `${columnRatios[1]}%` }}>{renderBlock(blocks[2], 2)}</div>
              <div style={{ width: `${columnRatios[2]}%` }}>{renderBlock(blocks[3], 3)}</div>
            </div>
          </div>
        );

      case '2cols':
        return (
          <div className="h-full flex" style={gapStyle}>
            <div style={{ width: `${columnRatios[0]}%` }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ width: `${columnRatios[1]}%` }}>{renderBlock(blocks[1], 1)}</div>
          </div>
        );

      case '3cols':
        return (
          <div className="h-full flex" style={gapStyle}>
            <div style={{ width: `${columnRatios[0]}%` }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ width: `${columnRatios[1]}%` }}>{renderBlock(blocks[1], 1)}</div>
            <div style={{ width: `${columnRatios[2]}%` }}>{renderBlock(blocks[2], 2)}</div>
          </div>
        );

      case 'left-large-right-split':
        return (
          <div className="h-full flex" style={gapStyle}>
            <div style={{ width: `${columnRatios[0]}%` }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ width: `${columnRatios[1]}%` }} className="flex flex-col" style={{ ...gapStyle, width: `${columnRatios[1]}%` }}>
              <div style={{ height: `${splitRatio}%` }}>{renderBlock(blocks[1], 1)}</div>
              <div style={{ height: `${100 - splitRatio}%` }}>{renderBlock(blocks[2], 2)}</div>
            </div>
          </div>
        );

      case 'right-large-left-split':
        return (
          <div className="h-full flex" style={gapStyle}>
            <div className="flex flex-col" style={{ ...gapStyle, width: `${columnRatios[0]}%` }}>
              <div style={{ height: `${splitRatio}%` }}>{renderBlock(blocks[0], 0)}</div>
              <div style={{ height: `${100 - splitRatio}%` }}>{renderBlock(blocks[1], 1)}</div>
            </div>
            <div style={{ width: `${columnRatios[1]}%` }}>{renderBlock(blocks[2], 2)}</div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div 
      className="h-full" 
      style={{ 
        ...getSlideBackgroundStyle(), 
        padding: blockGap > 0 ? blockGap : 0,
        fontFamily,
      }}
    >
      {renderLayout()}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function QuizPreview({ quiz, onClose, isLive = false, onComplete }: QuizPreviewProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [prevSlideIndex, setPrevSlideIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [responses, setResponses] = useState<SlideResponse[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const currentSlide = quiz.slides[currentSlideIndex];
  const currentResponse = responses.find(r => r.slideId === currentSlide?.id);
  const hasAnswered = !!currentResponse;
  
  const score = calculateQuizScore(responses, quiz.slides);
  const bgColor = '#F0F1F8';
  
  // Reset on slide change
  useEffect(() => {
    setSelectedOption(null);
    setTextAnswer('');
    setShowResult(false);
  }, [currentSlideIndex]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        goToPrevSlide();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        if (hasAnswered || currentSlide?.type !== 'activity') {
          goToNextSlide();
        }
      } else if (e.key === 'Escape') {
        onClose?.();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlideIndex, hasAnswered, currentSlide]);
  
  const goToNextSlide = useCallback(() => {
    if (currentSlideIndex < quiz.slides.length - 1 && !isAnimating) {
      setIsAnimating(true);
      setPrevSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(prev => prev + 1);
      setTimeout(() => setIsAnimating(false), 500);
    } else if (currentSlideIndex === quiz.slides.length - 1) {
      setIsCompleted(true);
      onComplete?.(responses);
    }
  }, [quiz, currentSlideIndex, isAnimating, responses, onComplete]);
  
  const goToPrevSlide = useCallback(() => {
    if (currentSlideIndex > 0 && !isAnimating && quiz.settings.allowBack) {
      setIsAnimating(true);
      setPrevSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(prev => prev - 1);
      setTimeout(() => setIsAnimating(false), 500);
    }
  }, [currentSlideIndex, isAnimating, quiz.settings.allowBack]);
  
  // Submit answer
  const submitAnswer = () => {
    if (!currentSlide || currentSlide.type !== 'activity') return;
    
    let isCorrect = false;
    let answer: string | string[] = '';
    
    if (currentSlide.activityType === 'abc') {
      const abcSlide = currentSlide as ABCActivitySlide;
      const correctOption = abcSlide.options.find(o => o.isCorrect);
      isCorrect = selectedOption === correctOption?.id;
      answer = selectedOption || '';
    } else if (currentSlide.activityType === 'open') {
      const openSlide = currentSlide as OpenActivitySlide;
      const normalizedAnswer = openSlide.caseSensitive ? textAnswer : textAnswer.toLowerCase();
      isCorrect = openSlide.correctAnswers.some(correct => 
        (openSlide.caseSensitive ? correct : correct.toLowerCase()) === normalizedAnswer
      );
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
  
  // Progress bar renderer
  const renderProgressBar = () => (
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
            return <ExampleSlideView slide={slide as ExampleActivitySlide} />;
          default:
            return <div className="text-slate-500 text-center">Nepodporovaný typ aktivity</div>;
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
    <div className="fixed inset-0 flex flex-col z-50" style={{ backgroundColor: bgColor }}>
      {/* Desktop: Top bar with X */}
      <div className="hidden lg:flex absolute top-0 left-0 right-0 z-20 items-center justify-between px-4 py-3">
        {onClose && (
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        
        {/* Score */}
        {quiz.settings.showScore && (
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-1 text-red-500">
              <XCircle className="w-5 h-5" />
              <span className="font-bold">{score.incorrectCount}</span>
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-bold">{score.correctCount}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Mobile: Top navigation with arrows and progress bar */}
      <div className="flex lg:hidden items-center gap-3 px-4 py-4" style={{ backgroundColor: bgColor }}>
        {/* Left arrow */}
        <button
          onClick={goToPrevSlide}
          disabled={currentSlideIndex === 0 || !quiz.settings.allowBack}
          className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 bg-[#CBD5E1] text-slate-600 ${
            currentSlideIndex === 0 || !quiz.settings.allowBack ? 'opacity-30 cursor-not-allowed' : ''
          }`}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        {/* Progress bar */}
        <div className="flex-1 flex items-center gap-1.5">
          {renderProgressBar()}
        </div>
        
        {/* Right arrow */}
        <button
          onClick={() => {
            if (hasAnswered || currentSlide?.type !== 'activity') {
              goToNextSlide();
            } else if (selectedOption || textAnswer.trim()) {
              submitAnswer();
            }
          }}
          disabled={currentSlide?.type === 'activity' && !hasAnswered && !selectedOption && !textAnswer.trim()}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-white flex-shrink-0 ${
            currentSlide?.type === 'activity' && !hasAnswered && !selectedOption && !textAnswer.trim() ? 'opacity-30 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: '#7C3AED' }}
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
      
      {/* Main content area with arrows */}
      <div className="flex-1 flex flex-col pt-4 pb-4 lg:pt-16 lg:pb-4" style={{ backgroundColor: bgColor }}>
        {/* Desktop: Segmented progress bar */}
        <div className="hidden lg:flex items-center justify-center pb-3">
          <div className="w-1/2 max-w-xl flex items-center gap-1.5">
            {renderProgressBar()}
          </div>
        </div>
        
        {/* Content with arrows */}
        <div className="flex-1 flex items-stretch">
          {/* Desktop: Left arrow */}
          <div className="hidden lg:flex w-16 flex-shrink-0 items-center justify-center">
            <button
              onClick={goToPrevSlide}
              disabled={currentSlideIndex === 0 || !quiz.settings.allowBack}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out bg-[#CBD5E1] text-slate-600 ${
                currentSlideIndex === 0 || !quiz.settings.allowBack ? 'opacity-30 cursor-not-allowed' : 'hover:h-28'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
          
          {/* Slide content */}
          <div className="flex-1 flex items-stretch px-4">
            <div 
              className={`w-full max-w-5xl mx-auto rounded-3xl shadow-2xl overflow-hidden flex flex-col bg-white ${
                currentSlideIndex > prevSlideIndex && isAnimating ? 'animate-slide-in' : ''
              } ${
                currentSlideIndex < prevSlideIndex && isAnimating ? 'animate-slide-in-left' : ''
              }`}
              key={currentSlideIndex}
            >
              {currentSlide ? (
                renderSlideView(currentSlide)
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <p className="text-xl">Žádné slidy</p>
                </div>
              )}
              
              {/* Submit button for activities */}
              {currentSlide?.type === 'activity' && !hasAnswered && (selectedOption || textAnswer.trim()) && (
                <div className="p-6 flex justify-center border-t border-slate-100">
                  <button
                    onClick={submitAnswer}
                    className="px-8 py-3 rounded-xl font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Odpovědět
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Desktop: Right arrow */}
          <div className="hidden lg:flex w-16 flex-shrink-0 items-center justify-center">
            <button
              onClick={() => {
                if (hasAnswered || currentSlide?.type !== 'activity') {
                  goToNextSlide();
                } else if (selectedOption || textAnswer.trim()) {
                  submitAnswer();
                }
              }}
              disabled={currentSlide?.type === 'activity' && !hasAnswered && !selectedOption && !textAnswer.trim()}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-out ${
                currentSlide?.type === 'activity' && !hasAnswered && !selectedOption && !textAnswer.trim() 
                  ? 'opacity-30 cursor-not-allowed' 
                  : 'hover:h-28'
              }`}
              style={{ backgroundColor: '#7C3AED' }}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuizPreview;
