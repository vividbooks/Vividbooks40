// Class Chat utilities - Slack/Discord-like chat for classes
import { database } from './firebase-config';
import { ref, push, set, onValue, off, update, remove } from 'firebase/database';

const PROJECT_ID = 'njbtqmsxbyvpwigfceke';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

const CLASS_CHAT_PATH = 'class_chats';

// Shared content attached to a message
export interface SharedContent {
  id: string;
  type: 'document' | 'worksheet' | 'quiz' | 'board' | 'lesson';
  title: string;
  description?: string;
  thumbnail?: string;
  url?: string; // Link to the content
  category?: string; // e.g., 'fyzika', 'matematika'
}

export interface ChatMessage {
  id: string;
  classId: string;
  authorId: string;
  authorType: 'student' | 'teacher';
  authorName: string;
  content: string;
  parentId?: string;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
  reactions?: Record<string, ChatReaction[]>;
  sharedContent?: SharedContent; // Optional shared content
}

export interface ChatReaction {
  id: string;
  userId: string;
  userType: 'student' | 'teacher';
  userName: string;
  emoji: string;
  createdAt: string;
}

export interface OnlineUser {
  id: string;
  name: string;
  type: 'student' | 'teacher';
  lastSeen: string;
  isOnline: boolean;
}

// Send a message to class chat
export async function sendChatMessage(
  classId: string,
  authorId: string,
  authorType: 'student' | 'teacher',
  authorName: string,
  content: string,
  parentId?: string,
  sharedContent?: SharedContent
): Promise<string | null> {
  if (!database) {
    console.error('[ClassChat] Firebase not initialized');
    return null;
  }

  try {
    const messagesRef = ref(database, `${CLASS_CHAT_PATH}/${classId}/messages`);
    const newMessageRef = push(messagesRef);
    const messageId = newMessageRef.key;

    const message: Record<string, any> = {
      classId,
      authorId,
      authorType,
      authorName,
      content,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Only add parentId if it exists (Firebase doesn't accept undefined)
    if (parentId) {
      message.parentId = parentId;
    }
    
    // Add shared content if provided
    if (sharedContent) {
      message.sharedContent = sharedContent;
    }

    await set(newMessageRef, message);
    console.log('[ClassChat] Message sent:', messageId);

    // Also save to Supabase for persistence
    await saveMessageToSupabase({
      id: messageId!,
      ...message,
    });

    return messageId;
  } catch (error) {
    console.error('[ClassChat] Failed to send message:', error);
    return null;
  }
}

// Save message to Supabase for persistence
async function saveMessageToSupabase(message: ChatMessage): Promise<void> {
  try {
    const url = `https://${PROJECT_ID}.supabase.co/rest/v1/class_chat_messages`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: message.id,
        class_id: message.classId,
        author_id: message.authorId,
        author_type: message.authorType,
        author_name: message.authorName,
        content: message.content,
        parent_id: message.parentId || null,
        is_pinned: message.isPinned || false,
        created_at: message.createdAt,
        updated_at: message.updatedAt,
      }),
    });
  } catch (error) {
    console.error('[ClassChat] Failed to save to Supabase:', error);
  }
}

// Subscribe to chat messages (real-time)
export function subscribeToChatMessages(
  classId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  console.log('[ClassChat] subscribeToChatMessages called for class:', classId);
  
  if (!database) {
    console.error('[ClassChat] Firebase not initialized');
    return () => {};
  }

  const path = `${CLASS_CHAT_PATH}/${classId}/messages`;
  console.log('[ClassChat] Subscribing to Firebase path:', path);
  const messagesRef = ref(database, path);
  
  const unsubscribe = onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();
    console.log('[ClassChat] Firebase snapshot received, data:', data ? Object.keys(data).length + ' messages' : 'null');
    if (data) {
      const messages: ChatMessage[] = Object.entries(data).map(([id, msg]: [string, any]) => ({
        id,
        ...msg,
      }));
      // Sort by createdAt ascending (oldest first)
      messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      callback(messages);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('[ClassChat] Firebase subscription error:', error);
  });

  return () => off(messagesRef);
}

// Add reaction to a message
export async function addReaction(
  classId: string,
  messageId: string,
  userId: string,
  userType: 'student' | 'teacher',
  userName: string,
  emoji: string
): Promise<void> {
  if (!database) return;

  try {
    const reactionId = `${userId}_${emoji}`;
    const reactionRef = ref(database, `${CLASS_CHAT_PATH}/${classId}/messages/${messageId}/reactions/${reactionId}`);
    
    await set(reactionRef, {
      userId,
      userType,
      userName,
      emoji,
      createdAt: new Date().toISOString(),
    });

    console.log('[ClassChat] Reaction added:', emoji);
  } catch (error) {
    console.error('[ClassChat] Failed to add reaction:', error);
  }
}

// Remove reaction from a message
export async function removeReaction(
  classId: string,
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> {
  if (!database) return;

  try {
    const reactionId = `${userId}_${emoji}`;
    const reactionRef = ref(database, `${CLASS_CHAT_PATH}/${classId}/messages/${messageId}/reactions/${reactionId}`);
    await remove(reactionRef);
    console.log('[ClassChat] Reaction removed:', emoji);
  } catch (error) {
    console.error('[ClassChat] Failed to remove reaction:', error);
  }
}

// Update online presence
export async function updateOnlinePresence(
  classId: string,
  userId: string,
  userType: 'student' | 'teacher',
  userName: string,
  isOnline: boolean
): Promise<void> {
  if (!database) return;

  try {
    const presenceRef = ref(database, `${CLASS_CHAT_PATH}/${classId}/online/${userId}`);
    
    if (isOnline) {
      await set(presenceRef, {
        id: userId,
        name: userName,
        type: userType,
        lastSeen: new Date().toISOString(),
        isOnline: true,
      });
    } else {
      await update(presenceRef, {
        lastSeen: new Date().toISOString(),
        isOnline: false,
      });
    }
  } catch (error) {
    console.error('[ClassChat] Failed to update presence:', error);
  }
}

// Subscribe to online users
export function subscribeToOnlineUsers(
  classId: string,
  callback: (users: OnlineUser[]) => void
): () => void {
  if (!database) {
    return () => {};
  }

  const presenceRef = ref(database, `${CLASS_CHAT_PATH}/${classId}/online`);
  
  const unsubscribe = onValue(presenceRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const users: OnlineUser[] = Object.values(data);
      // Filter to only show users online in last 5 minutes
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const onlineUsers = users.filter(u => 
        u.isOnline || new Date(u.lastSeen).getTime() > fiveMinutesAgo
      );
      callback(onlineUsers);
    } else {
      callback([]);
    }
  });

  return () => off(presenceRef);
}

// Delete a message (author or teacher only)
export async function deleteMessage(
  classId: string,
  messageId: string
): Promise<void> {
  if (!database) return;

  try {
    const messageRef = ref(database, `${CLASS_CHAT_PATH}/${classId}/messages/${messageId}`);
    await remove(messageRef);
    console.log('[ClassChat] Message deleted:', messageId);
  } catch (error) {
    console.error('[ClassChat] Failed to delete message:', error);
  }
}

// Pin/unpin a message (teacher only)
export async function togglePinMessage(
  classId: string,
  messageId: string,
  isPinned: boolean
): Promise<void> {
  if (!database) return;

  try {
    const messageRef = ref(database, `${CLASS_CHAT_PATH}/${classId}/messages/${messageId}`);
    await update(messageRef, { isPinned, updatedAt: new Date().toISOString() });
    console.log('[ClassChat] Message pin toggled:', messageId, isPinned);
  } catch (error) {
    console.error('[ClassChat] Failed to toggle pin:', error);
  }
}

// Load initial messages from Supabase (for history)
export async function loadChatHistory(classId: string, limit: number = 100): Promise<ChatMessage[]> {
  try {
    const url = `https://${PROJECT_ID}.supabase.co/rest/v1/class_chat_messages?class_id=eq.${classId}&order=created_at.desc&limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.map((msg: any) => ({
      id: msg.id,
      classId: msg.class_id,
      authorId: msg.author_id,
      authorType: msg.author_type,
      authorName: msg.author_name,
      content: msg.content,
      parentId: msg.parent_id,
      isPinned: msg.is_pinned,
      createdAt: msg.created_at,
      updatedAt: msg.updated_at,
      sharedContent: msg.shared_content,
    })).reverse(); // Reverse to get oldest first
  } catch (error) {
    console.error('[ClassChat] Failed to load history:', error);
    return [];
  }
}

// Get teacher messages with shared content (for student dashboard)
export async function getTeacherSharedContent(classId: string, limit: number = 20): Promise<ChatMessage[]> {
  try {
    // First try Firebase for real-time data
    if (database) {
      return new Promise((resolve) => {
        const messagesRef = ref(database, `${CLASS_CHAT_PATH}/${classId}/messages`);
        
        onValue(messagesRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const allMessages: ChatMessage[] = Object.entries(data).map(([id, msg]: [string, any]) => ({
              id,
              ...msg,
            }));
            
            // Filter to only teacher messages with shared content
            const teacherContentMessages = allMessages
              .filter(m => m.authorType === 'teacher' && m.sharedContent)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, limit);
            
            resolve(teacherContentMessages);
          } else {
            resolve([]);
          }
        }, { onlyOnce: true });
      });
    }
    
    return [];
  } catch (error) {
    console.error('[ClassChat] Failed to get teacher content:', error);
    return [];
  }
}

// ============================================
// DIRECT MESSAGES (DM) - Private conversations
// ============================================

const DM_PATH = 'direct_messages';

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderType: 'student' | 'teacher';
  content: string;
  createdAt: string;
  read: boolean;
}

export interface DMConversation {
  id: string;
  participants: {
    id: string;
    name: string;
    type: 'student' | 'teacher';
  }[];
  classId: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  createdAt: string;
}

// Generate a consistent conversation ID for two users
export function getConversationId(userId1: string, userId2: string): string {
  // Sort IDs to ensure same conversation ID regardless of order
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

// Create or get a DM conversation
export async function getOrCreateDMConversation(
  classId: string,
  user1: { id: string; name: string; type: 'student' | 'teacher' },
  user2: { id: string; name: string; type: 'student' | 'teacher' }
): Promise<string> {
  if (!database) {
    console.error('[DM] Firebase not initialized');
    return '';
  }

  const conversationId = getConversationId(user1.id, user2.id);
  
  try {
    const conversationRef = ref(database, `${DM_PATH}/conversations/${conversationId}`);
    
    // Check if conversation exists
    return new Promise((resolve) => {
      onValue(conversationRef, async (snapshot) => {
        if (!snapshot.exists()) {
          // Create new conversation
          await set(conversationRef, {
            id: conversationId,
            participants: [user1, user2],
            classId,
            createdAt: new Date().toISOString(),
          });
          console.log('[DM] Created new conversation:', conversationId);
        }
        resolve(conversationId);
      }, { onlyOnce: true });
    });
  } catch (error) {
    console.error('[DM] Failed to get/create conversation:', error);
    return '';
  }
}

// Send a direct message
export async function sendDirectMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  senderType: 'student' | 'teacher',
  content: string
): Promise<string | null> {
  if (!database) {
    console.error('[DM] Firebase not initialized');
    return null;
  }

  try {
    const messagesRef = ref(database, `${DM_PATH}/messages/${conversationId}`);
    const newMessageRef = push(messagesRef);
    const messageId = newMessageRef.key;

    const message = {
      conversationId,
      senderId,
      senderName,
      senderType,
      content,
      createdAt: new Date().toISOString(),
      read: false,
    };

    await set(newMessageRef, message);

    // Update conversation with last message
    const conversationRef = ref(database, `${DM_PATH}/conversations/${conversationId}`);
    await update(conversationRef, {
      lastMessage: content.substring(0, 100),
      lastMessageAt: message.createdAt,
    });

    console.log('[DM] Message sent:', messageId);
    return messageId;
  } catch (error) {
    console.error('[DM] Failed to send message:', error);
    return null;
  }
}

// Subscribe to direct messages in a conversation
export function subscribeToDMMessages(
  conversationId: string,
  callback: (messages: DirectMessage[]) => void
): () => void {
  if (!database) {
    return () => {};
  }

  const messagesRef = ref(database, `${DM_PATH}/messages/${conversationId}`);
  
  const unsubscribe = onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const messages: DirectMessage[] = Object.entries(data).map(([id, msg]: [string, any]) => ({
        id,
        ...msg,
      }));
      // Sort by createdAt ascending (oldest first)
      messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      callback(messages);
    } else {
      callback([]);
    }
  });

  return () => off(messagesRef);
}

// Subscribe to user's DM conversations
export function subscribeToDMConversations(
  userId: string,
  callback: (conversations: DMConversation[]) => void
): () => void {
  if (!database) {
    return () => {};
  }

  const conversationsRef = ref(database, `${DM_PATH}/conversations`);
  
  const unsubscribe = onValue(conversationsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const allConversations: DMConversation[] = Object.values(data);
      // Filter to only include conversations where user is a participant
      const userConversations = allConversations.filter(conv => 
        conv.participants?.some(p => p.id === userId)
      );
      // Sort by last message time (newest first)
      userConversations.sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      });
      callback(userConversations);
    } else {
      callback([]);
    }
  });

  return () => off(conversationsRef);
}

// Mark messages as read
export async function markDMAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  if (!database) return;

  try {
    const messagesRef = ref(database, `${DM_PATH}/messages/${conversationId}`);
    
    onValue(messagesRef, async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const updates: Record<string, any> = {};
        Object.entries(data).forEach(([id, msg]: [string, any]) => {
          if (msg.senderId !== userId && !msg.read) {
            updates[`${DM_PATH}/messages/${conversationId}/${id}/read`] = true;
          }
        });
        
        if (Object.keys(updates).length > 0) {
          const rootRef = ref(database);
          await update(rootRef, updates);
        }
      }
    }, { onlyOnce: true });
  } catch (error) {
    console.error('[DM] Failed to mark as read:', error);
  }
}

// Get unread count for a user
export function subscribeToUnreadCount(
  userId: string,
  callback: (count: number) => void
): () => void {
  if (!database) {
    callback(0);
    return () => {};
  }

  const conversationsRef = ref(database, `${DM_PATH}/conversations`);
  
  const unsubscribe = onValue(conversationsRef, async (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const allConversations: DMConversation[] = Object.values(data);
      const userConversations = allConversations.filter(conv => 
        conv.participants?.some(p => p.id === userId)
      );
      
      let totalUnread = 0;
      
      // Check each conversation for unread messages
      for (const conv of userConversations) {
        const messagesRef = ref(database, `${DM_PATH}/messages/${conv.id}`);
        await new Promise<void>((resolve) => {
          onValue(messagesRef, (msgSnapshot) => {
            const messages = msgSnapshot.val();
            if (messages) {
              Object.values(messages).forEach((msg: any) => {
                if (msg.senderId !== userId && !msg.read) {
                  totalUnread++;
                }
              });
            }
            resolve();
          }, { onlyOnce: true });
        });
      }
      
      callback(totalUnread);
    } else {
      callback(0);
    }
  });

  return () => off(conversationsRef);
}

