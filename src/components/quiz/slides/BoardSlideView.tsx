/**
 * Board (Nástěnka) Slide View
 * 
 * Display component for board activities in preview/playback mode
 * Shows the question at the top and posts below in a grid
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Heart,
  MessageSquare,
  Send,
  Image as ImageIcon,
  Youtube,
  ChevronLeft,
  ChevronRight,
  User,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { BoardActivitySlide, BoardPost } from '../../../types/quiz';

interface BoardSlideViewProps {
  slide: BoardActivitySlide;
  posts: BoardPost[];
  currentUserId?: string;
  currentUserName?: string;
  isTeacher?: boolean;
  onAddPost?: (text: string, mediaUrl?: string, mediaType?: 'image' | 'youtube') => void;
  onLikePost?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  readOnly?: boolean;
}

// Helper to extract YouTube video ID from URL
function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Floating hearts animation component
function FloatingHearts({ count }: { count: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <Heart
          key={i}
          className="absolute text-pink-500 fill-pink-500 animate-float-up"
          style={{
            left: `${20 + Math.random() * 60}%`,
            bottom: '-20px',
            animationDelay: `${i * 0.1}s`,
            fontSize: `${12 + Math.random() * 8}px`,
            width: `${16 + Math.random() * 8}px`,
            height: `${16 + Math.random() * 8}px`,
          }}
        />
      ))}
    </div>
  );
}

// Single post card component
function PostCard({ 
  post, 
  currentUserId, 
  isAnonymous,
  onLike, 
  onDelete,
  isTeacher,
}: { 
  post: BoardPost; 
  currentUserId?: string;
  isAnonymous?: boolean;
  onLike?: () => void;
  onDelete?: () => void;
  isTeacher?: boolean;
}) {
  const [showHearts, setShowHearts] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const hasLiked = currentUserId ? post.likes.includes(currentUserId) : false;
  const youtubeId = post.mediaType === 'youtube' && post.mediaUrl ? getYouTubeId(post.mediaUrl) : null;
  
  const handleLike = useCallback(() => {
    if (!hasLiked) {
      // Show floating hearts animation
      setShowHearts(true);
      setIsAnimating(true);
      setTimeout(() => setShowHearts(false), 1000);
      setTimeout(() => setIsAnimating(false), 300);
    }
    onLike?.();
  }, [hasLiked, onLike]);
  
  return (
    <div 
      className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-200 relative flex-shrink-0"
      style={{ width: '100%', maxWidth: '550px' }}
    >
      {/* Floating hearts animation */}
      {showHearts && <FloatingHearts count={5} />}
      
      {/* Post content */}
      <div className="p-4">
        <div className="flex gap-3">
          {/* Text column */}
          <div className="flex-1 min-w-0">
            <p className="text-[#4E5871] whitespace-pre-wrap break-words text-sm leading-relaxed">
              {post.text}
            </p>
          </div>
          
          {/* Media column (if present) */}
          {post.mediaUrl && (
            <div className="w-24 flex-shrink-0">
              {post.mediaType === 'image' ? (
                <img 
                  src={post.mediaUrl} 
                  alt="Příloha"
                  className="w-full h-20 object-cover rounded-lg"
                />
              ) : youtubeId ? (
                <div className="w-full h-20 rounded-lg overflow-hidden bg-slate-900">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer: author + actions */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-pink-50/30 border-t border-slate-100 flex items-center justify-between">
        {/* Author */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
            <User className="w-3 h-3 text-white" />
          </div>
          <span className="font-medium">{isAnonymous ? 'Anonym' : post.authorName}</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {/* Like button */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              hasLiked 
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/30' 
                : 'bg-white border border-slate-200 text-slate-500 hover:border-pink-300 hover:text-pink-500 hover:bg-pink-50'
            } ${isAnimating ? 'scale-110' : ''}`}
          >
            <Heart className={`w-4 h-4 transition-transform ${hasLiked ? 'fill-current' : ''} ${isAnimating ? 'animate-bounce' : ''}`} />
            <span>{post.likes.length}</span>
          </button>
          
          {/* Delete button (only for author or teacher) */}
          {(currentUserId === post.authorId || isTeacher) && onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// New post form component
function NewPostForm({
  allowMedia,
  onSubmit,
  maxPosts,
  currentPostCount,
}: {
  allowMedia: boolean;
  onSubmit: (text: string, mediaUrl?: string, mediaType?: 'image' | 'youtube') => void;
  maxPosts?: number;
  currentPostCount: number;
}) {
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'youtube' | null>(null);
  const [showMediaInput, setShowMediaInput] = useState(false);
  
  const canPost = maxPosts === undefined || maxPosts === 0 || currentPostCount < maxPosts;
  
  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(
      text.trim(), 
      mediaUrl.trim() || undefined, 
      mediaType || undefined
    );
    setText('');
    setMediaUrl('');
    setMediaType(null);
    setShowMediaInput(false);
  };
  
  if (!canPost) {
    return (
      <div className="bg-gradient-to-r from-slate-100 to-pink-50 rounded-2xl p-4 text-center text-slate-500 text-sm border border-slate-200">
        <Sparkles className="w-5 h-5 mx-auto mb-2 text-pink-400" />
        Dosáhl/a jsi maximálního počtu příspěvků ({maxPosts})
      </div>
    );
  }
  
  return (
    <div 
      className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 mx-auto"
      style={{ width: '100%', maxWidth: '550px' }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Napiš svůj příspěvek... ✨"
        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 outline-none resize-none text-[#4E5871] bg-slate-50 placeholder:text-slate-400"
        rows={2}
      />
      
      {/* Media input */}
      {allowMedia && showMediaInput && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setMediaType('image')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mediaType === 'image' 
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Obrázek
            </button>
            <button
              onClick={() => setMediaType('youtube')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mediaType === 'youtube' 
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Youtube className="w-4 h-4" />
              YouTube
            </button>
          </div>
          {mediaType && (
            <input
              type="text"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder={mediaType === 'image' ? 'URL obrázku...' : 'URL YouTube videa...'}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 outline-none text-sm bg-slate-50"
            />
          )}
        </div>
      )}
      
      {/* Actions */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          {allowMedia && (
            <button
              onClick={() => setShowMediaInput(!showMediaInput)}
              className={`p-2 rounded-xl transition-all ${
                showMediaInput 
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md' 
                  : 'text-slate-400 hover:text-pink-500 hover:bg-pink-50 border border-transparent hover:border-pink-200'
              }`}
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
          style={{
            background: text.trim() 
              ? 'linear-gradient(to right, #ec4899, #f43f5e)' 
              : '#e2e8f0',
            color: text.trim() ? 'white' : '#94a3b8',
            boxShadow: text.trim() 
              ? '0 10px 15px -3px rgba(236, 72, 153, 0.3)' 
              : 'none',
            cursor: text.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          <Send className="w-4 h-4" />
          Odeslat
        </button>
      </div>
    </div>
  );
}

// Calculate dynamic font size based on question length
function getQuestionFontSize(text: string): string {
  const length = text.length;
  if (length < 20) return '2.5rem';      // Very short - extra large
  if (length < 40) return '2rem';        // Short - large
  if (length < 80) return '1.75rem';     // Medium - medium-large
  if (length < 120) return '1.5rem';     // Long - medium
  if (length < 200) return '1.25rem';    // Very long - small
  return '1.125rem';                      // Extra long - smallest
}

export function BoardSlideView({
  slide,
  posts,
  currentUserId,
  currentUserName,
  isTeacher = false,
  onAddPost,
  onLikePost,
  onDeletePost,
  readOnly = false,
}: BoardSlideViewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const postsPerPage = 6;
  
  const hasImage = !!slide.questionImage;
  const questionFontSize = getQuestionFontSize(slide.question || '');
  
  // Sort posts by likes (most liked first), then by date
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      // First by likes
      if (b.likes.length !== a.likes.length) {
        return b.likes.length - a.likes.length;
      }
      // Then by date (newest first)
      return b.createdAt - a.createdAt;
    });
  }, [posts]);
  
  // Paginate posts
  const totalPages = Math.ceil(sortedPosts.length / postsPerPage);
  const currentPosts = sortedPosts.slice(
    currentPage * postsPerPage, 
    (currentPage + 1) * postsPerPage
  );
  
  // Count current user's posts
  const userPostCount = currentUserId 
    ? posts.filter(p => p.authorId === currentUserId).length 
    : 0;
  
  const totalLikes = posts.reduce((sum, p) => sum + p.likes.length, 0);

  // Layout with image: two columns
  if (hasImage) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-hidden flex">
        {/* Left column: Question + Image */}
        <div className="w-2/5 p-8 flex flex-col border-r border-slate-100">
          {/* Question */}
          <div className="mb-8">
            <h2 
              className="font-bold text-[#4E5871] leading-tight"
              style={{ fontSize: questionFontSize }}
            >
              {slide.question || 'Téma diskuze...'}
            </h2>
          </div>
          
          {/* Image */}
          <div className="flex-1 flex items-center justify-center">
            <img
              src={slide.questionImage}
              alt="Obrázek k tématu"
              className="max-w-full max-h-full rounded-2xl shadow-xl object-contain"
            />
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-slate-500 mt-6">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm">
              <MessageSquare className="w-4 h-4 text-pink-500" />
              <span className="font-medium">{posts.length} příspěvků</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm">
              <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
              <span className="font-medium">{totalLikes} lajků</span>
            </div>
          </div>
        </div>
        
        {/* Right column: Posts */}
        <div className="w-3/5 p-6 flex flex-col overflow-hidden bg-gradient-to-b from-transparent to-pink-50/20">
          {/* New post form */}
          {!readOnly && onAddPost && (
            <div className="mb-5 flex-shrink-0">
              <NewPostForm
                allowMedia={slide.allowMedia}
                onSubmit={onAddPost}
                maxPosts={slide.maxPosts}
                currentPostCount={userPostCount}
              />
            </div>
          )}
          
          {/* Posts */}
          <div className="flex-1 overflow-auto">
            {currentPosts.length > 0 ? (
              <div className="flex flex-col items-center gap-4">
                {currentPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                    isAnonymous={slide.allowAnonymous}
                    onLike={onLikePost ? () => onLikePost(post.id) : undefined}
                    onDelete={onDeletePost ? () => onDeletePost(post.id) : undefined}
                    isTeacher={isTeacher}
                  />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 h-full">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Zatím žádné příspěvky</p>
                  {!readOnly && <p className="text-sm mt-1">Buď první kdo něco napíše! ✨</p>}
                </div>
              </div>
            )}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-200/50">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-2 rounded-xl bg-white shadow-sm hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={`w-8 h-8 rounded-full text-sm font-bold transition-all ${
                      currentPage === i
                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30'
                        : 'bg-white shadow-sm hover:shadow-md text-slate-600'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
                className="p-2 rounded-xl bg-white shadow-sm hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Layout without image: question centered at top, posts below
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-hidden flex flex-col">
      {/* Header: Question centered */}
      <div className="flex-shrink-0 px-8 pt-16 pb-8 text-center border-b border-slate-100">
        <h2 
          className="font-bold text-[#4E5871] leading-tight mb-4"
          style={{ fontSize: questionFontSize }}
        >
          {slide.question || 'Téma diskuze...'}
        </h2>
        
        {/* Stats */}
        <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm">
            <MessageSquare className="w-4 h-4 text-pink-500" />
            <span className="font-medium">{posts.length} příspěvků</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm">
            <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
            <span className="font-medium">{totalLikes} lajků</span>
          </div>
        </div>
      </div>
      
      {/* New post form */}
      {!readOnly && onAddPost && (
        <div className="flex-shrink-0 px-8 py-4">
          <NewPostForm
            allowMedia={slide.allowMedia}
            onSubmit={onAddPost}
            maxPosts={slide.maxPosts}
            currentPostCount={userPostCount}
          />
        </div>
      )}
      
        {/* Posts grid */}
      <div className="flex-1 overflow-auto px-4 sm:px-8 py-4">
        {currentPosts.length > 0 ? (
          <div className="flex flex-col items-center gap-4">
            {currentPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                isAnonymous={slide.allowAnonymous}
                onLike={onLikePost ? () => onLikePost(post.id) : undefined}
                onDelete={onDeletePost ? () => onDeletePost(post.id) : undefined}
                isTeacher={isTeacher}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center text-slate-400 h-full">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <p className="font-medium text-lg">Zatím žádné příspěvky</p>
              {!readOnly && <p className="text-sm mt-2">Buď první kdo něco napíše! ✨</p>}
            </div>
          </div>
        )}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 px-8 py-4 border-t border-slate-100 bg-white/50">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="p-2 rounded-xl bg-white shadow-sm hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${
                  currentPage === i
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30 scale-110'
                    : 'bg-white shadow-sm hover:shadow-md text-slate-600'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className="p-2 rounded-xl bg-white shadow-sm hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      )}
    </div>
  );
}

export default BoardSlideView;
