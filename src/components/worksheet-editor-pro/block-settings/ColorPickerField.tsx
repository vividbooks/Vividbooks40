import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Palette, X } from 'lucide-react';
import { SIDEBAR_COLORS, TEXT_COLORS } from './shared';

const CUSTOM_COLORS_STORAGE_KEY = 'vividbooks.customColors';
const CUSTOM_COLORS_UPDATED_EVENT = 'vividbooks-custom-colors-updated';
const MAX_CUSTOM_COLORS = 12;

/** Pro porovnání výběru a deduplikaci palety (žádná / bílá / černá vždy první). */
function normalizeHexForCompare(v: string | undefined): string | null {
  if (!v || v.trim().toLowerCase() === 'transparent') return null;
  const t = v.trim().toLowerCase();
  if (t === '#fff') return '#ffffff';
  if (t === '#000') return '#000000';
  return t;
}

function isWhiteOrBlackHex(v: string): boolean {
  const n = normalizeHexForCompare(v);
  return n === '#ffffff' || n === '#000000';
}

type DesignSystemSwatch = {
  id: string;
  name?: string;
  value: string;
};

interface ColorPickerFieldProps {
  value?: string;
  onChange: (color: string) => void;
  onClear?: () => void;
  palette?: Array<{ value: string; label: string }>;
  designSystemSwatches?: DesignSystemSwatch[];
  /** Pouze swatche z design systému — bez výchozí palety, bez uložených vlastních barev a bez „Přidat vlastní barvu“. */
  designSystemOnly?: boolean;
  placeholder?: string;
  swatchStyle?: 'fill' | 'border';
  borderStyle?: string;
  defaultCustomColor?: string;
  align?: 'left' | 'right';
}

export function ColorPickerField({
  value,
  onChange,
  onClear,
  palette = TEXT_COLORS,
  designSystemSwatches = [],
  designSystemOnly = false,
  placeholder = 'Vlastní barva',
  swatchStyle = 'fill',
  borderStyle = 'solid',
  defaultCustomColor = '#ffffff',
  align = 'left',
}: ColorPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [customColors, setCustomColors] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const readStoredColors = () => {
      try {
        const raw = window.localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((color): color is string => typeof color === 'string');
      } catch {
        return [];
      }
    };

    const syncColors = () => {
      setCustomColors(readStoredColors());
    };

    syncColors();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === CUSTOM_COLORS_STORAGE_KEY) {
        syncColors();
      }
    };

    const handleCustomUpdate = () => {
      syncColors();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(CUSTOM_COLORS_UPDATED_EVENT, handleCustomUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CUSTOM_COLORS_UPDATED_EVENT, handleCustomUpdate);
    };
  }, []);

  const saveCustomColor = (color: string) => {
    if (typeof window === 'undefined') return;
    const normalizedColor = color.trim().toLowerCase();
    if (!normalizedColor) return;

    try {
      const raw = window.localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const existing = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
      const nextColors = [
        normalizedColor,
        ...existing.filter((item) => item.toLowerCase() !== normalizedColor),
      ].slice(0, MAX_CUSTOM_COLORS);

      window.localStorage.setItem(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(nextColors));
      setCustomColors(nextColors);
      window.dispatchEvent(new CustomEvent(CUSTOM_COLORS_UPDATED_EVENT));
    } catch {
      // Ignore storage failures and still allow the color to be used locally.
    }
  };

  const customPalette = useMemo(
    () => (designSystemOnly ? [] : customColors
      .filter((color) => !palette.some((item) => item.value.toLowerCase() === color.toLowerCase()))
      .filter((color) => !designSystemSwatches.some((item) => item.value.toLowerCase() === color.toLowerCase()))
      .map((color) => ({ value: color, label: color.toUpperCase() }))),
    [customColors, designSystemOnly, designSystemSwatches, palette]
  );

  const filteredDesignSystemSwatches = useMemo(
    () => designSystemSwatches.filter((s) => !isWhiteOrBlackHex(s.value)),
    [designSystemSwatches]
  );

  const filteredPalette = useMemo(
    () => palette.filter((p) => !isWhiteOrBlackHex(p.value)),
    [palette]
  );

  const filteredCustomPalette = useMemo(
    () => customPalette.filter((p) => !isWhiteOrBlackHex(p.value)),
    [customPalette]
  );

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const currentLabel = useMemo(() => {
    if (!value || value.trim().toLowerCase() === 'transparent') return 'Žádná';
    const n = normalizeHexForCompare(value);
    if (n === '#ffffff') return 'Bílá';
    if (n === '#000000') return 'Černá';
    const fromPalette = palette.find((item) => normalizeHexForCompare(item.value) === n)?.label;
    if (fromPalette) return fromPalette;
    const fromDesignSystem = designSystemSwatches.find((item) => normalizeHexForCompare(item.value) === n)?.name;
    if (fromDesignSystem) return fromDesignSystem;
    const fromCustomPalette = customPalette.find((item) => normalizeHexForCompare(item.value) === n)?.label;
    return fromCustomPalette || placeholder;
  }, [customPalette, designSystemSwatches, palette, placeholder, value]);

  const isNoneValue = !value || value.trim().toLowerCase() === 'transparent';
  const swatchNode = (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        ...(swatchStyle === 'fill'
          ? isNoneValue
            ? {
                backgroundColor: '#f1f5f9',
                backgroundImage:
                  'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%) 50% / 6px 6px',
              }
            : { backgroundColor: value || '#000000' }
          : { backgroundColor: 'transparent' }),
        border:
          swatchStyle === 'fill'
            ? isNoneValue
              ? '1px dashed #94a3b8'
              : `1px solid ${value === '#FFFFFF' ? '#475569' : 'rgba(255,255,255,0.08)'}`
            : `3px ${borderStyle} ${isNoneValue ? 'rgba(148,163,184,0.5)' : value || '#475569'}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.24)',
        flexShrink: 0,
      }}
    />
  );

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: 1 }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          backgroundColor: '#334155',
          border: `1px solid ${open ? '#5C5CFF' : 'rgba(255,255,255,0.04)'}`,
          borderRadius: 8,
          cursor: 'pointer',
          color: '#E5E5E5',
          minHeight: 52,
        }}
      >
        {swatchNode}
        <span style={{ flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 700 }}>
          {currentLabel}
        </span>
        {onClear && value && !isNoneValue ? (
          <span
            onClick={(event) => {
              event.stopPropagation();
              onClear();
              setOpen(false);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              color: '#94a3b8',
            }}
          >
            <X size={12} />
          </span>
        ) : (
          <ChevronDown
            size={16}
            style={{
              color: '#94a3b8',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.18s ease',
            }}
          />
        )}
      </button>

      <input
        ref={hiddenInputRef}
        type="color"
        value={value || defaultCustomColor}
        onChange={(event) => {
          saveCustomColor(event.target.value);
          onChange(event.target.value);
          setOpen(false);
        }}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
      />

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            [align]: 0,
            zIndex: 1200,
            width: 224,
            padding: 14,
            backgroundColor: '#223047',
            border: `1px solid ${SIDEBAR_COLORS.controlBorder}`,
            borderRadius: 16,
            boxShadow: '0 16px 30px rgba(2, 6, 23, 0.45)',
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                marginBottom: 8,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#8ea0bf',
              }}
            >
              Barvy
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 40px)', gap: 12, justifyContent: 'space-between' }}>
              {(() => {
                const isActiveNone = normalizeHexForCompare(value) === null;
                const isActiveWhite = normalizeHexForCompare(value) === '#ffffff';
                const isActiveBlack = normalizeHexForCompare(value) === '#000000';
                return (
                  <>
                    <button
                      type="button"
                      title="Žádná"
                      onClick={() => {
                        onClear?.();
                        if (!onClear) onChange('transparent');
                        setOpen(false);
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: isActiveNone ? '2px solid #e2e8f0' : '1px dashed rgba(148,163,184,0.55)',
                        backgroundColor: swatchStyle === 'fill' ? '#f1f5f9' : '#223047',
                        backgroundImage:
                          swatchStyle === 'fill'
                            ? 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%) 50% / 8px 8px'
                            : undefined,
                        boxShadow: isActiveNone
                          ? '0 0 0 3px rgba(92,92,255,0.28)'
                          : 'inset 0 0 0 1px rgba(15,23,42,0.14)',
                        cursor: 'pointer',
                        padding: 0,
                        outline: 'none',
                        position: 'relative',
                      }}
                    >
                      {swatchStyle === 'border' && (
                        <span
                          style={{
                            position: 'absolute',
                            inset: 8,
                            borderRadius: '50%',
                            border: `4px dashed rgba(148,163,184,0.65)`,
                          }}
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Bílá"
                      onClick={() => {
                        onChange('#FFFFFF');
                        setOpen(false);
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: isActiveWhite ? '2px solid #e2e8f0' : '1px solid rgba(255,255,255,0.16)',
                        backgroundColor: swatchStyle === 'fill' ? '#FFFFFF' : '#223047',
                        boxShadow: isActiveWhite
                          ? '0 0 0 3px rgba(92,92,255,0.28)'
                          : 'inset 0 0 0 1px rgba(15,23,42,0.14)',
                        cursor: 'pointer',
                        padding: 0,
                        outline: 'none',
                        position: 'relative',
                      }}
                    >
                      {swatchStyle === 'border' && (
                        <span
                          style={{
                            position: 'absolute',
                            inset: 8,
                            borderRadius: '50%',
                            border: `4px ${borderStyle} #FFFFFF`,
                          }}
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Černá"
                      onClick={() => {
                        onChange('#000000');
                        setOpen(false);
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: isActiveBlack ? '2px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
                        backgroundColor: swatchStyle === 'fill' ? '#000000' : '#223047',
                        boxShadow: isActiveBlack
                          ? '0 0 0 3px rgba(92,92,255,0.28)'
                          : 'inset 0 0 0 1px rgba(15,23,42,0.14)',
                        cursor: 'pointer',
                        padding: 0,
                        outline: 'none',
                        position: 'relative',
                      }}
                    >
                      {swatchStyle === 'border' && (
                        <span
                          style={{
                            position: 'absolute',
                            inset: 8,
                            borderRadius: '50%',
                            border: `4px ${borderStyle} #000000`,
                          }}
                        />
                      )}
                    </button>
                  </>
                );
              })()}
            </div>
            {(filteredDesignSystemSwatches.length > 0 ||
              (!designSystemOnly && (filteredCustomPalette.length > 0 || filteredPalette.length > 0))) && (
              <div style={{ height: 1, backgroundColor: 'rgba(148,163,184,0.2)', marginTop: 12 }} />
            )}
          </div>

          {filteredDesignSystemSwatches.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  marginBottom: 8,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#8ea0bf',
                }}
              >
                {designSystemOnly ? 'Paleta design systému' : 'Design systém'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 40px)', gap: 12, justifyContent: 'space-between' }}>
                {filteredDesignSystemSwatches.map((swatch) => {
                  const isActive = normalizeHexForCompare(swatch.value) === normalizeHexForCompare(value);
                  return (
                    <button
                      key={swatch.id}
                      type="button"
                      title={swatch.name || swatch.value}
                      onClick={() => {
                        onChange(swatch.value);
                        setOpen(false);
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: isActive ? '2px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
                        backgroundColor: swatchStyle === 'fill' ? swatch.value : '#223047',
                        boxShadow: isActive ? '0 0 0 3px rgba(92,92,255,0.28)' : 'inset 0 0 0 1px rgba(15,23,42,0.14)',
                        cursor: 'pointer',
                        padding: 0,
                        outline: 'none',
                        position: 'relative',
                      }}
                    >
                      {swatchStyle === 'border' && (
                        <span
                          style={{
                            position: 'absolute',
                            inset: 8,
                            borderRadius: '50%',
                            border: `4px ${borderStyle} ${swatch.value}`,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {!designSystemOnly && (
                <div style={{ height: 1, backgroundColor: 'rgba(148,163,184,0.2)', marginTop: 12 }} />
              )}
            </div>
          )}

          {!designSystemOnly && filteredCustomPalette.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  marginBottom: 8,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#8ea0bf',
                }}
              >
                Vlastní barvy
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 40px)', gap: 12, justifyContent: 'space-between' }}>
                {filteredCustomPalette.map((color) => {
                  const isActive = normalizeHexForCompare(color.value) === normalizeHexForCompare(value);
                  return (
                    <button
                      key={color.value}
                      type="button"
                      title={color.label}
                      onClick={() => {
                        onChange(color.value);
                        setOpen(false);
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: isActive ? '2px solid #e2e8f0' : color.value === '#ffffff' ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(255,255,255,0.04)',
                        backgroundColor: swatchStyle === 'fill' ? color.value : '#223047',
                        boxShadow: isActive ? '0 0 0 3px rgba(92,92,255,0.28)' : 'inset 0 0 0 1px rgba(15,23,42,0.14)',
                        cursor: 'pointer',
                        padding: 0,
                        outline: 'none',
                        position: 'relative',
                      }}
                    >
                      {swatchStyle === 'border' && (
                        <span
                          style={{
                            position: 'absolute',
                            inset: 8,
                            borderRadius: '50%',
                            border: `4px ${borderStyle} ${color.value}`,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <div style={{ height: 1, backgroundColor: 'rgba(148,163,184,0.2)', marginTop: 12 }} />
            </div>
          )}

          {!designSystemOnly && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 40px)', gap: 12, justifyContent: 'space-between' }}>
            {filteredPalette.map((color) => {
              const isActive = normalizeHexForCompare(color.value) === normalizeHexForCompare(value);
              return (
                <button
                  key={color.value}
                  type="button"
                  title={color.label}
                  onClick={() => {
                    onChange(color.value);
                    setOpen(false);
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: isActive ? '2px solid #e2e8f0' : color.value === '#FFFFFF' ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(255,255,255,0.04)',
                    backgroundColor: swatchStyle === 'fill' ? color.value : '#223047',
                    boxShadow: isActive ? '0 0 0 3px rgba(92,92,255,0.28)' : 'inset 0 0 0 1px rgba(15,23,42,0.14)',
                    cursor: 'pointer',
                    padding: 0,
                    outline: 'none',
                    position: 'relative',
                  }}
                >
                  {swatchStyle === 'border' && (
                    <span
                      style={{
                        position: 'absolute',
                        inset: 8,
                        borderRadius: '50%',
                        border: `4px ${borderStyle} ${color.value}`,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          )}

          {!designSystemOnly && (
          <button
            type="button"
            onClick={() => hiddenInputRef.current?.click()}
            style={{
              width: '100%',
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px dashed rgba(148,163,184,0.35)',
              background: 'rgba(255,255,255,0.02)',
              color: '#dbe4f0',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <Palette size={14} />
            Přidat vlastní barvu
          </button>
          )}
        </div>
      )}
    </div>
  );
}
