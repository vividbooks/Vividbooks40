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

  const hasSource = sourceUrl.trim().length > 0;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div 
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '500px',
          width: 'calc(100% - 32px)',
          margin: '16px',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 999999,
        }}
      >
        {/* Header */}
        <div style={{
          backgroundColor: '#fef3c7',
          borderBottom: '1px solid #fcd34d',
          padding: '12px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle style={{ width: '20px', height: '20px', color: '#d97706', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <h2 style={{ 
                fontSize: '16px', 
                fontWeight: 600, 
                color: '#92400e',
                margin: 0,
              }}>
                Vkládáte větší množství textu
              </h2>
              <p style={{ 
                fontSize: '14px', 
                color: '#d97706',
                margin: '4px 0 0 0',
              }}>
                Detekováno {wordCount} slov
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {/* Preview of pasted text */}
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
              Náhled vloženého textu:
            </p>
            <p style={{ 
              fontSize: '14px', 
              color: '#334155', 
              backgroundColor: '#f8fafc', 
              borderRadius: '8px', 
              padding: '12px', 
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              margin: 0,
            }}>
              {previewText}
            </p>
          </div>

          <p style={{ fontSize: '14px', color: '#475569', marginBottom: '16px' }}>
            Uveďte prosím odkaz, odkud text kopírujete. Jinak máme podezření na kopírování textu nebo použití umělé inteligence.
          </p>

          {/* URL Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: 500, 
              color: '#334155', 
              marginBottom: '6px' 
            }}>
              Zdroj textu (URL nebo popis)
            </label>
            <input
              type="text"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="např. https://wikipedia.org/... nebo 'vlastní poznámky'"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 16px',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ 
              marginTop: '6px', 
              fontSize: '12px', 
              color: '#64748b', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px' 
            }}>
              💡 Učitel uvidí, zda jste uvedli zdroj u vloženého textu.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ 
          padding: '0 20px 20px 20px', 
          display: 'flex', 
          gap: '12px' 
        }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px 16px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Zrušit vložení
          </button>
          
          <button
            onClick={handleConfirmWithSource}
            style={{
              flex: 1,
              padding: '10px 16px',
              border: 'none',
              backgroundColor: hasSource ? '#16a34a' : '#f59e0b',
              color: '#ffffff',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Check style={{ width: '16px', height: '16px', color: '#ffffff' }} />
            <span>{hasSource ? 'Potvrdit se zdrojem' : 'Pokračovat bez zdroje'}</span>
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
