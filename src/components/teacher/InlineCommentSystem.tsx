/**
 * Inline Comment System
 * 
 * Provides Google Docs-style inline commenting for teacher review.
 * - Select text to add a comment
 * - Comments appear in a sidebar
 * - Highlighted text in the document
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Trash2 } from 'lucide-react';
import { InlineComment, TextSelection } from '../../types/student-submission';

interface UseInlineCommentsOptions {
  /** Container element to watch for text selection */
  containerRef: React.RefObject<HTMLElement>;
  /** Current comments */
  comments: InlineComment[];
  /** Callback to add a comment */
  onAddComment: (comment: Omit<InlineComment, 'id' | 'createdAt' | 'isRead'>) => void;
  /** Teacher info */
  teacherId: string;
  teacherName: string;
  /** Whether commenting is enabled */
  enabled?: boolean;
}

interface SelectionState {
  isActive: boolean;
  position: { x: number; y: number };
  selection: TextSelection | null;
}

export function useInlineComments({
  containerRef,
  comments,
  onAddComment,
  teacherId,
  teacherName,
  enabled = true,
}: UseInlineCommentsOptions) {
  const [selectionState, setSelectionState] = useState<SelectionState>({
    isActive: false,
    position: { x: 0, y: 0 },
    selection: null,
  });
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');

  // Handle text selection
  const handleSelectionChange = useCallback(() => {
    if (!enabled || !containerRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelectionState({
        isActive: false,
        position: { x: 0, y: 0 },
        selection: null,
      });
      return;
    }

    const selectedText = selection.toString().trim();
    if (selectedText.length < 2) return;

    // Check if selection is within our container
    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container.contains(range.commonAncestorContainer)) return;

    // Find the block ID
    let blockElement = range.startContainer.parentElement;
    while (blockElement && !blockElement.dataset?.blockId) {
      blockElement = blockElement.parentElement;
    }
    const blockId = blockElement?.dataset?.blockId || 'unknown';

    // Get position for the popup
    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setSelectionState({
      isActive: true,
      position: {
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top - 10,
      },
      selection: {
        blockId,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        selectedText,
      },
    });
  }, [enabled, containerRef]);

  // Listen for selection changes
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange, enabled]);

  // Handle adding a comment
  const handleAddComment = useCallback(() => {
    if (!selectionState.selection || !commentText.trim()) return;

    onAddComment({
      teacherId,
      teacherName,
      selection: selectionState.selection,
      content: commentText.trim(),
    });

    // Reset state
    setCommentText('');
    setShowCommentInput(false);
    setSelectionState({
      isActive: false,
      position: { x: 0, y: 0 },
      selection: null,
    });

    // Clear the selection
    window.getSelection()?.removeAllRanges();
  }, [selectionState.selection, commentText, onAddComment, teacherId, teacherName]);

  // Handle clicking the add comment button
  const handleStartComment = useCallback(() => {
    setShowCommentInput(true);
  }, []);

  // Cancel adding comment
  const handleCancelComment = useCallback(() => {
    setShowCommentInput(false);
    setCommentText('');
  }, []);

  return {
    selectionState,
    showCommentInput,
    commentText,
    setCommentText,
    handleStartComment,
    handleAddComment,
    handleCancelComment,
  };
}

// =============================================
// SELECTION POPUP COMPONENT
// =============================================

interface SelectionPopupProps {
  position: { x: number; y: number };
  showInput: boolean;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onStartComment: () => void;
  onAddComment: () => void;
  onCancel: () => void;
}

export function SelectionPopup({
  position,
  showInput,
  commentText,
  onCommentTextChange,
  onStartComment,
  onAddComment,
  onCancel,
}: SelectionPopupProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  return (
    <div
      className="absolute z-50 transform -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {showInput ? (
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-72">
          <textarea
            ref={inputRef}
            value={commentText}
            onChange={(e) => onCommentTextChange(e.target.value)}
            placeholder="Napište komentář..."
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                onAddComment();
              }
              if (e.key === 'Escape') {
                onCancel();
              }
            }}
          />
          <div className="flex justify-between items-center mt-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Zrušit
            </button>
            <button
              onClick={onAddComment}
              disabled={!commentText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Přidat</span>
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1 text-center">
            Ctrl+Enter pro odeslání
          </p>
        </div>
      ) : (
        <button
          onClick={onStartComment}
          className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg shadow-lg hover:bg-amber-600 transition-colors font-medium"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm">Přidat komentář</span>
        </button>
      )}
      
      {/* Arrow pointing to selection */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
    </div>
  );
}

// =============================================
// COMMENT HIGHLIGHT COMPONENT
// =============================================

interface CommentHighlightProps {
  comment: InlineComment;
  isActive: boolean;
  onClick: () => void;
}

export function CommentHighlight({ comment, isActive, onClick }: CommentHighlightProps) {
  return (
    <span
      onClick={onClick}
      className={`cursor-pointer transition-colors ${
        isActive
          ? 'bg-amber-300 border-b-2 border-amber-500'
          : 'bg-amber-100 hover:bg-amber-200 border-b-2 border-amber-300'
      }`}
      title={comment.content}
    >
      {comment.selection.selectedText}
    </span>
  );
}

// =============================================
// COMMENTS SIDEBAR
// =============================================

interface CommentsSidebarProps {
  comments: InlineComment[];
  activeCommentId: string | null;
  onSelectComment: (id: string) => void;
  onDeleteComment: (id: string) => void;
}

export function CommentsSidebar({
  comments,
  activeCommentId,
  onSelectComment,
  onDeleteComment,
}: CommentsSidebarProps) {
  if (comments.length === 0) {
    return (
      <div className="p-4 text-center text-slate-500">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Zatím žádné komentáře</p>
        <p className="text-xs mt-1">Označte text pro přidání komentáře</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {comments.map((comment) => (
        <div
          key={comment.id}
          onClick={() => onSelectComment(comment.id)}
          className={`p-3 cursor-pointer transition-colors ${
            activeCommentId === comment.id
              ? 'bg-amber-50 border-l-4 border-amber-500'
              : 'hover:bg-slate-50 border-l-4 border-transparent'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm text-amber-700 italic line-clamp-1 flex-1">
              "{comment.selection.selectedText}"
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteComment(comment.id);
              }}
              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-sm text-slate-700">{comment.content}</p>
          <p className="text-xs text-slate-400 mt-1">
            {comment.teacherName} • {new Date(comment.createdAt).toLocaleString('cs-CZ')}
          </p>
        </div>
      ))}
    </div>
  );
}

export default {
  useInlineComments,
  SelectionPopup,
  CommentHighlight,
  CommentsSidebar,
};


















