/**
 * Teacher tombstones (server-side deletes)
 *
 * Goal: prevent "zombie" items across browsers/tabs.
 * - On delete: write a tombstone row (best-effort), then attempt real DELETE
 * - On sync: pull tombstones and apply them locally BEFORE merging remote rows
 *
 * This file uses direct REST calls to Supabase for reliability.
 */

export type TeacherItemType = 'quiz' | 'document' | 'worksheet' | 'file' | 'link' | 'folder';

export interface TeacherTombstoneRow {
  item_type: TeacherItemType;
  item_id: string;
  deleted_at: string;
  client_id?: string | null;
}

// Supabase config for direct fetch calls (kept consistent with storage modules)
const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

const CLIENT_ID_KEY = 'vivid-client-id';

export function getClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const created = (globalThis.crypto?.randomUUID?.() || `client-${Date.now()}-${Math.random().toString(16).slice(2)}`) as string;
    localStorage.setItem(CLIENT_ID_KEY, created);
    return created;
  } catch {
    return `client-${Date.now()}`;
  }
}

type Cache = { userId: string; fetchedAt: number; rows: TeacherTombstoneRow[] };
let cache: Cache | null = null;

export async function fetchTeacherTombstones(userId: string, accessToken: string): Promise<TeacherTombstoneRow[]> {
  console.log('[Tombstones] fetchTeacherTombstones called for user:', userId);
  
  // Small TTL to avoid 6 identical calls during App sync
  if (cache && cache.userId === userId && Date.now() - cache.fetchedAt < 5000) {
    console.log('[Tombstones] Using cached tombstones:', cache.rows.length);
    return cache.rows;
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_deleted_items?teacher_id=eq.${userId}&select=item_type,item_id,deleted_at,client_id&order=deleted_at.asc`,
      {
        method: 'GET',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[Tombstones] Fetch response status:', res.status);

    if (res.status === 404) {
      // Table not deployed yet
      console.warn('[Tombstones] ⚠️ Table teacher_deleted_items does not exist (404)');
      cache = { userId, fetchedAt: Date.now(), rows: [] };
      return [];
    }

    if (!res.ok) {
      // Don't break sync if this fails
      const txt = await res.text();
      console.warn('[Tombstones] Fetch failed:', res.status, txt);
      cache = { userId, fetchedAt: Date.now(), rows: [] };
      return [];
    }

    const rows = (await res.json()) as TeacherTombstoneRow[];
    console.log('[Tombstones] ✅ Fetched', rows?.length || 0, 'tombstones from server');
    cache = { userId, fetchedAt: Date.now(), rows };
    return rows || [];
  } catch (err: any) {
    console.warn('[Tombstones] Fetch error:', err?.message || err);
    cache = { userId, fetchedAt: Date.now(), rows: [] };
    return [];
  }
}

export async function recordTeacherTombstone(
  userId: string,
  accessToken: string,
  itemType: TeacherItemType,
  itemId: string
): Promise<void> {
  try {
    const body = {
      teacher_id: userId,
      item_type: itemType,
      item_id: itemId,
      deleted_at: new Date().toISOString(),
      client_id: getClientId(),
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/teacher_deleted_items?on_conflict=teacher_id,item_type,item_id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 404) return; // table not deployed
    if (!res.ok) {
      console.warn('[Tombstones] Record failed:', res.status, await res.text());
    } else {
      // Invalidate cache so next sync sees it
      cache = null;
    }
  } catch (err: any) {
    console.warn('[Tombstones] Record error:', err?.message || err);
  }
}

export async function clearTeacherTombstone(
  userId: string,
  accessToken: string,
  itemType: TeacherItemType,
  itemId: string
): Promise<void> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_deleted_items?teacher_id=eq.${userId}&item_type=eq.${itemType}&item_id=eq.${itemId}`,
      {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
      }
    );
    if (res.status === 404) return;
    if (!res.ok) {
      // not fatal
      console.warn('[Tombstones] Clear failed:', res.status, await res.text());
    } else {
      cache = null;
    }
  } catch (err: any) {
    console.warn('[Tombstones] Clear error:', err?.message || err);
  }
}




