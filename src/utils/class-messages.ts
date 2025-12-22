/**
 * Class Messages - Teacher to class communication
 */

const PROJECT_ID = 'njbtqmsxbyvpwigfceke';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

export interface ClassMessage {
  id: string;
  class_id: string;
  teacher_id?: string;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  created_at: string;
  updated_at: string;
  // Computed
  is_read?: boolean;
  read_at?: string;
}

/**
 * Send a message to a class
 */
export async function sendClassMessage(
  classId: string,
  title: string,
  content: string,
  priority: 'normal' | 'important' | 'urgent' = 'normal'
): Promise<ClassMessage | null> {
  try {
    const response = await fetch(`https://${PROJECT_ID}.supabase.co/rest/v1/class_messages`, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        class_id: classId,
        title,
        content,
        priority,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[ClassMessages] Failed to send message:', error);
      return null;
    }

    const [message] = await response.json();
    console.log('[ClassMessages] Message sent:', message.id);
    return message;
  } catch (error) {
    console.error('[ClassMessages] Error sending message:', error);
    return null;
  }
}

/**
 * Get messages for a class (teacher view)
 */
export async function getClassMessages(classId: string): Promise<ClassMessage[]> {
  try {
    const response = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/class_messages?class_id=eq.${classId}&order=created_at.desc`,
      {
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('[ClassMessages] Error getting messages:', error);
    return [];
  }
}

/**
 * Get messages for a student (with read status)
 */
export async function getMessagesForStudent(classId: string, studentId: string): Promise<ClassMessage[]> {
  try {
    // Get all messages for the class
    const messagesResponse = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/class_messages?class_id=eq.${classId}&order=created_at.desc`,
      {
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    if (!messagesResponse.ok) {
      return [];
    }

    const messages: ClassMessage[] = await messagesResponse.json();

    // Get read status for this student
    const readsResponse = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/class_message_reads?student_id=eq.${studentId}&select=message_id,read_at`,
      {
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    const reads: { message_id: string; read_at: string }[] = readsResponse.ok ? await readsResponse.json() : [];
    const readMap = new Map(reads.map(r => [r.message_id, r.read_at]));

    // Merge read status
    return messages.map(m => ({
      ...m,
      is_read: readMap.has(m.id),
      read_at: readMap.get(m.id),
    }));
  } catch (error) {
    console.error('[ClassMessages] Error getting student messages:', error);
    return [];
  }
}

/**
 * Mark a message as read by a student
 */
export async function markMessageAsRead(messageId: string, studentId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${PROJECT_ID}.supabase.co/rest/v1/class_message_reads`, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        message_id: messageId,
        student_id: studentId,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[ClassMessages] Error marking message as read:', error);
    return false;
  }
}

/**
 * Delete a message
 */
export async function deleteClassMessage(messageId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://${PROJECT_ID}.supabase.co/rest/v1/class_messages?id=eq.${messageId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[ClassMessages] Error deleting message:', error);
    return false;
  }
}

/**
 * Get unread message count for a student
 */
export async function getUnreadMessageCount(classId: string, studentId: string): Promise<number> {
  const messages = await getMessagesForStudent(classId, studentId);
  return messages.filter(m => !m.is_read).length;
}

