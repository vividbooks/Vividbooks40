/**
 * Paste Warning Dialog
 * 
 * Shown when a student pastes more than 2 words of text.
 * Asks them to provide a source URL or acknowledge potential AI detection.
 */

import React, { useState } from 'react';
import { AlertTriangle, Link2, X, Check } from 'lucide-react';
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
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleConfirmWithSource = () => {
    onConfirm(sourceUrl.trim() || undefined);
  };

  const handleConfirmWithoutSource = () => {
    onConfirm(undefined);
  };

  const previewText = pastedText.length > 100 
    ? pastedText.substring(0, 100) + '...' 
    : pastedText;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Vkládáte větší množství textu
              </h2>
              <p className="text-sm text-white/80">
                {wordCount} slov detekováno
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Preview of pasted text */}
          <div className="bg-slate-50 rounded-lg p-3 mb-4 border border-slate-200">
            <p className="text-sm text-slate-600 italic line-clamp-3">
              "{previewText}"
            </p>
          </div>

          <p className="text-slate-700 mb-4">
            Uveďte prosím odkaz, odkud text kopírujete. Jinak bude učiteli 
            hlášeno podezření na <span className="font-medium text-amber-600">kopírování textu</span> nebo{' '}
            <span className="font-medium text-amber-600">použití umělé inteligence</span>.
          </p>

          {/* URL Input */}
          {showUrlInput ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Odkaz na zdroj
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    autoFocus
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Zadejte URL stránky, ze které jste text zkopírovali
              </p>
            </div>
          ) : (
            <button
              onClick={() => setShowUrlInput(true)}
              className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
            >
              <Link2 className="h-4 w-4" />
              <span>Mám zdroj - chci uvést odkaz</span>
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Zrušit vložení
          </button>
          
          {showUrlInput ? (
            <button
              onClick={handleConfirmWithSource}
              disabled={!sourceUrl.trim()}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Check className="h-4 w-4" />
              <span>Potvrdit se zdrojem</span>
            </button>
          ) : (
            <button
              onClick={handleConfirmWithoutSource}
              className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Pokračovat bez zdroje</span>
            </button>
          )}
        </div>

        {/* Warning footer */}
        {!showUrlInput && (
          <div className="bg-amber-50 border-t border-amber-200 px-6 py-3">
            <p className="text-xs text-amber-700 text-center">
              ⚠️ Pokračováním bez uvedení zdroje bude učitel informován o vložení textu
            </p>
          </div>
        )}
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

