/**
 * Sync Queue - Centralized queue for all storage operations
 * 
 * Ensures:
 * - Operations are processed sequentially (no race conditions)
 * - Failed operations are retried with exponential backoff
 * - Server response is confirmed before updating local state
 * - Operations persist across page reloads
 */

import { supabase } from '../supabase/client';
import { recordTeacherTombstone, TeacherItemType } from './teacher-tombstones';

// Supabase config
const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

const QUEUE_KEY = 'vivid-sync-queue';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export type OperationType = 'upsert' | 'delete';
export type TableName = 'teacher_boards' | 'teacher_documents' | 'teacher_folders' | 'teacher_worksheets' | 'teacher_files' | 'teacher_links';

export interface QueuedOperation {
  id: string;
  type: OperationType;
  table: TableName;
  itemId: string;
  data?: Record<string, unknown>;
  retries: number;
  createdAt: string;
  lastAttempt?: string;
  error?: string;
}

// In-memory queue + processing state
let queue: QueuedOperation[] = [];
let isProcessing = false;
let processingPromise: Promise<void> | null = null;

// Load queue from localStorage - ALWAYS sync before operations
function loadQueue(): void {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        queue = parsed;
        console.log('[SyncQueue] Loaded', queue.length, 'items from localStorage');
      }
    }
  } catch (e) {
    console.error('[SyncQueue] Failed to load queue:', e);
    queue = [];
  }
}

// Save queue to localStorage
function saveQueue(): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    console.error('[SyncQueue] Failed to save queue to localStorage');
  }
}

// Initialize on module load
loadQueue();

// Also reload when window gets focus (in case another tab modified it)
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    loadQueue();
    if (queue.length > 0 && !isProcessing) {
      console.log('[SyncQueue] Window focused, processing', queue.length, 'pending items');
      processQueue();
    }
  });
}

/**
 * Get current access token with timeout
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), 2000)
    );
    const result = await Promise.race([sessionPromise, timeoutPromise]);
    if (result && 'data' in result) {
      return result.data.session?.access_token || null;
    }
  } catch (e) {
    console.warn('[SyncQueue] getAccessToken failed:', e);
  }
  return null;
}

/**
 * Get current user ID with timeout
 */
async function getUserId(): Promise<string | null> {
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), 2000)
    );
    const result = await Promise.race([sessionPromise, timeoutPromise]);
    if (result && 'data' in result) {
      return result.data.session?.user?.id || null;
    }
  } catch (e) {
    console.warn('[SyncQueue] getUserId failed:', e);
  }
  return null;
}

/**
 * Convert table name to tombstone item type
 */
function tableToItemType(table: TableName): TeacherItemType {
  const map: Record<TableName, TeacherItemType> = {
    'teacher_boards': 'quiz',
    'teacher_documents': 'document',
    'teacher_folders': 'folder',
    'teacher_worksheets': 'worksheet',
    'teacher_files': 'file',
    'teacher_links': 'link',
  };
  return map[table];
}

/**
 * Execute a single operation
 * Returns true if successful, false if should retry, throws if fatal error
 */
async function executeOperation(op: QueuedOperation, userId: string, token: string): Promise<boolean> {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  if (op.type === 'delete') {
    // Record tombstone first (best-effort)
    await recordTeacherTombstone(userId, token, tableToItemType(op.table), op.itemId);

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${op.table}?id=eq.${op.itemId}&teacher_id=eq.${userId}`,
      { method: 'DELETE', headers }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[SyncQueue] DELETE ${op.table}/${op.itemId} failed:`, res.status, errorText);
      return false;
    }

    // Verify at least 1 row was deleted
    try {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        console.log(`[SyncQueue] ✅ DELETE ${op.table}/${op.itemId} confirmed (${rows.length} rows)`);
        return true;
      } else {
        // 0 rows deleted - item might not exist on server, which is fine for delete
        console.log(`[SyncQueue] ✅ DELETE ${op.table}/${op.itemId} - 0 rows (item may not exist)`);
        return true;
      }
    } catch {
      // If response is empty, that's OK for delete
      return true;
    }
  }

  if (op.type === 'upsert') {
    if (!op.data) {
      console.error('[SyncQueue] UPSERT operation missing data');
      return true; // Don't retry, it's a bug
    }

    const recordData = {
      ...op.data,
      id: op.itemId,
      teacher_id: userId,
      updated_at: new Date().toISOString(),
    };

    // Try UPDATE first
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/${op.table}?id=eq.${op.itemId}&teacher_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(recordData),
      }
    );

    if (updateRes.ok) {
      const result = await updateRes.json();
      if (Array.isArray(result) && result.length > 0) {
        console.log(`[SyncQueue] ✅ UPDATE ${op.table}/${op.itemId} confirmed`);
        return true;
      }
    }

    // UPDATE didn't match - try INSERT
    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/${op.table}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...recordData,
          created_at: recordData.created_at || new Date().toISOString(),
        }),
      }
    );

    if (insertRes.ok) {
      console.log(`[SyncQueue] ✅ INSERT ${op.table}/${op.itemId} confirmed`);
      return true;
    }

    const errorText = await insertRes.text();
    
    // Handle duplicate key - item exists with different owner or race condition
    if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
      console.warn(`[SyncQueue] ⚠️ UPSERT ${op.table}/${op.itemId} - duplicate key, skipping`);
      return true; // Don't retry
    }

    console.error(`[SyncQueue] INSERT ${op.table}/${op.itemId} failed:`, insertRes.status, errorText);
    return false;
  }

  return true;
}

/**
 * Process the queue
 */
async function processQueue(): Promise<void> {
  if (isProcessing) {
    return processingPromise || Promise.resolve();
  }

  // Reload from localStorage to catch any items added by other code paths
  loadQueue();
  
  if (queue.length === 0) {
    return;
  }

  isProcessing = true;
  console.log('[SyncQueue] Starting to process', queue.length, 'items');
  
  processingPromise = (async () => {
    try {
      const userId = await getUserId();
      const token = await getAccessToken();

      if (!userId || !token) {
        console.log('[SyncQueue] No auth, skipping queue processing');
        return;
      }

      while (queue.length > 0) {
        const op = queue[0];
        
        // Check if we should retry (exponential backoff)
        if (op.lastAttempt && op.retries > 0) {
          const delay = BASE_DELAY_MS * Math.pow(2, op.retries - 1);
          const elapsed = Date.now() - new Date(op.lastAttempt).getTime();
          if (elapsed < delay) {
            // Not ready to retry yet, skip for now
            break;
          }
        }

        try {
          const success = await executeOperation(op, userId, token);
          
          if (success) {
            // Remove from queue
            queue.shift();
            saveQueue();
            notifyQueueChange();
          } else {
            // Retry
            op.retries++;
            op.lastAttempt = new Date().toISOString();
            
            if (op.retries >= MAX_RETRIES) {
              console.error(`[SyncQueue] ❌ ${op.type} ${op.table}/${op.itemId} failed after ${MAX_RETRIES} retries, giving up`);
              queue.shift();
            }
            
            saveQueue();
            break; // Wait before retrying
          }
        } catch (err: any) {
          console.error(`[SyncQueue] Exception processing ${op.type} ${op.table}/${op.itemId}:`, err?.message);
          op.retries++;
          op.lastAttempt = new Date().toISOString();
          op.error = err?.message;
          
          if (op.retries >= MAX_RETRIES) {
            queue.shift();
          }
          
          saveQueue();
          break;
        }
      }
    } finally {
      isProcessing = false;
      processingPromise = null;
    }
  })();

  return processingPromise;
}

/**
 * Notify listeners that queue changed
 */
function notifyQueueChange(): void {
  window.dispatchEvent(new CustomEvent('sync-queue-change', { detail: { pending: queue.length } }));
}

/**
 * Add an operation to the queue
 */
export function queueOperation(
  type: OperationType,
  table: TableName,
  itemId: string,
  data?: Record<string, unknown>
): void {
  // Remove any existing operation for the same item
  queue = queue.filter(op => !(op.table === table && op.itemId === itemId));

  const operation: QueuedOperation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    table,
    itemId,
    data,
    retries: 0,
    createdAt: new Date().toISOString(),
  };

  queue.push(operation);
  saveQueue();
  notifyQueueChange();

  // Process immediately
  processQueue();
}

/**
 * Queue an upsert operation
 */
export function queueUpsert(table: TableName, itemId: string, data: Record<string, unknown>): void {
  queueOperation('upsert', table, itemId, data);
}

/**
 * Queue a delete operation
 */
export function queueDelete(table: TableName, itemId: string): void {
  queueOperation('delete', table, itemId);
}

/**
 * Get pending operations count
 */
export function getPendingCount(): number {
  loadQueue(); // Always sync with localStorage
  return queue.length;
}

/**
 * Get all pending operations
 */
export function getPendingOperations(): QueuedOperation[] {
  loadQueue(); // Always sync with localStorage
  return [...queue];
}

/**
 * Force process queue (e.g., when coming online)
 */
export function forceProcessQueue(): Promise<void> {
  loadQueue(); // Always reload from localStorage first
  console.log('[SyncQueue] Force processing', queue.length, 'items');
  return processQueue();
}

/**
 * Clear all pending operations (use with caution!)
 */
export function clearQueue(): void {
  queue = [];
  saveQueue();
  notifyQueueChange();
}

// Auto-process queue periodically
setInterval(() => {
  if (queue.length > 0 && !isProcessing) {
    processQueue();
  }
}, 5000);

// Process queue when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncQueue] Online - processing queue');
    processQueue();
  });
}

