import React from 'react';
import { Check, X, Plus } from 'lucide-react';
import { ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { WorksheetBlock } from '../../../types/worksheet';
import { MultipleChoiceBlock, PlayfulAnswerShape, PlayfulAnswerStyle } from '../../../types/worksheet';
import { inputStyle, labelStyle, buttonStyle, subtleCardStyle, SIDEBAR_COLORS } from './shared';
import { ColorPickerField } from './ColorPickerField';

const TEXT_COLORS = [
  { value: '#ef4444', label: 'Červená' },
  { value: '#f97316', label: 'Oranžová' },
  { value: '#eab308', label: 'Žlutá' },
  { value: '#22c55e', label: 'Zelená' },
  { value: '#3b82f6', label: 'Modrá' },
  { value: '#8b5cf6', label: 'Fialová' },
  { value: '#ec4899', label: 'Růžová' },
  { value: '#14b8a6', label: 'Tyrkysová' },
  { value: '#f59e0b', label: 'Zlatá' },
  { value: '#FFFFFF', label: 'Bílá' },
  { value: '#1e293b', label: 'Tmavá' },
  { value: '#94a3b8', label: 'Šedá' },
];

const RANDOM_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
];

const RANDOM_SHAPES: Exclude<PlayfulAnswerShape, 'mix'>[] = [
  'circle', 'square', 'pill', 'star', 'heart', 'hexagon', 'diamond', 'cloud'
];

function generatePlayfulPositions(count: number, seed: string) {
  const seededRandom = (s: string, idx: number) => {
    const hash = s.split('').reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1) + idx * 31, 0);
    return Math.abs(Math.sin(hash) * 10000) % 1;
  };
  const cols = count <= 4 ? 2 : count <= 6 ? 3 : 4;
  const rows = Math.ceil(count / cols);
  const cellWidth = 100 / cols;
  const cellHeight = 100 / rows;
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const baseX = cellWidth * col + cellWidth / 2;
    const baseY = cellHeight * row + cellHeight / 2;
    const offsetX = (seededRandom(seed, i * 2) - 0.5) * cellWidth * 0.3;
    const offsetY = (seededRandom(seed, i * 2 + 1) - 0.5) * cellHeight * 0.3;
    const rotation = (seededRandom(seed, i * 3) - 0.5) * 24;
    const scale = 90 + seededRandom(seed, i * 4) * 20;
    const shape = RANDOM_SHAPES[Math.floor(seededRandom(seed, i * 5) * RANDOM_SHAPES.length)];
    const color = RANDOM_COLORS[Math.floor(seededRandom(seed, i * 6) * RANDOM_COLORS.length)];
    return {
      x: Math.max(10, Math.min(90, baseX + offsetX)),
      y: Math.max(10, Math.min(90, baseY + offsetY)),
      rotation: Math.round(rotation * 10) / 10,
      scale: Math.round(scale),
      shape, color,
    };
  });
}

// ── Props ─────────────────────────────────────────────────────────────────
interface MultipleChoiceSettingsProps {
  block: WorksheetBlock;
  onUpdateBlock: (id: string, updates: Partial<WorksheetBlock>) => void;
  openAssetPicker: (ctx: { type: string; optionIndex?: number }) => void;
}

export function MultipleChoiceSettings({ block, onUpdateBlock, openAssetPicker }: MultipleChoiceSettingsProps) {
  const mcBlock = block as MultipleChoiceBlock;

  const defaultPlayful = {
    shape: 'circle' as PlayfulAnswerShape,
    style: 'stroke' as PlayfulAnswerStyle,
    primaryColor: '#ef4444',
    textColor: '#ef4444',
    strokeWidth: 2,
    positions: [] as any[],
    randomColors: false,
  };

  const getSettings = () => mcBlock.content.playfulSettings ?? defaultPlayful;

  const updateSettings = (patch: object) =>
    onUpdateBlock(block.id, {
      content: { ...mcBlock.content, playfulSettings: { ...getSettings(), ...patch } }
    } as any);

  return (
    <div style={{ ...subtleCardStyle, marginBottom: '16px' }}>

      {/* Typ odpovědí */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Typ odpovědí</label>
        <select
          value={mcBlock.content.variant || 'text'}
          onChange={(e) => {
            const newVariant = e.target.value as any;
            let updates: any = { content: { ...mcBlock.content, variant: newVariant } };
            if (newVariant === 'playful' || newVariant === 'playful-image') {
              const existing = mcBlock.content.playfulSettings;
              const needsNew = !existing?.positions || existing.positions.length < mcBlock.content.options.length;
              updates.content.playfulSettings = {
                ...defaultPlayful,
                ...existing,
                positions: needsNew ? generatePlayfulPositions(mcBlock.content.options.length, block.id) : existing!.positions,
              };
              updates.content.visualStyle = newVariant;
            } else {
              updates.content.visualStyle = 'list';
            }
            onUpdateBlock(block.id, updates as Partial<MultipleChoiceBlock>);
          }}
          style={{ ...inputStyle, height: '34px', padding: '0 12px', color: SIDEBAR_COLORS.text, cursor: 'pointer' }}
        >
          <option value="text">📝 ABC text</option>
          <option value="mixed">🖼️ ABC text + obrázky</option>
          <option value="image">🎨 ABC obrázky</option>
          <option value="boolean">✅ Ano / Ne</option>
          <option value="playful">🎯 Hravé ABC</option>
          <option value="playful-image">🖼️ Hravé obrázky</option>
        </select>
      </div>

      {/* Playful settings */}
      {(mcBlock.content.variant === 'playful' || mcBlock.content.variant === 'playful-image') && (
        <div style={{ ...subtleCardStyle, marginBottom: '16px', backgroundColor: SIDEBAR_COLORS.panelAlt }}>
          <label style={{ ...labelStyle, color: '#f59e0b', marginBottom: '12px', display: 'block' }}>🎨 Nastavení hravého stylu</label>

          {/* Shape */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, fontSize: '10px' }}>Tvar</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {[
                { value: 'circle', label: '⭕ Kolečka' }, { value: 'square', label: '⬜ Čtverce' },
                { value: 'pill', label: '💊 Bobánky' }, { value: 'bubble', label: '💬 Bubliny' },
                { value: 'heart', label: '❤️ Srdce' }, { value: 'hexagon', label: '⬡ Šestiúhel.' },
                { value: 'diamond', label: '◇ Kosočtv.' }, { value: 'cloud', label: '☁️ Mráčky' },
                { value: 'mix', label: '🎲 Mix' },
              ].map(shape => (
                <button key={shape.value}
                  onClick={() => updateSettings({ shape: shape.value as PlayfulAnswerShape })}
                  style={{ ...buttonStyle, justifyContent: 'center', fontSize: '9px', padding: '6px 2px',
                    backgroundColor: (getSettings().shape || 'circle') === shape.value ? '#f59e0b' : '#334155',
                    color: (getSettings().shape || 'circle') === shape.value ? '#0f172a' : '#94a3b8' }}
                >{shape.label}</button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, fontSize: '10px' }}>Styl</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[{ value: 'stroke', label: 'Obrys' }, { value: 'fill', label: 'Výplň' }].map(s => (
                <button key={s.value}
                  onClick={() => updateSettings({ style: s.value as PlayfulAnswerStyle })}
                  style={{ ...buttonStyle, flex: 1, justifyContent: 'center', fontSize: '11px', padding: '8px 4px',
                    backgroundColor: (getSettings().style || 'stroke') === s.value ? '#f59e0b' : '#334155',
                    color: (getSettings().style || 'stroke') === s.value ? '#0f172a' : '#94a3b8' }}
                >{s.label}</button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ ...labelStyle, fontSize: '10px' }}>Barva tvaru</label>
            <ColorPickerField
              value={getSettings().primaryColor || '#ef4444'}
              palette={TEXT_COLORS}
              placeholder={getSettings().randomColors ? '🎲 Náhodné barvy' : 'Vlastní barva'}
              defaultCustomColor="#ef4444"
              onChange={(color) => updateSettings({ primaryColor: color, textColor: color, randomColors: false })}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button onClick={() => {
                const pos = getSettings().positions || [];
                updateSettings({ randomColors: true, positions: pos.map((p: any, i: number) => ({ ...p, color: RANDOM_COLORS[i % RANDOM_COLORS.length] })) });
              }} style={{ flex: 1, padding: '8px', backgroundColor: getSettings().randomColors ? '#5C5CFF' : '#334155', color: getSettings().randomColors ? 'white' : '#94a3b8', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                🎲 Náhodné barvy
              </button>
              {getSettings().randomColors && (
                <button onClick={() => {
                  const shuffled = [...RANDOM_COLORS].sort(() => Math.random() - 0.5);
                  const pos = getSettings().positions || [];
                  updateSettings({ positions: pos.map((p: any, i: number) => ({ ...p, color: shuffled[i % shuffled.length] })) });
                }} style={{ padding: '8px 12px', backgroundColor: '#334155', color: '#94a3b8', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }} title="Vygenerovat nové barvy">🔄</button>
              )}
            </div>
          </div>

          {/* Regenerate positions */}
          <button onClick={() => {
            updateSettings({ positions: generatePlayfulPositions(mcBlock.content.options.length, Date.now().toString()) });
            toast.success('Pozice přegenerovány!');
          }} style={{ width: '100%', padding: '8px 12px', backgroundColor: '#334155', border: '1px dashed #475569', borderRadius: '6px', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            🔄 Přegenerovat pozice
          </button>
        </div>
      )}

      {/* Layout (text variant) */}
      {(mcBlock.content.variant || 'text') === 'text' && (
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Rozložení odpovědí</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[{ value: 1, label: 'Pod sebou' }, { value: 2, label: '2 sloupce' }, { value: 4, label: 'V řádku' }].map(l => (
              <button key={l.value}
                onClick={() => onUpdateBlock(block.id, { content: { ...mcBlock.content, gridColumns: l.value } } as any)}
                style={{ ...buttonStyle, flex: 1, justifyContent: 'center', fontSize: '10px',
                  backgroundColor: (mcBlock.content.gridColumns || 1) === l.value ? '#5C5CFF' : '#334155',
                  color: (mcBlock.content.gridColumns || 1) === l.value ? 'white' : '#94a3b8' }}
              >{l.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Answers header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderTop: '1px solid #333', paddingTop: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#CCCCCC' }}>MOŽNOSTI ODPOVĚDÍ</span>
      </div>

      {/* Boolean variant */}
      {mcBlock.content.variant === 'boolean' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {['Ano', 'Ne'].map((label, idx) => {
            const optionId = `opt-bool-${idx}`;
            const isCorrect = mcBlock.content.correctAnswers.includes(optionId);
            if (!mcBlock.content.options.find(o => o.id === optionId)) {
              const newOpts = [...mcBlock.content.options];
              if (!newOpts.find(o => o.id === optionId)) {
                newOpts.push({ id: optionId, text: label });
                onUpdateBlock(block.id, { content: { ...mcBlock.content, options: newOpts } } as any);
              }
            }
            return (
              <div key={optionId} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <div style={{ flex: 1, padding: '8px 12px', backgroundColor: '#334155', borderRadius: '6px', color: '#E5E5E5', fontSize: '12px', fontWeight: 500 }}>{label}</div>
                <button onClick={() => onUpdateBlock(block.id, { content: { ...mcBlock.content, correctAnswers: [optionId] } } as any)}
                  style={{ ...buttonStyle, width: 32, height: 32, padding: 0, justifyContent: 'center', backgroundColor: isCorrect ? '#10B981' : '#334155', color: isCorrect ? 'white' : '#94a3b8' }}>
                  <Check size={16} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* Image size + letter position for image/mixed variants */}
          {(mcBlock.content.variant === 'image' || mcBlock.content.variant === 'mixed') && (
            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Velikost obrázků</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[{ value: 2, label: 'Malé' }, { value: 3, label: 'Střední' }, { value: 4, label: 'Velké' }, { value: 6, label: 'Max' }].map(size => (
                    <button key={size.value}
                      onClick={() => onUpdateBlock(block.id, { content: { ...mcBlock.content, gridColumns: 12 / size.value } } as any)}
                      style={{ ...buttonStyle, flex: 1, justifyContent: 'center',
                        backgroundColor: mcBlock.content.gridColumns === 12 / size.value ? '#5C5CFF' : '#334155',
                        color: mcBlock.content.gridColumns === 12 / size.value ? 'white' : '#94a3b8' }}
                    >{size.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Pozice písmen</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[{ value: 'bottom', label: 'Pod obrázkem' }, { value: 'overlay', label: 'V rohu' }].map(pos => (
                    <button key={pos.value}
                      onClick={() => onUpdateBlock(block.id, { content: { ...mcBlock.content, letterPosition: pos.value as any } } as any)}
                      style={{ ...buttonStyle, flex: 1, justifyContent: 'center',
                        backgroundColor: (mcBlock.content.letterPosition || 'bottom') === pos.value ? '#5C5CFF' : '#334155',
                        color: (mcBlock.content.letterPosition || 'bottom') === pos.value ? 'white' : '#94a3b8' }}
                    >{pos.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Options list */}
          {(mcBlock.content.options || []).map((option, idx) => (
            <div key={option.id} style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, borderRadius: '4px', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', color: '#808080', flexShrink: 0, marginTop: '4px' }}>
                {String.fromCharCode(65 + idx)}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {mcBlock.content.variant !== 'image' && mcBlock.content.variant !== 'playful-image' && (
                  <input type="text" value={option.text}
                    onChange={e => {
                      const newOpts = [...(mcBlock.content.options || [])];
                      newOpts[idx] = { ...option, text: e.target.value };
                      onUpdateBlock(block.id, { content: { ...mcBlock.content, options: newOpts } } as any);
                    }}
                    placeholder={`Možnost ${String.fromCharCode(65 + idx)}`}
                    style={{ ...inputStyle, width: '100%' }} />
                )}
                {(mcBlock.content.variant === 'mixed' || mcBlock.content.variant === 'image' || mcBlock.content.variant === 'playful-image') && (
                  <div style={{ height: mcBlock.content.variant === 'image' || mcBlock.content.variant === 'playful-image' ? 80 : 40, backgroundColor: '#0f172a', borderRadius: '4px', border: '1px dashed #475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
                    onClick={() => openAssetPicker({ type: 'mc-option', optionIndex: idx })}>
                    {option.imageUrl
                      ? <img src={option.imageUrl} style={{ height: '100%', width: '100%', objectFit: 'cover' }} alt="" />
                      : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><ImageIcon size={14} style={{ color: '#64748b' }} />{(mcBlock.content.variant === 'image' || mcBlock.content.variant === 'playful-image') && <span style={{ fontSize: '9px', color: '#475569' }}>Vložit obrázek</span>}</div>}
                  </div>
                )}
              </div>
              <button onClick={() => {
                const newCorrect = mcBlock.content.correctAnswers.includes(option.id)
                  ? mcBlock.content.correctAnswers.filter(id => id !== option.id)
                  : [...mcBlock.content.correctAnswers, option.id];
                onUpdateBlock(block.id, { content: { ...mcBlock.content, correctAnswers: newCorrect } } as any);
              }} style={{ ...buttonStyle, width: 32, height: 32, padding: 0, justifyContent: 'center', flexShrink: 0, backgroundColor: mcBlock.content.correctAnswers.includes(option.id) ? '#10B981' : '#334155', color: mcBlock.content.correctAnswers.includes(option.id) ? 'white' : '#94a3b8' }}>
                <Check size={16} />
              </button>
              <button onClick={() => {
                const newOpts = (mcBlock.content.options || []).filter(o => o.id !== option.id);
                const newCorrect = mcBlock.content.correctAnswers.filter(id => id !== option.id);
                onUpdateBlock(block.id, { content: { ...mcBlock.content, options: newOpts, correctAnswers: newCorrect } } as any);
              }} style={{ ...buttonStyle, width: 32, height: 32, padding: 0, justifyContent: 'center', color: '#EF4444', backgroundColor: 'transparent', flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>
          ))}

          {/* Add option */}
          <button onClick={() => {
            const newOpts = [...(mcBlock.content.options || [])];
            newOpts.push({ id: `opt-${Date.now()}`, text: `Možnost ${String.fromCharCode(65 + newOpts.length)}` });
            onUpdateBlock(block.id, { content: { ...mcBlock.content, options: newOpts } } as any);
          }} style={{ ...buttonStyle, width: '100%', marginTop: '8px', justifyContent: 'center', backgroundColor: '#3B82F6', color: 'white' }}>
            <Plus size={14} /> Přidat možnost
          </button>
        </>
      )}
    </div>
  );
}
