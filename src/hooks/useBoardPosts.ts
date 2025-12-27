/**
 * Hook for real-time board posts synchronization via Firebase
 */

import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, push, update, remove, get } from 'firebase/database';
import { database } from '../utils/firebase-config';
import { BoardPost } from '../types/quiz';

const QUIZ_SESSIONS_PATH = 'quiz_sessions';

interface UseBoardPostsOptions {
  sessionId: string | null;
  slideId: string;
  currentUserId?: string;
  currentUserName?: string;
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
    
    const postsRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/boardPosts/${slideId}`);
    
    const unsubscribe = onValue(postsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert object to array
        const postsArray: BoardPost[] = Object.entries(data).map(([id, post]: [string, any]) => ({
          id,
          text: post.text || '',
          mediaUrl: post.mediaUrl,
          mediaType: post.mediaType,
          backgroundColor: post.backgroundColor,
          column: post.column,
          authorName: post.authorName || 'Anonym',
          authorId: post.authorId || '',
          likes: post.likes ? Object.keys(post.likes) : [],
          createdAt: post.createdAt || Date.now(),
        }));
        setPosts(postsArray);
      } else {
        setPosts([]);
      }
      setIsLoading(false);
    }, (err) => {
      console.error('Error fetching board posts:', err);
      setError('Nepodařilo se načíst příspěvky');
      setIsLoading(false);
    });
    
    return () => {
      unsubscribe();
    };
  }, [sessionId, slideId]);
  
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
      const postsRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/boardPosts/${slideId}`);
      const newPostRef = push(postsRef);
      
      // Build post object without undefined values (Firebase doesn't allow undefined)
      const newPost: Record<string, any> = {
        text,
        authorName: currentUserName || 'Anonym',
        authorId: currentUserId,
        createdAt: Date.now(),
        likes: {},
      };
      
      // Only add media fields if they have values
      if (mediaUrl) {
        newPost.mediaUrl = mediaUrl;
      }
      if (mediaType) {
        newPost.mediaType = mediaType;
      }
      if (backgroundColor) {
        newPost.backgroundColor = backgroundColor;
      }
      if (column) {
        newPost.column = column;
      }
      
      await update(newPostRef, newPost);
    } catch (err) {
      console.error('Error adding post:', err);
      throw err;
    }
  }, [sessionId, slideId, currentUserId, currentUserName]);
  
  // Like/unlike a post
  const likePost = useCallback(async (postId: string) => {
    if (!sessionId || !slideId || !currentUserId) {
      console.error('Cannot like post: missing sessionId, slideId, or userId');
      return;
    }
    
    try {
      const likeRef = ref(
        database, 
        `${QUIZ_SESSIONS_PATH}/${sessionId}/boardPosts/${slideId}/${postId}/likes/${currentUserId}`
      );
      
      // Check if already liked
      const snapshot = await get(likeRef);
      if (snapshot.exists()) {
        // Unlike
        await remove(likeRef);
      } else {
        // Like
        await update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/boardPosts/${slideId}/${postId}/likes`), {
          [currentUserId]: true
        });
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      throw err;
    }
  }, [sessionId, slideId, currentUserId]);
  
  // Delete a post
  const deletePost = useCallback(async (postId: string) => {
    if (!sessionId || !slideId) {
      console.error('Cannot delete post: missing sessionId or slideId');
      return;
    }
    
    try {
      const postRef = ref(
        database, 
        `${QUIZ_SESSIONS_PATH}/${sessionId}/boardPosts/${slideId}/${postId}`
      );
      await remove(postRef);
    } catch (err) {
      console.error('Error deleting post:', err);
      throw err;
    }
  }, [sessionId, slideId]);
  
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

