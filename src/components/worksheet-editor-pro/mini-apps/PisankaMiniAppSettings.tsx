/**
 * Pravý panel: písanka (český jazyk) — paragraph + miniApp pisanka.
 */

import { useState, type CSSProperties } from 'react';
import { ChevronDown, Image as ImageIcon, Plus, Settings2, Trash2 } from 'lucide-react';
import type {
  ParagraphBlock,
  PisankaLinePattern,
  PisankaLineTemplate,
  PisankaRowItem,
  WorksheetBlock,
} from '../../../types/worksheet';
import { ColorPickerField } from '../block-settings/ColorPickerField';
import { inputStyle, labelStyle, sectionTitleStyle, subtleCardStyle } from '../block-settings/shared';
import { buildPisankaHtml, mergePisankaMiniApp } from '../../../utils/mini-apps/pisanka';
import { PisankaGuideDotsDevPanel } from './PisankaGuideDotsDevPanel';

export type PisankaRowImagePickerContext = { type: 'pisanka-row-image'; rowIndex: number };

interface PisankaMiniAppSettingsProps {
  block: WorksheetBlock;
  onUpdateBlock: (id: string, patch: Partial<WorksheetBlock>) => void;
  openAssetPicker: (ctx: PisankaRowImagePickerContext) => void;
}

const rowSettingsPanelStyle: CSSProperties = {
  marginTop: 8,
  padding: '12px 14px',
  borderRadius: 8,
  background: '#0f172a',
  border: '1px solid #475569',
  boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
};

const rowSettingsSectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#94a3b8',
  marginBottom: 8,
  marginTop: 10,
};

const checkRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 12,
  color: '#e2e8f0',
  cursor: 'pointer',
  padding: '6px 0',
  userSelect: 'none',
};

const LINE_PATTERN_OPTIONS: {
  value: PisankaLinePattern;
  label: string;
  hint: string;
}[] = [
  {
    value: '1',
    label: 'Vzor 1',
    hint: 'Plná linka — šatečky, horní a spodní část, modrý pás uprostřed',
  },
  {
    value: '2',
    label: 'Vzor 2',
    hint: 'Kompaktní — jen střední pásmo se dvěma tlustými linkami (jako „a“ na dvou linkách)',
  },
  {
    value: '3',
    label: 'Vzor 3',
    hint: 'Jako vzor 1, ale bez vybarveného středního pásu',
  },
];

export function PisankaMiniAppSettings({
  block,
  onUpdateBlock,
  openAssetPicker,
}: PisankaMiniAppSettingsProps) {
  const [openRowSettings, setOpenRowSettings] = useState<number | null>(null);

  const pb = block as ParagraphBlock;
  const mini = mergePisankaMiniApp(undefined, (pb.content.miniApp as any) ?? {});

  const patchMini = (patch: Parameters<typeof mergePisankaMiniApp>[1]) => {
    const next = mergePisankaMiniApp(mini, patch);
    onUpdateBlock(block.id, {
      content: {
        ...pb.content,
        miniApp: next,
        html: buildPisankaHtml(next),
      } as ParagraphBlock['content'],
    });
  };

  const setLineTemplate = (lineTemplate: PisankaLineTemplate) => {
    patchMini({ lineTemplate });
  };

  const setLinePattern = (linePattern: PisankaLinePattern) => {
    patchMini({ linePattern });
  };

  const updateRow = (index: number, patch: Partial<PisankaRowItem>) => {
    const rows = mini.rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    patchMini({ rows });
  };

  const clearRowImage = (index: number) => {
    const rows = mini.rows.map((r, i) => {
      if (i !== index) return r;
      const { imageUrl: _removed, imageEnabled: _ie, ...rest } = r;
      return rest;
    });
    patchMini({ rows });
  };

  /** Zapnutí/vypnutí sekce s výběrem obrázku + při vypnutí odstraní URL. */
  const setRowAllowImage = (index: number, allowed: boolean) => {
    const rows = mini.rows.map((r, i) => {
      if (i !== index) return r;
      if (!allowed) {
        const { imageUrl: _u, imageEnabled: _e, ...rest } = r;
        return { ...rest, allowRowImage: false };
      }
      return { ...r, allowRowImage: true };
    });
    patchMini({ rows });
  };

  const addRow = () => {
    if (mini.rows.length >= 40) return;
    patchMini({ rows: [...mini.rows, { text: '', traceFont: 'vividbooks' }] });
  };

  const removeRow = (index: number) => {
    if (mini.rows.length <= 1) return;
    if (openRowSettings === index) setOpenRowSettings(null);
    else if (openRowSettings !== null && openRowSettings > index) setOpenRowSettings(openRowSettings - 1);
    patchMini({ rows: mini.rows.filter((_, i) => i !== index) });
  };

  return (
    <div style={{ ...subtleCardStyle, marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid #334155' }}>
      <h3 style={{ ...sectionTitleStyle, marginBottom: 8 }}>Písanka (celostránkový blok)</h3>
      <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12, lineHeight: 1.45 }}>
        Typ linek určuje výšku částí (0,8 / 0,6 cm). <strong>Vzor 1–3</strong> mění tvar linek na všech řádcích. U
        řádku v <strong>Nastavení řádku</strong> můžeš zvolit písmo předpisu, obrázek vzadu a panáčka vlevo.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Nadpis (Cooper Light)</label>
        <input
          type="text"
          style={{ ...inputStyle, width: '100%' }}
          value={mini.title ?? ''}
          placeholder="např. Pís 4"
          onChange={(e) => patchMini({ title: e.target.value })}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Vzor linek</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {LINE_PATTERN_OPTIONS.map((opt) => {
            const active = (mini.linePattern ?? '1') === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLinePattern(opt.value)}
                style={{
                  flex: 1,
                  minWidth: 100,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: active ? '2px solid #5C5CFF' : '1px solid #475569',
                  background: active ? 'rgba(92,92,255,0.15)' : '#1e293b',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Typ linek (vázané)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {(
            [
              { id: '3x08' as const, label: '3×0,8 cm', hint: 'každá část 0,8 cm' },
              { id: '3x06' as const, label: '3×0,6 cm', hint: 'každá část 0,6 cm' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLineTemplate(opt.id)}
              style={{
                flex: 1,
                minWidth: 120,
                padding: '10px 12px',
                borderRadius: 8,
                border: mini.lineTemplate === opt.id ? '2px solid #5C5CFF' : '1px solid #475569',
                background: mini.lineTemplate === opt.id ? 'rgba(92,92,255,0.15)' : '#1e293b',
                color: '#e2e8f0',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{opt.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <span>Proklad mezi řádky</span>
          <span style={{ color: '#94a3b8', fontWeight: 400 }}>{mini.rowGapPx ?? 56}px</span>
        </label>
        <input
          type="range"
          min={12}
          max={120}
          step={2}
          value={mini.rowGapPx ?? 56}
          onChange={(e) => patchMini({ rowGapPx: parseInt(e.target.value, 10) })}
          style={{ width: '100%', marginTop: 6 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ ...labelStyle, margin: 0 }}>Řádky ({mini.rows.length})</label>
          <button
            type="button"
            onClick={addRow}
            disabled={mini.rows.length >= 40}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #475569',
              background: '#1e293b',
              color: '#e2e8f0',
              fontSize: 11,
              cursor: mini.rows.length >= 40 ? 'not-allowed' : 'pointer',
              opacity: mini.rows.length >= 40 ? 0.5 : 1,
            }}
          >
            <Plus size={14} /> Přidat řádek
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mini.rows.map((row, idx) => (
            <div
              key={idx}
              style={{
                padding: 10,
                borderRadius: 8,
                border: '1px solid #334155',
                background: 'rgba(15, 23, 42, 0.5)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{idx + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setOpenRowSettings((s) => (s === idx ? null : idx))}
                    aria-expanded={openRowSettings === idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: openRowSettings === idx ? '1px solid #5C5CFF' : '1px solid #475569',
                      background: openRowSettings === idx ? 'rgba(92,92,255,0.2)' : '#1e293b',
                      color: '#e2e8f0',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    <Settings2 size={14} />
                    Nastavení řádku
                    <ChevronDown
                      size={14}
                      style={{
                        opacity: 0.85,
                        transform: openRowSettings === idx ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    disabled={mini.rows.length <= 1}
                    title="Smazat řádek"
                    style={{
                      padding: 4,
                      border: 'none',
                      background: 'transparent',
                      color: mini.rows.length <= 1 ? '#475569' : '#f87171',
                      cursor: mini.rows.length <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {openRowSettings === idx ? (
                <div style={rowSettingsPanelStyle}>
                  <div style={{ ...rowSettingsSectionLabel, marginTop: 0 }}>Výběr fontu</div>
                  <label style={checkRowStyle}>
                    <input
                      type="radio"
                      name={`pisanka-row-font-${block.id}-${idx}`}
                      checked={row.traceFont === 'vividbooks'}
                      onChange={() => updateRow(idx, { traceFont: 'vividbooks' })}
                    />
                    Vividbooks Script
                  </label>
                  <label style={checkRowStyle}>
                    <input
                      type="radio"
                      name={`pisanka-row-font-${block.id}-${idx}`}
                      checked={row.traceFont === 'cooper'}
                      onChange={() => updateRow(idx, { traceFont: 'cooper' })}
                    />
                    Cooper Light
                  </label>

                  <div style={rowSettingsSectionLabel}>Obrázek</div>
                  <label style={checkRowStyle}>
                    <input
                      type="checkbox"
                      checked={row.allowRowImage === true}
                      onChange={(e) => setRowAllowImage(idx, e.target.checked)}
                    />
                    Povolit obrázek na řádku
                  </label>
                  {row.allowRowImage === true ? (
                    <label
                      style={{
                        ...checkRowStyle,
                        opacity: row.imageUrl ? 1 : 0.45,
                        cursor: row.imageUrl ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!row.imageUrl && row.imageEnabled !== false}
                        disabled={!row.imageUrl}
                        onChange={(e) => updateRow(idx, { imageEnabled: e.target.checked })}
                      />
                      Zobrazit obrázek
                    </label>
                  ) : null}

                  <div style={rowSettingsSectionLabel}>Panáček</div>
                  <label style={checkRowStyle}>
                    <input
                      type="checkbox"
                      checked={row.showMascot === true}
                      onChange={(e) => updateRow(idx, { showMascot: e.target.checked })}
                    />
                    Panáček na začátku linky
                  </label>

                  <div style={rowSettingsSectionLabel}>Tužka</div>
                  <label style={checkRowStyle}>
                    <input
                      type="checkbox"
                      checked={row.showStartPencil === true}
                      onChange={(e) => updateRow(idx, { showStartPencil: e.target.checked })}
                    />
                    Tužka na začátku linky
                  </label>
                  <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                    Ukáže začátek předpisu na tomto řádku (jako ve školních sešitech).
                  </p>

                  <div style={rowSettingsSectionLabel}>Vodící tečky</div>
                  <label style={checkRowStyle}>
                    <input
                      type="checkbox"
                      checked={row.guideDots === 'on'}
                      onChange={(e) => updateRow(idx, { guideDots: e.target.checked ? 'on' : 'off' })}
                    />
                    Zapnout tečky
                  </label>
                  <p style={{ fontSize: 10, color: '#64748b', margin: '6px 0 0 28px', lineHeight: 1.4 }}>
                    Výška první tečky podle prvního písmene; stejný vzor se opakuje po řádku podle toho, jak je dlouhý
                    celý předpis na řádku.
                  </p>
                </div>
              ) : null}

              <label style={{ ...labelStyle, fontSize: 10 }}>Text předpisu (prázdné = jen linky)</label>
              <input
                type="text"
                style={{ ...inputStyle, width: '100%', marginBottom: 8 }}
                value={row.text}
                onChange={(e) => updateRow(idx, { text: e.target.value })}
                placeholder="např. Ano,"
              />

              {row.allowRowImage === true ? (
                <>
                  <label style={{ ...labelStyle, fontSize: 10 }}>Obrázek vzadu (volitelné)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => openAssetPicker({ type: 'pisanka-row-image', rowIndex: idx })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid #475569',
                        background: '#1e293b',
                        color: '#e2e8f0',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <ImageIcon size={14} />
                      Vybrat obrázek
                    </button>
                    {row.imageUrl ? (
                      <>
                        <img
                          src={row.imageUrl}
                          alt=""
                          style={{ maxHeight: 44, maxWidth: 80, objectFit: 'contain', borderRadius: 4 }}
                        />
                        <button
                          type="button"
                          onClick={() => clearRowImage(idx)}
                          style={{
                            fontSize: 10,
                            color: '#f87171',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Odebrat obrázek
                        </button>
                      </>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <details style={{ marginTop: 12 }}>
        <summary style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>Barvy linek a předpisu</summary>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <div>
            <label style={labelStyle}>Tenké linky</label>
            <ColorPickerField value={mini.lineThin ?? '#93c5fd'} onChange={(c) => patchMini({ lineThin: c })} />
          </div>
          <div>
            <label style={labelStyle}>Tlusté linky (základní + horní okraj pásu)</label>
            <ColorPickerField value={mini.lineThick ?? '#2563eb'} onChange={(c) => patchMini({ lineThick: c })} />
          </div>
          <div>
            <label style={labelStyle}>Výplň pásu (x-výška)</label>
            <ColorPickerField value={mini.bandFill ?? 'rgba(147, 197, 253, 0.35)'} onChange={(c) => patchMini({ bandFill: c })} />
          </div>
          <div>
            <label style={labelStyle}>Barva předepsaného textu</label>
            <ColorPickerField value={mini.traceColor ?? '#1e40af'} onChange={(c) => patchMini({ traceColor: c })} />
          </div>
        </div>
      </details>

      {import.meta.env.DEV ? <PisankaGuideDotsDevPanel /> : null}
    </div>
  );
}
