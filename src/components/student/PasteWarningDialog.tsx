/**
 * Paste Warning Dialog
 * 
 * Shown when a student pastes more than 2 words of text.
 * Asks them to provide a source URL or acknowledge potential AI detection.
 */

import React, { useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { PasteEvent } from '../../types/student-submission';

interface PasteWarningDialogProps {
  /** The text that was pasted */
  pastedText: string;
  /** Word count of pasted text */
  wordCount: number;
  /** Callback when user confirms with or without source */
  onConfirm: (sourceUrl: string | undefined) => void;
  /** Callback when user cancels (removes the pasted text) */
  onCancel: () => void;
}

export function PasteWarningDialog({
  pastedText,
  wordCount,
  onConfirm,
  onCancel,
}: PasteWarningDialogProps) {
  const [sourceUrl, setSourceUrl] = useState('');

  const handleConfirmWithSource = () => {
    onConfirm(sourceUrl.trim() || undefined);
  };

  const previewText = pastedText.length > 150 
    ? pastedText.substring(0, 150) + '...' 
    : pastedText;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pb-8 sm:items-center sm:pb-0 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 border border-slate-200">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-amber-800">
                Vkládáte větší množství textu
              </h2>
              <p className="text-sm text-amber-600">
                Detekováno {wordCount} slov
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Preview of pasted text */}
          <div className="mb-3">
            <p className="text-xs text-slate-500 mb-1">Náhled vloženého textu:</p>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200 line-clamp-2">
              {previewText}
            </p>
          </div>

          <p className="text-sm text-slate-600 mb-4">
            Uveďte prosím odkaz, odkud text kopírujete. Jinak máme podezření na kopírování textu nebo použití umělé inteligence.
          </p>

          {/* URL Input - always visible */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Zdroj textu (URL nebo popis)
            </label>
            <input
              type="text"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="např. https://wikipedia.org/... nebo 'vlastní poznámky'"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-sm"
              autoFocus
            />
            <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
              <span>💡</span> Učitel uvidí, zda jste uvedli zdroj u vloženého textu.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-medium text-sm"
          >
            Zrušit vložení
          </button>
          
          <button
            onClick={handleConfirmWithSource}
            className="flex-1 px-4 py-2.5 rounded-xl transition-colors font-medium text-sm flex items-center justify-center gap-2"
            style={{
              backgroundColor: sourceUrl.trim() ? '#16a34a' : '#f59e0b',
              color: 'white',
            }}
          >
            <Check className="h-4 w-4" />
            <span>{sourceUrl.trim() ? 'Potvrdit se zdrojem' : 'Pokračovat bez zdroje'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// HOOK FOR PASTE DETECTION
// =============================================

interface UsePasteDetectionOptions {
  /** Minimum word count to trigger warning (default: 3) */
  minWords?: number;
  /** Callback when a paste event is recorded */
  onPasteRecorded?: (event: PasteEvent) => void;
  /** Whether paste detection is enabled */
  enabled?: boolean;
}

interface PasteDetectionState {
  showWarning: boolean;
  pastedText: string;
  wordCount: number;
}

export function usePasteDetection(options: UsePasteDetectionOptions = {}) {
  const { minWords = 3, onPasteRecorded, enabled = true } = options;
  
  const [state, setState] = React.useState<PasteDetectionState>({
    showWarning: false,
    pastedText: '',
    wordCount: 0,
  });

  const pendingPasteRef = React.useRef<{
    text: string;
    element: HTMLElement | null;
    originalContent: string;
  } | null>(null);

  // Handle paste event
  const handlePaste = React.useCallback((e: ClipboardEvent) => {
    if (!enabled) return;

    const text = e.clipboardData?.getData('text/plain') || '';
    const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;

    if (wordCount > minWords) {
      // Store the paste info for later
      pendingPasteRef.current = {
        text,
        element: e.target as HTMLElement,
        originalContent: (e.target as HTMLElement)?.innerHTML || '',
      };

      // Show warning dialog
      setState({
        showWarning: true,
        pastedText: text,
        wordCount,
      });

      // Don't prevent default - let the paste happen, we'll undo if cancelled
    }
  }, [enabled, minWords]);

  // Handle user confirming the paste
  const handleConfirm = React.useCallback((sourceUrl: string | undefined) => {
    const pasteEvent: PasteEvent = {
      id: `paste-${Date.now()}`,
      timestamp: new Date().toISOString(),
      wordCount: state.wordCount,
      sourceUrl,
      dismissedWithoutSource: !sourceUrl,
      textPreview: state.pastedText.substring(0, 100),
    };

    onPasteRecorded?.(pasteEvent);

    setState({
      showWarning: false,
      pastedText: '',
      wordCount: 0,
    });
    pendingPasteRef.current = null;
  }, [state, onPasteRecorded]);

  // Handle user cancelling the paste
  const handleCancel = React.useCallback(() => {
    // Undo the paste by restoring original content
    if (pendingPasteRef.current?.element) {
      pendingPasteRef.current.element.innerHTML = pendingPasteRef.current.originalContent;
    }

    setState({
      showWarning: false,
      pastedText: '',
      wordCount: 0,
    });
    pendingPasteRef.current = null;
  }, []);

  // Attach paste listener
  React.useEffect(() => {
    if (!enabled) return;

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste, enabled]);

  return {
    showWarning: state.showWarning,
    pastedText: state.pastedText,
    wordCount: state.wordCount,
    handleConfirm,
    handleCancel,
  };
}

