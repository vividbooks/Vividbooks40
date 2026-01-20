/**
 * Link Storage Utilities
 * Helper functions for migrating links to Supabase
 * 
 * V2: Používá sync-queue pro spolehlivou synchronizaci
 */

import { supabase } from './supabase/client';
import { StoredLink } from '../types/file-storage';
import { detectLinkType } from './link-detector';
import { fetchTeacherTombstones } from './sync/teacher-tombstones';
import { queueUpsert, queueDelete } from './sync/sync-queue';

const LINKS_KEY = 'vivid-my-links';
const SUPABASE_IDS_KEY = 'vivid-links-supabase-ids';
const DELETED_IDS_KEY = 'vivid-links-deleted-ids';

// Supabase config for direct fetch calls
const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

// Track which IDs are from Supabase
let supabaseLinkIds = new Set<string>();
// Track which IDs were deleted locally (pending remote delete)
let deletedLinkIds = new Set<string>();

// Load IDs from localStorage on init
try {
  const stored = localStorage.getItem(SUPABASE_IDS_KEY);
  if (stored) supabaseLinkIds = new Set(JSON.parse(stored));
  const deletedStored = localStorage.getItem(DELETED_IDS_KEY);
  if (deletedStored) deletedLinkIds = new Set(JSON.parse(deletedStored));
} catch { /* ignore */ }

export type SyncStatus = 'supabase' | 'pending' | 'local';

/**
 * Get sync status for a link
 */
export function getLinkSyncStatus(id: string): SyncStatus {
  const existsInSupabase = supabaseLinkIds.has(id);
  if (existsInSupabase) return 'supabase';
  return 'local';
}

/**
 * Get debug info for a link
 */
export function getLinkDebugInfo(id: string): string {
  const links = getLinks();
  const link = links.find(l => l.id === id);
  
  return JSON.stringify({
    id,
    syncStatus: getLinkSyncStatus(id),
    inSupabaseIds: supabaseLinkIds.has(id),
    supabaseIdsCount: supabaseLinkIds.size,
    existsInList: !!link,
    linkData: link || null,
  }, null, 2);
}

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

/**
 * Migrate localStorage links to Supabase
 */
export async function migrateLinksToSupabase(): Promise<{ success: boolean; migrated: number }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, migrated: 0 };

    const localLinks = localStorage.getItem(LINKS_KEY);
    if (!localLinks) return { success: true, migrated: 0 };

    const linksToMigrate = JSON.parse(localLinks) as StoredLink[];
    let migrated = 0;

    for (const link of linksToMigrate) {
      const { error } = await supabase
        .from('teacher_links')
        .upsert({
          id: link.id,
          teacher_id: userId,
          title: link.title,
          url: link.url,
          description: link.description || null,
          thumbnail_url: link.thumbnailUrl || null,
          folder_id: link.folderId || null,
          transcript: link.extractedText || null,
        }, { onConflict: 'id' });

      if (!error) migrated++;
    }

    console.log(`[LinkStorage] Migrated ${migrated} links to Supabase`);
    return { success: true, migrated };
  } catch (err) {
    console.error('[LinkStorage] Migration error:', err);
    return { success: false, migrated: 0 };
  }
}

function notifyLinkChange(): void {
  window.dispatchEvent(new CustomEvent('links-updated'));
}

/**
 * Get links from localStorage
 */
export function getLinks(): StoredLink[] {
  try {
    const data = localStorage.getItem(LINKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function deleteLink(id: string): void {
  try {
    const list = getLinks().filter(l => l.id !== id);
    localStorage.setItem(LINKS_KEY, JSON.stringify(list));
    
    // Track as deleted locally
    deletedLinkIds.add(id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedLinkIds]));
    
    // Remove from supabase IDs
    supabaseLinkIds.delete(id);
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...supabaseLinkIds]));
    
    notifyLinkChange();
    
    // Queue for server delete
    queueDelete('teacher_links', id);
    
    console.log('[LinkStorage] Queued link for deletion:', id);
  } catch (err) {
    console.error('[LinkStorage] Local delete error:', err);
  }
}

export function saveLink(link: StoredLink): void {
  try {
    const list = getLinks();
    const idx = list.findIndex(l => l.id === link.id);
    const next = idx >= 0 ? list.map(l => (l.id === link.id ? link : l)) : [link, ...list];
    localStorage.setItem(LINKS_KEY, JSON.stringify(next));

    // If this link was previously deleted locally, unmark it
    if (deletedLinkIds.has(link.id)) {
      deletedLinkIds.delete(link.id);
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedLinkIds]));
    }

    notifyLinkChange();

    // Queue for sync
    queueUpsert('teacher_links', link.id, {
      title: link.title,
      url: link.url,
      description: link.description || null,
      thumbnail_url: link.thumbnailUrl || null,
      folder_id: link.folderId || null,
      transcript: link.extractedText || null,
      created_at: link.createdAt || new Date().toISOString(),
    });

    console.log('[LinkStorage] Queued link for sync:', link.id);
  } catch (err) {
    console.error('[LinkStorage] Local save error:', err);
  }
}

/**
 * Sync links from Supabase to localStorage
 * HARD SYNC: Supabase je source of truth
 * @param passedUserId - Optional user ID to use directly (avoids calling getUser which can timeout)
 */
export async function syncLinksFromSupabase(passedUserId?: string, accessToken?: string): Promise<void> {
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
      console.warn('[LinkStorage] No access token available for sync; skipping');
      return;
    }

    // Apply server tombstones first
    const tombstones = await fetchTeacherTombstones(userId, authToken);
    const tombstoned = tombstones.filter(t => t.item_type === 'link').map(t => t.item_id);
    if (tombstoned.length > 0) {
      let changed = false;
      for (const tid of tombstoned) {
        if (!deletedLinkIds.has(tid)) {
          deletedLinkIds.add(tid);
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedLinkIds]));
      }
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let data: any[] = [];
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/teacher_links?teacher_id=eq.${userId}&select=*&order=created_at.desc`,
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
        console.error('[LinkStorage] Error syncing from Supabase:', response.status);
        return;
      }
      data = await response.json();
      console.log('[LinkStorage] Direct fetch success, got', data?.length || 0, 'links');
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        console.error('[LinkStorage] Fetch timed out after 10s');
      } else {
        console.error('[LinkStorage] Fetch error:', fetchErr);
      }
      return;
    }

    const remoteRows: any[] = data || [];
    const remoteIds = new Set(remoteRows.map(r => r.id));

    const remoteLinks: StoredLink[] = [];
    const deleteRetry: string[] = [];

    for (const row of remoteRows) {
      if (deletedLinkIds.has(row.id)) {
        deleteRetry.push(row.id);
        continue;
      }
      remoteLinks.push({
        id: row.id,
        url: row.url,
        title: row.title,
        userId: userId,
        linkType: detectLinkType(row.url).type,
        icon: detectLinkType(row.url).icon,
        color: detectLinkType(row.url).color,
        bgColor: detectLinkType(row.url).bgColor,
        domain: detectLinkType(row.url).domain,
        description: row.description,
        thumbnailUrl: row.thumbnail_url,
        folderId: row.folder_id,
        createdAt: row.created_at,
        extractedText: row.transcript,
      });
    }

    // New local links: never synced before and not on server
    const localLinks = getLinks();
    const newLocal = localLinks.filter(l => !supabaseLinkIds.has(l.id) && !remoteIds.has(l.id) && !deletedLinkIds.has(l.id));
    
    // CRITICAL: Also filter out items that exist in server tombstones (prevents zombie resurrection!)
    const safeNewLocal = newLocal.filter(l => !tombstoned.includes(l.id));
    const blockedByTombstone = newLocal.length - safeNewLocal.length;
    
    if (blockedByTombstone > 0) {
      console.log('[LinkStorage] ⛔ Blocked', blockedByTombstone, 'local links from merging (server tombstone exists)');
      // Add to deleted set to prevent future attempts
      for (const link of newLocal) {
        if (tombstoned.includes(link.id)) {
          console.log('[LinkStorage] Cleaning tombstoned link from localStorage:', link.id);
          deletedLinkIds.add(link.id);
        }
      }
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedLinkIds]));
    }

    const merged = [...remoteLinks, ...safeNewLocal];
    localStorage.setItem(LINKS_KEY, JSON.stringify(merged));
    
    // Track which IDs are from Supabase
    const newIds = new Set(remoteLinks.map(l => l.id));
    supabaseLinkIds = newIds;
    localStorage.setItem(SUPABASE_IDS_KEY, JSON.stringify([...newIds]));
    
    console.log(`[LinkStorage] Synced ${remoteLinks.length} links from Supabase, kept ${newLocal.length} new local`);
    notifyLinkChange();

    // Retry deletes (fire & forget)
    for (const id of deleteRetry) {
      // Ensure tombstone exists (best-effort)
      void recordTeacherTombstone(userId, authToken, 'link', id);
      fetch(`${SUPABASE_URL}/rest/v1/teacher_links?id=eq.${id}&teacher_id=eq.${userId}`, {
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
              deletedLinkIds.delete(id);
              localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedLinkIds]));
            } else {
              console.warn('[LinkStorage] Retry delete returned ok but deleted 0 rows (keeping tombstone):', id);
            }
          }).catch(() => {});
        }
        return;
      });
    }
  } catch (err) {
    console.error('[LinkStorage] Sync error:', err);
  }
}


