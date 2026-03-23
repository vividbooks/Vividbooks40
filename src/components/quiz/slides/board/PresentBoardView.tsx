import React, { useState, useMemo } from 'react';
import { Heart, MessageSquare, Plus, User, Trash2 } from 'lucide-react';
import { BoardActivitySlide, BoardPost } from '../../../../types/quiz';
import { getQuestionFontSize, CARD_COLORS, PRO_PALETTE, CONS_PALETTE } from './board-constants';

interface PresentBoardViewProps {
  slide: BoardActivitySlide;
  posts: BoardPost[];
  currentUserId?: string;
  onAddPost?: (
    text: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'youtube',
    backgroundColor?: string,
    column?: 'left' | 'right',
  ) => void;
  onLikePost?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
}

export function PresentBoardView({
  slide,
  posts,
  currentUserId,
  onAddPost,
  onLikePost,
  onDeletePost,
}: PresentBoardViewProps) {
  const [text, setText] = useState('');
  const [leftText, setLeftText] = useState('');
  const [rightText, setRightText] = useState('');

  const isProscons = (slide.boardType || 'text') === 'pros-cons';
  const questionFontSize = getQuestionFontSize(slide.question || '');

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => b.likes.length - a.likes.length || b.createdAt - a.createdAt),
    [posts],
  );

  const leftPosts = useMemo(
    () => sortedPosts.filter((p) => isProscons ? p.column === 'left' : p.column !== 'right'),
    [sortedPosts, isProscons],
  );

  const rightPosts = useMemo(
    () => sortedPosts.filter((p) => p.column === 'right'),
    [sortedPosts],
  );

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAddPost?.(text.trim());
    setText('');
  };

  const handleSubmitLeft = () => {
    if (!leftText.trim()) return;
    onAddPost?.(leftText.trim(), undefined, undefined, undefined, 'left');
    setLeftText('');
  };

  const handleSubmitRight = () => {
    if (!rightText.trim()) return;
    onAddPost?.(rightText.trim(), undefined, undefined, undefined, 'right');
    setRightText('');
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'linear-gradient(135deg, #f8fafc, #fff, #fdf2f8)' }}>
      {/* Question */}
      <div style={{ padding: '24px 32px 12px' }}>
        <h2 className="font-bold text-[#4E5871] leading-snug text-center" style={{ fontSize: questionFontSize }}>
          {slide.question || 'Téma diskuze...'}
        </h2>
      </div>

      {isProscons ? (
        <div className="flex flex-1 gap-4 px-6 pb-6 min-h-0">
          {[
            {
              label: slide.leftColumnLabel || 'Pro',
              color: '#6366f1',
              input: leftText,
              setInput: setLeftText,
              submit: handleSubmitLeft,
              colPosts: leftPosts,
              palette: PRO_PALETTE,
            },
            {
              label: slide.rightColumnLabel || 'Proti',
              color: '#f59e0b',
              input: rightText,
              setInput: setRightText,
              submit: handleSubmitRight,
              colPosts: rightPosts,
              palette: CONS_PALETTE,
            },
          ].map((col) => (
            <div key={col.label} className="flex-1 flex flex-col min-h-0 gap-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="font-bold text-lg" style={{ color: col.color }}>{col.label}</span>
              </div>

              <div className="flex-shrink-0 flex flex-col gap-2">
                <textarea
                  value={col.input}
                  onChange={(e) => col.setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); col.submit(); }
                  }}
                  placeholder="Napište příspěvek…"
                  rows={3}
                  className="w-full rounded-2xl border-2 resize-none text-lg p-4 focus:outline-none transition-colors"
                  style={{ borderColor: col.color + '44', backgroundColor: col.color + '08' }}
                />
                <button
                  onClick={col.submit}
                  disabled={!col.input.trim()}
                  className="w-full py-3 rounded-xl font-bold text-white text-base transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ backgroundColor: col.color }}
                >
                  + Přidat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0">
                {col.colPosts.map((post, postIdx) => {
                  const pc = col.palette[postIdx % col.palette.length];
                  return (
                    <div
                      key={post.id}
                      className="rounded-2xl p-4 shadow-sm text-base font-medium text-[#4E5871] relative"
                      style={{ backgroundColor: pc.bg, border: `2px solid ${pc.border}` }}
                    >
                      <p className="leading-snug text-lg">{post.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-400">{post.authorName}</span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => onLikePost?.(post.id)}
                            className="flex items-center gap-1 text-sm text-slate-400 hover:text-pink-500 transition-colors"
                          >
                            <Heart
                              className="w-4 h-4"
                              style={{
                                fill: post.likes.includes(currentUserId || '') ? '#ec4899' : 'none',
                                color: post.likes.includes(currentUserId || '') ? '#ec4899' : 'currentColor',
                              }}
                            />
                            {post.likes.length}
                          </button>
                          {onDeletePost && (
                            <button
                              onClick={() => onDeletePost(post.id)}
                              className="text-slate-300 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '0 24px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Inline input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
              }}
              placeholder="Napište příspěvek…"
              rows={2}
              className="w-full rounded-2xl border-2 border-pink-200 resize-none p-3 focus:outline-none focus:border-pink-400 transition-colors bg-pink-50/40"
              style={{ fontSize: '2.5rem', lineHeight: 1.25 }}
            />
            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="px-4 py-2 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] flex items-center gap-1.5"
                style={{ background: 'linear-gradient(to right, #ec4899, #f43f5e)' }}
              >
                <Plus className="w-4 h-4" />
                Přidat
              </button>
            </div>
          </div>

          {/* Posts grid */}
          {sortedPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3">
              <MessageSquare className="w-16 h-16 opacity-30" />
              <p className="text-xl">Zatím žádné příspěvky</p>
            </div>
          ) : (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns:
                  sortedPosts.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
              }}
            >
              {sortedPosts.map((post, idx) => {
                const c = CARD_COLORS[idx % CARD_COLORS.length];
                return (
                  <div
                    key={post.id}
                    className="rounded-2xl p-5 shadow-sm flex flex-col gap-3"
                    style={{ backgroundColor: c.bg, border: `2px solid ${c.border}` }}
                  >
                    <p className="text-xl font-medium text-[#4E5871] leading-snug flex-1">{post.text}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {post.authorName}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onLikePost?.(post.id)}
                          className="flex items-center gap-1.5 text-base text-slate-400 hover:text-pink-500 transition-colors"
                        >
                          <Heart
                            className="w-5 h-5"
                            style={{
                              fill: post.likes.includes(currentUserId || '') ? '#ec4899' : 'none',
                              color: post.likes.includes(currentUserId || '') ? '#ec4899' : 'currentColor',
                            }}
                          />
                          {post.likes.length}
                        </button>
                        {onDeletePost && (
                          <button
                            onClick={() => onDeletePost(post.id)}
                            className="text-slate-300 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
