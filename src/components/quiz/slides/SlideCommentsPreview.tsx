/**
 * Slide Comments Preview
 * 
 * Compact preview of comments displayed below each slide in the editor.
 * Shows comment count and first 2 comments as preview.
 * Clicking opens the PageSettingsPanel with comments section.
 */

import React from 'react';
import {
  MessageSquare,
  ChevronRight,
  User,
} from 'lucide-react';
import { BoardComment } from '../../../utils/supabase/board-comments';

interface SlideCommentsPreviewProps {
  comments: BoardComment[];
  unreadCount: number;
  onOpenPanel: () => void;
}

export function SlideCommentsPreview({ 
  comments, 
  unreadCount,
  onOpenPanel 
}: SlideCommentsPreviewProps) {
  if (comments.length === 0) return null;

  // Show first 2 comments as preview
  const previewComments = comments.slice(0, 2);
  const hasMore = comments.length > 2;

  // Truncate text for preview
  const truncate = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Format relative time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'právě teď';
    if (diffMins < 60) return `před ${diffMins} min`;
    if (diffHours < 24) return `před ${diffHours} h`;
    if (diffDays < 7) return `před ${diffDays} dny`;
    return date.toLocaleDateString('cs-CZ');
  };

  return (
    <div 
      className="mt-2 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:bg-slate-100 transition-colors"
      onClick={onOpenPanel}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium text-slate-700">
            {comments.length} {comments.length === 1 ? 'komentář' : comments.length < 5 ? 'komentáře' : 'komentářů'}
          </span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </div>

      {/* Preview comments */}
      <div className="divide-y divide-slate-100">
        {previewComments.map((comment) => (
          <div key={comment.id} className="px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <User className="w-3 h-3" />
                <span className="font-medium">
                  {comment.author_name || 'Anonymní'}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {formatTime(comment.created_at)}
              </span>
              {!comment.is_read && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
            </div>
            <p className="text-sm text-slate-600 line-clamp-1">
              {truncate(comment.content)}
            </p>
          </div>
        ))}
      </div>

      {/* Show more */}
      {hasMore && (
        <div className="px-3 py-1.5 text-xs text-indigo-600 font-medium text-center bg-indigo-50">
          + {comments.length - 2} dalších komentářů
        </div>
      )}
    </div>
  );
}

export default SlideCommentsPreview;
