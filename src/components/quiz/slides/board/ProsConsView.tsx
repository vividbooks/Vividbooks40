import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { BoardActivitySlide, BoardPost } from '../../../../types/quiz';
import { SimplePostCard } from './SimplePostCard';
import { getQuestionFontSize } from './board-constants';

interface ProsConsViewProps {
  slide: BoardActivitySlide;
  posts: BoardPost[];
  currentUserId?: string;
  isAnonymous?: boolean;
  readOnly: boolean;
  canAddPost: boolean;
  onOpenAddModal: () => void;
  onLikePost?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  isTeacher?: boolean;
}

export function ProsConsView({
  slide,
  posts,
  currentUserId,
  isAnonymous,
  readOnly,
  canAddPost,
  onOpenAddModal,
  onLikePost,
  onDeletePost,
  isTeacher,
}: ProsConsViewProps) {
  const questionFontSize = getQuestionFontSize(slide.question || '');

  const { leftPosts, rightPosts } = useMemo(
    () => ({
      leftPosts: posts.filter((p) => p.column === 'left'),
      rightPosts: posts.filter((p) => p.column === 'right'),
    }),
    [posts],
  );

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-hidden flex flex-col">
      {/* Header */}
      <div
        className="text-center px-8 border-b border-slate-100 flex-shrink-0"
        style={{ paddingTop: '40px', paddingBottom: '24px' }}
      >
        <h2 className="font-bold text-[#4E5871] leading-tight mb-6" style={{ fontSize: questionFontSize }}>
          {slide.question || 'Téma diskuze...'}
        </h2>

        {!readOnly && canAddPost && (
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-base text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
            style={{
              background: 'linear-gradient(to right, #ec4899, #f43f5e)',
              boxShadow: '0 10px 25px -5px rgba(236, 72, 153, 0.4)',
            }}
          >
            <Plus className="w-5 h-5" />
            Přidat argument
          </button>
        )}
      </div>

      {/* Two columns */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left column (Pro) */}
        <div
          className="w-1/2 p-6 border-r border-slate-100 flex flex-col overflow-hidden"
          style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)' }}
        >
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
            >
              <span className="text-white font-bold text-sm">+</span>
            </div>
            <h3 className="font-bold text-green-700 text-lg">{slide.leftColumnLabel || 'Pro'}</h3>
            <span className="text-sm text-green-600 ml-auto bg-green-100 px-2 py-0.5 rounded-full">
              {leftPosts.length}
            </span>
          </div>

          <div className="flex-1 overflow-auto space-y-3">
            {leftPosts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Zatím žádné argumenty</div>
            ) : (
              leftPosts.map((post) => (
                <SimplePostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId}
                  isAnonymous={isAnonymous}
                  onLike={onLikePost ? () => onLikePost(post.id) : undefined}
                  onDelete={onDeletePost ? () => onDeletePost(post.id) : undefined}
                  isTeacher={isTeacher}
                />
              ))
            )}
          </div>
        </div>

        {/* Right column (Proti) */}
        <div
          className="w-1/2 p-6 flex flex-col overflow-hidden"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
        >
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
            >
              <span className="text-white font-bold text-sm">−</span>
            </div>
            <h3 className="font-bold text-red-700 text-lg">{slide.rightColumnLabel || 'Proti'}</h3>
            <span className="text-sm text-red-600 ml-auto bg-red-100 px-2 py-0.5 rounded-full">
              {rightPosts.length}
            </span>
          </div>

          <div className="flex-1 overflow-auto space-y-3">
            {rightPosts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Zatím žádné argumenty</div>
            ) : (
              rightPosts.map((post) => (
                <SimplePostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId}
                  isAnonymous={isAnonymous}
                  onLike={onLikePost ? () => onLikePost(post.id) : undefined}
                  onDelete={onDeletePost ? () => onDeletePost(post.id) : undefined}
                  isTeacher={isTeacher}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
