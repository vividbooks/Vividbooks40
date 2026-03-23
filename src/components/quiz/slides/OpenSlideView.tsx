import React from 'react';
import { MathText } from '../../math/MathText';
import { OpenActivitySlide } from '../../../types/quiz';

interface OpenSlideViewProps {
  slide: OpenActivitySlide;
  answer?: string;
  onAnswerChange?: (value: string) => void;
  disabled?: boolean;
}

export function OpenSlideView({
  slide,
  answer = '',
  onAnswerChange,
  disabled = false,
}: OpenSlideViewProps) {
  return (
    <div className="flex flex-col h-full items-center justify-center p-8">
      <h1
        className="text-4xl md:text-5xl font-bold text-center leading-tight mb-8"
        style={{ overflowWrap: 'normal', wordBreak: 'normal', hyphens: 'none', color: '#4E5871' }}
      >
        <MathText>{slide.question || 'Otevřená otázka...'}</MathText>
      </h1>

      {slide.media?.url && slide.media?.type === 'image' && (
        <img
          src={slide.media.url}
          alt="Obrázek k otázce"
          className="mb-6 max-w-full max-h-48 md:max-h-64 object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      <div className="w-full max-w-2xl">
        <textarea
          value={answer}
          onChange={(e) => onAnswerChange?.(e.target.value)}
          disabled={disabled}
          className="w-full h-40 p-4 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-0 text-lg resize-none disabled:bg-slate-50 disabled:text-slate-700"
          placeholder="Napište svou odpověď..."
        />
      </div>
    </div>
  );
}
