import { useState, useEffect, type CSSProperties } from 'react';
import type { ColorSwatch } from '../../../types/design-system';

const QUICK_COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#22C55E',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#000000',
  '#374151',
  '#6B7280',
  '#D1D5DB',
  '#F8FAFC',
  '#FFFFFF',
  '#1E40AF',
  '#065F46',
];

const C = {
  border: '#30363d',
  text: '#e6edf3',
  muted: '#7d8590',
  accent: '#5C5CFF',
};

const inp = (extra?: CSSProperties): CSSProperties => ({
  width: '100%',
  padding: '7px 10px',
  backgroundColor: '#21262d',
  border: `1px solid ${C.border}`,
  borderRadius: '7px',
  color: C.text,
  fontSize: '12px',
  outline: 'none',
  ...extra,
});

const btnBase = (extra?: CSSProperties): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  padding: '5px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: '7px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 500,
  color: C.muted,
  backgroundColor: '#21262d',
  ...extra,
});

/**
 * Formulář úpravy vzorku palety (hex, rychlé barvy, název) — sidebar design systému i popup na plátně.
 */
export function ColorSwatchEditForm({
  swatch,
  onSave,
  onClose,
}: {
  swatch: ColorSwatch;
  onSave: (p: Partial<ColorSwatch>) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState(swatch.value);
  const [name, setName] = useState(swatch.name);

  useEffect(() => {
    setVal(swatch.value);
    setName(swatch.name);
  }, [swatch.id, swatch.value, swatch.name]);

  return (
    <div onMouseDown={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <input
          type="color"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          style={{
            width: '42px',
            height: '42px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            padding: 0,
          }}
        />
        <input value={val} onChange={(e) => setVal(e.target.value)} style={inp({ flex: 1, fontFamily: 'monospace', fontSize: '11px' })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px', marginBottom: '10px' }}>
        {QUICK_COLORS.map((q) => (
          <div
            key={q}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setVal(q);
            }}
            onClick={() => setVal(q)}
            style={{
              aspectRatio: '1/1',
              borderRadius: '4px',
              backgroundColor: q,
              cursor: 'pointer',
              border: val === q ? `2px solid ${C.accent}` : '1px solid #333',
            }}
          />
        ))}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Název barvy"
        style={inp({ marginBottom: '10px' })}
      />
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="button"
          onClick={onClose}
          style={btnBase({ flex: 1, justifyContent: 'center', backgroundColor: 'transparent', border: 'none' })}
        >
          Zrušit
        </button>
        <button
          type="button"
          onClick={() => {
            onSave({ value: val, name });
            onClose();
          }}
          style={btnBase({ flex: 1, justifyContent: 'center', backgroundColor: C.accent, color: 'white', border: 'none' })}
        >
          OK
        </button>
      </div>
    </div>
  );
}
