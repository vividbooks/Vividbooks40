import React, { useMemo } from 'react';
import { Heart, MessageSquare, Plus } from 'lucide-react';
import { BoardActivitySlide, BoardPost } from '../../../../types/quiz';
import { SimplePostCard } from './SimplePostCard';
import { getQuestionFontSize } from './board-constants';

interface TextBoardViewProps {
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

export function TextBoardView({
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
}: TextBoardViewProps) {
  const questionFontSize = getQuestionFontSize(slide.question || '');
  const hasImage = !!slide.questionImage;

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

  const AddButton = () =>
    !readOnly && canAddPost ? (
      <button
        onClick={onOpenAddModal}
        className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-base text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
        style={{
          background: 'linear-gradient(to right, #ec4899, #f43f5e)',
          boxShadow: '0 10px 25px -5px rgba(236, 72, 153, 0.4)',
        }}
      >
        <Plus className="w-5 h-5" />
        Přidat příspěvek
      </button>
    ) : null;

  const EmptyState = () => (
    <div className="text-center py-12 text-slate-400">
      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>Zatím žádné příspěvky</p>
      <p className="text-sm mt-1">Buď první, kdo něco napíše!</p>
    </div>
  );

  const PostList = ({ className = '' }: { className?: string }) => (
    <div className={`space-y-4 ${className}`}>
      {sortedPosts.length === 0 ? (
        <EmptyState />
      ) : (
        sortedPosts.map((post) => (
          <SimplePostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            isAnonymous={isAnonymous}
            onLike={onLikePost ? () => onLikePost(post.id) : undefined}
            onDelete={onDeletePost ? () => onDeletePost(post.id) : undefined}
            isTeacher={isTeacher}
            size="medium"
          />
        ))
      )}
    </div>
  );

  if (hasImage) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-hidden flex flex-col lg:flex-row">
        {/* Left: Question + Image */}
        <div className="flex flex-col overflow-auto flex-1" style={{ padding: '32px', minWidth: 0 }}>
          <div style={{ paddingTop: '60px' }}>
            <h2 className="font-bold text-[#4E5871] leading-tight mb-6" style={{ fontSize: questionFontSize }}>
              {slide.question || 'Téma diskuze...'}
            </h2>

            <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
                <MessageSquare className="w-4 h-4 text-pink-500" />
                <span className="font-medium">{posts.length} příspěvků</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
                <Heart className="w-4 h-4 text-pink-500" style={{ fill: '#ec4899' }} />
                <span className="font-medium">{totalLikes} lajků</span>
              </div>
            </div>

            <div className="mb-8">
              <AddButton />
            </div>
          </div>

          <div className="flex-1 flex items-start justify-center">
            <img
              src={slide.questionImage}
              alt="Obrázek k tématu"
              className="max-w-full max-h-80 rounded-2xl shadow-lg object-contain"
            />
          </div>
        </div>

        {/* Right: Posts */}
        <div
          className="overflow-auto bg-white/50 flex-shrink-0"
          style={{ padding: '32px', paddingTop: '60px', width: '550px' }}
        >
          <PostList />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-auto">
      <div
        className="text-center max-w-3xl mx-auto"
        style={{ paddingTop: '80px', paddingBottom: '32px', paddingLeft: '32px', paddingRight: '32px' }}
      >
        <h2 className="font-bold text-[#4E5871] leading-tight mb-6" style={{ fontSize: questionFontSize }}>
          {slide.question || 'Téma diskuze...'}
        </h2>

        <div className="flex items-center justify-center gap-4 text-sm text-slate-500 mb-6">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
            <MessageSquare className="w-4 h-4 text-pink-500" />
            <span className="font-medium">{posts.length} příspěvků</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
            <Heart className="w-4 h-4 text-pink-500" style={{ fill: '#ec4899' }} />
            <span className="font-medium">{totalLikes} lajků</span>
          </div>
        </div>

        <div className="flex justify-center">
          <AddButton />
        </div>
      </div>

      <div
        className="mx-auto"
        style={{ paddingBottom: '48px', paddingLeft: '24px', paddingRight: '24px', maxWidth: '550px' }}
      >
        <PostList />
      </div>
    </div>
  );
}
