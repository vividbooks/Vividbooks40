/**
 * Folder Storage - Utility funkce pro ukládání složek
 * 
 * Používá Supabase jako primární storage s localStorage jako fallback/cache
 * 
 * V2: Používá sync-queue pro spolehlivou synchronizaci
 */

import { supabase } from './supabase/client';
import { fetchTeacherTombstones } from './sync/teacher-tombstones';
import { queueDelete } from './sync/sync-queue';

// Supabase config for direct fetch calls (kept consistent with other storage modules)
const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

const FOLDERS_KEY = 'vivid-my-folders';
const DOCUMENTS_KEY = 'vivid-my-documents';
const SUPABASE_IDS_KEY = 'vivid-folders-supabase-ids';
const DELETED_IDS_KEY = 'vivid-folders-deleted-ids';
const DIRTY_KEY = 'vivid-folders-dirty';

// Track which IDs are from Supabase
let supabaseFolderIds = new Set<string>();
// Track which IDs were deleted locally (pending remote delete)
let deletedFolderIds = new Set<string>();

// Load supabase IDs from localStorage on init
try {
  const stored = localStorage.getItem(SUPABASE_IDS_KEY);
  if (stored) supabaseFolderIds = new Set(JSON.parse(stored));
  const deletedStored = localStorage.getItem(DELETED_IDS_KEY);
  if (deletedStored) deletedFolderIds = new Set(JSON.parse(deletedStored));
} catch { /* ignore */ }

export type SyncStatus = 'supabase' | 'pending' | 'local';

/**
 * Get sync status for a folder
 */
export function getFolderSyncStatus(id: string): SyncStatus {
  const existsInSupabase = supabaseFolderIds.has(id);
  if (existsInSupabase) return 'supabase';
  return 'local';
}

/**
 * Get debug info for a folder
 */
export function getFolderDebugInfo(id: string): string {
  const folders = getFolders();
  const folder = folders.find(f => f.id === id);
  
  return JSON.stringify({
    id,
    syncStatus: getFolderSyncStatus(id),
    inSupabaseIds: supabaseFolderIds.has(id),
    supabaseIdsCount: supabaseFolderIds.size,
    existsInList: !!folder,
    folderData: folder || null,
  }, null, 2);
}

// =============================================
// TYPES
// =============================================

export interface ContentItem {
  id: string;
  name: string;
  type: 'folder' | 'document' | 'board' | 'worksheet' | 'file' | 'link';
  color?: string;
  copiedFrom?: string;
  originalId?: string;
  createdAt?: string;
  children?: ContentItem[];
  isSystemFolder?: boolean; // System folders cannot be deleted (e.g., "Média")
}

// System folder constants
export const MEDIA_FOLDER_ID = 'folder-media-library';
export const MEDIA_FOLDER_NAME = 'Moje obrázky';
export const MEDIA_FOLDER_COLOR = '#e2e8f0'; // Light gray - system folder

// =============================================
// HELPER FUNCTIONS
// =============================================

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

// =============================================
// LOCALSTORAGE FUNCTIONS (sync)
// =============================================

export function getFolders(): ContentItem[] {
  try {
    const data = localStorage.getItem(FOLDERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[FolderStorage] Error loading folders:', error);
    return [];
  }
}

export function saveFolders(folders: ContentItem[]): void {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));

    // Mark as dirty; actual push is done during sync (after we fetch remote state to avoid resurrecting deletions)
    localStorage.setItem(DIRTY_KEY, '1');
    notifyFolderChange();
  } catch (error) {
    console.error('[FolderStorage] Error saving folders:', error);
  }
}

export function getDocuments(): ContentItem[] {
  try {
    const data = localStorage.getItem(DOCUMENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[FolderStorage] Error loading documents:', error);
    return [];
  }
}

export function saveDocuments(documents: ContentItem[]): void {
  try {
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
  } catch (error) {
    console.error('[FolderStorage] Error saving documents:', error);
  }
}

/**
 * Ensure the system "Média" folder exists for the current user
 * This folder cannot be deleted and is used for storing uploaded assets
 */
export function ensureMediaFolderExists(): ContentItem {
  const folders = getFolders();
  
  // Check if media folder already exists
  let mediaFolder = folders.find(f => f.id === MEDIA_FOLDER_ID);
  
  if (!mediaFolder) {
    console.log('[FolderStorage] Creating system "Média" folder');
    mediaFolder = {
      id: MEDIA_FOLDER_ID,
      name: MEDIA_FOLDER_NAME,
      type: 'folder',
      color: MEDIA_FOLDER_COLOR,
      isSystemFolder: true,
      createdAt: new Date().toISOString(),
      children: [],
    };
    
    // Add at the beginning of the folders list
    saveFolders([mediaFolder, ...folders]);
    
    // Sync to Supabase immediately (background)
    (async () => {
      const userId = await getCurrentUserId();
      if (userId) {
        try {
          const folderData = {
            id: MEDIA_FOLDER_ID,
            teacher_id: userId,
            name: MEDIA_FOLDER_NAME,
            color: MEDIA_FOLDER_COLOR,
            parent_id: null,
            position: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from('teacher_folders')
            .insert(folderData);

          if (error) {
            if (!error.message?.includes('duplicate') && error.code !== '23505') {
              console.warn('[FolderStorage] Failed to sync Média folder:', error);
            }
          } else {
            console.log('[FolderStorage] Média folder synced to Supabase');
            supabaseFolderIds.add(MEDIA_FOLDER_ID);
            localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseFolderIds]));
          }
        } catch (err) {
          console.warn('[FolderStorage] Error syncing Média folder:', err);
        }
      }
    })();
  } else if (!mediaFolder.isSystemFolder) {
    // Update existing folder to be marked as system folder
    mediaFolder.isSystemFolder = true;
    saveFolders(folders);
  }
  
  return mediaFolder;
}

/**
 * Get the media folder ID, creating it if it doesn't exist
 */
export function getMediaFolderId(): string {
  ensureMediaFolderExists();
  return MEDIA_FOLDER_ID;
}

/**
 * Create a subfolder inside the Média folder for organizing imported content
 * @param name - Name of the subfolder (e.g., "PDF - Document Name")
 * @returns Promise with the ID of the created subfolder
 */
export async function createMediaSubfolder(name: string): Promise<string> {
  ensureMediaFolderExists();
  const folders = getFolders();
  
  // Find the media folder
  const mediaFolderIndex = folders.findIndex(f => f.id === MEDIA_FOLDER_ID);
  if (mediaFolderIndex === -1) {
    console.error('[FolderStorage] Media folder not found');
    return MEDIA_FOLDER_ID; // Fallback to media folder itself
  }
  
  // Generate unique subfolder ID
  const subfolderId = `folder-media-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  
  // Create the subfolder
  const subfolder: ContentItem = {
    id: subfolderId,
    name: name,
    type: 'folder',
    color: '#a78bfa', // Lighter purple for subfolders
    createdAt: new Date().toISOString(),
    children: [],
  };
  
  // Add subfolder as a child of the media folder
  const mediaFolder = folders[mediaFolderIndex];
  if (!mediaFolder.children) {
    mediaFolder.children = [];
  }
  mediaFolder.children.unshift(subfolder);
  
  // Save updated folders locally
  saveFolders(folders);
  
  // Immediately sync to Supabase to ensure folder exists before files are uploaded
  const userId = await getCurrentUserId();
  if (userId) {
    try {
      const folderData = {
        id: subfolderId,
        teacher_id: userId,
        name: name,
        color: '#a78bfa',
        parent_id: MEDIA_FOLDER_ID,
        position: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('teacher_folders')
        .insert(folderData);

      if (error) {
        // Ignore duplicate errors
        if (!error.message?.includes('duplicate') && error.code !== '23505') {
          console.warn('[FolderStorage] Failed to sync subfolder to Supabase:', error);
        } else {
          console.log('[FolderStorage] Subfolder already exists in Supabase');
        }
      } else {
        console.log('[FolderStorage] Subfolder synced to Supabase:', subfolderId);
        // Mark as synced
        supabaseFolderIds.add(subfolderId);
        localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseFolderIds]));
      }
    } catch (err) {
      console.warn('[FolderStorage] Error syncing subfolder:', err);
    }
  }
  
  console.log('[FolderStorage] Created media subfolder:', subfolderId, name);
  return subfolderId;
}

/**
 * Check if a folder is a protected system folder
 */
export function isSystemFolder(folderId: string): boolean {
  return folderId === MEDIA_FOLDER_ID;
}

// =============================================
// SUPABASE FUNCTIONS (async)
// =============================================

export async function getFoldersFromSupabase(passedUserId?: string, accessToken?: string): Promise<ContentItem[]> {
  try {
    const userId = passedUserId || await getCurrentUserId();
    if (!userId) return getFolders();

    // Use direct fetch instead of supabase.from() to avoid timeout issues
    const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';
    const authToken = accessToken;
    if (!authToken) {
      // Don't attempt anon-key fetch here; with RLS it can look like "empty server" and break local state.
      return getFolders();
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
    
    let folders: any[] = [];
    let docsResult = { data: [] as any[] };
    let boardsResult = { data: [] as any[] };
    
    try {
      const [foldersRes, docsRes, boardsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/teacher_folders?teacher_id=eq.${userId}&select=*&order=position.asc`, { headers, signal: controller.signal }),
        fetch(`${SUPABASE_URL}/rest/v1/teacher_documents?teacher_id=eq.${userId}&select=*`, { headers, signal: controller.signal }),
        fetch(`${SUPABASE_URL}/rest/v1/teacher_boards?teacher_id=eq.${userId}&select=id,title,folder_id,copied_from,original_id,created_at`, { headers, signal: controller.signal }),
      ]);
      clearTimeout(timeoutId);
      
      if (!foldersRes.ok) {
        console.error('[FolderStorage] Folders fetch failed:', foldersRes.status);
        return getFolders();
      }
      
      folders = await foldersRes.json();
      docsResult = { data: docsRes.ok ? await docsRes.json() : [] };
      boardsResult = { data: boardsRes.ok ? await boardsRes.json() : [] };
      
      console.log('[FolderStorage] Direct fetch success:', folders.length, 'folders,', docsResult.data.length, 'docs,', boardsResult.data.length, 'boards');
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        console.error('[FolderStorage] Fetch timed out after 10s');
      } else {
        console.error('[FolderStorage] Fetch error:', fetchErr);
      }
      return getFolders();
    }

    // Build tree structure
    const folderMap = new Map<string | null, ContentItem[]>();
    
    // Initialize root
    folderMap.set(null, []);

    // Add folders
    for (const folder of folders || []) {
      const item: ContentItem = {
        id: folder.id,
        name: folder.name,
        type: 'folder',
        color: folder.color,
        copiedFrom: folder.copied_from,
        originalId: folder.original_id,
        createdAt: folder.created_at,
        children: [],
      };

      const parentId = folder.parent_id || null;
      if (!folderMap.has(parentId)) {
        folderMap.set(parentId, []);
      }
      folderMap.get(parentId)!.push(item);
    }

    // Add documents to folders
    for (const doc of docsResult.data || []) {
      const item: ContentItem = {
        id: doc.id,
        name: doc.title,
        type: 'document',
        copiedFrom: doc.copied_from,
        originalId: doc.original_id,
        createdAt: doc.created_at,
      };

      const folderId = doc.folder_id || null;
      if (!folderMap.has(folderId)) {
        folderMap.set(folderId, []);
      }
      folderMap.get(folderId)!.push(item);
    }

    // Add boards to folders
    for (const board of boardsResult.data || []) {
      const item: ContentItem = {
        id: board.id,
        name: board.title,
        type: 'board',
        copiedFrom: board.copied_from,
        originalId: board.original_id,
        createdAt: board.created_at,
      };

      const folderId = board.folder_id || null;
      if (!folderMap.has(folderId)) {
        folderMap.set(folderId, []);
      }
      folderMap.get(folderId)!.push(item);
    }

    // Build nested structure
    function buildTree(parentId: string | null): ContentItem[] {
      const items = folderMap.get(parentId) || [];
      for (const item of items) {
        if (item.type === 'folder') {
          item.children = buildTree(item.id);
        }
      }
      return items;
    }

    return buildTree(null);
  } catch (error) {
    console.error('[FolderStorage] Error loading from Supabase:', error);
    return getFolders();
  }
}

async function saveFoldersToSupabase(folders: ContentItem[]): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return false;

    // Flatten folder structure for saving
    async function saveFolder(folder: ContentItem, parentId: string | null, position: number): Promise<void> {
      if (folder.type !== 'folder') return;

      const folderData = {
        id: folder.id,
        teacher_id: userId,
        name: folder.name,
        color: folder.color,
        parent_id: parentId,
        copied_from: folder.copiedFrom,
        original_id: folder.originalId,
        position: position,
        updated_at: new Date().toISOString(),
      };

      // Use UPDATE first, then INSERT (compatible with RLS)
      const { data: updateResult, error: updateError } = await supabase
        .from('teacher_folders')
        .update(folderData)
        .eq('id', folder.id)
        .eq('teacher_id', userId)
        .select();

      if (updateError) {
        console.error('[FolderStorage] Update error:', updateError);
      }

      // If no row was updated, insert new
      if (!updateResult || updateResult.length === 0) {
        const { error: insertError } = await supabase
          .from('teacher_folders')
          .insert({
            ...folderData,
            created_at: new Date().toISOString(),
          });
        if (insertError) {
          // Ignore duplicate key errors / conflicts (race condition or already exists)
          const isDuplicate = 
            insertError.message?.includes('duplicate key') ||
            insertError.message?.includes('already exists') ||
            insertError.code === '23505' || // PostgreSQL unique violation
            (insertError as any).status === 409; // HTTP Conflict
          if (!isDuplicate) {
            console.warn('[FolderStorage] Insert error (non-duplicate):', insertError);
            throw insertError;
          } else {
            console.log('[FolderStorage] Folder already exists, skipping:', folder.id);
          }
        }
      }

      // Save children
      if (folder.children) {
        for (let i = 0; i < folder.children.length; i++) {
          const child = folder.children[i];
          if (child.type === 'folder') {
            await saveFolder(child, folder.id, i);
          } else if (child.type === 'document') {
            // IMPORTANT: Do NOT upsert documents here (it would resurrect deleted documents).
            // Only update folder_id for existing rows.
            const { error } = await supabase
              .from('teacher_documents')
              .update({ folder_id: folder.id })
              .eq('id', child.id)
              .eq('teacher_id', userId);
            if (error) throw error;
          } else if (child.type === 'board') {
            const { error } = await supabase
              .from('teacher_boards')
              .update({ folder_id: folder.id })
              .eq('id', child.id)
              .eq('teacher_id', userId);
            if (error) throw error;
          } else if (child.type === 'worksheet') {
            const { error } = await supabase
              .from('teacher_worksheets')
              .update({ folder_id: folder.id })
              .eq('id', child.id)
              .eq('teacher_id', userId);
            if (error) throw error;
          } else if (child.type === 'file') {
            const { error } = await supabase
              .from('teacher_files')
              .update({ folder_id: folder.id })
              .eq('id', child.id)
              .eq('teacher_id', userId);
            if (error) throw error;
          } else if (child.type === 'link') {
            const { error } = await supabase
              .from('teacher_links')
              .update({ folder_id: folder.id })
              .eq('id', child.id)
              .eq('teacher_id', userId);
            if (error) throw error;
          }
        }
      }
    }

    // Save root folders
    for (let i = 0; i < folders.length; i++) {
      await saveFolder(folders[i], null, i);
    }

    return true;
  } catch (error) {
    console.error('[FolderStorage] Error saving to Supabase:', error);
    return false;
  }
}

// =============================================
// SYNC FUNCTIONS
// =============================================

/**
 * Dispatch custom event to notify components about folder changes
 */
function notifyFolderChange(): void {
  window.dispatchEvent(new CustomEvent('folders-updated'));
}

/**
 * Sync folders from Supabase to localStorage
 * SMART SYNC: Nejdřív nahraje lokální složky, pak stáhne ze Supabase
 * @param passedUserId - Optional user ID to use directly (avoids calling getUser which can timeout)
 * @param accessToken - Optional access token for authenticated requests
 */
export async function syncFromSupabase(passedUserId?: string, accessToken?: string): Promise<void> {
  try {
    // Use passed userId if available
    const userId = passedUserId || await getCurrentUserId();
    if (!userId) {
      console.log('[FolderStorage] No user logged in, skipping sync');
      return;
    }

    // Require authenticated token; anon key + RLS can look like "empty server"
    let token = accessToken;
    if (!token) {
      const { data: sessionData } = await supabase.auth.getSession();
      token = sessionData?.session?.access_token;
    }
    if (!token) {
      console.warn('[FolderStorage] No access token available for sync; skipping');
      return;
    }

    // Apply server tombstones first
    const tombstones = await fetchTeacherTombstones(userId, token);
    const tombstonedFolderIds = tombstones.filter(t => t.item_type === 'folder').map(t => t.item_id);
    if (tombstonedFolderIds.length > 0) {
      let changed = false;
      for (const tid of tombstonedFolderIds) {
        if (!deletedFolderIds.has(tid)) {
          deletedFolderIds.add(tid);
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedFolderIds]));
      }
    }
    // Helper function to collect folder IDs
    function collectFolderIds(folders: ContentItem[]): string[] {
      const ids: string[] = [];
      for (const f of folders) {
        if (f.type === 'folder') {
          ids.push(f.id);
          if (f.children) {
            ids.push(...collectFolderIds(f.children));
          }
        }
      }
      return ids;
    }
    
    // Step 1: read current local state
    const localFolders = getFolders();
    const localFolderIds = new Set(collectFolderIds(localFolders));

    // Step 2: fetch tree from Supabase (source of truth for remote state)
    const supabaseFolders = await getFoldersFromSupabase(userId, token);
    const supabaseIds = new Set(collectFolderIds(supabaseFolders));

    // Step 3: detect folders deleted remotely (were synced before, now missing)
    const remotelyDeletedFolderIds = new Set<string>(
      [...supabaseFolderIds].filter(id => !supabaseIds.has(id))
    );

    // Step 4: if local folders are marked dirty, push them AFTER remote fetch,
    // but NEVER resurrect remotely deleted folders or locally tombstoned folders.
    const isDirty = localStorage.getItem(DIRTY_KEY) === '1';
    if (isDirty && localFolders.length > 0) {
      const pruneDeleted = (items: ContentItem[]): ContentItem[] => {
        const out: ContentItem[] = [];
        for (const item of items) {
          if (item.type !== 'folder') continue;
          if (remotelyDeletedFolderIds.has(item.id)) continue;
          if (deletedFolderIds.has(item.id)) continue;
          const next: ContentItem = { ...item };
          if (next.children) next.children = pruneDeleted(next.children);
          out.push(next);
        }
        return out;
      };

      const safeLocalFolders = pruneDeleted(localFolders);
      if (safeLocalFolders.length > 0) {
        const ok = await saveFoldersToSupabase(safeLocalFolders);
        if (ok) {
          localStorage.removeItem(DIRTY_KEY);
        }
      }
    }
    
    // Step 5: keep ONLY folders that are truly new local (never synced before)
    // This prevents "zombie folders" where a folder deleted remotely would be re-uploaded.
    const stillUnsynced: ContentItem[] = [];
    for (const folder of localFolders) {
      if (folder.type === 'folder' && !supabaseFolderIds.has(folder.id) && !supabaseIds.has(folder.id)) {
        stillUnsynced.push(folder);
      }
    }
    
    // Merge: Supabase folders + new local folders
    // Also filter out folders tombstoned locally/server-side from the merged tree
    const mergedFolders = [...supabaseFolders, ...stillUnsynced].filter(f => !deletedFolderIds.has(f.id));
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(mergedFolders));
    
    // Track which IDs are from Supabase
    supabaseFolderIds = supabaseIds;
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseIds]));
    
    console.log('[FolderStorage] Synced', supabaseFolders.length, 'folders from Supabase, kept', stillUnsynced.length, 'unsynced');
    notifyFolderChange();
  } catch (error) {
    console.error('[FolderStorage] Sync error:', error);
  }
}

/**
 * Delete a folder (local + server tombstone + remote delete)
 * Used by UI to prevent folders reappearing across browsers.
 * Returns false if the folder is protected (system folder).
 */
export function deleteFolder(id: string): boolean {
  try {
    // Prevent deletion of system folders
    if (isSystemFolder(id)) {
      console.warn('[FolderStorage] Cannot delete system folder:', id);
      return false;
    }
    
    // Track as deleted locally
    deletedFolderIds.add(id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedFolderIds]));
    
    // Remove from supabase IDs
    supabaseFolderIds.delete(id);
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseFolderIds]));
    
    localStorage.setItem(DIRTY_KEY, '1');
    notifyFolderChange();

    // Queue for server delete (with tombstone)
    queueDelete('teacher_folders', id);
    
    console.log('[FolderStorage] Queued folder for deletion:', id);
    return true;
  } catch (error) {
    console.error('[FolderStorage] Error deleting folder:', error);
    return false;
  }
}

/**
 * Migrate localStorage data to Supabase
 */
export async function migrateToSupabase(): Promise<{ success: boolean; migrated: number }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, migrated: 0 };

    const folders = getFolders();
    const success = await saveFoldersToSupabase(folders);
    
    return { 
      success, 
      migrated: folders.length 
    };
  } catch (error) {
    console.error('[FolderStorage] Migration error:', error);
    return { success: false, migrated: 0 };
  }
}


