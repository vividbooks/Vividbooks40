/**
 * useVersionHistory Hook
 * 
 * React hook for managing document version history.
 * Provides automatic versioning with debouncing and manual save capabilities.
 * 
 * Usage:
 * ```tsx
 * const {
 *   versions,
 *   loading,
 *   saveVersion,
 *   restoreVersion,
 *   canUndo,
 *   canRedo,
 * } = useVersionHistory({
 *   documentId: 'my-doc-id',
 *   documentType: 'lesson',
 *   content: editorContent,
 *   title: documentTitle,
 * });
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DocumentVersion,
  DocumentType,
  ChangeType,
  UserType,
  saveVersion as saveVersionToDb,
  getVersionHistory,
  restoreVersion as restoreVersionFromDb,
  initVersionCache,
  clearVersionCache,
  shouldSaveVersion,
  hashContent,
} from '../utils/document-versions';

// ============================================
// TYPES
// ============================================

export interface UseVersionHistoryOptions {
  /** Document identifier (slug or UUID) */
  documentId: string;
  /** Type of document */
  documentType: DocumentType;
  /** Current document content */
  content: string;
  /** Current document title */
  title: string;
  /** Document category (optional) */
  category?: string;
  /** Current user ID */
  userId?: string;
  /** Current user type */
  userType?: UserType;
  /** Current user name for display */
  userName?: string;
  /** Enable auto-save (default: true) */
  autoSave?: boolean;
  /** Auto-save debounce delay in ms (default: 2000) */
  autoSaveDelay?: number;
  /** Callback when version is saved */
  onVersionSaved?: (version: DocumentVersion) => void;
  /** Callback when version is restored */
  onVersionRestored?: (version: DocumentVersion) => void;
  /** Whether the editor is in read-only mode */
  readOnly?: boolean;
}

export interface UseVersionHistoryReturn {
  /** List of versions (most recent first) */
  versions: DocumentVersion[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Total number of versions */
  totalVersions: number;
  /** Whether there's an unsaved change */
  hasUnsavedChanges: boolean;
  /** Last saved version */
  lastSavedVersion: DocumentVersion | null;
  /** Save a new version manually */
  saveManualVersion: (description?: string) => Promise<boolean>;
  /** Save version (auto or manual based on options) */
  saveVersion: (changeType?: ChangeType, description?: string) => Promise<boolean>;
  /** Restore to a specific version */
  restoreVersion: (versionId: string) => Promise<boolean>;
  /** Load more versions (pagination) */
  loadMoreVersions: () => Promise<void>;
  /** Refresh version list */
  refreshVersions: () => Promise<void>;
  /** Whether more versions can be loaded */
  hasMoreVersions: boolean;
  /** Whether auto-save is pending */
  autoSavePending: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_AUTO_SAVE_DELAY = 2000; // 2 seconds
const VERSIONS_PER_PAGE = 20;

// ============================================
// HOOK
// ============================================

export function useVersionHistory(options: UseVersionHistoryOptions): UseVersionHistoryReturn {
  const {
    documentId,
    documentType,
    content,
    title,
    category,
    userId,
    userType = 'teacher',
    userName,
    autoSave = true,
    autoSaveDelay = DEFAULT_AUTO_SAVE_DELAY,
    onVersionSaved,
    onVersionRestored,
    readOnly = false,
  } = options;

  // State
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalVersions, setTotalVersions] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedVersion, setLastSavedVersion] = useState<DocumentVersion | null>(null);
  const [autoSavePending, setAutoSavePending] = useState(false);

  // Refs
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentHashRef = useRef<string>('');
  const isInitializedRef = useRef(false);
  const offsetRef = useRef(0);

  // ==========================================
  // LOAD VERSIONS
  // ==========================================

  const loadVersions = useCallback(async (reset = true) => {
    if (!documentId || !documentType) {
      console.log('[useVersionHistory] loadVersions skipped - missing documentId or documentType');
      return;
    }

    console.log(`[useVersionHistory] loadVersions called for ${documentType}:${documentId}`);

    if (reset) {
      setLoading(true);
      offsetRef.current = 0;
    }

    try {
      const result = await getVersionHistory({
        documentId,
        documentType,
        limit: VERSIONS_PER_PAGE,
        offset: offsetRef.current,
      });

      console.log(`[useVersionHistory] getVersionHistory result:`, {
        error: result.error,
        versionsCount: result.versions.length,
        total: result.total,
      });

      if (result.error) {
        console.error('[useVersionHistory] Error loading versions:', result.error);
        setError(result.error);
        return;
      }

      if (reset) {
        setVersions(result.versions);
      } else {
        setVersions(prev => [...prev, ...result.versions]);
      }

      setTotalVersions(result.total);
      
      if (result.versions.length > 0 && reset) {
        setLastSavedVersion(result.versions[0]);
      }

      setError(null);
    } catch (err) {
      console.error('[useVersionHistory] Error loading versions:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [documentId, documentType]);

  const loadMoreVersions = useCallback(async () => {
    offsetRef.current += VERSIONS_PER_PAGE;
    await loadVersions(false);
  }, [loadVersions]);

  const refreshVersions = useCallback(async () => {
    await loadVersions(true);
  }, [loadVersions]);

  // ==========================================
  // SAVE VERSION
  // ==========================================

  const saveVersionInternal = useCallback(async (
    changeType: ChangeType = 'auto',
    description?: string
  ): Promise<boolean> => {
    if (readOnly || !documentId || !documentType) return false;

    // Check if content actually changed for auto-saves
    if (changeType === 'auto') {
      const currentHash = hashContent(content);
      if (currentHash === lastContentHashRef.current) {
        return true; // No change, skip
      }
      
      if (!shouldSaveVersion(documentId, documentType, content)) {
        return true; // Not enough change, skip
      }
    }

    try {
      const result = await saveVersionToDb({
        documentId,
        documentType,
        category,
        title,
        content,
        userId,
        userType,
        userName,
        changeType,
        changeDescription: description,
        force: changeType !== 'auto',
      });

      if (!result.success) {
        console.error('[useVersionHistory] Save failed:', result.error);
        setError(result.error || 'Failed to save version');
        return false;
      }

      if (result.skipped) {
        return true; // Skipped but not an error
      }

      if (result.version) {
        lastContentHashRef.current = hashContent(content);
        setLastSavedVersion(result.version);
        setHasUnsavedChanges(false);
        
        // Add to versions list
        setVersions(prev => [result.version!, ...prev]);
        setTotalVersions(prev => prev + 1);

        onVersionSaved?.(result.version);
      }

      return true;
    } catch (err) {
      console.error('[useVersionHistory] Save error:', err);
      setError(String(err));
      return false;
    }
  }, [
    readOnly, documentId, documentType, category, title, content,
    userId, userType, userName, onVersionSaved
  ]);

  const saveManualVersion = useCallback(async (description?: string): Promise<boolean> => {
    return saveVersionInternal('manual', description || 'Manuální uložení');
  }, [saveVersionInternal]);

  const saveVersion = useCallback(async (
    changeType?: ChangeType,
    description?: string
  ): Promise<boolean> => {
    return saveVersionInternal(changeType || 'auto', description);
  }, [saveVersionInternal]);

  // ==========================================
  // RESTORE VERSION
  // ==========================================

  const restoreVersion = useCallback(async (versionId: string): Promise<boolean> => {
    if (readOnly) return false;

    try {
      const result = await restoreVersionFromDb(versionId, userId, userType, userName);

      if (!result.success) {
        setError(result.error || 'Failed to restore version');
        return false;
      }

      if (result.newVersion) {
        lastContentHashRef.current = hashContent(result.newVersion.content);
        setLastSavedVersion(result.newVersion);
        setVersions(prev => [result.newVersion!, ...prev]);
        setTotalVersions(prev => prev + 1);

        onVersionRestored?.(result.newVersion);
      }

      return true;
    } catch (err) {
      console.error('[useVersionHistory] Restore error:', err);
      setError(String(err));
      return false;
    }
  }, [readOnly, userId, userType, userName, onVersionRestored]);

  // ==========================================
  // AUTO-SAVE EFFECT
  // ==========================================

  useEffect(() => {
    if (readOnly || !autoSave || !isInitializedRef.current) return;

    // Check for unsaved changes
    const currentHash = hashContent(content);
    if (currentHash !== lastContentHashRef.current) {
      setHasUnsavedChanges(true);
      setAutoSavePending(true);

      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new timer
      autoSaveTimerRef.current = setTimeout(async () => {
        await saveVersionInternal('auto');
        setAutoSavePending(false);
      }, autoSaveDelay);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, autoSave, autoSaveDelay, readOnly, saveVersionInternal]);

  // ==========================================
  // INITIALIZATION EFFECT
  // ==========================================

  useEffect(() => {
    if (!documentId || !documentType) return;

    // Initialize cache
    initVersionCache(documentId, documentType, content);
    lastContentHashRef.current = hashContent(content);
    isInitializedRef.current = true;

    // Load existing versions
    loadVersions(true);

    return () => {
      // Cleanup
      clearVersionCache(documentId, documentType);
      isInitializedRef.current = false;
      
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [documentId, documentType]);

  // Update hash when content changes from external source (e.g., restore)
  useEffect(() => {
    if (isInitializedRef.current && lastSavedVersion) {
      const savedHash = hashContent(lastSavedVersion.content);
      const currentHash = hashContent(content);
      
      if (savedHash === currentHash) {
        lastContentHashRef.current = currentHash;
        setHasUnsavedChanges(false);
      }
    }
  }, [content, lastSavedVersion]);

  // ==========================================
  // RETURN
  // ==========================================

  return {
    versions,
    loading,
    error,
    totalVersions,
    hasUnsavedChanges,
    lastSavedVersion,
    saveManualVersion,
    saveVersion,
    restoreVersion,
    loadMoreVersions,
    refreshVersions,
    hasMoreVersions: versions.length < totalVersions,
    autoSavePending,
  };
}

