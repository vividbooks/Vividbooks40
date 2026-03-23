import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Heart, User, Trash2 } from 'lucide-react';
import { BoardPost } from '../../../../types/quiz';
import { FloatingHearts } from './FloatingHearts';
import { getYouTubeId } from './board-constants';

/**
 * Shared hook for post like interaction.
 * Cleans up pending timeouts on unmount to avoid state updates on unmounted components.
 */
export function usePostLike(hasLiked: boolean, onLike?: () => void) {
  const [showHearts, setShowHearts] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const handleLike = useCallback(() => {
    if (!hasLiked) {
      setShowHearts(true);
      setIsAnimating(true);
      timeoutsRef.current.push(window.setTimeout(() => setShowHearts(false), 1000));
      timeoutsRef.current.push(window.setTimeout(() => setIsAnimating(false), 300));
    }
    onLike?.();
  }, [hasLiked, onLike]);

  return { showHearts, isAnimating, handleLike };
}

interface PostSlideProps {
  post: BoardPost;
  currentUserId?: string;
  isAnonymous?: boolean;
  onLike?: () => void;
  onDelete?: () => void;
  isTeacher?: boolean;
}

export function PostSlide({ post, currentUserId, isAnonymous, onLike, onDelete, isTeacher }: PostSlideProps) {
  const hasLiked = currentUserId ? post.likes.includes(currentUserId) : false;
  const { showHearts, isAnimating, handleLike } = usePostLike(hasLiked, onLike);

  const youtubeId = post.mediaType === 'youtube' && post.mediaUrl ? getYouTubeId(post.mediaUrl) : null;
  const hasMedia = !!post.mediaUrl;
  const bgColor = post.backgroundColor || '#ffffff';

  return (
    <div
      className="h-full w-full flex flex-col lg:flex-row rounded-2xl shadow-lg overflow-hidden relative"
      style={{ backgroundColor: bgColor }}
    >
      {showHearts && <FloatingHearts count={5} />}

      <div
        className="flex flex-col overflow-hidden"
        style={{ width: hasMedia ? '50%' : '100%', padding: '32px' }}
      >
        <div className="flex items-center gap-3 mb-6 flex-shrink-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-md flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}
          >
            <User className="w-6 h-6 text-white" />
          </div>
          <span className="font-semibold text-lg text-slate-700">
            {isAnonymous ? 'Anonymní' : post.authorName}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <p className="text-2xl text-[#4E5871] leading-relaxed whitespace-pre-wrap">{post.text}</p>
        </div>

        <div
          className="flex items-center gap-4 mt-6 pt-6 border-t flex-shrink-0"
          style={{ borderColor: 'rgba(0,0,0,0.1)' }}
        >
          <button
            onClick={handleLike}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all duration-200"
            style={{
              background: hasLiked ? 'linear-gradient(to right, #ec4899, #f43f5e)' : 'rgba(255,255,255,0.8)',
              color: hasLiked ? '#ffffff' : '#64748b',
              border: hasLiked ? 'none' : '1px solid rgba(0,0,0,0.1)',
              boxShadow: hasLiked ? '0 4px 12px rgba(236, 72, 153, 0.4)' : '0 2px 4px rgba(0,0,0,0.05)',
              transform: isAnimating ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            <Heart className="w-5 h-5" style={{ fill: hasLiked ? '#ffffff' : 'none' }} />
            <span>{post.likes.length}</span>
          </button>

          {(currentUserId === post.authorId || isTeacher) && onDelete && (
            <button
              onClick={onDelete}
              className="p-2.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {hasMedia && (
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{ width: '50%', height: '100%', backgroundColor: '#0f172a' }}
        >
          {post.mediaType === 'image' && (
            <img
              src={post.mediaUrl}
              alt="Příloha"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}
          {post.mediaType === 'youtube' && youtubeId && (
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              style={{ width: '100%', height: '100%' }}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      )}
    </div>
  );
}
