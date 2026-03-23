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
  /** Dark chrome for embedding in PRO sidebar (#1e293b) */
  appearance?: 'light' | 'dark';
  /** Custom class name */
  className?: string;
}

// ============================================
// SUB-COMPONENTS
// ============================================

function ChangeTypeBadge({ type, dark }: { type: ChangeType; dark?: boolean }) {
  const colors: Record<ChangeType, { bg: string; text: string }> = dark
    ? {
        auto: { bg: 'bg-slate-700/80', text: 'text-slate-200' },
        manual: { bg: 'bg-blue-900/60', text: 'text-blue-200' },
        structural: { bg: 'bg-amber-900/50', text: 'text-amber-200' },
        restore: { bg: 'bg-purple-900/50', text: 'text-purple-200' },
      }
    : {
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
  dark,
}: {
  version: DocumentVersion;
  isLatest: boolean;
  onRestore: () => void;
  onPreview?: () => void;
  restoring: boolean;
  dark?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);

  const cardClass = dark
    ? isLatest
      ? 'bg-emerald-950/35 border-emerald-800/80'
      : 'bg-slate-800/60 border-slate-600 hover:border-slate-500 hover:bg-slate-800'
    : isLatest
      ? 'bg-green-50 border-green-200'
      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50';

  const titleClass = dark ? 'text-slate-100' : 'text-slate-800';
  const latestBadge = dark
    ? 'text-xs px-1.5 py-0.5 rounded bg-emerald-900/70 text-emerald-200'
    : 'text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700';
  const metaClass = dark ? 'text-slate-400' : 'text-slate-500';
  const descClass = dark ? 'text-slate-300' : 'text-slate-600';
  const sizeClass = dark ? 'text-slate-500' : 'text-slate-400';
  const previewBtn = dark
    ? 'p-1.5 rounded-md bg-slate-700 border border-slate-500 text-slate-200 hover:bg-slate-600'
    : 'p-1.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors';
  const restoreBtn = dark
    ? 'p-1.5 rounded-md bg-blue-950/80 border border-blue-700 text-blue-300 hover:bg-blue-900/80'
    : 'p-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors disabled:opacity-50';

  return (
    <div
      className={`group relative p-3 rounded-lg border transition-all ${cardClass}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-sm ${titleClass}`}>
              Verze {version.version_number}
            </span>
            {isLatest && (
              <span className={latestBadge}>
                Aktuální
              </span>
            )}
            <ChangeTypeBadge type={version.change_type as ChangeType} dark={dark} />
          </div>
          
          <div className={`flex items-center gap-2 mt-1 text-xs ${metaClass}`}>
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
            <p className={`mt-1.5 text-xs italic ${descClass}`}>
              "{version.change_description}"
            </p>
          )}
        </div>

        {/* Size indicator */}
        <div className={`text-xs whitespace-nowrap ${sizeClass}`}>
          {formatSize(version.content_size)}
        </div>
      </div>

      {/* Actions */}
      {showActions && !isLatest && (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {onPreview && (
            <button
              onClick={onPreview}
              className={previewBtn}
              title="Náhled"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onRestore}
            disabled={restoring}
            className={`${restoreBtn} disabled:opacity-50`}
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
  dark,
}: {
  onSave: (description: string) => void;
  saving: boolean;
  dark?: boolean;
}) {
  const [description, setDescription] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(description);
    setDescription('');
    setIsOpen(false);
  };

  const primaryBtn =
    'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium border-none cursor-pointer transition-opacity hover:opacity-90 bg-blue-600 text-white disabled:opacity-50';

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} className={primaryBtn}>
        <Save className="w-4 h-4 shrink-0" />
        <span>Uložit verzi</span>
      </button>
    );
  }

  const inputClass = dark
    ? 'w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
    : 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

  const cancelClass = dark
    ? 'w-full px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/80 transition-colors text-sm text-center'
    : 'w-full px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors text-sm text-center';

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Popis změny (volitelné)..."
        className={inputClass}
        autoFocus
      />
      <div className="flex flex-col gap-2">
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>Uložit verzi</span>
        </button>
        <button type="button" onClick={() => setIsOpen(false)} className={cancelClass}>
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
  appearance = 'light',
  className = '',
}: VersionHistoryPanelProps) {
  const dark = appearance === 'dark';
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

  const rootBg = dark ? 'bg-[#1e293b]' : 'bg-white';
  const headerBorder = dark ? 'border-slate-600' : 'border-slate-200';
  const headerIcon = dark ? 'text-slate-300' : 'text-slate-600';
  const headerTitle = dark ? 'text-slate-100' : 'text-slate-800';
  const headerMeta = dark ? 'text-slate-400' : 'text-slate-500';
  const closeBtn = dark
    ? 'p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700'
    : 'p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100';

  return (
    <div className={`flex flex-col h-full min-h-0 ${rootBg} ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${headerBorder}`}>
        <div className="flex items-center gap-2 min-w-0">
          <History className={`w-5 h-5 shrink-0 ${headerIcon}`} />
          <h3 className={`font-semibold truncate ${headerTitle}`}>Historie verzí</h3>
          {totalVersions > 0 && (
            <span className={`text-xs shrink-0 ${headerMeta}`}>({totalVersions})</span>
          )}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className={closeBtn} aria-label="Zavřít historii">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status bar */}
      {(hasUnsavedChanges || autoSavePending) && (
        <div
          className={
            dark
              ? 'px-4 py-2 bg-amber-950/50 border-b border-amber-800/60 shrink-0'
              : 'px-4 py-2 bg-amber-50 border-b border-amber-200 shrink-0'
          }
        >
          <div
            className={`flex items-center gap-2 text-sm ${dark ? 'text-amber-200' : 'text-amber-700'}`}
          >
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
      <div className={`px-4 py-3 border-b shrink-0 ${dark ? 'border-slate-600' : 'border-slate-100'}`}>
        <ManualSaveForm onSave={handleSaveManual} saving={saving} dark={dark} />
      </div>

      {/* Error */}
      {error && (
        <div
          className={
            dark
              ? 'px-4 py-3 bg-red-950/40 border-b border-red-900/60 shrink-0'
              : 'px-4 py-3 bg-red-50 border-b border-red-200 shrink-0'
          }
        >
          <div className={`flex flex-col gap-2 text-sm ${dark ? 'text-red-200' : 'text-red-700'}`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            {error.includes('neexistuje') && (
              <p className={`text-xs ml-6 ${dark ? 'text-red-300' : 'text-red-600'}`}>
                Spusťte SQL migraci v Supabase:{' '}
                <code className={dark ? 'bg-red-950/80 px-1 rounded' : 'bg-red-100 px-1 rounded'}>
                  supabase/migrations/20241221_document_versions.sql
                </code>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Version list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && versions.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`w-6 h-6 animate-spin ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <FileText className={`w-12 h-12 mb-3 ${dark ? 'text-slate-600' : 'text-slate-300'}`} />
            <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              Zatím žádné uložené verze
            </p>
            <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              Verze se ukládají automaticky při editaci (časovač po změně obsahu)
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
                dark={dark}
              />
            ))}

            {/* Load more */}
            {hasMoreVersions && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className={
                  dark
                    ? 'w-full flex items-center justify-center gap-2 py-3 text-sm text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors'
                    : 'w-full flex items-center justify-center gap-2 py-3 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors'
                }
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
        <div
          className={`px-4 py-2 border-t shrink-0 ${dark ? 'border-slate-600 bg-slate-900/40' : 'border-slate-100 bg-slate-50'}`}
        >
          <p className={`text-xs text-center ${dark ? 'text-slate-500' : 'text-slate-500'}`}>
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

