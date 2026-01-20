/**
 * Fill-in-the-Blanks Slide View (Doplňování)
 * 
 * Sentence with blanks on TOP, options BELOW
 * Click blank to select it, then click option to fill
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import { FillBlanksActivitySlide, BlankItem } from '../../../types/quiz';

interface FillBlanksViewProps {
  slide: FillBlanksActivitySlide;
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

// Word option button
function WordOption({
  word,
  isCorrect,
  isWrong,
  isUsed,
  onClick,
  disabled,
  showResult,
}: {
  word: string;
  isCorrect?: boolean;
  isWrong?: boolean;
  isUsed: boolean;
  onClick: () => void;
  disabled: boolean;
  showResult: boolean;
}) {
  const getStyle = (): React.CSSProperties => {
    if (showResult && isCorrect) {
      return {
        backgroundColor: '#3b82f6',
        color: 'white',
        boxShadow: '0 4px 0 #2563eb',
      };
    }
    if (showResult && isWrong) {
      return {
        backgroundColor: '#dc2626',
        color: 'white',
        boxShadow: '0 4px 0 #b91c1c',
      };
    }
    if (isUsed) {
      return {
        backgroundColor: '#e2e8f0',
        color: '#94a3b8',
        boxShadow: 'none',
        opacity: 0.4,
      };
    }
    return {
      backgroundColor: '#f8fafc',
      color: '#4E5871',
      boxShadow: '0 4px 0 #cbd5e1',
      border: '2px solid #e2e8f0',
    };
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isUsed}
      className="px-6 py-4 rounded-xl font-bold text-2xl transition-all hover:scale-105 disabled:hover:scale-100"
      style={getStyle()}
    >
      {word}
    </button>
  );
}

export function FillBlanksView({
  slide,
  isTeacher = false,
  readOnly = false,
  onSubmit,
  showResults = false,
}: FillBlanksViewProps) {
  // State
  const [filledBlanks, setFilledBlanks] = useState<Record<string, string>>({});
  const [selectedBlankId, setSelectedBlankId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Shuffled options ref
  const shuffledOptionsRef = useRef<string[] | null>(null);

  // Get sentence and blanks - with defensive checks
  const sentences = slide.sentences || [];
  const sentence = sentences[0] || { id: 'sentence-1', text: '', blanks: [] };
  const blanks = sentence.blanks || [];
  const distractors: string[] = slide.distractors || [];

  // Create word options
  const { wordOptions, correctAnswers } = useMemo(() => {
    const correct: Record<string, string> = {};
    const allWords: string[] = [];

    blanks.forEach(blank => {
      if (blank && blank.id && blank.text) {
        correct[blank.id] = blank.text;
        allWords.push(blank.text);
      }
    });

    // Add distractors
    allWords.push(...distractors);

    // Shuffle once
    if (!shuffledOptionsRef.current) {
      shuffledOptionsRef.current = slide.shuffleOptions ? shuffleArray(allWords) : allWords;
    }

    return {
      wordOptions: shuffledOptionsRef.current,
      correctAnswers: correct,
    };
  }, [slide, blanks, distractors]);

  // Check if word is available
  const isWordAvailable = (word: string) => {
    const totalOfWord = wordOptions.filter(w => w === word).length;
    const usedOfWord = Object.values(filledBlanks).filter(w => w === word).length;
    return usedOfWord < totalOfWord;
  };

  // Handle blank click - select it
  const handleBlankClick = useCallback((blankId: string) => {
    if (readOnly || isSubmitted) return;

    // If already filled, clear it
    if (filledBlanks[blankId]) {
      setFilledBlanks(prev => {
        const newFilled = { ...prev };
        delete newFilled[blankId];
        return newFilled;
      });
      setSelectedBlankId(null);
      return;
    }

    // Select this blank
    setSelectedBlankId(blankId === selectedBlankId ? null : blankId);
  }, [filledBlanks, selectedBlankId, readOnly, isSubmitted]);

  // Handle option click - fill selected blank
  const handleOptionClick = useCallback((word: string) => {
    if (readOnly || isSubmitted) return;
    if (!isWordAvailable(word)) return;

    if (selectedBlankId) {
      setFilledBlanks(prev => ({
        ...prev,
        [selectedBlankId]: word,
      }));
      setSelectedBlankId(null);
    }
  }, [selectedBlankId, readOnly, isSubmitted, filledBlanks, wordOptions]);

  // Calculate score
  const calculateScore = useCallback(() => {
    let correct = 0;
    Object.entries(filledBlanks).forEach(([blankId, word]) => {
      if (word.toLowerCase() === correctAnswers[blankId]?.toLowerCase()) {
        correct++;
      }
    });
    return { correct, total: blanks.length };
  }, [filledBlanks, correctAnswers, blanks]);

  const allFilled = Object.keys(filledBlanks).length === blanks.length;

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!allFilled) return;
    setIsSubmitted(true);
    const score = calculateScore();
    onSubmit?.({
      correct: score.correct,
      total: score.total,
      answers: filledBlanks,
    });
  }, [allFilled, calculateScore, filledBlanks, onSubmit]);

  // Reset
  const handleReset = () => {
    setFilledBlanks({});
    setSelectedBlankId(null);
    setIsSubmitted(false);
    shuffledOptionsRef.current = null;
  };

  const showResultsNow = showResults || isSubmitted;
  const score = calculateScore();

  // Render sentence with clickable blanks
  const renderSentence = () => {
    if (blanks.length === 0) {
      return <span>{sentence.text}</span>;
    }

    // Filter out invalid blanks and sort
    const validBlanks = blanks.filter(b => b && b.id && b.text !== undefined);
    const sortedBlanks = [...validBlanks].sort((a, b) => (a.position || 0) - (b.position || 0));
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedBlanks.forEach((blank, idx) => {
      const blankPosition = blank.position || 0;
      // Text before blank
      if (blankPosition > lastIndex) {
        parts.push(
          <span key={`text-${idx}`}>
            {sentence.text.slice(lastIndex, blankPosition)}
          </span>
        );
      }

      // Blank slot
      const filledWord = filledBlanks[blank.id];
      const isCorrect = filledWord?.toLowerCase() === correctAnswers[blank.id]?.toLowerCase();
      const isSelected = selectedBlankId === blank.id;

      const getBlankStyle = (): React.CSSProperties => {
        if (showResultsNow && filledWord) {
          return {
            backgroundColor: isCorrect ? '#dcfce7' : '#fee2e2',
            borderColor: isCorrect ? '#22c55e' : '#ef4444',
            color: isCorrect ? '#166534' : '#dc2626',
          };
        }
        if (isSelected) {
          return {
            backgroundColor: '#f3e8ff',
            borderColor: '#7C3AED',
            boxShadow: '0 0 0 4px rgba(124, 58, 237, 0.2)',
          };
        }
        if (filledWord) {
          return {
            backgroundColor: '#faf5ff',
            borderColor: '#a855f7',
            color: '#7c3aed',
          };
        }
        return {
          backgroundColor: '#f8fafc',
          borderColor: '#94a3b8',
        };
      };

      parts.push(
        <button
          key={blank.id}
          onClick={() => handleBlankClick(blank.id)}
          disabled={readOnly || isSubmitted}
          className="inline-flex items-center justify-center px-4 py-2 mx-1 rounded-xl border-2 transition-all font-bold"
          style={{
            ...getBlankStyle(),
            minWidth: filledWord ? 'auto' : '100px',
            minHeight: '48px',
          }}
        >
          {filledWord || ''}
          {showResultsNow && filledWord && (
            <span className="ml-2">
              {isCorrect ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </span>
          )}
        </button>
      );

      lastIndex = (blank.position || 0) + (blank.text?.length || 0);
    });

    // Remaining text
    if (lastIndex < sentence.text.length) {
      parts.push(
        <span key="text-end">
          {sentence.text.slice(lastIndex)}
        </span>
      );
    }

    return <>{parts}</>;
  };

  // Get result state for word option
  const getWordResultState = (word: string) => {
    const usedInBlankId = Object.entries(filledBlanks).find(([, w]) => w === word)?.[0];
    if (!usedInBlankId) return { isCorrect: false, isWrong: false };
    
    const isCorrect = word.toLowerCase() === correctAnswers[usedInBlankId]?.toLowerCase();
    return { isCorrect, isWrong: !isCorrect };
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-orange-50/30 rounded-3xl flex flex-col overflow-hidden">
      {/* Header with buttons */}
      <div className="flex-shrink-0 px-6 pt-6 pb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#4E5871]">
          {slide.instruction || 'Doplň chybějící slova'}
        </h2>

        <div className="flex items-center gap-3">
          {showResultsNow && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              score.correct === score.total ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <span className="font-bold">{score.correct}/{score.total} správně</span>
            </div>
          )}
          
          {!showResultsNow && !isTeacher && (
            <>
              <button
                onClick={handleReset}
                disabled={Object.keys(filledBlanks).length === 0}
                className="px-4 py-2 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={handleSubmit}
                disabled={!allFilled}
                className="px-6 py-2 rounded-xl font-bold text-white transition-all hover:scale-105 disabled:opacity-50 disabled:transform-none"
                style={{
                  background: allFilled 
                    ? 'linear-gradient(to right, #f97316, #f59e0b)' 
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
              className="px-4 py-2 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Zkusit znovu
            </button>
          )}
        </div>
      </div>

      {/* Sentence on TOP - centered and big */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-4">
        <div className="text-center">
          <div 
            className="text-4xl md:text-5xl font-medium text-slate-700 leading-relaxed"
            style={{ lineHeight: '1.8' }}
          >
            {renderSentence()}
          </div>
          
          {/* Hint when blank is selected */}
          {selectedBlankId && !showResultsNow && (
            <p className="mt-6 text-slate-500 text-lg animate-pulse">
              Vyber slovo z možností níže
            </p>
          )}
        </div>
      </div>

      {/* Word options BELOW */}
      <div className="flex-shrink-0 px-6 pb-6">
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
          <div className="flex flex-wrap gap-4 justify-center">
            {wordOptions.map((word, idx) => {
              const { isCorrect, isWrong } = showResultsNow ? getWordResultState(word) : { isCorrect: false, isWrong: false };
              const isUsed = !isWordAvailable(word);
              
              return (
                <WordOption
                  key={`${word}-${idx}`}
                  word={word}
                  isCorrect={isCorrect}
                  isWrong={isWrong}
                  isUsed={isUsed}
                  onClick={() => handleOptionClick(word)}
                  disabled={readOnly || isSubmitted || !selectedBlankId}
                  showResult={showResultsNow}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Teacher view */}
      {isTeacher && (
        <div className="flex-shrink-0 px-6 pb-6">
          <div className="p-4 bg-slate-50 rounded-xl">
            <h3 className="font-medium text-slate-700 mb-2 text-sm">Správné odpovědi:</h3>
            <div className="flex flex-wrap gap-2">
              {blanks.filter(b => b && b.text).map((blank) => (
                <span key={blank.id} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                  {blank.text}
                </span>
              ))}
            </div>
            {distractors.length > 0 && (
              <>
                <h3 className="font-medium text-slate-700 mb-2 mt-3 text-sm">Špatné odpovědi:</h3>
                <div className="flex flex-wrap gap-2">
                  {distractors.map((d, i) => (
                    <span key={i} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      {d}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FillBlanksView;
