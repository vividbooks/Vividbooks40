/**
 * Document Versions - Core Service
 * 
 * Unified version history system for all editor types:
 * - Documents (HTML)
 * - Worksheets (JSON)
 * - Quizzes/Vividboards (JSON)
 * - My Content
 * 
 * Features:
 * - Content hashing for duplicate detection
 * - Minimum diff threshold to avoid saving minor changes
 * - Support for both HTML and JSON content
 * - Automatic and manual versioning
 */

import { supabase } from './supabase/client';

// ============================================
// LOCAL STORAGE FALLBACK
// ============================================

const LOCAL_STORAGE_PREFIX = 'doc_versions_';
const MAX_LOCAL_VERSIONS = 20;

interface LocalVersionStore {
  versions: DocumentVersion[];
  lastUpdated: string;
}

function getLocalStorageKey(documentId: string, documentType: DocumentType): string {
  return `${LOCAL_STORAGE_PREFIX}${documentType}_${documentId}`;
}

function getLocalVersions(documentId: string, documentType: DocumentType): DocumentVersion[] {
  try {
    const key = getLocalStorageKey(documentId, documentType);
    const data = localStorage.getItem(key);
    if (data) {
      const store: LocalVersionStore = JSON.parse(data);
      return store.versions || [];
    }
  } catch (e) {
    console.warn('[DocumentVersions] Error reading local versions:', e);
  }
  return [];
}

function saveLocalVersion(documentId: string, documentType: DocumentType, version: DocumentVersion): void {
  try {
    const key = getLocalStorageKey(documentId, documentType);
    const versions = getLocalVersions(documentId, documentType);
    
    // Add new version at the beginning
    versions.unshift(version);
    
    // Keep only MAX_LOCAL_VERSIONS
    if (versions.length > MAX_LOCAL_VERSIONS) {
      versions.length = MAX_LOCAL_VERSIONS;
    }
    
    const store: LocalVersionStore = {
      versions,
      lastUpdated: new Date().toISOString(),
    };
    
    localStorage.setItem(key, JSON.stringify(store));
  } catch (e) {
    console.warn('[DocumentVersions] Error saving local version:', e);
  }
}

// Flag to track if Supabase is available
let supabaseAvailable = true;

// ============================================
// TYPES
// ============================================

export type DocumentType = 'lesson' | 'worksheet' | 'quiz' | 'my_content' | 'workbook';
export type ContentType = 'html' | 'json';
export type ChangeType = 'auto' | 'manual' | 'structural' | 'restore';
export type UserType = 'teacher' | 'student' | 'admin';

export interface DocumentVersion {
  id: string;
  document_id: string;
  document_type: DocumentType;
  category?: string;
  title: string;
  content: string;
  content_type: ContentType;
  version_number: number;
  content_hash: string;
  content_size: number;
  created_by?: string;
  created_by_type: UserType;
  created_by_name?: string;
  created_at: string;
  change_type: ChangeType;
  change_description?: string;
  metadata?: Record<string, any>;
}

export interface SaveVersionOptions {
  documentId: string;
  documentType: DocumentType;
  category?: string;
  title: string;
  content: string;
  contentType?: ContentType;
  userId?: string;
  userType?: UserType;
  userName?: string;
  changeType?: ChangeType;
  changeDescription?: string;
  metadata?: Record<string, any>;
  /** Force save even if content hasn't changed enough */
  force?: boolean;
}

export interface VersionHistoryOptions {
  documentId: string;
  documentType: DocumentType;
  limit?: number;
  offset?: number;
}

// ============================================
// CONSTANTS
// ============================================

/** Minimum character difference to trigger auto-save */
const MIN_DIFF_THRESHOLD = 10;

/** Minimum time between auto-saves in milliseconds */
const MIN_AUTO_SAVE_INTERVAL = 5000; // 5 seconds for better UX

/** Maximum versions to keep per document */
const MAX_VERSIONS_PER_DOCUMENT = 50;

// Last save timestamps per document
const lastSaveTimestamps: Map<string, number> = new Map();

// Last content hashes per document
const lastContentHashes: Map<string, string> = new Map();

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a simple hash of content for comparison
 * Using a simple hash function for browser compatibility
 */
export function hashContent(content: string): string {
  let hash = 0;
  if (content.length === 0) return hash.toString(16);
  
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to hex and pad to ensure consistent length
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Calculate the difference between two strings (approximate character count)
 */
export function calculateDiff(oldContent: string, newContent: string): number {
  if (!oldContent) return newContent.length;
  if (!newContent) return oldContent.length;
  
  // Simple length-based diff for performance
  const lengthDiff = Math.abs(newContent.length - oldContent.length);
  
  // If lengths are similar, check actual content difference
  if (lengthDiff < MIN_DIFF_THRESHOLD) {
    let diffCount = 0;
    const minLen = Math.min(oldContent.length, newContent.length);
    
    // Sample comparison for large documents
    const step = minLen > 10000 ? Math.floor(minLen / 1000) : 1;
    
    for (let i = 0; i < minLen; i += step) {
      if (oldContent[i] !== newContent[i]) {
        diffCount += step;
      }
    }
    
    return diffCount + lengthDiff;
  }
  
  return lengthDiff;
}

/**
 * Determine content type from document type
 */
export function getContentType(documentType: DocumentType): ContentType {
  switch (documentType) {
    case 'worksheet':
    case 'quiz':
    case 'workbook':
      return 'json';
    case 'lesson':
    case 'my_content':
    default:
      return 'html';
  }
}

/**
 * Generate document key for caching
 */
function getDocumentKey(documentId: string, documentType: DocumentType): string {
  return `${documentType}:${documentId}`;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Check if we should save a new version based on content changes and timing
 */
export function shouldSaveVersion(
  documentId: string,
  documentType: DocumentType,
  newContent: string,
  options?: { force?: boolean; changeType?: ChangeType }
): boolean {
  // Always save if forced
  if (options?.force) return true;
  
  // Always save structural changes
  if (options?.changeType === 'structural' || options?.changeType === 'manual') {
    return true;
  }
  
  const docKey = getDocumentKey(documentId, documentType);
  const now = Date.now();
  
  // Check time since last save
  const lastSave = lastSaveTimestamps.get(docKey);
  if (lastSave && (now - lastSave) < MIN_AUTO_SAVE_INTERVAL) {
    return false;
  }
  
  // Check content hash
  const newHash = hashContent(newContent);
  const lastHash = lastContentHashes.get(docKey);
  
  if (lastHash === newHash) {
    return false; // Content identical
  }
  
  return true;
}

/**
 * Save a new version of a document
 */
export async function saveVersion(options: SaveVersionOptions): Promise<{
  success: boolean;
  version?: DocumentVersion;
  error?: string;
  skipped?: boolean;
}> {
  const {
    documentId,
    documentType,
    category,
    title,
    content,
    contentType = getContentType(documentType),
    userId,
    userType = 'teacher',
    userName,
    changeType = 'auto',
    changeDescription,
    metadata,
    force = false,
  } = options;

  console.log(`[DocumentVersions] saveVersion called for ${documentType}:${documentId}, changeType: ${changeType}, force: ${force}`);

  // Check if we should save
  if (!force && changeType === 'auto') {
    if (!shouldSaveVersion(documentId, documentType, content, { changeType })) {
      console.log('[DocumentVersions] Skipping - shouldSaveVersion returned false');
      return { success: true, skipped: true };
    }
  }

  try {
    const contentHash = hashContent(content);
    const docKey = getDocumentKey(documentId, documentType);

    // Helper function with timeout for Supabase queries
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
          setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms)
        )
      ]);
    };

    // Get the next version number (with timeout)
    let versionNumber = 1;
    try {
      const { data: lastVersion, error: fetchError } = await withTimeout(
        supabase
          .from('document_versions')
          .select('version_number')
          .eq('document_id', documentId)
          .eq('document_type', documentType)
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle(),
        5000 // 5 second timeout
      );

      if (fetchError) {
        console.error('[DocumentVersions] Error fetching last version:', fetchError);
      }
      
      versionNumber = (lastVersion?.version_number || 0) + 1;
    } catch (timeoutError) {
      console.warn('[DocumentVersions] Timeout fetching last version, using timestamp-based version');
      versionNumber = Date.now(); // Use timestamp as fallback version number
    }

    // Check for duplicate content hash (skip if identical to last version)
    if (!force && changeType === 'auto') {
      try {
        const { data: duplicateCheck } = await withTimeout(
          supabase
            .from('document_versions')
            .select('id')
            .eq('document_id', documentId)
            .eq('document_type', documentType)
            .eq('content_hash', contentHash)
            .limit(1)
            .maybeSingle(),
          5000
        );

        if (duplicateCheck) {
          console.log('[DocumentVersions] Skipping duplicate content');
          return { success: true, skipped: true };
        }
      } catch (timeoutError) {
        console.warn('[DocumentVersions] Timeout checking duplicates, proceeding with save');
      }
    }

    // Insert new version
    console.log('[DocumentVersions] Inserting version...', { documentId, documentType, versionNumber });
    
    let data = null;
    let error = null;
    
    try {
      const result = await withTimeout(
        supabase
          .from('document_versions')
          .insert({
            document_id: documentId,
            document_type: documentType,
            category,
            title,
            content,
            content_type: contentType,
            version_number: versionNumber,
            content_hash: contentHash,
            content_size: content.length,
            created_by: userId,
            created_by_type: userType,
            created_by_name: userName,
            change_type: changeType,
            change_description: changeDescription,
            metadata,
          })
          .select()
          .single(),
        10000 // 10 second timeout for insert (larger payload)
      );
      data = result.data;
      error = result.error;
    } catch (timeoutError) {
      console.warn('[DocumentVersions] Insert timeout, falling back to localStorage');
      error = { message: 'Insert timeout' };
    }

    console.log('[DocumentVersions] Insert result:', { data: !!data, error: error?.message });

    if (error) {
      console.error('[DocumentVersions] Error saving version:', error);
      
      // Mark Supabase as unavailable and fall back to local storage
      supabaseAvailable = false;
      console.log('[DocumentVersions] Falling back to localStorage');
      
      // Create a local version
      const localVersion: DocumentVersion = {
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        document_id: documentId,
        document_type: documentType,
        category,
        title,
        content,
        content_type: contentType,
        version_number: versionNumber,
        content_hash: contentHash,
        content_size: content.length,
        created_by: userId,
        created_by_type: userType,
        created_by_name: userName,
        created_at: new Date().toISOString(),
        change_type: changeType,
        change_description: changeDescription,
        metadata,
      };
      
      saveLocalVersion(documentId, documentType, localVersion);
      
      // Update cache
      lastSaveTimestamps.set(docKey, Date.now());
      lastContentHashes.set(docKey, contentHash);
      
      console.log(`[DocumentVersions] Saved local version ${versionNumber} for ${documentType}:${documentId}`);
      
      return { success: true, version: localVersion };
    }

    // Update cache
    lastSaveTimestamps.set(docKey, Date.now());
    lastContentHashes.set(docKey, contentHash);

    console.log(`[DocumentVersions] Saved version ${versionNumber} for ${documentType}:${documentId}`);

    return { success: true, version: data };
  } catch (error) {
    console.error('[DocumentVersions] Unexpected error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get version history for a document
 */
export async function getVersionHistory(
  options: VersionHistoryOptions
): Promise<{
  versions: DocumentVersion[];
  total: number;
  error?: string;
}> {
  const { documentId, documentType, limit = 20, offset = 0 } = options;

  console.log(`[DocumentVersions] getVersionHistory for ${documentType}:${documentId}`);

  // If we know Supabase is unavailable, use local storage directly
  if (!supabaseAvailable) {
    console.log('[DocumentVersions] Using localStorage (Supabase unavailable)');
    const localVersions = getLocalVersions(documentId, documentType);
    const paginatedVersions = localVersions.slice(offset, offset + limit);
    return {
      versions: paginatedVersions,
      total: localVersions.length,
    };
  }

  try {
    // Get count
    const { count, error: countError } = await supabase
      .from('document_versions')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId)
      .eq('document_type', documentType);

    if (countError) {
      console.error('[DocumentVersions] Error counting versions:', countError);
      
      // Fall back to local storage on any error
      supabaseAvailable = false;
      console.log('[DocumentVersions] Falling back to localStorage');
      const localVersions = getLocalVersions(documentId, documentType);
      const paginatedVersions = localVersions.slice(offset, offset + limit);
      return {
        versions: paginatedVersions,
        total: localVersions.length,
      };
    }

    console.log('[DocumentVersions] Count result:', count);

    // Get versions
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .eq('document_type', documentType)
      .order('version_number', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[DocumentVersions] Error fetching versions:', error);
      
      // Fall back to local storage on any error
      supabaseAvailable = false;
      console.log('[DocumentVersions] Falling back to localStorage');
      const localVersions = getLocalVersions(documentId, documentType);
      const paginatedVersions = localVersions.slice(offset, offset + limit);
      return {
        versions: paginatedVersions,
        total: localVersions.length,
      };
    }

    console.log(`[DocumentVersions] Fetched ${data?.length || 0} versions, total: ${count}`);

    // Merge with any local versions that might exist
    const localVersions = getLocalVersions(documentId, documentType);
    const mergedVersions = [...(data || [])];
    
    // Add local versions that aren't in Supabase (by ID prefix)
    localVersions.forEach(localVer => {
      if (localVer.id.startsWith('local_')) {
        // Insert local version at the right position by version_number
        const insertIndex = mergedVersions.findIndex(v => v.version_number < localVer.version_number);
        if (insertIndex === -1) {
          mergedVersions.push(localVer);
        } else {
          mergedVersions.splice(insertIndex, 0, localVer);
        }
      }
    });

    return {
      versions: mergedVersions.slice(0, limit),
      total: (count || 0) + localVersions.filter(v => v.id.startsWith('local_')).length,
    };
  } catch (error) {
    console.error('[DocumentVersions] Unexpected error:', error);
    
    // Fall back to local storage
    supabaseAvailable = false;
    const localVersions = getLocalVersions(documentId, documentType);
    const paginatedVersions = localVersions.slice(offset, offset + limit);
    return {
      versions: paginatedVersions,
      total: localVersions.length,
    };
  }
}

/**
 * Get a specific version by ID
 */
export async function getVersion(versionId: string): Promise<{
  version?: DocumentVersion;
  error?: string;
}> {
  // Check if this is a local version
  if (versionId.startsWith('local_')) {
    // Search all local storage keys for this version
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(LOCAL_STORAGE_PREFIX)) {
          const data = localStorage.getItem(key);
          if (data) {
            const store: LocalVersionStore = JSON.parse(data);
            const version = store.versions.find(v => v.id === versionId);
            if (version) {
              return { version };
            }
          }
        }
      }
    } catch (e) {
      console.warn('[DocumentVersions] Error searching local versions:', e);
    }
    return { error: 'Local version not found' };
  }

  // Try Supabase
  try {
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (error) {
      console.error('[DocumentVersions] Error fetching version:', error);
      return { error: error.message };
    }

    return { version: data };
  } catch (error) {
    console.error('[DocumentVersions] Unexpected error:', error);
    return { error: String(error) };
  }
}

/**
 * Restore a document to a specific version
 * This creates a new version with change_type='restore'
 */
export async function restoreVersion(
  versionId: string,
  userId?: string,
  userType?: UserType,
  userName?: string
): Promise<{
  success: boolean;
  newVersion?: DocumentVersion;
  error?: string;
}> {
  try {
    // Get the version to restore
    const { version, error: fetchError } = await getVersion(versionId);

    if (fetchError || !version) {
      return { success: false, error: fetchError || 'Version not found' };
    }

    // Save as new version with restore type
    const result = await saveVersion({
      documentId: version.document_id,
      documentType: version.document_type as DocumentType,
      category: version.category,
      title: version.title,
      content: version.content,
      contentType: version.content_type as ContentType,
      userId,
      userType,
      userName,
      changeType: 'restore',
      changeDescription: `Obnoveno z verze ${version.version_number}`,
      force: true,
    });

    return {
      success: result.success,
      newVersion: result.version,
      error: result.error,
    };
  } catch (error) {
    console.error('[DocumentVersions] Unexpected error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Compare two versions and return a simple diff summary
 */
export function compareVersions(
  version1: DocumentVersion,
  version2: DocumentVersion
): {
  sizeChange: number;
  percentChange: number;
  isNewer: boolean;
} {
  const sizeChange = version2.content_size - version1.content_size;
  const percentChange = version1.content_size > 0
    ? Math.round((sizeChange / version1.content_size) * 100)
    : 100;

  return {
    sizeChange,
    percentChange,
    isNewer: new Date(version2.created_at) > new Date(version1.created_at),
  };
}

/**
 * Format version date for display
 */
export function formatVersionDate(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Právě teď';
  if (diffMins < 60) return `Před ${diffMins} min`;
  if (diffHours < 24) return `Před ${diffHours} hod`;
  if (diffDays < 7) return `Před ${diffDays} dny`;

  return d.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get change type label in Czech
 */
export function getChangeTypeLabel(changeType: ChangeType): string {
  switch (changeType) {
    case 'auto':
      return 'Automaticky';
    case 'manual':
      return 'Manuálně';
    case 'structural':
      return 'Strukturální změna';
    case 'restore':
      return 'Obnoveno';
    default:
      return changeType;
  }
}

/**
 * Clear version cache for a document
 */
export function clearVersionCache(documentId: string, documentType: DocumentType): void {
  const docKey = getDocumentKey(documentId, documentType);
  lastSaveTimestamps.delete(docKey);
  lastContentHashes.delete(docKey);
}

/**
 * Initialize version cache with current content
 */
export function initVersionCache(
  documentId: string,
  documentType: DocumentType,
  currentContent: string
): void {
  const docKey = getDocumentKey(documentId, documentType);
  lastContentHashes.set(docKey, hashContent(currentContent));
  lastSaveTimestamps.set(docKey, Date.now());
}

