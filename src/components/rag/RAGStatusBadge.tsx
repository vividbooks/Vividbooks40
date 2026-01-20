/**
 * RAGStatusBadge - Indikátor stavu indexace dokumentu v Gemini RAG
 */

import React from 'react';
import { Loader2, Check, AlertCircle, CloudOff, Cloud } from 'lucide-react';
import type { RAGStatus } from '../../hooks/useRAGSync';

interface RAGStatusBadgeProps {
  status: RAGStatus;
  indexedAt?: Date | null;
  error?: string | null;
  compact?: boolean;
}

const statusConfig: Record<RAGStatus, {
  icon: typeof Loader2;
  label: string;
  shortLabel: string;
  className: string;
  spin?: boolean;
}> = {
  none: {
    icon: CloudOff,
    label: 'Není v AI',
    shortLabel: '−',
    className: 'bg-slate-100 text-slate-500'
  },
  uploading: {
    icon: Loader2,
    label: 'Odesílám...',
    shortLabel: '...',
    className: 'bg-blue-100 text-blue-600',
    spin: true
  },
  indexing: {
    icon: Loader2,
    label: 'Indexuji...',
    shortLabel: '⏳',
    className: 'bg-amber-100 text-amber-600',
    spin: true
  },
  active: {
    icon: Check,
    label: 'Aktivní v AI',
    shortLabel: '✓',
    className: 'bg-green-100 text-green-600'
  },
  error: {
    icon: AlertCircle,
    label: 'Chyba',
    shortLabel: '!',
    className: 'bg-red-100 text-red-600'
  }
};

export function RAGStatusBadge({ status, indexedAt, error, compact = false }: RAGStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const tooltipText = error 
    ? `Chyba: ${error}` 
    : indexedAt 
      ? `Indexováno: ${indexedAt.toLocaleString('cs-CZ')}`
      : config.label;

  if (compact) {
    return (
      <div 
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${config.className}`}
        title={tooltipText}
      >
        {config.spin ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Icon className="w-3.5 h-3.5" />
        )}
      </div>
    );
  }

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}
      title={tooltipText}
    >
      <Icon className={`w-3.5 h-3.5 ${config.spin ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
    </div>
  );
}

/**
 * Varianta pro inline zobrazení v editoru
 */
export function RAGStatusIndicator({ status }: { status: RAGStatus }) {
  const config = statusConfig[status];
  
  return (
    <span 
      className={`inline-flex items-center gap-1 text-xs ${
        status === 'active' ? 'text-green-600' : 
        status === 'error' ? 'text-red-600' : 
        'text-slate-500'
      }`}
      title={config.label}
    >
      {status === 'active' && <Cloud className="w-3 h-3" />}
      {status === 'error' && <AlertCircle className="w-3 h-3" />}
      {(status === 'uploading' || status === 'indexing') && (
        <Loader2 className="w-3 h-3 animate-spin" />
      )}
    </span>
  );
}


