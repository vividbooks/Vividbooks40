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
  onSubmit,
  onClose,
}: {
  allowMedia: boolean;
  onSubmit: (text: string, mediaUrl?: string, mediaType?: 'image' | 'youtube', backgroundColor?: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'youtube' | null>(null);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  
  const youtubeId = mediaType === 'youtube' && mediaUrl ? getYouTubeId(mediaUrl) : null;
  const canSubmit = text.trim() || mediaUrl.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(text.trim(), mediaUrl.trim() || undefined, mediaType || undefined, backgroundColor);
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
          <h3 className="font-bold text-slate-800 text-lg">Nový příspěvek</h3>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-5 py-2 rounded-xl font-bold text-sm transition-all"
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
            placeholder="Napiš něco úžasného... ✨"
            className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 outline-none resize-none text-[#4E5871] bg-slate-50 placeholder:text-slate-400 text-lg"
            rows={4}
            autoFocus={!allowMedia}
          />
        </div>

        {/* Color picker */}
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
    <div className="h-full w-full flex flex-col lg:flex-row">
      {/* Left side or full width: Question */}
      <div className={`${hasImage ? 'lg:w-1/2' : 'w-full'} p-8 lg:p-12 flex flex-col items-center justify-center text-center`}>
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
            className="flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg text-white transition-all hover:scale-105 active:scale-95 shadow-xl"
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
          <div className="text-center text-sm text-slate-500 bg-slate-100 rounded-xl py-3 px-6">
            <Sparkles className="w-5 h-5 inline mr-2 text-pink-400" />
            Dosáhl/a jsi maximálního počtu příspěvků
          </div>
        )}
      </div>

      {/* Right side: Image */}
      {hasImage && (
        <div className="lg:w-1/2 p-8 flex items-center justify-center bg-slate-50">
          <img
            src={slide.questionImage}
            alt="Obrázek k tématu"
            className="max-w-full max-h-full rounded-2xl shadow-xl object-contain"
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
        className="flex flex-col p-8 lg:p-10"
        style={{ width: hasMedia ? '50%' : '100%' }}
      >
        {/* Author */}
        <div className="flex items-center gap-3 mb-8">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-md"
            style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}
          >
            <User className="w-6 h-6 text-white" />
          </div>
          <span className="font-semibold text-lg text-slate-700">
            {isAnonymous ? 'Anonymní' : post.authorName}
          </span>
        </div>

        {/* Text content */}
        <div className="flex-1">
          <p className="text-2xl text-[#4E5871] leading-relaxed whitespace-pre-wrap">
            {post.text}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 mt-8 pt-6 border-t" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
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

      {/* Right side: Media - exactly 50% */}
      {hasMedia && (
        <div 
          className="bg-slate-900 flex items-center justify-center"
          style={{ width: '50%' }}
        >
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

// Simple post card for pros-cons view
function SimplePostCard({
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
  const hasLiked = currentUserId ? post.likes.includes(currentUserId) : false;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <p className="text-[#4E5871] text-sm mb-3">{post.text}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {isAnonymous ? 'Anonym' : post.authorName}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onLike}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all"
            style={{
              background: hasLiked ? '#fce7f3' : '#f8fafc',
              color: hasLiked ? '#ec4899' : '#64748b',
            }}
          >
            <Heart className="w-3 h-3" style={{ fill: hasLiked ? '#ec4899' : 'none' }} />
            {post.likes.length}
          </button>
          {(currentUserId === post.authorId || isTeacher) && onDelete && (
            <button
              onClick={onDelete}
              className="p-1 text-slate-300 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
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
  onAddPost,
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
  onAddPost: (text: string, column: 'left' | 'right') => void;
  onLikePost?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  isTeacher?: boolean;
}) {
  const [leftInput, setLeftInput] = useState('');
  const [rightInput, setRightInput] = useState('');
  
  const leftPosts = posts.filter(p => p.column === 'left');
  const rightPosts = posts.filter(p => p.column === 'right');
  const questionFontSize = getQuestionFontSize(slide.question || '');

  const handleSubmitLeft = () => {
    if (!leftInput.trim()) return;
    onAddPost(leftInput.trim(), 'left');
    setLeftInput('');
  };

  const handleSubmitRight = () => {
    if (!rightInput.trim()) return;
    onAddPost(rightInput.trim(), 'right');
    setRightInput('');
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-auto flex flex-col">
      {/* Question header */}
      <div 
        className="text-center px-8 border-b border-slate-100"
        style={{ paddingTop: '60px', paddingBottom: '30px' }}
      >
        <h2 
          className="font-bold text-[#4E5871] leading-tight"
          style={{ fontSize: questionFontSize }}
        >
          {slide.question || 'Téma diskuze...'}
        </h2>
      </div>

      {/* Two columns */}
      <div className="flex-1 flex">
        {/* Left column (Pro) */}
        <div className="w-1/2 p-6 border-r border-slate-100" style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)' }}>
          <div className="flex items-center gap-2 mb-4">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
            >
              <span className="text-white font-bold text-sm">+</span>
            </div>
            <h3 className="font-bold text-green-700 text-lg">{slide.leftColumnLabel || 'Pro'}</h3>
            <span className="text-sm text-green-600 ml-auto">{leftPosts.length}</span>
          </div>

          {/* Add input */}
          {!readOnly && canAddPost && (
            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={leftInput}
                  onChange={(e) => setLeftInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitLeft()}
                  placeholder="Přidej argument..."
                  className="flex-1 px-3 py-2 rounded-lg border border-green-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none text-sm bg-white"
                />
                <button
                  onClick={handleSubmitLeft}
                  disabled={!leftInput.trim()}
                  className="px-3 py-2 rounded-lg font-medium text-sm transition-all"
                  style={{
                    background: leftInput.trim() ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#e2e8f0',
                    color: leftInput.trim() ? 'white' : '#94a3b8',
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Posts */}
          <div className="space-y-3 overflow-auto max-h-[400px]">
            {leftPosts.map(post => (
              <SimplePostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                isAnonymous={isAnonymous}
                onLike={onLikePost ? () => onLikePost(post.id) : undefined}
                onDelete={onDeletePost ? () => onDeletePost(post.id) : undefined}
                isTeacher={isTeacher}
              />
            ))}
          </div>
        </div>

        {/* Right column (Proti) */}
        <div className="w-1/2 p-6" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="flex items-center gap-2 mb-4">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
            >
              <span className="text-white font-bold text-sm">−</span>
            </div>
            <h3 className="font-bold text-red-700 text-lg">{slide.rightColumnLabel || 'Proti'}</h3>
            <span className="text-sm text-red-600 ml-auto">{rightPosts.length}</span>
          </div>

          {/* Add input */}
          {!readOnly && canAddPost && (
            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={rightInput}
                  onChange={(e) => setRightInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitRight()}
                  placeholder="Přidej argument..."
                  className="flex-1 px-3 py-2 rounded-lg border border-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none text-sm bg-white"
                />
                <button
                  onClick={handleSubmitRight}
                  disabled={!rightInput.trim()}
                  className="px-3 py-2 rounded-lg font-medium text-sm transition-all"
                  style={{
                    background: rightInput.trim() ? 'linear-gradient(135deg, #ef4444, #dc2626)' : '#e2e8f0',
                    color: rightInput.trim() ? 'white' : '#94a3b8',
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Posts */}
          <div className="space-y-3 overflow-auto max-h-[400px]">
            {rightPosts.map(post => (
              <SimplePostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                isAnonymous={isAnonymous}
                onLike={onLikePost ? () => onLikePost(post.id) : undefined}
                onDelete={onDeletePost ? () => onDeletePost(post.id) : undefined}
                isTeacher={isTeacher}
              />
            ))}
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
      <ProsConsView
        slide={slide}
        posts={posts}
        currentUserId={currentUserId}
        isAnonymous={slide.allowAnonymous}
        readOnly={readOnly}
        canAddPost={canAddPost}
        onAddPost={(text, column) => handleAddPost(text, undefined, undefined, undefined, column)}
        onLikePost={onLikePost}
        onDeletePost={onDeletePost}
        isTeacher={isTeacher}
      />
    );
  }

  // Render Text or Presentation view (slider)
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-pink-50/30 rounded-3xl overflow-hidden flex flex-col">
      {/* Main content area */}
      <div className="flex-1 min-h-0 p-6">
        {currentSlideIndex === 0 ? (
          // Question slide
          <div className="h-full bg-white rounded-2xl shadow-lg overflow-hidden">
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
          // Post slide
          <PostSlide
            post={currentPost}
            currentUserId={currentUserId}
            isAnonymous={slide.allowAnonymous}
            onLike={onLikePost ? () => onLikePost(currentPost.id) : undefined}
            onDelete={onDeletePost ? () => onDeletePost(currentPost.id) : undefined}
            isTeacher={isTeacher}
          />
        ) : null}
      </div>

      {/* Navigation - always visible */}
      <div className="flex-shrink-0 flex items-center justify-center gap-4 px-6 py-4 bg-white/80 backdrop-blur-sm border-t border-slate-100">
          <button
            onClick={goToPrevSlide}
            disabled={currentSlideIndex === 0}
            className="p-3 rounded-full bg-white shadow-md hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-6 h-6 text-slate-600" />
          </button>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSlides }).map((_, index) => (
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
