/**
 * Board (Nástěnka) Slide View
 * 
 * Display component for board activities in preview/playback mode
 * Shows the question on the left and posts on the right
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  const hasLiked = currentUserId ? post.likes.includes(currentUserId) : false;
  const youtubeId = post.mediaType === 'youtube' && post.mediaUrl ? getYouTubeId(post.mediaUrl) : null;
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Post content */}
      <div className="p-4">
        <div className="flex gap-4">
          {/* Text column */}
          <div className="flex-1 min-w-0">
            <p className="text-[#4E5871] whitespace-pre-wrap break-words">
              {post.text}
            </p>
          </div>
          
          {/* Media column (if present) */}
          {post.mediaUrl && (
            <div className="w-32 flex-shrink-0">
              {post.mediaType === 'image' ? (
                <img 
                  src={post.mediaUrl} 
                  alt="Příloha"
                  className="w-full h-24 object-cover rounded-lg"
                />
              ) : youtubeId ? (
                <div className="w-full h-24 rounded-lg overflow-hidden bg-slate-900">
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
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        {/* Author */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <User className="w-4 h-4" />
          <span>{isAnonymous ? 'Anonym' : post.authorName}</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Like button */}
          <button
            onClick={onLike}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors ${
              hasLiked 
                ? 'bg-pink-100 text-pink-600' 
                : 'hover:bg-slate-200 text-slate-500'
            }`}
          >
            <Heart className={`w-4 h-4 ${hasLiked ? 'fill-current' : ''}`} />
            <span>{post.likes.length}</span>
          </button>
          
          {/* Delete button (only for author or teacher) */}
          {(currentUserId === post.authorId || isTeacher) && onDelete && (
            <button
              onClick={onDelete}
              className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
  
  const canPost = maxPosts === undefined || currentPostCount < maxPosts;
  
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
      <div className="bg-slate-100 rounded-xl p-4 text-center text-slate-500 text-sm">
        Dosáhl/a jsi maximálního počtu příspěvků ({maxPosts})
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Napiš svůj příspěvek..."
        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none resize-none text-[#4E5871]"
        rows={3}
      />
      
      {/* Media input */}
      {allowMedia && showMediaInput && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setMediaType('image')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                mediaType === 'image' 
                  ? 'bg-pink-100 text-pink-600 border border-pink-300' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Obrázek
            </button>
            <button
              onClick={() => setMediaType('youtube')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                mediaType === 'youtube' 
                  ? 'bg-pink-100 text-pink-600 border border-pink-300' 
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
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none text-sm"
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
              className={`p-2 rounded-lg transition-colors ${
                showMediaInput 
                  ? 'bg-pink-100 text-pink-600' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            text.trim()
              ? 'bg-pink-500 text-white hover:bg-pink-600'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
          Odeslat
        </button>
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
  const [currentPage, setCurrentPage] = useState(0);
  const postsPerPage = 6;
  
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
  
  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Left column: Question + optional image */}
      <div className="lg:w-2/5 p-6 flex flex-col">
        {/* Question */}
        <div className="mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-[#4E5871] leading-tight">
            {slide.question || 'Téma diskuze...'}
          </h2>
        </div>
        
        {/* Question image (if present) */}
        {slide.questionImage && (
          <div className="flex-1 flex items-center justify-center mb-6">
            <img
              src={slide.questionImage}
              alt="Obrázek k tématu"
              className="max-w-full max-h-64 lg:max-h-96 rounded-xl shadow-lg object-contain"
            />
          </div>
        )}
        
        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            <span>{posts.length} příspěvků</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart className="w-4 h-4" />
            <span>{posts.reduce((sum, p) => sum + p.likes.length, 0)} lajků</span>
          </div>
        </div>
      </div>
      
      {/* Right column: Posts */}
      <div className="lg:w-3/5 p-6 bg-slate-50 flex flex-col overflow-hidden">
        {/* New post form (if not read-only) */}
        {!readOnly && onAddPost && (
          <div className="mb-4 flex-shrink-0">
            <NewPostForm
              allowMedia={slide.allowMedia}
              onSubmit={(text, mediaUrl, mediaType) => {
                onAddPost(text, mediaUrl, mediaType);
              }}
              maxPosts={slide.maxPosts}
              currentPostCount={userPostCount}
            />
          </div>
        )}
        
        {/* Posts grid */}
        <div className="flex-1 overflow-auto">
          {currentPosts.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Zatím žádné příspěvky</p>
                {!readOnly && <p className="text-sm mt-1">Buď první kdo něco napíše!</p>}
              </div>
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-200">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    currentPage === i
                      ? 'bg-pink-500 text-white'
                      : 'hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default BoardSlideView;

