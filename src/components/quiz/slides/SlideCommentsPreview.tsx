/**
 * Slide Comments Preview
 * 
 * Simple clickable button showing comment count.
 * Clicking opens the PageSettingsPanel with comments section.
 */

import React from 'react';
import { MessageSquare } from 'lucide-react';
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
  const count = comments.length;
  
  // Format count text
  const getCountText = () => {
    if (count === 0) return 'Komentáře';
    if (count === 1) return '1 komentář';
    if (count < 5) return `${count} komentáře`;
    return `${count} komentářů`;
  };

  return (
    <button 
      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
      onClick={onOpenPanel}
    >
      <MessageSquare className="w-4 h-4" />
      <span>{getCountText()}</span>
      {unreadCount > 0 && (
        <span className="px-1.5 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full min-w-[18px] text-center">
          {unreadCount}
        </span>
      )}
    </button>
  );
}

export default SlideCommentsPreview;
