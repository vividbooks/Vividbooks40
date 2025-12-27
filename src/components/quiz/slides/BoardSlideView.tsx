/**
 * Board (Nástěnka) Slide View
 * 
 * Padlet-style board where:
 * - First slide shows the question + image + add button
 * - Each subsequent slide is a single post
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Heart,
  MessageSquare,
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
  onAddPost?: (text: string, mediaUrl?: string, mediaType?: 'image' | 'youtube', backgroundColor?: string, column?: 'left' | 'right') => void;
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

// Color options for posts
const POST_COLORS = [
  { name: 'Bílá', value: '#ffffff' },
  { name: 'Růžová', value: '#fce7f3' },
  { name: 'Fialová', value: '#ede9fe' },
  { name: 'Modrá', value: '#dbeafe' },
  { name: 'Zelená', value: '#dcfce7' },
  { name: 'Žlutá', value: '#fef9c3' },
  { name: 'Oranžová', value: '#ffedd5' },
  { name: 'Šedá', value: '#f1f5f9' },
];

// Modal for adding new post (Padlet-style)
function AddPostModal({
  allowMedia,
  showColumnSelector,
  leftColumnLabel,
  rightColumnLabel,
  onSubmit,
  onClose,
}: {
  allowMedia: boolean;
  showColumnSelector?: boolean;
  leftColumnLabel?: string;
  rightColumnLabel?: string;
  onSubmit: (text: string, mediaUrl?: string, mediaType?: 'image' | 'youtube', backgroundColor?: string, column?: 'left' | 'right') => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'youtube' | null>(null);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [selectedColumn, setSelectedColumn] = useState<'left' | 'right'>('left');
  
  const youtubeId = mediaType === 'youtube' && mediaUrl ? getYouTubeId(mediaUrl) : null;
  const canSubmit = text.trim() || mediaUrl.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(
      text.trim(), 
      mediaUrl.trim() || undefined, 
      mediaType || undefined, 
      backgroundColor,
      showColumnSelector ? selectedColumn : undefined
    );
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: '600px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
          <h3 className="font-bold text-slate-800 text-lg">
            {showColumnSelector ? 'Nový argument' : 'Nový příspěvek'}
          </h3>
          <div style={{ width: '40px' }} /> {/* Spacer for centering */}
        </div>

        {/* Media upload area */}
        {allowMedia && (
          <div 
            className="relative border-2 border-dashed border-slate-200 m-4 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)',
              minHeight: mediaUrl ? 'auto' : '160px',
            }}
          >
            {/* Media preview */}
            {mediaUrl && mediaType === 'image' && (
              <div className="relative">
                <img 
                  src={mediaUrl} 
                  alt="Náhled" 
                  className="w-full h-64 object-cover"
                  onError={() => setMediaUrl('')}
                />
                <button
                  onClick={() => { setMediaUrl(''); setMediaType(null); }}
                  className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}
            
            {mediaUrl && mediaType === 'youtube' && youtubeId && (
              <div className="relative">
                <div className="w-full h-64">
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
                  className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Media type selector */}
            {!mediaUrl && (
              <div className="flex items-center justify-center gap-6 py-12">
                <button
                  onClick={() => setMediaType('image')}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl hover:bg-white/50 transition-colors group"
                >
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #818cf8, #6366f1)' }}
                  >
                    <ImageIcon className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Obrázek</span>
                </button>
                
                <button
                  onClick={() => setMediaType('youtube')}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl hover:bg-white/50 transition-colors group"
                >
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
                  >
                    <Youtube className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">YouTube</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* URL input when media type is selected */}
        {allowMedia && mediaType && !mediaUrl && (
          <div className="px-4 pb-3">
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
            placeholder={showColumnSelector ? "Napiš svůj argument..." : "Napiš něco úžasného... ✨"}
            className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 outline-none resize-none text-[#4E5871] bg-slate-50 placeholder:text-slate-400 text-lg"
            rows={4}
            autoFocus={!allowMedia}
          />
        </div>

        {/* Color picker - only for non-column posts */}
        {!showColumnSelector && (
          <div className="px-4 pb-5 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-600 mb-3">Barva pozadí</p>
            <div className="flex flex-wrap gap-2">
              {POST_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setBackgroundColor(color.value)}
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color.value,
                    borderColor: backgroundColor === color.value ? '#ec4899' : '#e2e8f0',
                    boxShadow: backgroundColor === color.value ? '0 0 0 2px rgba(236, 72, 153, 0.3)' : 'none',
                  }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* Column selector and Submit button */}
        <div className="px-4 pb-5 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-3">
            {/* Column dropdown for pros-cons */}
            {showColumnSelector && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-600 mb-2">Kam odeslat?</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedColumn('left')}
                    className="flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all border-2"
                    style={{
                      backgroundColor: selectedColumn === 'left' ? 'rgba(34, 197, 94, 0.1)' : '#ffffff',
                      borderColor: selectedColumn === 'left' ? '#22c55e' : '#e2e8f0',
                      color: selectedColumn === 'left' ? '#15803d' : '#64748b',
                    }}
                  >
                    <span className="mr-2">+</span>
                    {leftColumnLabel || 'Pro'}
                  </button>
                  <button
                    onClick={() => setSelectedColumn('right')}
                    className="flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all border-2"
                    style={{
                      backgroundColor: selectedColumn === 'right' ? 'rgba(239, 68, 68, 0.1)' : '#ffffff',
                      borderColor: selectedColumn === 'right' ? '#ef4444' : '#e2e8f0',
                      color: selectedColumn === 'right' ? '#b91c1c' : '#64748b',
                    }}
                  >
                    <span className="mr-2">−</span>
                    {rightColumnLabel || 'Proti'}
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full mt-4 py-3 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2"
            style={{
              background: canSubmit 
                ? (showColumnSelector 
                    ? (selectedColumn === 'left' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #dc2626)')
                    : 'linear-gradient(to right, #ec4899, #f43f5e)')
                : '#f1f5f9',
              color: canSubmit ? 'white' : '#94a3b8',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            Odeslat
            {showColumnSelector && (
              <span className="opacity-80">
                → {selectedColumn === 'left' ? (leftColumnLabel || 'Pro') : (rightColumnLabel || 'Proti')}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Question slide (first slide)
function QuestionSlide({
  slide,
  totalPosts,
  totalLikes,
  canAddPost,
  readOnly,
  onAddPost,
}: {
  slide: BoardActivitySlide;
  totalPosts: number;
  totalLikes: number;
  canAddPost: boolean;
  readOnly: boolean;
  onAddPost: () => void;
}) {
  const questionFontSize = getQuestionFontSize(slide.question || '');
  const hasImage = !!slide.questionImage;

  return (
    <div className="h-full w-full flex flex-col lg:flex-row overflow-hidden">
      {/* Left side or full width: Question */}
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
        
        {/* Stats */}
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

        {/* Add post button */}
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

      {/* Right side: Image - with constrained height */}
      {hasImage && (
        <div 
          className="lg:w-1/2 flex items-center justify-center bg-slate-50 overflow-hidden"
          style={{ padding: '24px' }}
        >
          <img
            src={slide.questionImage}
            alt="Obrázek k tématu"
            className="rounded-2xl shadow-xl"
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%', 
              objectFit: 'contain' 
            }}
          />
        </div>
      )}
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
  const bgColor = post.backgroundColor || '#ffffff';

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
    <div 
      className="h-full w-full flex flex-col lg:flex-row rounded-2xl shadow-lg overflow-hidden relative"
      style={{ backgroundColor: bgColor }}
    >
      {showHearts && <FloatingHearts count={5} />}
      
      {/* Left side: Text - exactly 50% when media exists */}
      <div 
        className="flex flex-col overflow-hidden"
        style={{ 
          width: hasMedia ? '50%' : '100%',
          padding: '32px',
        }}
      >
        {/* Author - fixed height */}
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

        {/* Text content - scrollable */}
        <div className="flex-1 min-h-0 overflow-auto">
          <p className="text-2xl text-[#4E5871] leading-relaxed whitespace-pre-wrap">
            {post.text}
          </p>
        </div>

        {/* Actions - fixed height */}
        <div className="flex items-center gap-4 mt-6 pt-6 border-t flex-shrink-0" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
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
            <Heart 
              className="w-5 h-5"
              style={{ fill: hasLiked ? '#ffffff' : 'none' }}
            />
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

      {/* Right side: Media - exactly 50%, height constrained */}
      {hasMedia && (
        <div 
          className="flex items-center justify-center overflow-hidden"
          style={{ 
            width: '50%', 
            height: '100%',
            backgroundColor: '#0f172a' 
          }}
        >
          {post.mediaType === 'image' && (
            <img 
              src={post.mediaUrl} 
              alt="Příloha"
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain' 
              }}
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

// Simple post card for text board and pros-cons view
function SimplePostCard({
  post,
  currentUserId,
  isAnonymous,
  onLike,
  onDelete,
  isTeacher,
  size = 'small',
}: {
  post: BoardPost;
  currentUserId?: string;
  isAnonymous?: boolean;
  onLike?: () => void;
  onDelete?: () => void;
  isTeacher?: boolean;
  size?: 'small' | 'medium';
}) {
  const [showHearts, setShowHearts] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const hasLiked = currentUserId ? post.likes.includes(currentUserId) : false;

  const handleLike = useCallback(() => {
    if (!hasLiked) {
      setShowHearts(true);
      setIsAnimating(true);
      setTimeout(() => setShowHearts(false), 1000);
      setTimeout(() => setIsAnimating(false), 300);
    }
    onLike?.();
  }, [hasLiked, onLike]);

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
            <Heart 
              className="w-3.5 h-3.5" 
              style={{ fill: hasLiked ? '#ffffff' : 'none' }} 
            />
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

// Text Board View - classic list of posts
function TextBoardView({
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
}: {
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
}) {
  const questionFontSize = getQuestionFontSize(slide.question || '');
  const totalLikes = posts.reduce((sum, p) => sum + p.likes.length, 0);
  const hasImage = !!slide.questionImage;

  // Sort posts by likes (most liked first), then by date
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (b.likes.length !== a.likes.length) {
        return b.likes.length - a.likes.length;
      }
      return b.createdAt - a.createdAt;
    });
  }, [posts]);

  // Two-column layout when there's an image
  if (hasImage) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-hidden flex flex-col lg:flex-row">
        {/* Left column: Question + Image - flexible */}
        <div 
          className="flex flex-col overflow-auto flex-1"
          style={{ padding: '32px', minWidth: 0 }}
        >
          {/* Question */}
          <div style={{ paddingTop: '60px' }}>
            <h2 
              className="font-bold text-[#4E5871] leading-tight mb-6"
              style={{ fontSize: questionFontSize }}
            >
              {slide.question || 'Téma diskuze...'}
            </h2>
            
            {/* Stats */}
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

            {/* Add post button */}
            {!readOnly && canAddPost && (
              <button
                onClick={onOpenAddModal}
                className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-base text-white transition-all hover:scale-105 active:scale-95 shadow-lg mb-8"
                style={{
                  background: 'linear-gradient(to right, #ec4899, #f43f5e)',
                  boxShadow: '0 10px 25px -5px rgba(236, 72, 153, 0.4)',
                }}
              >
                <Plus className="w-5 h-5" />
                Přidat příspěvek
              </button>
            )}
          </div>

          {/* Image below question */}
          <div className="flex-1 flex items-start justify-center">
            <img
              src={slide.questionImage}
              alt="Obrázek k tématu"
              className="max-w-full max-h-80 rounded-2xl shadow-lg object-contain"
            />
          </div>
        </div>

        {/* Right column: Posts - fixed width for consistent post size */}
        <div 
          className="overflow-auto bg-white/50 flex-shrink-0"
          style={{ padding: '32px', paddingTop: '60px', width: '550px' }}
        >
          <div className="space-y-4">
            {sortedPosts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Zatím žádné příspěvky</p>
                <p className="text-sm mt-1">Buď první, kdo něco napíše!</p>
              </div>
            ) : (
              sortedPosts.map(post => (
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
        </div>
      </div>
    );
  }

  // Single column layout when no image
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-auto">
      {/* Question section - centered */}
      <div 
        className="text-center max-w-3xl mx-auto"
        style={{ paddingTop: '80px', paddingBottom: '32px', paddingLeft: '32px', paddingRight: '32px' }}
      >
        <h2 
          className="font-bold text-[#4E5871] leading-tight mb-6"
          style={{ fontSize: questionFontSize }}
        >
          {slide.question || 'Téma diskuze...'}
        </h2>
        
        {/* Stats */}
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

        {/* Add post button */}
        {!readOnly && canAddPost && (
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-base text-white transition-all hover:scale-105 active:scale-95 shadow-lg mx-auto"
            style={{
              background: 'linear-gradient(to right, #ec4899, #f43f5e)',
              boxShadow: '0 10px 25px -5px rgba(236, 72, 153, 0.4)',
            }}
          >
            <Plus className="w-5 h-5" />
            Přidat příspěvek
          </button>
        )}
      </div>

      {/* Posts list - centered, same width as with image */}
      <div 
        className="mx-auto space-y-4"
        style={{ paddingBottom: '48px', paddingLeft: '24px', paddingRight: '24px', maxWidth: '550px' }}
      >
        {sortedPosts.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Zatím žádné příspěvky</p>
            <p className="text-sm mt-1">Buď první, kdo něco napíše!</p>
          </div>
        ) : (
          sortedPosts.map(post => (
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
    </div>
  );
}

// Pros and Cons View
function ProsConsView({
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
}: {
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
}) {
  const leftPosts = posts.filter(p => p.column === 'left');
  const rightPosts = posts.filter(p => p.column === 'right');
  const questionFontSize = getQuestionFontSize(slide.question || '');

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-hidden flex flex-col">
      {/* Question header with Add button */}
      <div 
        className="text-center px-8 border-b border-slate-100 flex-shrink-0"
        style={{ paddingTop: '40px', paddingBottom: '24px' }}
      >
        <h2 
          className="font-bold text-[#4E5871] leading-tight mb-6"
          style={{ fontSize: questionFontSize }}
        >
          {slide.question || 'Téma diskuze...'}
        </h2>
        
        {/* Add post button */}
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
            <span className="text-sm text-green-600 ml-auto bg-green-100 px-2 py-0.5 rounded-full">{leftPosts.length}</span>
          </div>

          {/* Posts - scrollable */}
          <div className="flex-1 overflow-auto space-y-3">
            {leftPosts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Zatím žádné argumenty
              </div>
            ) : (
              leftPosts.map(post => (
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
            <span className="text-sm text-red-600 ml-auto bg-red-100 px-2 py-0.5 rounded-full">{rightPosts.length}</span>
          </div>

          {/* Posts - scrollable */}
          <div className="flex-1 overflow-auto space-y-3">
            {rightPosts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Zatím žádné argumenty
              </div>
            ) : (
              rightPosts.map(post => (
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
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0); // 0 = question slide
  const [showAddModal, setShowAddModal] = useState(false);

  // Determine board type
  const boardType = slide.boardType || (slide.allowMedia ? 'presentation' : 'text');
  
  // Sort posts by likes (most liked first), then by date
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (b.likes.length !== a.likes.length) {
        return b.likes.length - a.likes.length;
      }
      return b.createdAt - a.createdAt;
    });
  }, [posts]);

  const totalPosts = sortedPosts.length;
  const totalSlides = totalPosts + 1; // +1 for question slide
  const totalLikes = posts.reduce((sum, p) => sum + p.likes.length, 0);

  // Count current user's posts
  const userPostCount = currentUserId 
    ? posts.filter(p => p.authorId === currentUserId).length 
    : 0;
  const maxPosts = slide.maxPosts;
  const canAddPost = maxPosts === undefined || maxPosts === 0 || userPostCount < maxPosts;

  const handleAddPost = (text: string, mediaUrl?: string, mediaType?: 'image' | 'youtube', backgroundColor?: string, column?: 'left' | 'right') => {
    onAddPost?.(text, mediaUrl, mediaType, backgroundColor, column);
    setShowAddModal(false);
  };

  const goToPrevSlide = () => {
    setCurrentSlideIndex(prev => Math.max(0, prev - 1));
  };

  const goToNextSlide = () => {
    setCurrentSlideIndex(prev => Math.min(totalSlides - 1, prev + 1));
  };

  // Current post (if not on question slide)
  const currentPost = currentSlideIndex > 0 ? sortedPosts[currentSlideIndex - 1] : null;

  // Render Pros-Cons view
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
        
        {/* Add post modal for pros-cons */}
        {showAddModal && (
          <AddPostModal
            allowMedia={false}
            showColumnSelector={true}
            leftColumnLabel={slide.leftColumnLabel}
            rightColumnLabel={slide.rightColumnLabel}
            onSubmit={handleAddPost}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </>
    );
  }

  // Render Text Board view - classic list of posts
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
        
        {/* Add post modal for text board */}
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

  // Render Text or Presentation view (slider)
  return (
    <div 
      className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-hidden"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Main content area - takes remaining space with fixed height */}
      <div 
        style={{ 
          flex: '1 1 0%', 
          minHeight: 0, 
          padding: '24px',
          overflow: 'hidden',
        }}
      >
        {currentSlideIndex === 0 ? (
          // Question slide
          <div style={{ height: '100%', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <QuestionSlide
              slide={slide}
              totalPosts={totalPosts}
              totalLikes={totalLikes}
              canAddPost={canAddPost}
              readOnly={readOnly}
              onAddPost={() => setShowAddModal(true)}
            />
          </div>
        ) : currentPost ? (
          // Post slide - height constrained
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

      {/* Navigation - always visible, fixed height */}
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
          onClick={goToPrevSlide}
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
                background: index === 0 
                  ? (currentSlideIndex === 0 ? '#4E5871' : '#cbd5e1')
                  : (currentSlideIndex === index ? 'linear-gradient(to right, #ec4899, #f43f5e)' : '#cbd5e1'),
              }}
              title={index === 0 ? 'Otázka' : `Příspěvek ${index}`}
            />
          ))}
          {totalSlides > 15 && (
            <span className="text-xs text-slate-400 ml-1">+{totalSlides - 15}</span>
          )}
        </div>

        <button
          onClick={goToNextSlide}
          disabled={currentSlideIndex === totalSlides - 1}
          className="p-3 rounded-full bg-white shadow-md hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight className="w-6 h-6 text-slate-600" />
        </button>

        {/* Slide counter */}
        <div className="text-sm text-slate-500 font-medium ml-4">
          {currentSlideIndex + 1} / {totalSlides}
        </div>
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
