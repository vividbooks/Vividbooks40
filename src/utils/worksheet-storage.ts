/**
 * Worksheet Storage - Utility funkce pro ukládání pracovních listů
 * 
 * Používá Supabase jako primární storage s localStorage jako fallback/cache
 * 
 * V2: Používá sync-queue pro spolehlivou synchronizaci
 */

import { Worksheet } from '../types/worksheet';
import { supabase } from './supabase/client';
import { fetchTeacherTombstones } from './sync/teacher-tombstones';
import { queueUpsert, queueDelete } from './sync/sync-queue';

const WORKSHEETS_KEY = 'vividbooks_worksheets';
const WORKSHEET_PREFIX = 'vividbooks_worksheet_';
const SUPABASE_IDS_KEY = 'vividbooks_worksheets_supabase_ids';
const DELETED_IDS_KEY = 'vividbooks_worksheets_deleted_ids';

// Supabase config for direct fetch calls
const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

// Track which IDs are from Supabase
let supabaseWorksheetIds = new Set<string>();
// Track which IDs were deleted locally (pending remote delete)
let deletedWorksheetIds = new Set<string>();

// Load IDs from localStorage on init
try {
  const stored = localStorage.getItem(SUPABASE_IDS_KEY);
  if (stored) supabaseWorksheetIds = new Set(JSON.parse(stored));
  const deletedStored = localStorage.getItem(DELETED_IDS_KEY);
  if (deletedStored) deletedWorksheetIds = new Set(JSON.parse(deletedStored));
} catch { /* ignore */ }

export type SyncStatus = 'supabase' | 'pending' | 'local';

/**
 * Get sync status for a worksheet
 */
export function getWorksheetSyncStatus(id: string): SyncStatus {
  const existsLocally = localStorage.getItem(`${WORKSHEET_PREFIX}${id}`) !== null;
  const existsInSupabase = supabaseWorksheetIds.has(id);
  
  if (existsInSupabase) return 'supabase';
  if (existsLocally) return 'local';
  return 'local';
}

/**
 * Get debug info for a worksheet
 */
export function getWorksheetDebugInfo(id: string): string {
  const worksheet = getWorksheet(id);
  const list = getWorksheetList();
  const listItem = list.find(w => w.id === id);
  
  return JSON.stringify({
    id,
    syncStatus: getWorksheetSyncStatus(id),
    inSupabaseIds: supabaseWorksheetIds.has(id),
    supabaseIdsCount: supabaseWorksheetIds.size,
    existsInLocalStorage: !!worksheet,
    existsInList: !!listItem,
    listItem: listItem || null,
  }, null, 2);
}

// =============================================
// HELPER FUNCTIONS
// =============================================

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

function notifyWorksheetChange(): void {
  window.dispatchEvent(new CustomEvent('worksheets-updated'));
}

/**
 * Typ pro seznam pracovních listů (metadata)
 */
export interface WorksheetListItem {
  id: string;
  title: string;
  subject: string;
  grade: number;
  createdAt: string;
  updatedAt: string;
  blocksCount: number;
  folderId?: string | null; // ID složky, ve které je pracovní list uložen (null = root)
}

/**
 * Získat seznam všech pracovních listů (metadata)
 */
export function getWorksheetList(): WorksheetListItem[] {
  try {
    const list = localStorage.getItem(WORKSHEETS_KEY);
    return list ? JSON.parse(list) : [];
  } catch (error) {
    console.error('Error loading worksheet list:', error);
    return [];
  }
}

/**
 * Uložit worksheet POUZE do localStorage
 */
function saveWorksheetToLocalStorageOnly(worksheet: Worksheet): void {
  try {
    // Uložit samotný worksheet
    localStorage.setItem(
      `${WORKSHEET_PREFIX}${worksheet.id}`, 
      JSON.stringify(worksheet)
    );
    
    // Aktualizovat seznam
    const list = getWorksheetList();
    const existingIndex = list.findIndex(item => item.id === worksheet.id);
    
    const listItem: WorksheetListItem = {
      id: worksheet.id,
      title: worksheet.title || 'Bez názvu',
      subject: worksheet.metadata?.subject || 'other',
      grade: worksheet.metadata?.grade || 6,
      updatedAt: new Date().toISOString(),
      createdAt: existingIndex >= 0 ? list[existingIndex].createdAt : new Date().toISOString(),
      blocksCount: worksheet.blocks?.length || 0,
      folderId: existingIndex >= 0 ? list[existingIndex].folderId : undefined,
    };
    
    if (existingIndex >= 0) {
      list[existingIndex] = listItem;
    } else {
      list.unshift(listItem);
    }
    
    localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(list));
    notifyWorksheetChange();
  } catch (error) {
    console.error('Error saving worksheet to localStorage:', error);
  }
}

/**
 * Uložit/aktualizovat pracovní list do localStorage a Supabase
 */
export function saveWorksheet(worksheet: Worksheet): void {
  saveWorksheetToLocalStorageOnly(worksheet);

  // Remove from deleted IDs if re-saving
  if (deletedWorksheetIds.has(worksheet.id)) {
    deletedWorksheetIds.delete(worksheet.id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedWorksheetIds]));
  }

  // Get folder ID from list
  const folderId = getWorksheetList().find(w => w.id === worksheet.id)?.folderId ?? null;

  // Queue for sync
  queueUpsert('teacher_worksheets', worksheet.id, {
    name: worksheet.title || 'Nový pracovní list',
    worksheet_type: worksheet.metadata?.subject || null,
    content: worksheet.blocks || [],
    pdf_settings: (worksheet as any).pdfSettings || {},
    folder_id: folderId,
    created_at: worksheet.createdAt || new Date().toISOString(),
  });

  console.log('[WorksheetStorage] Queued worksheet for sync:', worksheet.id);
}

/**
 * Načíst pracovní list podle ID
 */
export function getWorksheet(id: string): Worksheet | null {
  try {
    const data = localStorage.getItem(`${WORKSHEET_PREFIX}${id}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading worksheet:', error);
    return null;
  }
}

/**
 * Smazat pracovní list (localStorage + Supabase)
 */
export function deleteWorksheet(id: string): void {
  try {
    // Delete from localStorage
    localStorage.removeItem(`${WORKSHEET_PREFIX}${id}`);
    
    const list = getWorksheetList().filter(item => item.id !== id);
    localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(list));
    
    // Track as deleted (prevents zombie restore)
    deletedWorksheetIds.add(id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedWorksheetIds]));
    
    // Remove from supabase IDs
    supabaseWorksheetIds.delete(id);
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseWorksheetIds]));
    
    notifyWorksheetChange();
    
    // Queue for server delete
    queueDelete('teacher_worksheets', id);
    
    console.log('[WorksheetStorage] Queued worksheet for deletion:', id);
  } catch (error) {
    console.error('Error deleting worksheet:', error);
  }
}

/**
 * Duplikovat pracovní list
 */
export function duplicateWorksheet(id: string): Worksheet | null {
  try {
    const original = getWorksheet(id);
    if (!original) return null;
    
    const duplicate: Worksheet = {
      ...original,
      id: crypto.randomUUID(),
      title: `${original.title || 'Bez názvu'} (kopie)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    saveWorksheet(duplicate);
    return duplicate;
  } catch (error) {
    console.error('Error duplicating worksheet:', error);
    return null;
  }
}

/**
 * Zkontrolovat, zda worksheet existuje
 */
export function worksheetExists(id: string): boolean {
  return localStorage.getItem(`${WORKSHEET_PREFIX}${id}`) !== null;
}

/**
 * Přesunout pracovní list do složky
 */
export function moveWorksheetToFolder(worksheetId: string, folderId: string | null): void {
  try {
    const list = getWorksheetList();
    const index = list.findIndex(item => item.id === worksheetId);
    
    if (index >= 0) {
      list[index].folderId = folderId;
      localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(list));
    }
  } catch (error) {
    console.error('Error moving worksheet to folder:', error);
  }
}

/**
 * Získat pracovní listy v konkrétní složce
 */
export function getWorksheetsInFolder(folderId: string | null): WorksheetListItem[] {
  const list = getWorksheetList();
  return list.filter(item => (item.folderId || null) === folderId);
}

/**
 * Získat pracovní listy v root (bez složky)
 */
export function getRootWorksheets(): WorksheetListItem[] {
  return getWorksheetsInFolder(null);
}

// =============================================
// SUPABASE SYNC FUNCTIONS
// =============================================

/**
 * Sync worksheets from Supabase to localStorage
 * HARD SYNC: Supabase je source of truth
 * @param passedUserId - Optional user ID to use directly (avoids calling getUser which can timeout)
 */
export async function syncFromSupabase(passedUserId?: string, accessToken?: string): Promise<void> {
  try {
    const userId = passedUserId || await getCurrentUserId();
    if (!userId) return;

    // Require authenticated token; anon key with RLS can return empty and corrupt local synced IDs
    let authToken = accessToken;
    if (!authToken) {
      const { data: sessionData } = await supabase.auth.getSession();
      authToken = sessionData?.session?.access_token;
    }
    if (!authToken) {
      console.warn('[WorksheetStorage] No access token available for sync; skipping');
      return;
    }

    // Apply server tombstones first
    const tombstones = await fetchTeacherTombstones(userId, authToken);
    const tombstoned = tombstones.filter(t => t.item_type === 'worksheet').map(t => t.item_id);
    if (tombstoned.length > 0) {
      let changed = false;
      for (const tid of tombstoned) {
        if (!deletedWorksheetIds.has(tid)) {
          deletedWorksheetIds.add(tid);
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedWorksheetIds]));
      }
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let data: any[] | null = null;
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/teacher_worksheets?teacher_id=eq.${userId}&select=*`,
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
        console.error('[WorksheetStorage] Error syncing from Supabase:', response.status);
        return;
      }
      data = await response.json();
      console.log('[WorksheetStorage] Direct fetch success, got', data?.length || 0, 'worksheets');
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        console.error('[WorksheetStorage] Fetch timed out after 10s');
      } else {
        console.error('[WorksheetStorage] Fetch error:', fetchErr);
      }
      return;
    }

    console.log('[WorksheetStorage] Syncing worksheets from Supabase, found:', data?.length || 0);

    const remoteRows = data || [];
    const remoteIds = new Set(remoteRows.map(w => w.id));

    // Detect remote deletions: was synced before, now missing on server
    const remoteDeletions = [...supabaseWorksheetIds].filter(id => !remoteIds.has(id));
    for (const id of remoteDeletions) {
      if (!deletedWorksheetIds.has(id)) {
        localStorage.removeItem(`${WORKSHEET_PREFIX}${id}`);
      }
    }

    const remoteList: WorksheetListItem[] = [];
    for (const row of remoteRows) {
      // If locally deleted, skip adding to local and try to delete remotely later
      if (deletedWorksheetIds.has(row.id)) continue;

      // Save full content for editor
      // NOTE: Supabase stores only a subset of Worksheet fields (name/content/pdf_settings/etc).
      // We hydrate missing fields with safe defaults.
      const full: Worksheet = {
        id: row.id,
        title: row.name || 'Nový pracovní list',
        description: '',
        blocks: row.content || [],
        metadata: {
          subject: row.worksheet_type || 'other',
          grade: 6,
        },
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
        status: 'draft',
      } as Worksheet;
      // Preserve PDF settings (not part of Worksheet type in all places, but used by editor/storage)
      (full as any).pdfSettings = row.pdf_settings || {};
      localStorage.setItem(`${WORKSHEET_PREFIX}${row.id}`, JSON.stringify(full));

      remoteList.push({
        id: row.id,
        title: row.name,
        subject: row.worksheet_type || 'other',
        grade: 6,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        blocksCount: (row.content?.length || 0),
        folderId: row.folder_id,
      });
    }

    // New local worksheets are those not previously synced and not currently on server
    const localList = getWorksheetList();
    const newLocal = localList.filter(w => !supabaseWorksheetIds.has(w.id) && !remoteIds.has(w.id) && !deletedWorksheetIds.has(w.id));

    const merged = [...remoteList, ...newLocal];
    localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(merged));

    // Update synced IDs from server
    supabaseWorksheetIds = new Set(remoteList.map(w => w.id));
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseWorksheetIds]));
    notifyWorksheetChange();

    // Retry remote deletes
    const stillOnServerButDeleted = [...deletedWorksheetIds].filter(id => remoteIds.has(id));
    if (stillOnServerButDeleted.length > 0) {
      for (const id of stillOnServerButDeleted) {
        // Ensure tombstone exists (best-effort)
        void recordTeacherTombstone(userId, authToken, 'worksheet', id);
        fetch(`${SUPABASE_URL}/rest/v1/teacher_worksheets?id=eq.${id}&teacher_id=eq.${userId}`, {
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
                deletedWorksheetIds.delete(id);
                localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedWorksheetIds]));
              } else {
                console.warn('[WorksheetStorage] Retry delete returned ok but deleted 0 rows (keeping tombstone):', id);
              }
            }).catch(() => {});
          }
          return;
        });
      }
    }

    // Upload new local worksheets (fire & forget)
    // CRITICAL: Also filter out items that exist in server tombstones (prevents zombie resurrection!)
    if (newLocal.length > 0) {
      const safeNewLocal = newLocal.filter(w => !tombstoned.includes(w.id));
      const blockedByTombstone = newLocal.length - safeNewLocal.length;
      
      if (blockedByTombstone > 0) {
        console.log('[WorksheetStorage] ⛔ Blocked', blockedByTombstone, 'local worksheets from uploading (server tombstone exists)');
        // Clean up tombstoned items from localStorage
        for (const item of newLocal) {
          if (tombstoned.includes(item.id)) {
            console.log('[WorksheetStorage] Cleaning tombstoned worksheet from localStorage:', item.id);
            localStorage.removeItem(`${WORKSHEET_PREFIX}${item.id}`);
            deletedWorksheetIds.add(item.id);
          }
        }
        localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedWorksheetIds]));
        
        // Update the list without tombstoned items
        const cleanedList = getWorksheetList().filter(w => !tombstoned.includes(w.id));
        localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(cleanedList));
      }
      
      for (const item of safeNewLocal) {
        const w = getWorksheet(item.id);
        if (w) saveWorksheet(w);
      }
    }
  } catch (error) {
    console.error('[WorksheetStorage] Sync error:', error);
  }
}

/**
 * Migrate localStorage data to Supabase
 */
export async function migrateToSupabase(): Promise<{ success: boolean; migrated: number }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, migrated: 0 };

    const worksheets = getWorksheetList();
    let migrated = 0;

    for (const wsMeta of worksheets) {
      const worksheet = getWorksheet(wsMeta.id);
      if (!worksheet) continue;

      const { error } = await supabase
        .from('teacher_worksheets')
        .upsert({
          id: worksheet.id,
          teacher_id: userId,
          name: worksheet.title || 'Nový pracovní list',
          worksheet_type: worksheet.metadata?.subject,
          content: worksheet.blocks,
          pdf_settings: (worksheet as any).pdfSettings,
          folder_id: wsMeta.folderId,
          created_at: wsMeta.createdAt,
          updated_at: wsMeta.updatedAt || new Date().toISOString(),
        }, { onConflict: 'id' });

      if (!error) migrated++;
    }

    console.log(`[WorksheetStorage] Migrated ${migrated} worksheets to Supabase`);
    return { success: true, migrated };
  } catch (error) {
    console.error('[WorksheetStorage] Migration error:', error);
    return { success: false, migrated: 0 };
  }
}
