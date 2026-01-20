/**
 * File Storage - Utility funkce pro ukládání souborů
 * 
 * Používá Supabase jako primární storage s localStorage jako fallback/cache
 * 
 * V2: Používá sync-queue pro spolehlivou synchronizaci
 */

import { supabase } from './supabase/client';
import { fetchTeacherTombstones } from './sync/teacher-tombstones';
import { queueUpsert, queueDelete } from './sync/sync-queue';

const FILES_KEY = 'vivid-my-files';
const SUPABASE_IDS_KEY = 'vivid-files-supabase-ids';
const DELETED_IDS_KEY = 'vivid-files-deleted-ids';

// Supabase config for direct fetch calls
const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

// Track which IDs are from Supabase
let supabaseFileIds = new Set<string>();
// Track which IDs were deleted locally (pending remote delete)
let deletedFileIds = new Set<string>();

// Load IDs from localStorage on init
try {
  const stored = localStorage.getItem(SUPABASE_IDS_KEY);
  if (stored) supabaseFileIds = new Set(JSON.parse(stored));
  const deletedStored = localStorage.getItem(DELETED_IDS_KEY);
  if (deletedStored) deletedFileIds = new Set(JSON.parse(deletedStored));
} catch { /* ignore */ }

export type SyncStatus = 'supabase' | 'pending' | 'local';

/**
 * Get sync status for a file
 */
export function getFileSyncStatus(id: string): SyncStatus {
  const existsInSupabase = supabaseFileIds.has(id);
  if (existsInSupabase) return 'supabase';
  return 'local';
}

/**
 * Get debug info for a file
 */
export function getFileDebugInfo(id: string): string {
  const files = getFiles();
  const file = files.find(f => f.id === id);
  
  return JSON.stringify({
    id,
    syncStatus: getFileSyncStatus(id),
    inSupabaseIds: supabaseFileIds.has(id),
    supabaseIdsCount: supabaseFileIds.size,
    existsInList: !!file,
    fileData: file || null,
  }, null, 2);
}

export interface FileItem {
  id: string;
  name: string;
  url: string;
  type?: string;
  size?: number;
  folderId?: string | null;
  createdAt?: string;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

function notifyFileChange(): void {
  window.dispatchEvent(new CustomEvent('files-updated'));
}

// =============================================
// LOCALSTORAGE FUNCTIONS
// =============================================

export function getFiles(): FileItem[] {
  try {
    const list = localStorage.getItem(FILES_KEY);
    return list ? JSON.parse(list) : [];
  } catch (error) {
    console.error('[FileStorage] Error loading files:', error);
    return [];
  }
}

function saveFileToLocalStorageOnly(file: FileItem): void {
  try {
    const list = getFiles();
    const existingIndex = list.findIndex(item => item.id === file.id);
    
    const fileItem: FileItem = {
      ...file,
      createdAt: existingIndex >= 0 ? list[existingIndex].createdAt : new Date().toISOString(),
    };
    
    if (existingIndex >= 0) {
      list[existingIndex] = fileItem;
    } else {
      list.unshift(fileItem);
    }
    
    localStorage.setItem(FILES_KEY, JSON.stringify(list));
    notifyFileChange();
  } catch (error) {
    console.error('[FileStorage] Error saving file:', error);
  }
}

export function saveFile(file: FileItem): void {
  saveFileToLocalStorageOnly(file);

  // Remove from deleted IDs if re-saving
  if (deletedFileIds.has(file.id)) {
    deletedFileIds.delete(file.id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedFileIds]));
  }

  // Queue for sync
  queueUpsert('teacher_files', file.id, {
    file_name: file.name,
    file_url: file.url,
    file_type: file.type || null,
    file_size: file.size || null,
    folder_id: file.folderId ?? null,
    created_at: file.createdAt || new Date().toISOString(),
  });

  console.log('[FileStorage] Queued file for sync:', file.id);
}

export function deleteFile(id: string): void {
  try {
    const list = getFiles().filter(item => item.id !== id);
    localStorage.setItem(FILES_KEY, JSON.stringify(list));
    
    // Track as deleted locally
    deletedFileIds.add(id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedFileIds]));
    
    // Remove from supabase IDs
    supabaseFileIds.delete(id);
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseFileIds]));
    
    notifyFileChange();
    
    // Queue for server delete
    queueDelete('teacher_files', id);
    
    console.log('[FileStorage] Queued file for deletion:', id);
  } catch (error) {
    console.error('[FileStorage] Error deleting file:', error);
  }
}

export function moveFileToFolder(fileId: string, folderId: string | null): void {
  try {
    const list = getFiles();
    const index = list.findIndex(item => item.id === fileId);
    
    if (index >= 0) {
      list[index].folderId = folderId;
      localStorage.setItem(FILES_KEY, JSON.stringify(list));
      notifyFileChange();
      
      // Async update in Supabase (direct fetch)
      (async () => {
        try {
          const userId = await getCurrentUserId();
          if (!userId) return;
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;
          if (!accessToken) return;

          const response = await fetch(
            `${SUPABASE_URL}/rest/v1/teacher_files?id=eq.${fileId}&teacher_id=eq.${userId}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
              },
              body: JSON.stringify({ folder_id: folderId }),
            }
          );

          if (!response.ok) {
            console.error('[FileStorage] Supabase move failed:', response.status, await response.text());
          }
        } catch (err) {
          console.error('[FileStorage] Move error:', err);
        }
      })();
    }
  } catch (error) {
    console.error('[FileStorage] Error moving file:', error);
  }
}

export function getFilesInFolder(folderId: string | null): FileItem[] {
  const list = getFiles();
  return list.filter(item => (item.folderId || null) === folderId);
}

export function getRootFiles(): FileItem[] {
  return getFilesInFolder(null);
}

// =============================================
// SUPABASE SYNC FUNCTIONS
// =============================================

/**
 * @param passedUserId - Optional user ID to use directly (avoids calling getUser which can timeout)
 */
export async function syncFromSupabase(passedUserId?: string, accessToken?: string): Promise<void> {
  try {
    const userId = passedUserId || await getCurrentUserId();
    if (!userId) return;

    // Require auth token; anon key with RLS can return empty and corrupt local synced IDs
    let authToken = accessToken;
    if (!authToken) {
      const { data: sessionData } = await supabase.auth.getSession();
      authToken = sessionData?.session?.access_token;
    }
    if (!authToken) {
      console.warn('[FileStorage] No access token available for sync; skipping');
      return;
    }

    // Apply server tombstones first
    const tombstones = await fetchTeacherTombstones(userId, authToken);
    const tombstoned = tombstones.filter(t => t.item_type === 'file').map(t => t.item_id);
    if (tombstoned.length > 0) {
      let changed = false;
      for (const tid of tombstoned) {
        if (!deletedFileIds.has(tid)) {
          deletedFileIds.add(tid);
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedFileIds]));
      }
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let data: any[] | null = null;
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/teacher_files?teacher_id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error('[FileStorage] Error syncing from Supabase:', response.status);
        return;
      }
      data = await response.json();
      console.log('[FileStorage] Direct fetch success, got', data?.length || 0, 'files');
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        console.error('[FileStorage] Fetch timed out after 10s');
      } else {
        console.error('[FileStorage] Fetch error:', fetchErr);
      }
      return;
    }

    console.log('[FileStorage] Syncing files from Supabase, found:', data?.length || 0);

    const remoteRows: any[] = data || [];
    const remoteIds = new Set(remoteRows.map(r => r.id));
    const localList = getFiles();

    // Remote deletions: was synced before, now missing
    const remoteDeletions = [...supabaseFileIds].filter(id => !remoteIds.has(id));
    if (remoteDeletions.length > 0) {
      const filtered = localList.filter(f => !remoteDeletions.includes(f.id));
      localStorage.setItem(FILES_KEY, JSON.stringify(filtered));
    }

    // Build remote list excluding locally-deleted tombstones
    const remoteList: FileItem[] = [];
    const deleteRetry: string[] = [];
    for (const row of remoteRows) {
      if (deletedFileIds.has(row.id)) {
        deleteRetry.push(row.id);
        continue;
      }
      remoteList.push({
        id: row.id,
        name: row.file_name,
        url: row.file_url,
        type: row.file_type,
        size: row.file_size,
        folderId: row.folder_id,
        createdAt: row.created_at,
      });
    }

    // New local files: never synced before and not on server
    const newLocal = localList.filter(f => !supabaseFileIds.has(f.id) && !remoteIds.has(f.id) && !deletedFileIds.has(f.id));

    const merged = [...remoteList, ...newLocal];
    localStorage.setItem(FILES_KEY, JSON.stringify(merged));

    // Update synced ids from server
    supabaseFileIds = new Set(remoteList.map(f => f.id));
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseFileIds]));
    notifyFileChange();

    // Retry deletes
    for (const id of deleteRetry) {
      // Ensure tombstone exists (best-effort)
      void recordTeacherTombstone(userId, authToken, 'file', id);
      fetch(`${SUPABASE_URL}/rest/v1/teacher_files?id=eq.${id}&teacher_id=eq.${userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        }
      }).then(res => {
        if (res.ok) {
          return res.json().then((rows: any) => {
            const deletedCount = Array.isArray(rows) ? rows.length : 0;
            if (deletedCount > 0) {
              deletedFileIds.delete(id);
              localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedFileIds]));
            } else {
              console.warn('[FileStorage] Retry delete returned ok but deleted 0 rows (keeping tombstone):', id);
            }
          }).catch(() => {});
        }
        return;
      });
    }

    // Upload new local (fire & forget)
    // CRITICAL: Also filter out items that exist in server tombstones (prevents zombie resurrection!)
    const safeNewLocal = newLocal.filter(f => !tombstoned.includes(f.id));
    const blockedByTombstone = newLocal.length - safeNewLocal.length;
    
    if (blockedByTombstone > 0) {
      console.log('[FileStorage] ⛔ Blocked', blockedByTombstone, 'local files from uploading (server tombstone exists)');
      // Clean up tombstoned items from localStorage
      for (const file of newLocal) {
        if (tombstoned.includes(file.id)) {
          console.log('[FileStorage] Cleaning tombstoned file from localStorage:', file.id);
          deletedFileIds.add(file.id);
        }
      }
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedFileIds]));
      
      // Update the list without tombstoned items
      const cleanedList = getFiles().filter(f => !tombstoned.includes(f.id));
      localStorage.setItem(FILES_KEY, JSON.stringify(cleanedList));
    }
    
    for (const f of safeNewLocal) {
      saveFile(f);
    }
  } catch (error) {
    console.error('[FileStorage] Sync error:', error);
  }
}

export async function migrateToSupabase(): Promise<{ success: boolean; migrated: number }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, migrated: 0 };

    const files = getFiles();
    let migrated = 0;

    for (const file of files) {
      const { error } = await supabase
        .from('teacher_files')
        .upsert({
          id: file.id,
          teacher_id: userId,
          file_name: file.name,
          file_url: file.url,
          file_type: file.type,
          file_size: file.size,
          folder_id: file.folderId,
          created_at: file.createdAt || new Date().toISOString(),
        }, { onConflict: 'id' });

      if (!error) migrated++;
    }

    console.log(`[FileStorage] Migrated ${migrated} files to Supabase`);
    return { success: true, migrated };
  } catch (error) {
    console.error('[FileStorage] Migration error:', error);
    return { success: false, migrated: 0 };
  }
}

