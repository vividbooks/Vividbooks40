/**
 * ProAddContentPanel - Dark mode panel for adding content in PRO editor
 * Tabs: Blok (individual blocks) | Layout (full layout presets with placeholders)
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Type,
  AlignLeft,
  ListChecks,
  PenLine,
  MessageSquare,
  Square,
  Calculator,
  ImageIcon,
  Table,
  Link2,
  MapPin,
  Video,
  Info,
  FileText,
  QrCode,
  GripVertical,
  Figma,
  LayoutTemplate,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { BlockType, WorksheetBlock } from '../../types/worksheet';
import { createCompareCountsParagraphBlock } from '../../utils/mini-apps/compare-counts';
import { createPisankaParagraphBlock } from '../../utils/mini-apps/pisanka';
import {
  SIDEBAR_COLORS,
  sidebarContentStyle,
  sectionTitleStyle,
  subtleCardStyle,
  buttonStyle,
  getSegmentedButtonStyle,
} from './block-settings/shared';

interface LayoutSeriesItem {
  key: string;
  label: string;
  description: string;
  group: string;
  svgPreview?: string;
}

interface ProAddContentPanelProps {
  onAddBlock: (type: BlockType) => void;
  pendingInsertType?: BlockType | null;
  onInsertAtEnd?: () => void;
  onCancelInsert?: () => void;
  onDragStart?: (type: BlockType) => void;
  onDragEnd?: () => void;
  onInsertLayout?: (seriesKey: string) => void;
  layoutSeries?: LayoutSeriesItem[];
  /** Preferred block types from the active design system — shown with ★ badge */
  preferredBlockTypes?: BlockType[];
  /** Vložení bloků z miniaplikací (např. generovaný odstavec) */
  onInsertMiniAppBlocks?: (blocks: WorksheetBlock[]) => void;
  /** Šířka gridu pro nové miniaplikace — typicky plná šířka listu */
  miniAppGridSpan?: number;
}

const informationBlocks: Array<{
  type: BlockType;
  icon: typeof Type;
  label: string;
}> = [
  { type: 'heading', icon: Type, label: 'Nadpis' },
  { type: 'paragraph', icon: AlignLeft, label: 'Odstavec' },
  { type: 'infobox', icon: Info, label: 'Infobox' },
  { type: 'image', icon: ImageIcon, label: 'Obrázek' },
  { type: 'table', icon: Table, label: 'Tabulka' },
  { type: 'qr-code', icon: QrCode, label: 'QR kód' },
  { type: 'spacer', icon: Square, label: 'Prostor' },
  { type: 'header-footer', icon: FileText, label: 'Hlavička' },
];

const activityBlocks: Array<{
  type: BlockType;
  icon: typeof Type;
  label: string;
}> = [
  { type: 'multiple-choice', icon: ListChecks, label: 'Výběr' },
  { type: 'fill-blank', icon: PenLine, label: 'Doplnění' },
  { type: 'free-answer', icon: MessageSquare, label: 'Volná' },
  { type: 'connect-pairs', icon: Link2, label: 'Spojovačka' },
  { type: 'image-hotspots', icon: MapPin, label: 'Poznávačka' },
  { type: 'video-quiz', icon: Video, label: 'Video' },
  { type: 'examples', icon: Calculator, label: 'Příklady' },
];

const figmaBlocks: Array<{
  type: BlockType;
  icon: typeof Type;
  label: string;
}> = [
  { type: 'free-canvas', icon: Figma, label: 'Figma blok' },
];

const allBlocks = [...informationBlocks, ...activityBlocks, ...figmaBlocks];

const GROUP_LABELS: Record<string, string> = {
  column: 'Jeden sloupec',
  half: 'Polovina stránky 1/2 + 1/2',
  twothirds: 'Dvě třetiny 2/3 + 1/3',
};

const GROUP_ORDER = ['column', 'half', 'twothirds'];

type MiniAppItem = { id: string; label: string; disabled?: boolean };

const miniAppCategories: Array<{
  subject: string;
  grades: Array<{
    key: string;
    label: string;
    apps: MiniAppItem[];
  }>;
}> = [
  {
    subject: 'Matematika',
    grades: [
      {
        key: 'math-1',
        label: '1. ročník',
        apps: [
          { id: 'compare-counts', label: 'Porovnávání počtů' },
          { id: 'count-objects', label: 'Počítání objektů', disabled: true },
          { id: 'number-decompose', label: 'Rozklad čísla', disabled: true },
          { id: 'number-compare', label: 'Porovnávání čísel', disabled: true },
          { id: 'complete-sequence', label: 'Doplň řady', disabled: true },
        ],
      },
      {
        key: 'math-2',
        label: '2. ročník',
        apps: [
          { id: 'add-subtract', label: 'Sčítání a odčítání', disabled: true },
          { id: 'times-intro', label: 'Násobilka — úvod', disabled: true },
          { id: 'word-problems', label: 'Slovní úlohy', disabled: true },
          { id: 'shapes', label: 'Geometrické tvary', disabled: true },
        ],
      },
    ],
  },
  {
    subject: 'Český jazyk',
    grades: [
      {
        key: 'czech-1',
        label: '1. ročník',
        apps: [
          { id: 'pisanka', label: 'Písanka (vázané)' },
          { id: 'word-practice', label: 'Psaníčka slov', disabled: true },
          { id: 'syllables', label: 'Skládání slabik', disabled: true },
          { id: 'letter-fill', label: 'Doplň písmeno', disabled: true },
          { id: 'image-word', label: 'Spoj obrázek se slovem', disabled: true },
        ],
      },
    ],
  },
];

export function ProAddContentPanel({
  onAddBlock,
  pendingInsertType,
  onInsertAtEnd,
  onCancelInsert,
  onDragStart,
  onDragEnd,
  onInsertLayout,
  layoutSeries = [],
  preferredBlockTypes = [],
  onInsertMiniAppBlocks,
  miniAppGridSpan = 12,
}: ProAddContentPanelProps) {
  const [draggingType, setDraggingType] = useState<BlockType | null>(null);
  const [activeTab, setActiveTab] = useState<'block' | 'layout' | 'miniapp'>('block');
  const [hoveredLayout, setHoveredLayout] = useState<string | null>(null);
  const [expandedMiniApps, setExpandedMiniApps] = useState<string[]>(['math-1', 'czech-1']);

  const handleDragStart = (e: React.DragEvent, type: BlockType) => {
    setDraggingType(type);
    e.dataTransfer.setData('application/x-block-type', type);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.(type);
  };

  const handleDragEnd = () => {
    setDraggingType(null);
    onDragEnd?.();
  };

  const toggleMiniAppGroup = (key: string) => {
    setExpandedMiniApps((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleMiniAppClick = (app: MiniAppItem) => {
    if (app.disabled) {
      toast.message('Připravujeme', { description: 'Tato miniaplikace zatím není hotová.' });
      return;
    }
    if (app.id === 'compare-counts') {
      if (!onInsertMiniAppBlocks) {
        toast.error('Vložení miniaplikace není k dispozici.');
        return;
      }
      onInsertMiniAppBlocks([createCompareCountsParagraphBlock(miniAppGridSpan)]);
      return;
    }
    if (app.id === 'pisanka') {
      if (!onInsertMiniAppBlocks) {
        toast.error('Vložení miniaplikace není k dispozici.');
        return;
      }
      onInsertMiniAppBlocks([createPisankaParagraphBlock(miniAppGridSpan)]);
      return;
    }
    toast.message('Miniaplikace', { description: 'Tento typ zatím není napojený.' });
  };

  // Pending insert state (block mode only)
  if (pendingInsertType && activeTab === 'block') {
    const selected = allBlocks.find(b => b.type === pendingInsertType);
    const SelectedIcon = selected?.icon;
    return (
      <div style={{ padding: '16px', height: '100%', overflowY: 'auto', backgroundColor: SIDEBAR_COLORS.panelBg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #334155' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {SelectedIcon && <SelectedIcon size={20} style={{ color: '#5C5CFF' }} />}
          </div>
          <div>
            <p style={{ fontSize: '10px', color: '#808080', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vkládáte</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#E5E5E5' }}>{selected?.label}</p>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#E5E5E5', marginBottom: '12px' }}>Kam vložit?</h2>
          <p style={{ fontSize: '12px', color: '#808080', marginBottom: '24px' }}>Klikněte na modrou linku mezi bloky.</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
            <span style={{ fontSize: '10px', color: '#808080', textTransform: 'uppercase' }}>nebo</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
          </div>

          <button
            onClick={onInsertAtEnd}
            style={{ ...buttonStyle, ...getSegmentedButtonStyle(true), width: '100%', minHeight: '40px', justifyContent: 'center', fontSize: '13px' }}
          >
            Vložit na konec
          </button>
        </div>

        <button
          onClick={onCancelInsert}
          style={{ ...buttonStyle, width: '100%', minHeight: '38px', justifyContent: 'center', marginTop: '16px' }}
        >
          Zrušit
        </button>
      </div>
    );
  }

  // Group layouts by group key
  const groupedLayouts = GROUP_ORDER.map(group => ({
    group,
    label: GROUP_LABELS[group] || group,
    items: layoutSeries.filter(l => l.group === group),
  })).filter(g => g.items.length > 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: SIDEBAR_COLORS.panelBg }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #334155', flexShrink: 0 }}>
        <button
          onClick={() => setActiveTab('block')}
          style={{
            flex: 1,
            padding: '10px 8px',
            fontSize: '11px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            backgroundColor: 'transparent',
            color: activeTab === 'block' ? '#5C5CFF' : '#64748b',
            borderBottom: activeTab === 'block' ? '2px solid #5C5CFF' : '2px solid transparent',
            transition: 'all 0.15s ease',
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
          }}
        >
          <Type size={11} />
          Blok
        </button>
        <button
          onClick={() => setActiveTab('layout')}
          style={{
            flex: 1,
            padding: '10px 8px',
            fontSize: '11px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            backgroundColor: 'transparent',
            color: activeTab === 'layout' ? '#5C5CFF' : '#64748b',
            borderBottom: activeTab === 'layout' ? '2px solid #5C5CFF' : '2px solid transparent',
            transition: 'all 0.15s ease',
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
          }}
        >
          <LayoutTemplate size={11} />
          Layout
        </button>
        <button
          onClick={() => setActiveTab('miniapp')}
          style={{
            flex: 1,
            padding: '10px 8px',
            fontSize: '11px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            backgroundColor: 'transparent',
            color: activeTab === 'miniapp' ? '#5C5CFF' : '#64748b',
            borderBottom: activeTab === 'miniapp' ? '2px solid #5C5CFF' : '2px solid transparent',
            transition: 'all 0.15s ease',
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
          }}
        >
          <Sparkles size={11} />
          Miniaplikace
        </button>
      </div>

      {/* ── BLOK tab ── */}
      {activeTab === 'block' && (
        <div style={{ ...sidebarContentStyle, padding: '12px' }}>
          <h2 style={{ ...sectionTitleStyle, marginBottom: '8px' }}>
            Informace
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '16px' }}>
            {informationBlocks.map(({ type, icon: Icon, label }) => (
              <BlockCard
                key={type}
                type={type}
                icon={<Icon size={20} style={{ color: draggingType === type ? 'white' : '#94a3b8' }} />}
                label={label}
                isDragging={draggingType === type}
                isPreferred={preferredBlockTypes.includes(type)}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onClick={() => onAddBlock(type)}
              />
            ))}
          </div>

          <h2 style={{ ...sectionTitleStyle, marginBottom: '8px' }}>
            Aktivity
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '16px' }}>
            {activityBlocks.map(({ type, icon: Icon, label }) => (
              <BlockCard
                key={type}
                type={type}
                icon={<Icon size={20} style={{ color: draggingType === type ? 'white' : '#94a3b8' }} />}
                label={label}
                isDragging={draggingType === type}
                isPreferred={preferredBlockTypes.includes(type)}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onClick={() => onAddBlock(type)}
              />
            ))}
          </div>

          <h2 style={{ ...sectionTitleStyle, color: '#a78bfa', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Figma size={12} />
            Figma
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
            {figmaBlocks.map(({ type, icon: Icon, label }) => (
              <div
                key={type}
                draggable
                onDragStart={(e) => handleDragStart(e, type)}
                onDragEnd={handleDragEnd}
                onClick={() => onAddBlock(type)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '6px', padding: '12px 8px',
                  backgroundColor: draggingType === type ? '#7c3aed' : '#2d1f4a',
                  borderRadius: '8px', border: '1px solid #4c1d95',
                  cursor: 'grab', transition: 'all 0.1s ease',
                  opacity: draggingType === type ? 0.6 : 1, position: 'relative',
                }}
                onMouseEnter={(e) => { if (draggingType !== type) e.currentTarget.style.backgroundColor = '#3b1f6a'; }}
                onMouseLeave={(e) => { if (draggingType !== type) e.currentTarget.style.backgroundColor = '#2d1f4a'; }}
              >
                <GripVertical size={12} style={{ position: 'absolute', top: '4px', right: '4px', color: '#7c3aed' }} />
                <Icon size={20} style={{ color: draggingType === type ? 'white' : '#a78bfa' }} />
                <span style={{ fontSize: '10px', fontWeight: 500, color: draggingType === type ? 'white' : '#a78bfa', textAlign: 'center' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LAYOUT tab ── */}
      {activeTab === 'layout' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '14px', lineHeight: 1.5 }}>
            Klikni pro vložení layoutu s&nbsp;placeholder&nbsp;obsahem.
          </p>

          {groupedLayouts.map(({ group, label, items }) => (
            <div key={group} style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '10px', fontWeight: 700, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
                {label}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {items.map(item => (
                  <button
                    key={item.key}
                    onClick={() => onInsertLayout?.(item.key)}
                    onMouseEnter={() => setHoveredLayout(item.key)}
                    onMouseLeave={() => setHoveredLayout(null)}
                    title={item.description}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: '6px', padding: '8px 6px 10px',
                      backgroundColor: hoveredLayout === item.key ? '#334155' : '#1e293b',
                      borderRadius: '8px',
                      border: hoveredLayout === item.key ? '1px solid #5C5CFF' : '1px solid #334155',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                    }}
                  >
                    {item.svgPreview ? (
                      <div
                        style={{ width: '100%', borderRadius: '4px', overflow: 'hidden' }}
                        dangerouslySetInnerHTML={{ __html: item.svgPreview }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '52px', backgroundColor: '#334155', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LayoutTemplate size={18} style={{ color: '#475569' }} />
                      </div>
                    )}
                    <span style={{ fontSize: '10px', fontWeight: 600, color: hoveredLayout === item.key ? '#E5E5E5' : '#94a3b8', lineHeight: 1.2 }}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MINIAPLIKACE tab ── */}
      {activeTab === 'miniapp' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '14px', lineHeight: 1.5 }}>
            Vyber miniaplikaci. Hotová je zatím „Porovnávání počtů“ — ostatní přibudou.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {miniAppCategories.map(({ subject, grades }) => (
              <div
                key={subject}
                style={{
                  ...subtleCardStyle,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #334155',
                  backgroundColor: '#1e293b',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#312e81',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Sparkles size={14} style={{ color: '#c4b5fd' }} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#E5E5E5' }}>
                    {subject}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {grades.map((grade) => {
                    const isExpanded = expandedMiniApps.includes(grade.key);
                    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

                    return (
                      <div key={`${subject}-${grade.key}`}>
                        <button
                          type="button"
                          onClick={() => toggleMiniAppGroup(grade.key)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: '1px solid #334155',
                            backgroundColor: isExpanded ? '#273449' : '#243244',
                            color: '#E2E8F0',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ChevronIcon size={14} style={{ color: '#94a3b8' }} />
                            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.2px' }}>
                              {grade.label}
                            </span>
                          </div>
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
                            {grade.apps.length} app
                          </span>
                        </button>

                        {isExpanded && (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                              gap: '8px',
                              marginTop: '8px',
                            }}
                          >
                            {grade.apps.map((app) => {
                              const disabled = !!app.disabled;
                              return (
                                <button
                                  key={`${grade.key}-${app.id}`}
                                  type="button"
                                  onClick={() => handleMiniAppClick(app)}
                                  style={{
                                    aspectRatio: '1 / 1',
                                    borderRadius: '12px',
                                    border: disabled ? '1px solid #1e293b' : '1px solid #334155',
                                    backgroundColor: disabled ? '#1e293b' : '#334155',
                                    color: disabled ? '#64748b' : '#E2E8F0',
                                    padding: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    textAlign: 'center',
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    opacity: disabled ? 0.75 : 1,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: '34px',
                                      height: '34px',
                                      borderRadius: '10px',
                                      backgroundColor: disabled ? '#334155' : '#312e81',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Sparkles size={16} style={{ color: disabled ? '#64748b' : '#c4b5fd' }} />
                                  </div>
                                  <span style={{ fontSize: '11px', fontWeight: 700, lineHeight: 1.25 }}>
                                    {app.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Shared block card component ──────────────────────────────────────────────
function BlockCard({
  type,
  icon,
  label,
  isDragging,
  isPreferred,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  type: BlockType;
  icon: React.ReactNode;
  label: string;
  isDragging: boolean;
  isPreferred?: boolean;
  onDragStart: (e: React.DragEvent, type: BlockType) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, type)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '6px', padding: '12px 8px',
        backgroundColor: isDragging ? '#5C5CFF' : isPreferred ? '#1c2a1c' : '#334155',
        borderRadius: '8px', border: isPreferred ? '1px solid #22c55e40' : 'none',
        cursor: 'grab', transition: 'all 0.1s ease',
        opacity: isDragging ? 0.6 : 1, position: 'relative',
      }}
      onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.backgroundColor = '#475569'; }}
      onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.backgroundColor = isPreferred ? '#1c2a1c' : '#334155'; }}
    >
      <GripVertical size={12} style={{ position: 'absolute', top: '4px', right: '4px', color: '#606060' }} />
      {/* Preferred star badge */}
      {isPreferred && (
        <span style={{ position: 'absolute', top: '3px', left: '5px', fontSize: '9px', color: '#F59E0B', lineHeight: 1 }}>★</span>
      )}
      {icon}
      <span style={{ fontSize: '10px', fontWeight: 500, color: isDragging ? 'white' : '#94a3b8', textAlign: 'center' }}>{label}</span>
    </div>
  );
}
