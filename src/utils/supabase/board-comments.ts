/**
 * Board Comments Utility
 * 
 * CRUD operations for public comments on quiz/board slides
 * Comments are stored in Supabase and displayed to board owners
 */

import { supabase } from './client';
import { supabaseUrl, publicAnonKey } from './info';

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
 * Uses direct REST API call to avoid Supabase client auth issues for anonymous users
 */
export async function addBoardComment(comment: NewBoardComment): Promise<BoardComment | null> {
  console.log('[BoardComments] Adding comment via REST API:', comment);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${supabaseUrl}/rest/v1/board_comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': publicAnonKey,
        'Authorization': `Bearer ${publicAnonKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        board_id: comment.board_id,
        slide_id: comment.slide_id,
        author_name: comment.author_name?.trim() || null,
        content: comment.content.trim(),
        is_read: false,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log('[BoardComments] REST API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BoardComments] REST API error:', response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('[BoardComments] Comment added successfully:', data);
    
    // Response is an array with one item
    return (Array.isArray(data) ? data[0] : data) as BoardComment;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.error('[BoardComments] Request timed out after 10s');
    } else {
      console.error('[BoardComments] Exception adding comment:', e);
    }
    return null;
  }
}

// =============================================
// READ
// =============================================

/**
 * Get all comments for a board
 * Uses REST API for reliability on GitHub Pages
 */
export async function getBoardComments(boardId: string): Promise<BoardComment[]> {
  console.log('[BoardComments] Fetching comments for board:', boardId);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/board_comments?board_id=eq.${encodeURIComponent(boardId)}&order=created_at.desc`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('[BoardComments] REST API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    console.log('[BoardComments] Fetched', data.length, 'comments');
    return (data || []) as BoardComment[];
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.error('[BoardComments] Request timed out');
    } else {
      console.error('[BoardComments] Exception fetching comments:', e);
    }
    return [];
  }
}

/**
 * Get comments for a specific slide
 * Uses REST API for reliability on GitHub Pages
 */
export async function getSlideComments(boardId: string, slideId: string): Promise<BoardComment[]> {
  console.log('[BoardComments] Fetching comments for slide:', slideId);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/board_comments?board_id=eq.${encodeURIComponent(boardId)}&slide_id=eq.${encodeURIComponent(slideId)}&order=created_at.desc`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('[BoardComments] REST API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    console.log('[BoardComments] Fetched', data.length, 'slide comments');
    return (data || []) as BoardComment[];
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.error('[BoardComments] Request timed out');
    } else {
      console.error('[BoardComments] Exception fetching slide comments:', e);
    }
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
