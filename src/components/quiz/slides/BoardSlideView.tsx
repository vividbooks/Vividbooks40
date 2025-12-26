/**
 * Board (Nástěnka) Slide View
 * 
 * Padlet-style board where each post is a slide in a slider
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
  Plus,
  X,
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

// Calculate dynamic font size based on question length
function getQuestionFontSize(text: string): string {
  const length = text.length;
  if (length < 20) return '2.5rem';
  if (length < 40) return '2rem';
  if (length < 80) return '1.75rem';
  if (length < 120) return '1.5rem';
  if (length < 200) return '1.25rem';
  return '1.125rem';
}

// Modal for adding new post (Padlet-style)
function AddPostModal({
  allowMedia,
  onSubmit,
  onClose,
}: {
  allowMedia: boolean;
  onSubmit: (text: string, mediaUrl?: string, mediaType?: 'image' | 'youtube') => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'youtube' | null>(null);
  
  const youtubeId = mediaType === 'youtube' && mediaUrl ? getYouTubeId(mediaUrl) : null;
  const canSubmit = text.trim() || mediaUrl.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(text.trim(), mediaUrl.trim() || undefined, mediaType || undefined);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <button
            onClick={onClose}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Zrušit
          </button>
          <h3 className="font-bold text-slate-800">Nový příspěvek</h3>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-1.5 rounded-lg font-bold text-sm transition-all"
            style={{
              background: canSubmit ? 'linear-gradient(to right, #ec4899, #f43f5e)' : '#f1f5f9',
              color: canSubmit ? 'white' : '#94a3b8',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            Odeslat
          </button>
        </div>

        {/* Media upload area */}
        {allowMedia && (
          <div 
            className="relative border-2 border-dashed border-slate-200 m-4 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)',
              minHeight: mediaUrl ? 'auto' : '140px',
            }}
          >
            {/* Media preview */}
            {mediaUrl && mediaType === 'image' && (
              <div className="relative">
                <img 
                  src={mediaUrl} 
                  alt="Náhled" 
                  className="w-full h-56 object-cover"
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
                <div className="w-full h-56">
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
              <div className="flex items-center justify-center gap-4 py-10">
                <button
                  onClick={() => setMediaType('image')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-white/50 transition-colors group"
                >
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #818cf8, #6366f1)' }}
                  >
                    <ImageIcon className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Obrázek</span>
                </button>
                
                <button
                  onClick={() => setMediaType('youtube')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-white/50 transition-colors group"
                >
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
                  >
                    <Youtube className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">YouTube</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* URL input when media type is selected */}
        {allowMedia && mediaType && !mediaUrl && (
          <div className="px-4 pb-2">
            <input
              type="text"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder={mediaType === 'image' ? 'Vlož URL obrázku...' : 'Vlož URL YouTube videa...'}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 outline-none text-sm bg-slate-50"
              autoFocus
            />
          </div>
        )}

        {/* Text input */}
        <div className="px-4 pb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Napiš něco úžasného... ✨"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 outline-none resize-none text-[#4E5871] bg-slate-50 placeholder:text-slate-400"
            rows={4}
            autoFocus={!allowMedia}
          />
        </div>
      </div>
    </div>
  );
}

// Single post slide component
function PostSlide({
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
  const hasMedia = !!post.mediaUrl;

  const handleLike = useCallback(() => {
    if (!hasLiked) {
      setShowHearts(true);
      setIsAnimating(true);
      setTimeout(() => setShowHearts(false), 1000);
      setTimeout(() => setIsAnimating(false), 300);
    }
    onLike?.();
  }, [hasLiked, onLike]);

  return (
    <div className="h-full w-full flex flex-col lg:flex-row bg-white rounded-2xl shadow-lg overflow-hidden relative">
      {showHearts && <FloatingHearts count={5} />}
      
      {/* Left side: Text */}
      <div className={`${hasMedia ? 'lg:w-1/2' : 'w-full'} p-8 flex flex-col`}>
        {/* Author */}
        <div className="flex items-center gap-3 mb-6">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}
          >
            <User className="w-5 h-5 text-white" />
          </div>
          <span className="font-medium text-slate-700">
            {isAnonymous ? 'Anonymní' : post.authorName}
          </span>
        </div>

        {/* Text content */}
        <div className="flex-1">
          <p className="text-xl text-[#4E5871] leading-relaxed whitespace-pre-wrap">
            {post.text}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100">
          <button
            onClick={handleLike}
            className="flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-200"
            style={{
              background: hasLiked ? 'linear-gradient(to right, #ec4899, #f43f5e)' : '#f8fafc',
              color: hasLiked ? '#ffffff' : '#64748b',
              border: hasLiked ? 'none' : '1px solid #e2e8f0',
              boxShadow: hasLiked ? '0 4px 6px -1px rgba(236, 72, 153, 0.3)' : 'none',
              transform: isAnimating ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            <Heart 
              className="w-5 h-5"
              style={{ fill: hasLiked ? '#ffffff' : 'none' }}
            />
            <span>{post.likes.length}</span>
          </button>

          {(currentUserId === post.authorId || isTeacher) && onDelete && (
            <button
              onClick={onDelete}
              className="p-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Right side: Media */}
      {hasMedia && (
        <div className="lg:w-1/2 bg-slate-100 flex items-center justify-center">
          {post.mediaType === 'image' && (
            <img 
              src={post.mediaUrl} 
              alt="Příloha"
              className="w-full h-full object-cover"
            />
          )}
          {post.mediaType === 'youtube' && youtubeId && (
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              className="w-full h-full min-h-[300px]"
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
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  const hasImage = !!slide.questionImage;
  const questionFontSize = getQuestionFontSize(slide.question || '');
  
  // Sort posts by likes (most liked first), then by date
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (b.likes.length !== a.likes.length) {
        return b.likes.length - a.likes.length;
      }
      return b.createdAt - a.createdAt;
    });
  }, [posts]);

  const currentPost = sortedPosts[currentPostIndex];
  const totalPosts = sortedPosts.length;
  const totalLikes = posts.reduce((sum, p) => sum + p.likes.length, 0);

  // Count current user's posts
  const userPostCount = currentUserId 
    ? posts.filter(p => p.authorId === currentUserId).length 
    : 0;
  const maxPosts = slide.maxPosts;
  const canAddPost = maxPosts === undefined || maxPosts === 0 || userPostCount < maxPosts;

  const handleAddPost = (text: string, mediaUrl?: string, mediaType?: 'image' | 'youtube') => {
    onAddPost?.(text, mediaUrl, mediaType);
    setShowAddModal(false);
  };

  const goToPrevPost = () => {
    setCurrentPostIndex(prev => Math.max(0, prev - 1));
  };

  const goToNextPost = () => {
    setCurrentPostIndex(prev => Math.min(totalPosts - 1, prev + 1));
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-hidden flex flex-col lg:flex-row">
      {/* Left side: Question + Image + Add button */}
      <div 
        className={`${hasImage ? 'lg:w-2/5' : 'lg:w-1/3'} p-8 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-100`}
      >
        {/* Question */}
        <div 
          className="text-center lg:text-left mb-6"
          style={{ paddingTop: hasImage ? '20px' : '40px' }}
        >
          <h2 
            className="font-bold text-[#4E5871] leading-tight mb-4"
            style={{ fontSize: questionFontSize }}
          >
            {slide.question || 'Téma diskuze...'}
          </h2>
          
          {/* Stats */}
          <div className="flex items-center justify-center lg:justify-start gap-3 text-sm text-slate-500">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm">
              <MessageSquare className="w-4 h-4 text-pink-500" />
              <span className="font-medium">{totalPosts}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm">
              <Heart className="w-4 h-4 text-pink-500" style={{ fill: '#ec4899' }} />
              <span className="font-medium">{totalLikes}</span>
            </div>
          </div>
        </div>

        {/* Image */}
        {hasImage && (
          <div className="flex-1 flex items-center justify-center mb-6">
            <img
              src={slide.questionImage}
              alt="Obrázek k tématu"
              className="max-w-full max-h-64 lg:max-h-80 rounded-2xl shadow-xl object-contain"
            />
          </div>
        )}

        {/* Add post button */}
        {!readOnly && onAddPost && canAddPost && (
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
            style={{
              background: 'linear-gradient(to right, #ec4899, #f43f5e)',
              boxShadow: '0 10px 25px -5px rgba(236, 72, 153, 0.4)',
            }}
          >
            <Plus className="w-5 h-5" />
            Přidat příspěvek
          </button>
        )}

        {!canAddPost && (
          <div className="mt-auto text-center text-sm text-slate-500 bg-slate-100 rounded-xl py-3 px-4">
            <Sparkles className="w-4 h-4 inline mr-2 text-pink-400" />
            Dosáhl/a jsi maximálního počtu příspěvků
          </div>
        )}
      </div>

      {/* Right side: Posts slider */}
      <div className={`${hasImage ? 'lg:w-3/5' : 'lg:w-2/3'} flex flex-col p-6`}>
        {totalPosts > 0 ? (
          <>
            {/* Current post */}
            <div className="flex-1 min-h-0">
              {currentPost && (
                <PostSlide
                  post={currentPost}
                  currentUserId={currentUserId}
                  isAnonymous={slide.allowAnonymous}
                  onLike={onLikePost ? () => onLikePost(currentPost.id) : undefined}
                  onDelete={onDeletePost ? () => onDeletePost(currentPost.id) : undefined}
                  isTeacher={isTeacher}
                />
              )}
            </div>

            {/* Navigation */}
            {totalPosts > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={goToPrevPost}
                  disabled={currentPostIndex === 0}
                  className="p-3 rounded-full bg-white shadow-md hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-6 h-6 text-slate-600" />
                </button>

                {/* Dots */}
                <div className="flex items-center gap-2">
                  {sortedPosts.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentPostIndex(index)}
                      className="transition-all"
                      style={{
                        width: currentPostIndex === index ? '24px' : '10px',
                        height: '10px',
                        borderRadius: '5px',
                        background: currentPostIndex === index 
                          ? 'linear-gradient(to right, #ec4899, #f43f5e)' 
                          : '#cbd5e1',
                      }}
                    />
                  ))}
                </div>

                <button
                  onClick={goToNextPost}
                  disabled={currentPostIndex === totalPosts - 1}
                  className="p-3 rounded-full bg-white shadow-md hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-6 h-6 text-slate-600" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <MessageSquare className="w-20 h-20 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-xl mb-2">Zatím žádné příspěvky</p>
              {!readOnly && <p className="text-sm">Buď první kdo něco napíše! ✨</p>}
            </div>
          </div>
        )}
      </div>

      {/* Add post modal */}
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
