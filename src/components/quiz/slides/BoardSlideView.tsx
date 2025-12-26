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
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 50 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Heart
          key={i}
          style={{
            position: 'absolute',
            left: `${20 + Math.random() * 60}%`,
            bottom: '0px',
            color: '#ec4899',
            fill: '#ec4899',
            width: `${18 + Math.random() * 10}px`,
            height: `${18 + Math.random() * 10}px`,
            animation: `float-up 1s ease-out forwards`,
            animationDelay: `${i * 0.08}s`,
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
            style={{
              background: hasLiked 
                ? 'linear-gradient(to right, #ec4899, #f43f5e)' 
                : '#ffffff',
              color: hasLiked ? '#ffffff' : '#64748b',
              border: hasLiked ? 'none' : '1px solid #e2e8f0',
              boxShadow: hasLiked ? '0 4px 6px -1px rgba(236, 72, 153, 0.3)' : 'none',
              transform: isAnimating ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            <Heart 
              className="w-4 h-4 transition-transform"
              style={{ 
                fill: hasLiked ? '#ffffff' : 'none',
                animation: isAnimating ? 'bounce 0.3s ease' : 'none',
              }}
            />
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

// New post form component - Padlet style when media is allowed
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
  const [isExpanded, setIsExpanded] = useState(false);
  
  const canPost = maxPosts === undefined || maxPosts === 0 || currentPostCount < maxPosts;
  const youtubeId = mediaType === 'youtube' && mediaUrl ? getYouTubeId(mediaUrl) : null;
  
  const handleSubmit = () => {
    if (!text.trim() && !mediaUrl.trim()) return;
    onSubmit(
      text.trim(), 
      mediaUrl.trim() || undefined, 
      mediaType || undefined
    );
    setText('');
    setMediaUrl('');
    setMediaType(null);
    setIsExpanded(false);
  };

  const handleClear = () => {
    setText('');
    setMediaUrl('');
    setMediaType(null);
  };
  
  if (!canPost) {
    return (
      <div className="bg-gradient-to-r from-slate-100 to-pink-50 rounded-2xl p-4 text-center text-slate-500 text-sm border border-slate-200">
        <Sparkles className="w-5 h-5 mx-auto mb-2 text-pink-400" />
        Dosáhl/a jsi maximálního počtu příspěvků ({maxPosts})
      </div>
    );
  }

  // Simple form for text-only posts
  if (!allowMedia) {
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
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
            style={{
              background: text.trim() ? 'linear-gradient(to right, #ec4899, #f43f5e)' : '#e2e8f0',
              color: text.trim() ? 'white' : '#94a3b8',
              boxShadow: text.trim() ? '0 10px 15px -3px rgba(236, 72, 153, 0.3)' : 'none',
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

  // Padlet-style form for posts with media
  return (
    <div 
      className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mx-auto"
      style={{ width: '100%', maxWidth: '550px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <button
          onClick={handleClear}
          className="text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
        >
          Vymazat
        </button>
        <button
          onClick={handleSubmit}
          disabled={!text.trim() && !mediaUrl.trim()}
          className="px-4 py-1.5 rounded-lg font-bold text-sm transition-all"
          style={{
            background: (text.trim() || mediaUrl.trim()) 
              ? 'linear-gradient(to right, #ec4899, #f43f5e)' 
              : '#f1f5f9',
            color: (text.trim() || mediaUrl.trim()) ? 'white' : '#94a3b8',
            cursor: (text.trim() || mediaUrl.trim()) ? 'pointer' : 'not-allowed',
          }}
        >
          Odeslat
        </button>
      </div>

      {/* Media upload area */}
      <div 
        className="relative border-2 border-dashed border-slate-200 m-4 rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)',
          minHeight: mediaUrl ? 'auto' : '120px',
        }}
      >
        {/* Media preview */}
        {mediaUrl && mediaType === 'image' && (
          <div className="relative">
            <img 
              src={mediaUrl} 
              alt="Náhled" 
              className="w-full h-48 object-cover"
              onError={() => setMediaUrl('')}
            />
            <button
              onClick={() => { setMediaUrl(''); setMediaType(null); }}
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {mediaUrl && mediaType === 'youtube' && youtubeId && (
          <div className="relative">
            <div className="w-full h-48">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <button
              onClick={() => { setMediaUrl(''); setMediaType(null); }}
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Media type selector */}
        {!mediaUrl && (
          <div className="flex items-center justify-center gap-3 py-8">
            <button
              onClick={() => { setMediaType('image'); setIsExpanded(true); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-white/50 transition-colors group"
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: 'linear-gradient(135deg, #818cf8, #6366f1)' }}
              >
                <ImageIcon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-medium text-slate-600">Obrázek</span>
            </button>
            
            <button
              onClick={() => { setMediaType('youtube'); setIsExpanded(true); }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-white/50 transition-colors group"
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
              >
                <Youtube className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-medium text-slate-600">YouTube</span>
            </button>
          </div>
        )}
      </div>

      {/* URL input when media type is selected but no URL yet */}
      {mediaType && !mediaUrl && isExpanded && (
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder={mediaType === 'image' ? 'Vlož URL obrázku...' : 'Vlož URL YouTube videa...'}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 outline-none text-sm bg-slate-50"
              autoFocus
            />
            <button
              onClick={() => { setMediaType(null); setIsExpanded(false); }}
              className="px-3 py-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

      {/* Text input */}
      <div className="px-4 pb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Napiš něco úžasného... ✨"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 outline-none resize-none text-[#4E5871] bg-slate-50 placeholder:text-slate-400"
          rows={3}
        />
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

  // Layout with image: two columns 50/50
  if (hasImage) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-hidden flex">
        {/* Left column: Question + Image (50%) */}
        <div className="w-1/2 p-8 flex flex-col border-r border-slate-100 overflow-auto">
          {/* Question */}
          <div 
            className="text-center mb-8"
            style={{ paddingTop: '60px' }}
          >
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
          
          {/* Image */}
          <div className="flex-1 flex items-center justify-center pb-8">
            <img
              src={slide.questionImage}
              alt="Obrázek k tématu"
              className="max-w-full max-h-full rounded-2xl shadow-xl object-contain"
            />
          </div>
        </div>
        
        {/* Right column: Posts (50%) */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-gradient-to-b from-transparent to-pink-50/20">
          {/* New post form */}
          {!readOnly && onAddPost && (
            <div className="p-6 flex-shrink-0">
              <NewPostForm
                allowMedia={slide.allowMedia}
                onSubmit={onAddPost}
                maxPosts={slide.maxPosts}
                currentPostCount={userPostCount}
              />
            </div>
          )}
          
          {/* Posts */}
          <div className="flex-1 overflow-auto px-6 pb-6">
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
            <div className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-4 border-t border-slate-200/50 bg-white/50">
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
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-auto">
      {/* Header: Question centered */}
      <div 
        className="px-8 text-center border-b border-slate-100"
        style={{ paddingTop: '120px', paddingBottom: '40px' }}
      >
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
        <div className="px-8 py-6">
          <NewPostForm
            allowMedia={slide.allowMedia}
            onSubmit={onAddPost}
            maxPosts={slide.maxPosts}
            currentPostCount={userPostCount}
          />
        </div>
      )}
      
      {/* Posts grid */}
      <div className="px-4 sm:px-8 py-4">
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
          <div className="flex items-center justify-center text-slate-400 py-16">
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
        <div className="flex items-center justify-center gap-2 px-8 py-6 border-t border-slate-100 bg-white/50">
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
