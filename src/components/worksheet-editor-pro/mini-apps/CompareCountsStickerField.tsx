/**
 * Výběr nálepky ze stejného katalogu jako anotace Vividboardu (Supabase / sticker-library).
 * Kompaktní řádek: nálepka + koš vedle sebe, počet s velkými šipkami nahoru/dolů.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Loader2, Pencil, Sticker, Trash2, X } from 'lucide-react';
import {
  useStickerCatalog,
  type AnnotationStickerItem,
} from '../../../features/board-v2/annotations/sticker-library';
import { inputStyle, labelStyle } from '../block-settings/shared';

const COUNT_MIN = 0;
const COUNT_MAX = 40;

function clampCount(n: number): number {
  if (!Number.isFinite(n)) return COUNT_MIN;
  return Math.max(COUNT_MIN, Math.min(COUNT_MAX, Math.round(n)));
}

export interface CompareCountsStickerFieldProps {
  stickerUrl?: string;
  onSelect: (item: AnnotationStickerItem) => void;
  onClear: () => void;
  count: number;
  onCountChange: (n: number) => void;
}

export function CompareCountsStickerField({
  stickerUrl,
  onSelect,
  onClear,
  count,
  onCountChange,
}: CompareCountsStickerFieldProps) {
  const [open, setOpen] = useState(false);
  const { categories, loading, error } = useStickerCatalog();
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    if (categories.length === 0) return;
    if (categoryId) return;
    setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const itemsInCategory = useMemo(() => {
    const c = categories.find((x) => x.id === categoryId);
    if (!c) return [];
    return c.rows.flatMap((r) => r.items);
  }, [categories, categoryId]);

  const modal =
    open &&
    createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Výběr nálepky"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200020,
          background: 'rgba(15,23,42,0.72)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
        onClick={() => setOpen(false)}
      >
        <div
          style={{
            width: 'min(520px, 100%)',
            maxHeight: 'min(72vh, 640px)',
            background: '#0f172a',
            borderRadius: 14,
            border: '1px solid #334155',
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid #334155',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Nálepka z Vividboardu</span>
            <button
              type="button"
              aria-label="Zavřít"
              onClick={() => setOpen(false)}
              style={{
                border: 'none',
                background: '#1e293b',
                color: '#94a3b8',
                borderRadius: 8,
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b' }}>
            <label style={{ ...labelStyle, marginBottom: 6 }}>Kategorie</label>
            <select
              style={{ ...inputStyle, width: '100%' }}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', padding: 20 }}>
                <Loader2 className="animate-spin" size={20} />
                Načítám nálepky…
              </div>
            )}
            {error && (
              <div style={{ color: '#f87171', fontSize: 13, padding: 12 }}>
                Nepodařilo se načíst katalog nálepek ({error}).
              </div>
            )}
            {!loading && !error && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))',
                  gap: 8,
                }}
              >
                {itemsInCategory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={item.name}
                    onClick={() => {
                      onSelect(item);
                      setOpen(false);
                    }}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: 10,
                      border:
                        stickerUrl === item.url ? '2px solid #818cf8' : '1px solid #334155',
                      background: '#1e293b',
                      cursor: 'pointer',
                      padding: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={item.url}
                      alt=""
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );

  const thumbSize = 42;

  const step = (delta: number) => {
    onCountChange(clampCount(count + delta));
  };

  const arrowBtnBase: CSSProperties = {
    flex: 1,
    minHeight: 20,
    border: 'none',
    background: '#1e293b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    color: '#e2e8f0',
  };

  return (
    <div style={{ marginBottom: 2 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="Vybrat nebo změnit nálepku"
            style={{
              width: thumbSize,
              height: thumbSize,
              borderRadius: 10,
              border: '1px solid #475569',
              background: '#1e293b',
              position: 'relative',
              padding: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            {stickerUrl ? (
              <img
                src={stickerUrl}
                alt=""
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <Sticker size={20} color="#64748b" strokeWidth={1.75} />
            )}
            <span
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 17,
                height: 17,
                borderRadius: 5,
                background: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
              }}
              aria-hidden
            >
              <Pencil size={9} color="#f1f5f9" strokeWidth={2.5} />
            </span>
          </button>

          {stickerUrl ? (
            <button
              type="button"
              onClick={onClear}
              aria-label="Odebrat nálepku"
              title="Odebrat nálepku"
              style={{
                width: 36,
                height: 36,
                border: '1px solid #334155',
                borderRadius: 10,
                background: '#0f172a',
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                padding: 0,
              }}
            >
              <Trash2 size={17} />
            </button>
          ) : (
            <div style={{ width: 36, height: 36, flexShrink: 0 }} aria-hidden />
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              ...labelStyle,
              marginBottom: 0,
              fontSize: 10,
              letterSpacing: '0.06em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            Počet
          </span>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              borderRadius: 10,
              border: '1px solid #475569',
              overflow: 'hidden',
              background: '#0f172a',
            }}
          >
            <input
              type="number"
              className="vb-compare-count-input"
              min={COUNT_MIN}
              max={COUNT_MAX}
              value={count}
              onChange={(e) => onCountChange(clampCount(Number(e.target.value)))}
              style={{
                width: 48,
                height: 40,
                boxSizing: 'border-box',
                border: 'none',
                borderRadius: 0,
                textAlign: 'center',
                fontSize: 15,
                fontWeight: 600,
                background: '#1e293b',
                color: '#f1f5f9',
                outline: 'none',
                margin: 0,
              }}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: 40,
                minHeight: 40,
                borderLeft: '1px solid #334155',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => step(1)}
                disabled={count >= COUNT_MAX}
                aria-label="Zvýšit počet"
                style={{
                  ...arrowBtnBase,
                  borderBottom: '1px solid #334155',
                  opacity: count >= COUNT_MAX ? 0.35 : 1,
                  cursor: count >= COUNT_MAX ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronUp size={22} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={count <= COUNT_MIN}
                aria-label="Snížit počet"
                style={{
                  ...arrowBtnBase,
                  opacity: count <= COUNT_MIN ? 0.35 : 1,
                  cursor: count <= COUNT_MIN ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronDown size={22} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
      {modal}
    </div>
  );
}
