import React from 'react';
import { Heart, User, Trash2 } from 'lucide-react';
import { BoardPost } from '../../../../types/quiz';
import { FloatingHearts } from './FloatingHearts';
import { usePostLike } from './PostSlide';

interface SimplePostCardProps {
  post: BoardPost;
  currentUserId?: string;
  isAnonymous?: boolean;
  onLike?: () => void;
  onDelete?: () => void;
  isTeacher?: boolean;
  size?: 'small' | 'medium';
}

export function SimplePostCard({
  post,
  currentUserId,
  isAnonymous,
  onLike,
  onDelete,
  isTeacher,
  size = 'small',
}: SimplePostCardProps) {
  const hasLiked = currentUserId ? post.likes.includes(currentUserId) : false;
  const { showHearts, isAnimating, handleLike } = usePostLike(hasLiked, onLike);
  const isSmall = size === 'small';

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-slate-100 relative"
      style={{ padding: isSmall ? '16px' : '20px' }}
    >
      {showHearts && <FloatingHearts count={3} />}

      <p
        className="text-[#4E5871] mb-3 whitespace-pre-wrap"
        style={{ fontSize: isSmall ? '14px' : '16px', lineHeight: '1.5' }}
      >
        {post.text}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <User className="w-3 h-3" />
          {isAnonymous ? 'Anonym' : post.authorName}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
            style={{
              background: hasLiked ? 'linear-gradient(to right, #ec4899, #f43f5e)' : '#f8fafc',
              color: hasLiked ? '#ffffff' : '#64748b',
              fontSize: isSmall ? '12px' : '13px',
              transform: isAnimating ? 'scale(1.1)' : 'scale(1)',
              boxShadow: hasLiked ? '0 2px 8px rgba(236, 72, 153, 0.3)' : 'none',
            }}
          >
            <Heart className="w-3.5 h-3.5" style={{ fill: hasLiked ? '#ffffff' : 'none' }} />
            {post.likes.length}
          </button>

          {(currentUserId === post.authorId || isTeacher) && onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
