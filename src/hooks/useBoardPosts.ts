import { useState, useEffect, useCallback } from 'react';
import { BoardPost } from '../types/quiz';
import {
  addSessionPost,
  deleteSessionPost,
  getPreferredSessionBackend,
  listSessionPosts,
  SessionBackend,
  SessionKind,
  toggleSessionPostLike,
} from '../utils/live-session-repository';
import { supabase } from '../utils/supabase/client';

interface UseBoardPostsOptions {
  sessionId: string | null;
  slideId: string;
  currentUserId?: string;
  currentUserName?: string;
  sessionType?: SessionKind;
  backend?: SessionBackend;
}

interface UseBoardPostsReturn {
  posts: BoardPost[];
  isLoading: boolean;
  error: string | null;
  addPost: (text: string, mediaUrl?: string, mediaType?: 'image' | 'youtube', backgroundColor?: string, column?: 'left' | 'right') => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
}

export function useBoardPosts({
  sessionId,
  slideId,
  currentUserId,
  currentUserName,
  sessionType = 'live',
  backend = getPreferredSessionBackend(),
}: UseBoardPostsOptions): UseBoardPostsReturn {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Subscribe to posts changes
  useEffect(() => {
    if (!sessionId || !slideId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    const channel = supabase
      .channel(`board-posts:${sessionId}:${slideId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_session_posts', filter: `session_public_id=eq.${sessionId}` }, async () => {
        try {
          const nextPosts = await listSessionPosts(backend, sessionId, sessionType, slideId);
          setPosts(nextPosts);
          setIsLoading(false);
        } catch (err) {
          console.error('Error refreshing Supabase board posts:', err);
          setError('Nepodařilo se načíst příspěvky');
          setIsLoading(false);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_session_post_likes', filter: `session_public_id=eq.${sessionId}` }, async () => {
        try {
          const nextPosts = await listSessionPosts(backend, sessionId, sessionType, slideId);
          setPosts(nextPosts);
          setIsLoading(false);
        } catch (err) {
          console.error('Error refreshing Supabase board likes:', err);
          setError('Nepodařilo se načíst příspěvky');
          setIsLoading(false);
        }
      })
      .subscribe();

    listSessionPosts(backend, sessionId, sessionType, slideId)
      .then((nextPosts) => setPosts(nextPosts))
      .catch((err) => {
        console.error('Error fetching Supabase board posts:', err);
        setError('Nepodařilo se načíst příspěvky');
      })
      .finally(() => setIsLoading(false));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [backend, sessionId, sessionType, slideId]);
  
  // Add a new post
  const addPost = useCallback(async (
    text: string, 
    mediaUrl?: string, 
    mediaType?: 'image' | 'youtube',
    backgroundColor?: string,
    column?: 'left' | 'right'
  ) => {
    if (!sessionId || !slideId || !currentUserId) {
      console.error('Cannot add post: missing sessionId, slideId, or userId');
      return;
    }
    
    try {
      await addSessionPost(backend, sessionId, sessionType, slideId, currentUserId, currentUserName, {
        text,
        mediaUrl,
        mediaType,
        backgroundColor,
        column,
      });
    } catch (err) {
      console.error('Error adding post:', err);
      throw err;
    }
  }, [backend, sessionId, sessionType, slideId, currentUserId, currentUserName]);
  
  // Like/unlike a post
  const likePost = useCallback(async (postId: string) => {
    if (!sessionId || !slideId || !currentUserId) {
      console.error('Cannot like post: missing sessionId, slideId, or userId');
      return;
    }
    
    try {
      await toggleSessionPostLike(backend, sessionId, sessionType, slideId, postId, currentUserId);
    } catch (err) {
      console.error('Error toggling like:', err);
      throw err;
    }
  }, [backend, sessionId, sessionType, slideId, currentUserId]);
  
  // Delete a post
  const deletePost = useCallback(async (postId: string) => {
    if (!sessionId || !slideId) {
      console.error('Cannot delete post: missing sessionId or slideId');
      return;
    }
    
    try {
      await deleteSessionPost(backend, sessionId, sessionType, slideId, postId);
    } catch (err) {
      console.error('Error deleting post:', err);
      throw err;
    }
  }, [backend, sessionId, sessionType, slideId]);
  
  return {
    posts,
    isLoading,
    error,
    addPost,
    likePost,
    deletePost,
  };
}

export default useBoardPosts;

