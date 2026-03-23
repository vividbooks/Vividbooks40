/**
 * Board (Nástěnka) Slide View
 *
 * Padlet-style interactive board with three layout modes:
 *   - text        : classic post list
 *   - presentation: slideshow (question + individual post slides)
 *   - pros-cons   : two-column (pro / against) layout
 *
 * In teacher present-mode the component renders an inline input
 * instead of the modal so the teacher can post directly from the
 * presentation screen.
 */

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BoardActivitySlide, BoardPost } from '../../../../types/quiz';
import { AddPostModal } from './AddPostModal';
import { QuestionSlide } from './QuestionSlide';
import { PostSlide } from './PostSlide';
import { TextBoardView } from './TextBoardView';
import { ProsConsView } from './ProsConsView';
import { PresentBoardView } from './PresentBoardView';

export interface BoardSlideViewProps {
  slide: BoardActivitySlide;
  posts: BoardPost[];
  currentUserId?: string;
  currentUserName?: string;
  isTeacher?: boolean;
  onAddPost?: (
    text: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'youtube',
    backgroundColor?: string,
    column?: 'left' | 'right',
  ) => void;
  onLikePost?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  readOnly?: boolean;
  /** Present mode: large inline form, large cards, no modal */
  presentMode?: boolean;
}

export function BoardSlideView({
  slide,
  posts,
  currentUserId,
  isTeacher = false,
  onAddPost,
  onLikePost,
  onDeletePost,
  readOnly = false,
  presentMode = false,
}: BoardSlideViewProps) {
  // All hooks must be declared before any conditional return (Rules of Hooks).
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  const boardType = slide.boardType || (slide.allowMedia ? 'presentation' : 'text');

  const sortedPosts = useMemo(
    () =>
      [...posts].sort((a, b) =>
        b.likes.length !== a.likes.length
          ? b.likes.length - a.likes.length
          : b.createdAt - a.createdAt,
      ),
    [posts],
  );

  const totalLikes = useMemo(() => posts.reduce((sum, p) => sum + p.likes.length, 0), [posts]);

  const userPostCount = currentUserId ? posts.filter((p) => p.authorId === currentUserId).length : 0;
  const maxPosts = slide.maxPosts;
  const canAddPost = maxPosts === undefined || maxPosts === 0 || userPostCount < maxPosts;

  const handleAddPost = (
    text: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'youtube',
    backgroundColor?: string,
    column?: 'left' | 'right',
  ) => {
    onAddPost?.(text, mediaUrl, mediaType, backgroundColor, column);
    setShowAddModal(false);
  };

  // ── Present mode (teacher screen) ────────────────────────────────────────
  if (presentMode) {
    return (
      <PresentBoardView
        slide={slide}
        posts={posts}
        currentUserId={currentUserId}
        onAddPost={onAddPost}
        onLikePost={onLikePost}
        onDeletePost={onDeletePost}
      />
    );
  }

  // ── Pros-Cons layout ─────────────────────────────────────────────────────
  if (boardType === 'pros-cons') {
    return (
      <>
        <ProsConsView
          slide={slide}
          posts={posts}
          currentUserId={currentUserId}
          isAnonymous={slide.allowAnonymous}
          readOnly={readOnly}
          canAddPost={canAddPost}
          onOpenAddModal={() => setShowAddModal(true)}
          onLikePost={onLikePost}
          onDeletePost={onDeletePost}
          isTeacher={isTeacher}
        />
        {showAddModal && (
          <AddPostModal
            allowMedia={false}
            showColumnSelector
            leftColumnLabel={slide.leftColumnLabel}
            rightColumnLabel={slide.rightColumnLabel}
            onSubmit={handleAddPost}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </>
    );
  }

  // ── Text board layout ─────────────────────────────────────────────────────
  if (boardType === 'text') {
    return (
      <>
        <TextBoardView
          slide={slide}
          posts={posts}
          currentUserId={currentUserId}
          isAnonymous={slide.allowAnonymous}
          readOnly={readOnly}
          canAddPost={canAddPost}
          onOpenAddModal={() => setShowAddModal(true)}
          onLikePost={onLikePost}
          onDeletePost={onDeletePost}
          isTeacher={isTeacher}
        />
        {showAddModal && (
          <AddPostModal
            allowMedia={false}
            onSubmit={handleAddPost}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </>
    );
  }

  // ── Presentation (slideshow) layout ──────────────────────────────────────
  const totalSlides = sortedPosts.length + 1; // +1 for the question slide
  const currentPost = currentSlideIndex > 0 ? sortedPosts[currentSlideIndex - 1] : null;

  return (
    <div
      className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-hidden"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Slide content */}
      <div style={{ flex: '1 1 0%', minHeight: 0, padding: '24px', overflow: 'hidden' }}>
        {currentSlideIndex === 0 ? (
          <div
            style={{
              height: '100%',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            <QuestionSlide
              slide={slide}
              totalPosts={sortedPosts.length}
              totalLikes={totalLikes}
              canAddPost={canAddPost}
              readOnly={readOnly}
              onAddPost={() => setShowAddModal(true)}
            />
          </div>
        ) : currentPost ? (
          <div style={{ height: '100%' }}>
            <PostSlide
              post={currentPost}
              currentUserId={currentUserId}
              isAnonymous={slide.allowAnonymous}
              onLike={onLikePost ? () => onLikePost(currentPost.id) : undefined}
              onDelete={onDeletePost ? () => onDeletePost(currentPost.id) : undefined}
              isTeacher={isTeacher}
            />
          </div>
        ) : null}
      </div>

      {/* Navigation bar */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '16px 24px',
          backgroundColor: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid #f1f5f9',
        }}
      >
        <button
          onClick={() => setCurrentSlideIndex((p) => Math.max(0, p - 1))}
          disabled={currentSlideIndex === 0}
          className="p-3 rounded-full bg-white shadow-md hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-6 h-6 text-slate-600" />
        </button>

        {/* Dots */}
        <div className="flex items-center gap-2">
          {Array.from({ length: Math.min(totalSlides, 15) }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlideIndex(index)}
              className="transition-all"
              style={{
                width: currentSlideIndex === index ? '28px' : '12px',
                height: '12px',
                borderRadius: '6px',
                background:
                  index === 0
                    ? currentSlideIndex === 0
                      ? '#4E5871'
                      : '#cbd5e1'
                    : currentSlideIndex === index
                    ? 'linear-gradient(to right, #ec4899, #f43f5e)'
                    : '#cbd5e1',
              }}
              title={index === 0 ? 'Otázka' : `Příspěvek ${index}`}
            />
          ))}
          {totalSlides > 15 && (
            <span className="text-xs text-slate-400 ml-1">+{totalSlides - 15}</span>
          )}
        </div>

        <button
          onClick={() => setCurrentSlideIndex((p) => Math.min(totalSlides - 1, p + 1))}
          disabled={currentSlideIndex === totalSlides - 1}
          className="p-3 rounded-full bg-white shadow-md hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight className="w-6 h-6 text-slate-600" />
        </button>

        <div className="text-sm text-slate-500 font-medium ml-4">
          {currentSlideIndex + 1} / {totalSlides}
        </div>
      </div>

      {showAddModal && (
        <AddPostModal
          allowMedia={slide.allowMedia}
          onSubmit={handleAddPost}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

export default BoardSlideView;
