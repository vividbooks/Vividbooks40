/**
 * Document Comments Utility
 * 
 * Functions for managing inline comments on student documents
 */

import { supabase } from './supabase/client';
import { DocumentComment, SubmissionGrading } from '../types/document-comments';

const COMMENTS_STORAGE_KEY = 'vivid-doc-comments';

// =============================================
// LOCAL STORAGE OPERATIONS
// =============================================

/**
 * Get all comments for a document from localStorage
 */
export function getCommentsFromStorage(documentId: string): DocumentComment[] {
  try {
    const allComments = localStorage.getItem(COMMENTS_STORAGE_KEY);
    if (!allComments) return [];
    
    const parsed = JSON.parse(allComments);
    return parsed[documentId] || [];
  } catch {
    return [];
  }
}

/**
 * Save comments to localStorage
 */
export function saveCommentsToStorage(documentId: string, comments: DocumentComment[]): void {
  try {
    const allComments = localStorage.getItem(COMMENTS_STORAGE_KEY);
    const parsed = allComments ? JSON.parse(allComments) : {};
    parsed[documentId] = comments;
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(parsed));
  } catch (e) {
    console.error('Error saving comments:', e);
  }
}

/**
 * Add a new comment
 */
export function addComment(
  documentId: string,
  comment: Omit<DocumentComment, 'id' | 'createdAt'>
): DocumentComment {
  const newComment: DocumentComment = {
    ...comment,
    id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  
  const comments = getCommentsFromStorage(documentId);
  comments.push(newComment);
  saveCommentsToStorage(documentId, comments);
  
  return newComment;
}

/**
 * Update an existing comment
 */
export function updateComment(
  documentId: string,
  commentId: string,
  updates: Partial<DocumentComment>
): DocumentComment | null {
  const comments = getCommentsFromStorage(documentId);
  const index = comments.findIndex(c => c.id === commentId);
  
  if (index === -1) return null;
  
  comments[index] = {
    ...comments[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  saveCommentsToStorage(documentId, comments);
  return comments[index];
}

/**
 * Delete a comment
 */
export function deleteComment(documentId: string, commentId: string): boolean {
  const comments = getCommentsFromStorage(documentId);
  const filtered = comments.filter(c => c.id !== commentId);
  
  if (filtered.length === comments.length) return false;
  
  saveCommentsToStorage(documentId, filtered);
  return true;
}

/**
 * Resolve a comment
 */
export function resolveComment(
  documentId: string,
  commentId: string,
  resolvedBy: string
): DocumentComment | null {
  return updateComment(documentId, commentId, {
    resolved: true,
    resolvedAt: new Date().toISOString(),
    resolvedBy,
  });
}

// =============================================
// GRADING OPERATIONS
// =============================================

const GRADING_STORAGE_KEY = 'vivid-submission-gradings';

/**
 * Save grading for a submission
 */
export async function saveGrading(
  submissionId: string,
  grading: SubmissionGrading
): Promise<void> {
  // Save to localStorage
  try {
    const allGradings = localStorage.getItem(GRADING_STORAGE_KEY);
    const parsed = allGradings ? JSON.parse(allGradings) : {};
    parsed[submissionId] = grading;
    localStorage.setItem(GRADING_STORAGE_KEY, JSON.stringify(parsed));
  } catch (e) {
    console.error('Error saving grading to localStorage:', e);
  }
  
  // Try to save to Supabase
  try {
    await supabase
      .from('student_submissions')
      .update({
        status: 'graded',
        score: grading.score,
        max_score: grading.maxScore,
        teacher_comment: grading.finalComment,
        graded_at: grading.gradedAt,
        graded_by: grading.gradedBy,
      })
      .eq('id', submissionId);
  } catch (e) {
    console.log('[Grading] Supabase update skipped');
  }
}

/**
 * Get grading for a submission
 */
export function getGrading(submissionId: string): SubmissionGrading | null {
  try {
    const allGradings = localStorage.getItem(GRADING_STORAGE_KEY);
    if (!allGradings) return null;
    
    const parsed = JSON.parse(allGradings);
    return parsed[submissionId] || null;
  } catch {
    return null;
  }
}

// =============================================
// SUPABASE SYNC (for future)
// =============================================

/**
 * Sync comments to Supabase (for future implementation)
 */
export async function syncCommentsToSupabase(
  documentId: string,
  submissionId: string
): Promise<void> {
  const comments = getCommentsFromStorage(documentId);
  
  try {
    await supabase
      .from('student_submissions')
      .update({
        comments: comments,
      })
      .eq('id', submissionId);
  } catch (e) {
    console.log('[Comments] Supabase sync skipped');
  }
}

