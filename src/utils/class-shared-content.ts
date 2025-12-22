/**
 * Class Shared Content
 * 
 * Manages content shared by teachers with their classes.
 * Students can view but not edit/delete this content.
 */

export interface ClassSharedItem {
  id: string;
  class_id: string;
  teacher_id: string;
  name: string;
  type: 'document' | 'board' | 'folder';
  content_id: string;
  folder_id?: string; // For nested structure
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = 'vivid-class-shared-content';

// ============================================
// Teacher-side functions
// ============================================

/**
 * Get all shared items for a class (teacher view)
 */
export function getTeacherSharedContent(teacherId: string, classId: string): ClassSharedItem[] {
  const key = `${STORAGE_KEY}-${teacherId}-${classId}`;
  const saved = localStorage.getItem(key);
  if (!saved) return [];
  
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

/**
 * Save shared content for a class
 */
export function saveTeacherSharedContent(teacherId: string, classId: string, items: ClassSharedItem[]): void {
  const key = `${STORAGE_KEY}-${teacherId}-${classId}`;
  localStorage.setItem(key, JSON.stringify(items));
}

/**
 * Share a content item with a class (without auto-sync)
 */
export function shareContentWithClass(
  teacherId: string,
  classId: string,
  item: Omit<ClassSharedItem, 'id' | 'class_id' | 'teacher_id' | 'created_at' | 'updated_at'>,
  skipSync: boolean = false
): ClassSharedItem {
  console.log('[ShareContent] Sharing item:', item.name, 'type:', item.type, 'to class:', classId);
  
  const items = getTeacherSharedContent(teacherId, classId);
  const now = new Date().toISOString();
  
  // Use unique ID with timestamp and random to avoid duplicates
  const newItem: ClassSharedItem = {
    ...item,
    id: `shared-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    class_id: classId,
    teacher_id: teacherId,
    created_at: now,
    updated_at: now,
  };
  
  console.log('[ShareContent] Created shared item:', newItem.id, 'folder_id:', newItem.folder_id);
  
  items.push(newItem);
  saveTeacherSharedContent(teacherId, classId, items);
  
  console.log('[ShareContent] Total shared items for class:', items.length);
  
  // Sync to cloud only if not skipping (to avoid race conditions when sharing multiple items)
  if (!skipSync) {
    syncSharedContentToCloud(teacherId, classId);
  }
  
  return newItem;
}

/**
 * Remove shared content from a class
 */
export function unshareContentFromClass(teacherId: string, classId: string, itemId: string): void {
  const items = getTeacherSharedContent(teacherId, classId);
  const filtered = items.filter(i => i.id !== itemId);
  saveTeacherSharedContent(teacherId, classId, filtered);
  syncSharedContentToCloud(teacherId, classId);
}

// ============================================
// Student-side functions
// ============================================

/**
 * Get shared content for student's class
 * This fetches from all teachers who have shared with the class
 */
export async function getSharedContentForClass(classId: string): Promise<ClassSharedItem[]> {
  console.log('[SharedContent] Fetching shared content for class:', classId);
  
  // Use direct API call for reliability
  const projectId = 'njbtqmsxbyvpwigfceke';
  const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
  
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/rest/v1/class_shared_content?class_id=eq.${classId}&order=created_at.desc`,
      {
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log('[SharedContent] Found', data?.length || 0, 'shared items from Supabase');
      
      if (data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          class_id: row.class_id,
          teacher_id: row.teacher_id,
          name: row.name,
          type: row.type,
          content_id: row.content_id,
          folder_id: row.folder_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
      }
    } else {
      console.error('[SharedContent] API error:', response.status);
    }
  } catch (error) {
    console.error('[SharedContent] Error fetching from cloud:', error);
  }
  
  // Fallback: scan localStorage for any shared content with this class
  console.log('[SharedContent] Falling back to localStorage');
  const items: ClassSharedItem[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY) && key.includes(classId)) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        items.push(...data);
      } catch {
        // Skip invalid data
      }
    }
  }
  
  console.log('[SharedContent] Found', items.length, 'items in localStorage');
  return items;
}

// ============================================
// Sync functions
// ============================================

const projectId = 'njbtqmsxbyvpwigfceke';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

/**
 * Sync shared content to Supabase
 */
export async function syncSharedContentToCloud(teacherId: string, classId: string): Promise<void> {
  const items = getTeacherSharedContent(teacherId, classId);
  console.log('[SharedContent] Syncing', items.length, 'items to cloud for class:', classId);
  console.log('[SharedContent] Items to sync:', items.map(i => ({ id: i.id, name: i.name, type: i.type, folder_id: i.folder_id })));
  
  try {
    // First delete all existing items for this teacher/class
    const deleteUrl = `https://${projectId}.supabase.co/rest/v1/class_shared_content?teacher_id=eq.${encodeURIComponent(teacherId)}&class_id=eq.${encodeURIComponent(classId)}`;
    console.log('[SharedContent] Delete URL:', deleteUrl);
    
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('[SharedContent] Delete response:', deleteResponse.status, deleteResponse.statusText);
    if (!deleteResponse.ok) {
      const deleteError = await deleteResponse.text();
      console.error('[SharedContent] Delete failed:', deleteResponse.status, deleteError);
    }
    
    // Then insert all current items
    if (items.length > 0) {
      const insertData = items.map(item => ({
        id: item.id,
        class_id: item.class_id,
        teacher_id: item.teacher_id,
        name: item.name,
        type: item.type,
        content_id: item.content_id,
        folder_id: item.folder_id || null,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
      console.log('[SharedContent] Insert data:', JSON.stringify(insertData, null, 2));
      
      const insertResponse = await fetch(
        `https://${projectId}.supabase.co/rest/v1/class_shared_content`,
        {
          method: 'POST',
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(insertData)
        }
      );
      
      const responseText = await insertResponse.text();
      console.log('[SharedContent] Insert response:', insertResponse.status, responseText);
      
      if (insertResponse.ok) {
        console.log('[SharedContent] Successfully synced', items.length, 'items to cloud');
      } else {
        console.error('[SharedContent] Insert failed:', insertResponse.status, responseText);
      }
    } else {
      console.log('[SharedContent] No items to sync (all removed)');
    }
  } catch (error) {
    console.error('[SharedContent] Error syncing to cloud:', error);
  }
}

