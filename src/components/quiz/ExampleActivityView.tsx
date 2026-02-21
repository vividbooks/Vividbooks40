/**
 * Shared Example Activity View
 * 
 * Used by QuizStudentView, QuizJoinPage, and QuizPreview
 * to render the "Example" activity type with a consistent layout.
 * 
 * Layout: Left/Top = Problem, Right/Bottom = Calculator
 * Responsive via ResizeObserver (container-aware, not viewport-based)
 */

import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import MathKeyboard, { NumberPicker, FractionKeyboard, ComparisonPicker, PieFractionPicker } from '../math/MathKeyboard';
import { MathText } from '../math/MathText';
import { AutoScaleQuestion } from './AutoScaleQuestion';
import type { ExampleActivitySlide, ExampleKeyboardType, SlideResponse, CustomKeyboardKey } from '../../types/quiz';

interface ExampleActivityViewProps {
  slide: ExampleActivitySlide;
  textAnswer: string;
  setTextAnswer: (text: string) => void;
  hasAnswered: boolean;
  response?: SlideResponse | null;
  showResults?: boolean;
  showExplanation?: boolean;
  onSubmit: () => void;
  customKeys?: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null];
  extraKeys?: [CustomKeyboardKey | null, CustomKeyboardKey | null, CustomKeyboardKey | null];
}

export function ExampleActivityView({
  slide,
  textAnswer,
  setTextAnswer,
  hasAnswered,
  response,
  showResults = false,
  showExplanation = false,
  onSubmit,
  customKeys,
  extraKeys,
}: ExampleActivityViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setNarrow(entry.contentRect.width < 600);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const problemText = slide.problem || slide.title || '';
  const kbType: ExampleKeyboardType = slide.keyboardType || 'simple';

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, height: '100%', minHeight: 0 }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          height: '100%',
          minHeight: 0,
          overflow: narrow ? 'auto' : 'hidden',
        }}
      >
        {/* TOP/LEFT: Problem */}
        <div
          style={{
            width: narrow ? '100%' : '50%',
            minHeight: narrow ? '30vh' : undefined,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: narrow ? '40px 20px' : 24,
          }}
        >
          {slide.media?.url && slide.media?.type === 'image' ? (
            <>
              {/* Question - upper portion */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: narrow ? undefined : 1, padding: narrow ? '0 0 12px' : 8 }}>
                <AutoScaleQuestion>
                  {problemText}
                </AutoScaleQuestion>
              </div>
              {/* Image - lower portion */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: narrow ? undefined : 1 }}>
                <img
                  src={slide.media.url}
                  alt="Obrázek k otázce"
                  style={{
                    maxWidth: '100%',
                    maxHeight: narrow ? 160 : '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>
            </>
          ) : (
            <AutoScaleQuestion>
              {problemText}
            </AutoScaleQuestion>
          )}

          {/* Result feedback */}
          {hasAnswered && showResults && response && (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              {response.isCorrect ? (
                <div className="flex items-center gap-2 px-6 py-3 bg-green-50 rounded-2xl">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                  <span className="font-semibold text-green-600 text-xl">Správně!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-6 py-3 bg-red-50 rounded-2xl">
                  <XCircle className="w-7 h-7 text-red-500" />
                  <span className="font-semibold text-red-600 text-xl">
                    Správně: <MathText>{slide.finalAnswer || ''}</MathText>
                  </span>
                </div>
              )}
              {(() => {
                const media = response.isCorrect ? slide.correctAnswerMedia : slide.wrongAnswerMedia;
                if (!media?.url) return null;
                return (
                  <img
                    src={media.url}
                    alt=""
                    style={{ maxHeight: 120, borderRadius: 12, objectFit: 'contain' }}
                  />
                );
              })()}
            </div>
          )}

          {/* Explanation */}
          {showExplanation && hasAnswered && slide.explanation && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 w-full max-w-md">
              <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                <HelpCircle className="w-5 h-5" />
                <span>Vysvětlení:</span>
              </div>
              <p className="text-slate-700">
                <MathText>{slide.explanation}</MathText>
              </p>
            </div>
          )}
        </div>

        {/* BOTTOM/RIGHT: Calculator */}
        <div
          style={{
            width: narrow ? '100%' : '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f1f3f8',
            borderLeft: narrow ? 'none' : '1px solid #e2e5ed',
            borderTop: narrow ? '1px solid #e2e5ed' : 'none',
            padding: narrow ? 8 : 0,
          }}
        >
          {!hasAnswered ? (
            <div style={{ width: '100%', maxWidth: 440, padding: 16 }}>
              {kbType === 'number-only' ? (
                <NumberPicker
                  value={textAnswer}
                  onChange={setTextAnswer}
                  compact={true}
                />
              ) : kbType === 'fraction' ? (
                <FractionKeyboard
                  value={textAnswer}
                  onChange={setTextAnswer}
                  compact={true}
                />
              ) : kbType === 'comparison' ? (
                <ComparisonPicker
                  value={textAnswer}
                  onChange={setTextAnswer}
                  compact={true}
                />
              ) : kbType === 'pie-fraction' ? (
                <PieFractionPicker
                  value={textAnswer}
                  onChange={setTextAnswer}
                  compact={true}
                />
              ) : (
                <MathKeyboard
                  value={textAnswer}
                  onChange={setTextAnswer}
                  placeholder="Vaše odpověď..."
                  showPreview={true}
                  suffix={slide.answerSuffix}
                  compact={true}
                  keyboardMode={kbType === 'full' ? 'full' : 'simple'}
                  customKeys={kbType === 'simple' ? customKeys?.map(k => k || undefined) as any : undefined}
                  extraKeys={kbType === 'simple' ? extraKeys?.map(k => k || undefined) as any : undefined}
                />
              )}
              <button
                onClick={onSubmit}
                disabled={!textAnswer.trim()}
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding: '14px 24px',
                  borderRadius: 12,
                  backgroundColor: textAnswer.trim() ? '#4F46E5' : '#9CA3AF',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: 16,
                  border: 'none',
                  cursor: textAnswer.trim() ? 'pointer' : 'default',
                  opacity: textAnswer.trim() ? 1 : 0.7,
                  transition: 'background-color 0.2s, opacity 0.2s',
                }}
              >
                Odpovědět
              </button>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: 440, padding: 24 }}>
              <div
                className={`p-6 rounded-2xl border-2 text-center ${
                  showResults && response
                    ? response.isCorrect
                      ? 'bg-green-50 border-green-500'
                      : 'bg-red-50 border-red-500'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="text-sm text-slate-400 block mb-2">Vaše odpověď</span>
                <div className="text-2xl font-semibold text-slate-800">
                  <MathText>{response?.answer as string || textAnswer}</MathText>
                  {slide.answerSuffix && (
                    <span style={{ color: '#94a3b8', fontWeight: 500, marginLeft: 6 }}>{slide.answerSuffix}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExampleActivityView;
