/**
 * Board Comments Utility
 * 
 * CRUD operations for public comments on quiz/board slides
 * Comments are stored in Supabase and displayed to board owners
 */

import { supabase } from './client';

// =============================================
// TYPES
// =============================================

export interface BoardComment {
  id: string;
  board_id: string;
  slide_id: string;
  author_name: string | null;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface NewBoardComment {
  board_id: string;
  slide_id: string;
  author_name?: string | null;
  content: string;
}

// =============================================
// CREATE
// =============================================

/**
 * Add a new comment to a slide
 */
export async function addBoardComment(comment: NewBoardComment): Promise<BoardComment | null> {
  try {
    const { data, error } = await supabase
      .from('board_comments')
      .insert({
        board_id: comment.board_id,
        slide_id: comment.slide_id,
        author_name: comment.author_name?.trim() || null,
        content: comment.content.trim(),
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[BoardComments] Error adding comment:', error);
      return null;
    }

    return data as BoardComment;
  } catch (e) {
    console.error('[BoardComments] Exception adding comment:', e);
    return null;
  }
}

// =============================================
// READ
// =============================================

/**
 * Get all comments for a board
 */
export async function getBoardComments(boardId: string): Promise<BoardComment[]> {
  try {
    const { data, error } = await supabase
      .from('board_comments')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[BoardComments] Error fetching comments:', error);
      return [];
    }

    return (data || []) as BoardComment[];
  } catch (e) {
    console.error('[BoardComments] Exception fetching comments:', e);
    return [];
  }
}

/**
 * Get comments for a specific slide
 */
export async function getSlideComments(boardId: string, slideId: string): Promise<BoardComment[]> {
  try {
    const { data, error } = await supabase
      .from('board_comments')
      .select('*')
      .eq('board_id', boardId)
      .eq('slide_id', slideId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[BoardComments] Error fetching slide comments:', error);
      return [];
    }

    return (data || []) as BoardComment[];
  } catch (e) {
    console.error('[BoardComments] Exception fetching slide comments:', e);
    return [];
  }
}

/**
 * Get count of unread comments for a board
 */
export async function getUnreadCommentsCount(boardId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('board_comments')
      .select('*', { count: 'exact', head: true })
      .eq('board_id', boardId)
      .eq('is_read', false);

    if (error) {
      console.error('[BoardComments] Error counting unread:', error);
      return 0;
    }

    return count || 0;
  } catch (e) {
    console.error('[BoardComments] Exception counting unread:', e);
    return 0;
  }
}

/**
 * Get comments grouped by slide
 */
export async function getCommentsGroupedBySlide(boardId: string): Promise<Record<string, BoardComment[]>> {
  const comments = await getBoardComments(boardId);
  
  const grouped: Record<string, BoardComment[]> = {};
  for (const comment of comments) {
    if (!grouped[comment.slide_id]) {
      grouped[comment.slide_id] = [];
    }
    grouped[comment.slide_id].push(comment);
  }
  
  return grouped;
}

// =============================================
// UPDATE
// =============================================

/**
 * Mark a single comment as read
 */
export async function markCommentAsRead(commentId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('board_comments')
      .update({ is_read: true })
      .eq('id', commentId);

    if (error) {
      console.error('[BoardComments] Error marking as read:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[BoardComments] Exception marking as read:', e);
    return false;
  }
}

/**
 * Mark all comments for a slide as read
 */
export async function markSlideCommentsAsRead(boardId: string, slideId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('board_comments')
      .update({ is_read: true })
      .eq('board_id', boardId)
      .eq('slide_id', slideId);

    if (error) {
      console.error('[BoardComments] Error marking slide comments as read:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[BoardComments] Exception marking slide comments as read:', e);
    return false;
  }
}

/**
 * Mark all comments for a board as read
 */
export async function markAllCommentsAsRead(boardId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('board_comments')
      .update({ is_read: true })
      .eq('board_id', boardId);

    if (error) {
      console.error('[BoardComments] Error marking all as read:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[BoardComments] Exception marking all as read:', e);
    return false;
  }
}

// =============================================
// DELETE
// =============================================

/**
 * Delete a single comment
 */
export async function deleteComment(commentId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('board_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('[BoardComments] Error deleting comment:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[BoardComments] Exception deleting comment:', e);
    return false;
  }
}

/**
 * Delete all comments for a slide
 */
export async function deleteSlideComments(boardId: string, slideId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('board_comments')
      .delete()
      .eq('board_id', boardId)
      .eq('slide_id', slideId);

    if (error) {
      console.error('[BoardComments] Error deleting slide comments:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[BoardComments] Exception deleting slide comments:', e);
    return false;
  }
}
