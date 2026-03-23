import React from 'react';
import { Heart, MessageSquare, Plus, Sparkles } from 'lucide-react';
import { BoardActivitySlide } from '../../../../types/quiz';
import { getQuestionFontSize } from './board-constants';

interface QuestionSlideProps {
  slide: BoardActivitySlide;
  totalPosts: number;
  totalLikes: number;
  canAddPost: boolean;
  readOnly: boolean;
  onAddPost: () => void;
}

export function QuestionSlide({
  slide,
  totalPosts,
  totalLikes,
  canAddPost,
  readOnly,
  onAddPost,
}: QuestionSlideProps) {
  const questionFontSize = getQuestionFontSize(slide.question || '');
  const hasImage = !!slide.questionImage;

  return (
    <div className="h-full w-full flex flex-col lg:flex-row overflow-hidden">
      <div
        className={`${hasImage ? 'lg:w-1/2' : 'w-full'} flex flex-col items-center justify-center text-center overflow-auto`}
        style={{ padding: '32px' }}
      >
        <h2
          className="font-bold text-[#4E5871] leading-tight mb-6"
          style={{ fontSize: questionFontSize }}
        >
          {slide.question || 'Téma diskuze...'}
        </h2>

        <div className="flex items-center justify-center gap-4 text-sm text-slate-500 mb-8">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
            <MessageSquare className="w-5 h-5 text-pink-500" />
            <span className="font-medium">{totalPosts} příspěvků</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
            <Heart className="w-5 h-5 text-pink-500" style={{ fill: '#ec4899' }} />
            <span className="font-medium">{totalLikes} lajků</span>
          </div>
        </div>

        {!readOnly && canAddPost && (
          <button
            onClick={onAddPost}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg text-white transition-all hover:scale-105 active:scale-95 shadow-xl flex-shrink-0"
            style={{
              background: 'linear-gradient(to right, #ec4899, #f43f5e)',
              boxShadow: '0 15px 30px -5px rgba(236, 72, 153, 0.4)',
            }}
          >
            <Plus className="w-6 h-6" />
            Přidat příspěvek
          </button>
        )}

        {!canAddPost && !readOnly && (
          <div className="text-center text-sm text-slate-500 bg-slate-100 rounded-xl py-3 px-6 flex-shrink-0">
            <Sparkles className="w-5 h-5 inline mr-2 text-pink-400" />
            Dosáhl/a jsi maximálního počtu příspěvků
          </div>
        )}
      </div>

      {hasImage && (
        <div
          className="lg:w-1/2 flex items-center justify-center bg-slate-50 overflow-hidden"
          style={{ padding: '24px' }}
        >
          <img
            src={slide.questionImage}
            alt="Obrázek k tématu"
            className="rounded-2xl shadow-xl"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  );
}
