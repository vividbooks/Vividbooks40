import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { SIDEBAR_COLORS, SIDEBAR_RADIUS } from './shared';

export type FontFamilyOption = { label: string; value: string };

const defaultListBox: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '100%',
  marginTop: 4,
  backgroundColor: SIDEBAR_COLORS.panelAlt,
  border: `1px solid ${SIDEBAR_COLORS.controlBorder}`,
  borderRadius: SIDEBAR_RADIUS.md,
  boxShadow: '0 14px 36px rgba(0, 0, 0, 0.45)',
  maxHeight: 280,
  overflowY: 'auto',
  zIndex: 10000,
  padding: 4,
};

/**
 * Výběr rodiny písma s náhledem — každý řádek používá `fontFamily` z hodnoty (CSS stack).
 * Nahrazuje nativní &lt;select&gt;, u kterého nelze spolehlivě zobrazit každý font zvlášť.
 */
export function FontFamilySelect({
  id,
  value,
  options,
  onChange,
  triggerStyle,
  listBoxStyle,
  chevronColor = '#808080',
  listMaxHeight = 280,
  'aria-labelledby': ariaLabelledBy,
}: {
  id?: string;
  value: string;
  options: FontFamilyOption[];
  onChange: (value: string) => void;
  triggerStyle?: CSSProperties;
  /** Panel se seznamem (position absolute vůči obalu) */
  listBoxStyle?: CSSProperties;
  chevronColor?: string;
  listMaxHeight?: number;
  'aria-labelledby'?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const baseTrigger: CSSProperties = {
    width: '100%',
    minHeight: 34,
    padding: '0 28px 0 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    cursor: 'pointer',
    boxSizing: 'border-box',
    border: 'none',
    margin: 0,
    font: 'inherit',
    ...triggerStyle,
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        id={id}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={baseTrigger}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: value,
            textAlign: 'left',
          }}
        >
          {selected?.label ?? value}
        </span>
        <ChevronDown
          size={14}
          style={{
            flexShrink: 0,
            color: chevronColor,
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.15s ease',
          }}
        />
      </button>
      {open ? (
        <div
          role="listbox"
          style={{ ...defaultListBox, ...listBoxStyle, maxHeight: listMaxHeight }}
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <button
                key={`${o.value}-${i}`}
                type="button"
                id={id ? `${id}-opt-${i}` : undefined}
                role="option"
                aria-selected={isSel}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  marginBottom: 2,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  lineHeight: 1.35,
                  color: SIDEBAR_COLORS.text,
                  backgroundColor: isSel ? 'rgba(99, 102, 241, 0.22)' : 'transparent',
                  fontFamily: o.value,
                }}
                onMouseEnter={(e) => {
                  if (!isSel) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!isSel) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
