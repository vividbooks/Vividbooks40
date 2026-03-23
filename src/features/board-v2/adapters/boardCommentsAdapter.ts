import {
  addBoardComment,
  deleteComment,
  getBoardComments,
  getCommentsGroupedBySlide,
  getSlideComments,
  getUnreadCommentsCount,
  markSlideCommentsAsRead,
} from '../../../utils/supabase/board-comments';

export const boardCommentsAdapter = {
  addComment: addBoardComment,
  getBoardComments,
  getSlideComments,
  getCommentsGroupedBySlide,
  getUnreadCommentsCount,
  markSlideCommentsAsRead,
  deleteComment,
};

export type BoardCommentsAdapter = typeof boardCommentsAdapter;
