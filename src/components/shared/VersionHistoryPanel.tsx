/**
 * VersionHistoryPanel
 * 
 * Reusable UI component for displaying document version history.
 * Can be used as a sidebar panel or modal in any editor.
 * 
 * Features:
 * - Version list with timestamps
 * - Preview before restore
 * - Manual save with description
 * - Infinite scroll for loading more versions
 */

import React, { useState, useCallback } from 'react';
import {
  History,
  Clock,
  User,
  RotateCcw,
  Save,
  ChevronDown,
  X,
  Check,
  AlertCircle,
  Loader2,
  FileText,
  Eye,
  ArrowUpDown,
} from 'lucide-react';
import {
  DocumentVersion,
  ChangeType,
  formatVersionDate,
  getChangeTypeLabel,
} from '../../utils/document-versions';

// ============================================
// TYPES
// ============================================

export interface VersionHistoryPanelProps {
  /** List of versions to display */
  versions: DocumentVersion[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Total number of versions */
  totalVersions: number;
  /** Whether there are more versions to load */
  hasMoreVersions: boolean;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether auto-save is pending */
  autoSavePending: boolean;
  /** Current version (if any) */
  currentVersion?: DocumentVersion | null;
  /** Callback to save manual version */
  onSaveManual: (description?: string) => Promise<boolean>;
  /** Callback to restore a version */
  onRestore: (versionId: string) => Promise<boolean>;
  /** Callback to load more versions */
  onLoadMore: () => Promise<void>;
  /** Callback to preview a version */
  onPreview?: (version: DocumentVersion) => void;
  /** Callback when panel is closed */
  onClose?: () => void;
  /** Whether the panel is in compact mode */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================
// SUB-COMPONENTS
// ============================================

function ChangeTypeBadge({ type }: { type: ChangeType }) {
  const colors: Record<ChangeType, { bg: string; text: string }> = {
    auto: { bg: 'bg-slate-100', text: 'text-slate-600' },
    manual: { bg: 'bg-blue-100', text: 'text-blue-700' },
    structural: { bg: 'bg-amber-100', text: 'text-amber-700' },
    restore: { bg: 'bg-purple-100', text: 'text-purple-700' },
  };

  const style = colors[type] || colors.auto;

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
      {getChangeTypeLabel(type)}
    </span>
  );
}

function VersionItem({
  version,
  isLatest,
  onRestore,
  onPreview,
  restoring,
}: {
  version: DocumentVersion;
  isLatest: boolean;
  onRestore: () => void;
  onPreview?: () => void;
  restoring: boolean;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`group relative p-3 rounded-lg border transition-all ${
        isLatest
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-800 text-sm">
              Verze {version.version_number}
            </span>
            {isLatest && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                Aktuální
              </span>
            )}
            <ChangeTypeBadge type={version.change_type as ChangeType} />
          </div>
          
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            <span>{formatVersionDate(version.created_at)}</span>
            {version.created_by_name && (
              <>
                <span>•</span>
                <User className="w-3 h-3" />
                <span>{version.created_by_name}</span>
              </>
            )}
          </div>

          {version.change_description && (
            <p className="mt-1.5 text-xs text-slate-600 italic">
              "{version.change_description}"
            </p>
          )}
        </div>

        {/* Size indicator */}
        <div className="text-xs text-slate-400 whitespace-nowrap">
          {formatSize(version.content_size)}
        </div>
      </div>

      {/* Actions */}
      {showActions && !isLatest && (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {onPreview && (
            <button
              onClick={onPreview}
              className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              title="Náhled"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onRestore}
            disabled={restoring}
            className="p-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors disabled:opacity-50"
            title="Obnovit tuto verzi"
          >
            {restoring ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function ManualSaveForm({
  onSave,
  saving,
}: {
  onSave: (description: string) => void;
  saving: boolean;
}) {
  const [description, setDescription] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(description);
    setDescription('');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{ 
          backgroundColor: '#2563eb', 
          color: 'white',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 500,
          border: 'none',
          cursor: 'pointer',
        }}
        className="hover:opacity-90 transition-opacity"
      >
        <Save className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
        <span>Uložit verzi</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Popis změny (volitelné)..."
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoFocus
      />
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={saving}
          style={{ 
            backgroundColor: '#2563eb', 
            color: 'white',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            opacity: saving ? 0.5 : 1,
          }}
          className="hover:opacity-90 transition-opacity"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>Uložit verzi</span>
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="w-full px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors text-sm text-center"
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}

// ============================================
// UTILITIES
// ============================================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function VersionHistoryPanel({
  versions,
  loading,
  error,
  totalVersions,
  hasMoreVersions,
  hasUnsavedChanges,
  autoSavePending,
  currentVersion,
  onSaveManual,
  onRestore,
  onLoadMore,
  onPreview,
  onClose,
  compact = false,
  className = '',
}: VersionHistoryPanelProps) {
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const handleRestore = useCallback(async (versionId: string) => {
    setRestoringId(versionId);
    try {
      await onRestore(versionId);
    } finally {
      setRestoringId(null);
    }
  }, [onRestore]);

  const handleSaveManual = useCallback(async (description: string) => {
    console.log('[VersionHistoryPanel] handleSaveManual called with:', description);
    setSaving(true);
    try {
      const result = await onSaveManual(description);
      console.log('[VersionHistoryPanel] Save result:', result);
    } catch (err) {
      console.error('[VersionHistoryPanel] Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [onSaveManual]);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setLoadingMore(false);
    }
  }, [onLoadMore]);

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-800">Historie verzí</h3>
          {totalVersions > 0 && (
            <span className="text-xs text-slate-500">({totalVersions})</span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status bar */}
      {(hasUnsavedChanges || autoSavePending) && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            {autoSavePending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Automatické ukládání...</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" />
                <span>Máte neuložené změny</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Manual save */}
      <div className="px-4 py-3 border-b border-slate-100">
        <ManualSaveForm onSave={handleSaveManual} saving={saving} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <div className="flex flex-col gap-2 text-red-700 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            {error.includes('neexistuje') && (
              <p className="text-xs text-red-600 ml-6">
                Spusťte SQL migraci v Supabase: <code className="bg-red-100 px-1 rounded">supabase/migrations/20241221_document_versions.sql</code>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading && versions.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">Zatím žádné uložené verze</p>
            <p className="text-slate-400 text-xs mt-1">
              Verze se ukládají automaticky při editaci
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {versions.map((version, index) => (
              <VersionItem
                key={version.id}
                version={version}
                isLatest={index === 0}
                onRestore={() => handleRestore(version.id)}
                onPreview={onPreview ? () => onPreview(version) : undefined}
                restoring={restoringId === version.id}
              />
            ))}

            {/* Load more */}
            {hasMoreVersions && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Načíst starší verze
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer info */}
      {!compact && versions.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            Verze se ukládají automaticky a uchovávají se po dobu 90 dnů
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================
// EXPORTS
// ============================================

export default VersionHistoryPanel;

