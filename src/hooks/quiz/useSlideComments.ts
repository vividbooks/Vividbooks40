import { useState, useEffect } from 'react';
import {
  addBoardComment,
  getSlideComments,
  type BoardComment,
} from '../../utils/supabase/board-comments';

export interface UseSlideCommentsReturn {
  showCommentsPanel: boolean;
  setShowCommentsPanel: (v: boolean) => void;
  slideComments: BoardComment[];
  commentAuthorName: string;
  setCommentAuthorName: (v: string) => void;
  commentContent: string;
  setCommentContent: (v: string) => void;
  submittingComment: boolean;
  commentSuccess: boolean;
  submitComment: () => Promise<void>;
}

export function useSlideComments(
  isPublicMode: boolean,
  boardId: string | undefined,
  currentSlideId: string | undefined
): UseSlideCommentsReturn {
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [slideComments, setSlideComments] = useState<BoardComment[]>([]);
  const [commentAuthorName, setCommentAuthorName] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState(false);

  // Load comments for current slide
  useEffect(() => {
    if (isPublicMode && boardId && currentSlideId) {
      getSlideComments(boardId, currentSlideId).then(setSlideComments);
      setCommentContent('');
      setCommentSuccess(false);
    }
  }, [isPublicMode, boardId, currentSlideId]);

  // Load saved author name
  useEffect(() => {
    if (isPublicMode) {
      const saved = localStorage.getItem('public-viewer-author-name');
      if (saved) setCommentAuthorName(saved);
    }
  }, [isPublicMode]);

  const submitComment = async () => {
    if (!boardId || !currentSlideId || !commentContent.trim()) return;

    setSubmittingComment(true);
    try {
      const result = await addBoardComment({
        board_id: boardId,
        slide_id: currentSlideId,
        author_name: commentAuthorName.trim() || null,
        content: commentContent.trim(),
      });

      if (result) {
        setCommentSuccess(true);
        setCommentContent('');
        if (commentAuthorName.trim()) {
          localStorage.setItem('public-viewer-author-name', commentAuthorName.trim());
        }
        const updated = await getSlideComments(boardId, currentSlideId);
        setSlideComments(updated);
        setTimeout(() => setCommentSuccess(false), 3000);
      } else {
        console.error('[useSlideComments] Failed to add comment - result was null');
      }
    } catch (e) {
      console.error('[useSlideComments] Error submitting comment:', e);
    } finally {
      setSubmittingComment(false);
    }
  };

  return {
    showCommentsPanel, setShowCommentsPanel,
    slideComments,
    commentAuthorName, setCommentAuthorName,
    commentContent, setCommentContent,
    submittingComment,
    commentSuccess,
    submitComment,
  };
}
