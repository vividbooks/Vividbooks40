import React from 'react';
import { MathText } from '../../math/MathText';
import { InfoSlide } from '../../../types/quiz';
import { BlockLayoutView } from '../BlockLayoutView';

export function InfoSlideView({ slide }: { slide: InfoSlide }) {
  if (slide.layout && slide.layout.blocks.length > 0) {
    return (
      <div className="flex-1 h-full">
        <BlockLayoutView slide={slide} />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full p-8">
      {slide.title && (
        <h1 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: '#4E5871' }}>
          <MathText>{slide.title}</MathText>
        </h1>
      )}
      {slide.content && (
        <div
          className="prose prose-lg max-w-none flex-1"
          dangerouslySetInnerHTML={{ __html: slide.content }}
        />
      )}
      {slide.media && (
        <div className="mt-8">
          {slide.media.type === 'image' && (
            <img src={slide.media.url} alt={slide.media.caption || ''} className="max-h-96 object-contain" />
          )}
        </div>
      )}
    </div>
  );
}
