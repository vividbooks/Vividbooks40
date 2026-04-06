import { useEffect, useCallback, useState } from 'react';
import { X, Check } from 'lucide-react';
import {
  PRESET_ILLUSTRATION_STYLES,
  presetCatalogThumbnailUrl,
  type PresetIllustrationStyleDefinition,
} from '../../data/preset-illustration-styles';

/**
 * Náhled dlaždice: nejdřív obrázek z datasetu, pak volitelná `thumbnailUrl` u presetu, jinak deterministický seed (picsum).
 */
export function IllustrationStyleThumb({
  preset,
  styleId,
  datasetThumbnailUrl,
}: {
  preset?: PresetIllustrationStyleDefinition;
  /** Když není `preset` (např. styl z AI návrhu), seed pro katalogový náhled */
  styleId?: string;
  datasetThumbnailUrl?: string | undefined;
}) {
  const [failed, setFailed] = useState(false);
  const seedId = preset?.id ?? styleId;
  const [g0, g1] = preset?.thumbGradient ?? (['#e2e8f0', '#cbd5e1'] as const);
  if (!seedId) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${g0} 0%, ${g1} 100%)`,
        }}
      />
    );
  }
  const url =
    (datasetThumbnailUrl?.startsWith('http') ? datasetThumbnailUrl : undefined) ??
    preset?.thumbnailUrl ??
    presetCatalogThumbnailUrl(seedId);
  const showImg = typeof url === 'string' && url.startsWith('http') && !failed;

  if (!showImg) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${g0} 0%, ${g1} 100%)`,
        }}
      />
    );
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
      }}
    />
  );
}

type PresetIllustrationStylesPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (preset: PresetIllustrationStyleDefinition) => void;
  appliedPresetIds: ReadonlySet<string>;
  /** Katalogové id → URL tvého uloženého / vygenerovaného náhledu (knihovna + spot). Bez URL = jen barevný gradient. */
  datasetThumbnailByPresetCatalogId?: ReadonlyMap<string, string> | undefined;
};

export function PresetIllustrationStylesPicker({
  open,
  onClose,
  onSelect,
  appliedPresetIds,
  datasetThumbnailByPresetCatalogId,
}: PresetIllustrationStylesPickerProps) {
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onKey]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-styles-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(920px, 100%)',
          maxHeight: 'min(88vh, 900px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          backgroundColor: '#0f172a',
          border: '1px solid rgba(148, 163, 184, 0.35)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 18px 12px',
            borderBottom: '1px solid rgba(51, 65, 85, 0.9)',
          }}
        >
          <div>
            <h2
              id="preset-styles-title"
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: '#f8fafc',
                letterSpacing: '-0.02em',
              }}
            >
              Přednastavené AI styly
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.45, color: '#94a3b8', maxWidth: 640 }}>
              Náhled = obrázek uložený u tohoto stylu v datasetu (tlačítko „Uložit do stylu“ nebo „Přidat obrázek ke
              stylu“). Náhled z „Náhodná ilustrace“ se tu neukazuje — až po uložení mezi reference stylu. Jinak
              deterministický náhled z katalogu (stejné id = stejný obrázek).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Zavřít"
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 10,
              border: '1px solid rgba(148, 163, 184, 0.35)',
              background: 'rgba(30, 41, 59, 0.9)',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '14px 16px 18px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
            alignContent: 'start',
          }}
        >
          {PRESET_ILLUSTRATION_STYLES.map((preset) => {
            const applied = appliedPresetIds.has(preset.id);
            const datasetThumb = datasetThumbnailByPresetCatalogId?.get(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelect(preset)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  textAlign: 'left',
                  padding: 0,
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: applied ? '2px solid #818cf8' : '1px solid rgba(51, 65, 85, 0.95)',
                  background: '#1e293b',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    aspectRatio: '1 / 1',
                    width: '100%',
                    position: 'relative',
                    flexShrink: 0,
                    overflow: 'hidden',
                    background: '#0f172a',
                  }}
                >
                  <IllustrationStyleThumb preset={preset} datasetThumbnailUrl={datasetThumb} />
                  {applied ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'rgba(15, 23, 42, 0.85)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#a5b4fc',
                        border: '1px solid rgba(129, 140, 248, 0.6)',
                      }}
                    >
                      <Check size={16} strokeWidth={2.5} />
                    </div>
                  ) : null}
                </div>
                <div style={{ padding: '10px 11px 12px' }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#f1f5f9',
                      marginBottom: 4,
                      lineHeight: 1.25,
                    }}
                  >
                    {preset.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      lineHeight: 1.4,
                      color: '#94a3b8',
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {preset.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
