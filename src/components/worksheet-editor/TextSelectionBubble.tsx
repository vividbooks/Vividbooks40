/**
 * TextSelectionBubble
 *
 * A compact floating popup that appears above a textarea when the user
 * selects text. Provides inline formatting: bold, italic, underline, and
 * highlight colours.
 *
 * Positioning strategy: mirrors the textarea content in a hidden div to find
 * the exact character-level x/y of the selection, then renders the bubble
 * centred above it via a React portal.
 *
 * All interactive elements use onMouseDown + e.preventDefault() so the
 * textarea never loses focus or its selection.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Underline } from 'lucide-react';

// ─── Highlight colours ────────────────────────────────────────────────────────
const HIGHLIGHTS = [
  { bg: '#fef08a', label: 'Žlutá' },
  { bg: '#bbf7d0', label: 'Zelená' },
  { bg: '#bfdbfe', label: 'Modrá' },
  { bg: '#fbcfe8', label: 'Růžová' },
  { bg: '#fde68a', label: 'Oranžová' },
  { bg: 'transparent', label: 'Zrušit' },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface TextSelectionBubbleProps {
  /** The textarea element whose text is being formatted. */
  targetEl: HTMLTextAreaElement | HTMLInputElement | null;
  /** Whether a non-empty selection currently exists. */
  show: boolean;
  /**
   * Called with a wrapping function (e.g. s => `**${s}**`).
   * The parent is responsible for reading the selection from targetEl
   * and writing the result back.
   */
  onFormat: (wrap: (selected: string) => string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the center-top of the textarea in viewport coordinates.
 * Simple and reliable — avoids the fragile mirror-div technique.
 */
function getSelectionCoords(
  ta: HTMLTextAreaElement | HTMLInputElement,
): { top: number; left: number; bottom: number } {
  const rect = ta.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left + rect.width / 2,
    bottom: rect.bottom,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TextSelectionBubble({
  targetEl,
  show,
  onFormat,
}: TextSelectionBubbleProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [showHighlights, setShowHighlights] = useState(false);

  // Recompute position whenever show/targetEl changes
  useEffect(() => {
    if (!show || !targetEl) {
      setPos(null);
      setShowHighlights(false);
      return;
    }
    const coords = getSelectionCoords(targetEl);
    setPos({ top: coords.top - 48, left: coords.left });
  }, [show, targetEl]);

  if (!show || !pos) return null;

  const BUBBLE_H = 40;
  // If the bubble would go off the top of the viewport, flip it below the textarea
  const top = pos.top < 8
    ? (targetEl ? targetEl.getBoundingClientRect().bottom + 8 : pos.top + 60)
    : pos.top;

  const bubble = (
    <div
      data-toolbar-element="true"
      style={{
        position: 'fixed',
        top,
        left: pos.left,
        transform: 'translateX(-50%)',
        zIndex: 99999,
        background: 'white',
        borderRadius: '10px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '4px 8px',
        height: `${BUBBLE_H}px`,
        userSelect: 'none',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* ── Bold ── */}
      <BubbleBtn
        title="Tučné"
        onClick={() => onFormat((s) => `**${s}**`)}
      >
        <Bold size={14} strokeWidth={2.5} />
      </BubbleBtn>

      {/* ── Italic ── */}
      <BubbleBtn
        title="Kurzíva"
        onClick={() => onFormat((s) => `*${s}*`)}
      >
        <Italic size={14} />
      </BubbleBtn>

      {/* ── Underline ── */}
      <BubbleBtn
        title="Podtržené"
        onClick={() => onFormat((s) => `<u>${s}</u>`)}
      >
        <Underline size={14} />
      </BubbleBtn>

      {/* ── Divider ── */}
      <div style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />

      {/* ── Highlight picker trigger ── */}
      <div style={{ position: 'relative' }}>
        <BubbleBtn
          title="Zvýraznit"
          onClick={() => setShowHighlights((v) => !v)}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: 4,
              background: '#fef08a',
              fontWeight: 700,
              fontSize: 12,
              color: '#78350f',
            }}
          >
            A
          </span>
        </BubbleBtn>

        {showHighlights && (
          <div
            data-toolbar-element="true"
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: 6,
              background: 'white',
              borderRadius: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              gap: 6,
              padding: '8px 10px',
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {HIGHLIGHTS.map(({ bg, label }) => (
              <button
                key={bg}
                title={label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (bg === 'transparent') {
                    onFormat((s) => s); // strip highlight — no-op wrap, caller should handle
                  } else {
                    onFormat((s) => `<mark style="background:${bg}">${s}</mark>`);
                  }
                  setShowHighlights(false);
                }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: bg === 'transparent' ? 'white' : bg,
                  border: bg === 'transparent' ? '2px solid #e2e8f0' : '2px solid transparent',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: bg === 'transparent' ? 'hidden' : 'visible',
                  flexShrink: 0,
                }}
              >
                {bg === 'transparent' && (
                  /* Strike-through line for "remove" option */
                  <span style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#ef4444', fontSize: 16, fontWeight: 700, lineHeight: 1,
                  }}>×</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(bubble, document.body);
}

// ─── Tiny helper button ───────────────────────────────────────────────────────
function BubbleBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        color: '#374151',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}
