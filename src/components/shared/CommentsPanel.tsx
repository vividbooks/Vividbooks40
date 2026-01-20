/**
 * CommentsPanel - Sidebar for viewing and adding comments
 * 
 * Used by teachers to provide feedback on student work
 */

import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, X, Check, Trash2, User } from 'lucide-react';
import { DocumentComment } from '../../types/document-comments';
import {
  getCommentsFromStorage,
  addComment,
  deleteComment,
  resolveComment,
} from '../../utils/document-comments';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

interface CommentsPanelProps {
  documentId: string;
  isTeacher: boolean;
  teacherId?: string;
  teacherName?: string;
  selectedText?: string;
  selectionRange?: { from: number; to: number };
  onAddComment?: (comment: DocumentComment) => void;
  onClose?: () => void;
}

export function CommentsPanel({
  documentId,
  isTeacher,
  teacherId,
  teacherName,
  selectedText,
  selectionRange,
  onAddComment,
  onClose,
}: CommentsPanelProps) {
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

  // Load comments
  useEffect(() => {
    const loadedComments = getCommentsFromStorage(documentId);
    setComments(loadedComments);
  }, [documentId]);

  // Handle adding new comment
  const handleAddComment = () => {
    if (!newCommentText.trim() || !teacherId || !teacherName) return;
    if (!selectionRange) return;

    const comment = addComment(documentId, {
      startOffset: selectionRange.from,
      endOffset: selectionRange.to,
      highlightedText: selectedText || '',
      content: newCommentText.trim(),
      authorId: teacherId,
      authorName: teacherName,
      authorRole: 'teacher',
    });

    setComments(prev => [...prev, comment]);
    setNewCommentText('');
    setIsAddingComment(false);
    onAddComment?.(comment);
  };

  // Handle deleting comment
  const handleDeleteComment = (commentId: string) => {
    if (deleteComment(documentId, commentId)) {
      setComments(prev => prev.filter(c => c.id !== commentId));
    }
  };

  // Handle resolving comment
  const handleResolveComment = (commentId: string) => {
    if (!teacherId) return;
    const updated = resolveComment(documentId, commentId, teacherId);
    if (updated) {
      setComments(prev => prev.map(c => c.id === commentId ? updated : c));
    }
  };

  // Sort comments by position
  const sortedComments = [...comments].sort((a, b) => a.startOffset - b.startOffset);
  const unresolvedComments = sortedComments.filter(c => !c.resolved);
  const resolvedComments = sortedComments.filter(c => c.resolved);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800">Komentáře</h3>
          <span className="text-sm text-slate-500">({unresolvedComments.length})</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Add Comment Section (for teachers) */}
      {isTeacher && (
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          {selectedText && selectionRange ? (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 font-medium">VYBRANÝ TEXT:</div>
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-slate-700 line-clamp-2">
                "{selectedText}"
              </div>
              
              {isAddingComment ? (
                <>
                  <textarea
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Napište komentář..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddComment}
                      disabled={!newCommentText.trim()}
                      className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Přidat komentář
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingComment(false);
                        setNewCommentText('');
                      }}
                      className="px-3 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Zrušit
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setIsAddingComment(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Přidat komentář k výběru
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-slate-500">
                Vyberte text v dokumentu pro přidání komentáře
              </p>
            </div>
          )}
        </div>
      )}

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto">
        {unresolvedComments.length === 0 && resolvedComments.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Zatím žádné komentáře</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Unresolved Comments */}
            {unresolvedComments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                isTeacher={isTeacher}
                onDelete={() => handleDeleteComment(comment.id)}
                onResolve={() => handleResolveComment(comment.id)}
              />
            ))}

            {/* Resolved Comments */}
            {resolvedComments.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-4">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 font-medium">VYŘEŠENÉ</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                {resolvedComments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    isTeacher={isTeacher}
                    onDelete={() => handleDeleteComment(comment.id)}
                    isResolved
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Comment Card Component
function CommentCard({
  comment,
  isTeacher,
  onDelete,
  onResolve,
  isResolved = false,
}: {
  comment: DocumentComment;
  isTeacher: boolean;
  onDelete: () => void;
  onResolve?: () => void;
  isResolved?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-xl border ${
        isResolved
          ? 'bg-slate-50 border-slate-200 opacity-60'
          : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      {/* Highlighted text */}
      <div className="text-xs text-slate-500 mb-2 p-2 bg-yellow-50 rounded-lg border border-yellow-100 line-clamp-1">
        "{comment.highlightedText}"
      </div>

      {/* Comment content */}
      <p className="text-sm text-slate-700 mb-3">{comment.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
            <User className="w-3 h-3 text-indigo-600" />
          </div>
          <div className="text-xs">
            <span className="font-medium text-slate-700">{comment.authorName}</span>
            <span className="text-slate-400 ml-1">
              · {format(new Date(comment.createdAt), 'd. M.', { locale: cs })}
            </span>
          </div>
        </div>

        {isTeacher && !isResolved && (
          <div className="flex items-center gap-1">
            {onResolve && (
              <button
                onClick={onResolve}
                className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors"
                title="Označit jako vyřešené"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              title="Smazat komentář"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommentsPanel;

