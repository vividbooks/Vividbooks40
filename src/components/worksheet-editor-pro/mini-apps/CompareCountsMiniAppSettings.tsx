/**
 * Pravý panel: nastavení miniaplikace „Porovnávání počtů“ (paragraph + miniApp).
 * Nahoře vzhled karty (sdílený), pod tím příklady 1–9 (jako podotázky).
 */

import { useState } from 'react';
import type { CompareCountsExample, ParagraphBlock, WorksheetBlock } from '../../../types/worksheet';
import { ColorPickerField } from '../block-settings/ColorPickerField';
import {
  inputStyle,
  labelStyle,
  sectionTitleStyle,
  subtleCardStyle,
  FONT_FAMILIES,
} from '../block-settings/shared';
import {
  applyCountDraftToExample,
  buildCompareCountsHtml,
  createEmptyGroup,
  MAX_COMPARE_COUNTS_EXAMPLES,
  MAX_COMPARE_GROUPS_PER_SIDE,
  mergeCompareCountsMiniApp,
} from '../../../utils/mini-apps/compare-counts';
import { legacyQuestionStringToHtml } from '../../../utils/worksheet-text';
import { loadStickerCatalog } from '../../../features/board-v2/annotations/sticker-library';
import { CompareCountsStickerField } from './CompareCountsStickerField';

const AI_GENERATE_SYSTEM = `Jsi asistent pro české pracovní listy (matematika 1. stupeň). Odpovídej POUZE platným JSON, bez markdown, bez komentářů.
Formát odpovědi přesně:
{"examples":[ ... přesně 8 objektů ... ]}
Každý objekt má tvar:
{"leftGroups":[{"count":číslo},...],"rightGroups":[{"count":číslo},...]}
Počty jsou celá čísla 0–40. Počet položek v leftGroups a rightGroups musí v každém z 8 příkladů odpovídat šabloně (stejná délka polí jako v šabloně).

DŮLEŽITÉ — OBTÍŽNOST:
Nejprve si z prvního příkladu (počty v uživatelské zprávě) odvoď úroveň obtížnosti (malá čísla + malý rozdíl = začáteční; větší čísla nebo větší rozdíly = těžší).
Všech 8 nových příkladů musí být na **stejné nebo velmi blízké úrovni** jako tento vzor — ne skok na úplně jiné řády (např. ze 2 a 3 nesmíš najednou dávat 28 a 31).
Dodrž doporučené číselné pásmo z uživatelské zprávy. Střídej vztahy větší / menší / rovno.
Obrázky se nepřidávají — jen počty. Nepřidávej stickerUrl ani jiná pole.`;

/** Z prvního příkladu odvodíme pásmo počtů a text pro prompt (konzistentní úroveň s šablonou). */
function buildDifficultyBlockFromTemplate(ex: CompareCountsExample): string {
  const left = ex.leftGroups.map((g) => g.count);
  const right = ex.rightGroups.map((g) => g.count);
  const all = [...left, ...right].filter((n) => Number.isFinite(n));
  if (all.length === 0) {
    return `Obtížnost: šablona bez počtů — použij mírnou úroveň (typicky počty 1–8), vhodné pro 1. ročník.`;
  }
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(0, max - min);
  const leftSum = ex.leftGroups.reduce((s, g) => s + g.count, 0);
  const rightSum = ex.rightGroups.reduce((s, g) => s + g.count, 0);
  const sideDiff = Math.abs(leftSum - rightSum);

  const padLo = Math.max(1, 1 + Math.ceil(span / 2));
  const padHi = Math.max(2, 2 + Math.ceil(span / 2));
  const lo = Math.max(0, min - padLo);
  const hi = Math.min(40, max + padHi);

  let levelCz = 'střední';
  if (max <= 5 && sideDiff <= 2) levelCz = 'začáteční (1.–2. ročník)';
  else if (max <= 10 && sideDiff <= 4) levelCz = 'lehká až střední';
  else if (max >= 18 || sideDiff >= 8) levelCz = 'náročnější';

  return [
    `Počty ve vzorovém příkladu — levá: [${left.join(', ')}], pravá: [${right.join(', ')}].`,
    `Součty stran: levá ${leftSum}, pravá ${rightSum} (abs. rozdíl ${sideDiff}).`,
    `Rozsah čísel ve vzoru: min ${min}, max ${max}.`,
    `Odhad úrovně: **${levelCz}**.`,
    `Pro všech 8 nových příkladů drž jednotlivé počty převážně v intervalu **${lo}–${hi}** (výjimečně ±1–2 mimo, ale ne dramaticky).`,
    `Typ obtížnosti porovnání má být podobný vzoru (např. těsné srovnání vs. zřetelný rozdíl).`,
  ].join('\n');
}

function parseAiCompareExamplesJson(text: string): { leftGroups: { count: number }[]; rightGroups: { count: number }[] }[] {
  let t = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) t = fence[1].trim();
  const obj = JSON.parse(t) as { examples?: unknown };
  const arr = Array.isArray(obj.examples) ? obj.examples : Array.isArray(obj) ? (obj as unknown[]) : null;
  if (!arr) throw new Error('V odpovědi chybí pole examples');
  return arr as { leftGroups: { count: number }[]; rightGroups: { count: number }[] }[];
}

interface CompareCountsMiniAppSettingsProps {
  block: WorksheetBlock;
  onUpdateBlock: (id: string, patch: Partial<WorksheetBlock>) => void;
}

export function CompareCountsMiniAppSettings({ block, onUpdateBlock }: CompareCountsMiniAppSettingsProps) {
  const pb = block as ParagraphBlock;
  const mini = mergeCompareCountsMiniApp(undefined, (pb.content.miniApp as any) ?? {});
  const [isGeneratingExamples, setIsGeneratingExamples] = useState(false);

  const patchMini = (patch: Parameters<typeof mergeCompareCountsMiniApp>[1]) => {
    const next = mergeCompareCountsMiniApp(mini, patch);
    onUpdateBlock(block.id, {
      content: {
        ...pb.content,
        miniApp: next,
        html: buildCompareCountsHtml(next),
      },
    } as any);
  };

  const setExamples = (examples: CompareCountsExample[]) => {
    patchMini({ examples: examples.slice(0, MAX_COMPARE_COUNTS_EXAMPLES) });
  };

  const updateExample = (id: string, fn: (ex: CompareCountsExample) => CompareCountsExample) => {
    setExamples(mini.examples.map((ex) => (ex.id === id ? fn(ex) : ex)));
  };

  const removeExample = (id: string) => {
    if (mini.examples.length <= 1) return;
    setExamples(mini.examples.filter((ex) => ex.id !== id));
  };

  const combine = !!mini.combineMultipleTypesPerSide;

  const generateNineExamplesWithAi = async () => {
    const template = mini.examples[0];
    if (!template) return;
    if (mini.examples.length > 1) {
      const ok = window.confirm(
        'Vygeneruje se 8 nových příkladů podle prvního příkladu. Příklady 2+ budou nahrazeny. Pokračovat?',
      );
      if (!ok) return;
    }
    setIsGeneratingExamples(true);
    try {
      const catalog = await loadStickerCatalog();
      const stickerPool = catalog.flatMap((c) => c.rows.flatMap((r) => r.items.map((it) => ({ id: it.id, url: it.url }))));
      if (stickerPool.length === 0) {
        throw new Error('Nepodařilo se načíst katalog nálepek (zkontrolujte připojení).');
      }

      const { chatWithAIProxy } = await import('../../../utils/ai-chat-proxy');
      const templateShape = {
        leftGroups: template.leftGroups.map((g) => ({ count: g.count })),
        rightGroups: template.rightGroups.map((g) => ({ count: g.count })),
      };
      const difficultyBlock = buildDifficultyBlockFromTemplate(template);
      const userPrompt = `Zadání úlohy (kontext):\n"""${(mini.question ?? '').trim() || '(bez textu)'}"""\n\n---\n**1) OBTÍŽNOST PODLE PRVNÍHO PŘÍKLADU (povinně respektuj)**\n${difficultyBlock}\n---\n**2) Tvar JSON (jen počty; obrázky doplní aplikace)**\n${JSON.stringify(templateShape)}\n\n${combine ? 'Režim „více typů na straně“ — stejný počet skupin vlevo/vpravo jako ve vzoru.' : 'Jedna skupina vlevo, jedna vpravo.'}\n\nVygeneruj **přesně 8** nových příkladů na stejné úrovni obtížnosti jako vzor. JSON podle systémových instrukcí.`;
      const raw = await chatWithAIProxy(
        [
          { role: 'system', content: AI_GENERATE_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        'gemini-3-flash',
        { temperature: 0.78, max_tokens: 4096 },
      );
      const drafts = parseAiCompareExamplesJson(raw);
      if (drafts.length < 8) {
        throw new Error(`AI vrátila jen ${drafts.length} příkladů, očekáváno 8.`);
      }
      const eight = drafts.slice(0, 8).map((d) =>
        applyCountDraftToExample(template, d, { useRandomStickers: true, stickerPool }),
      );
      setExamples([template, ...eight]);
    } catch (e) {
      console.error(e);
      window.alert(
        e instanceof Error
          ? `Generování se nepovedlo: ${e.message}`
          : 'Generování se nepovedlo. Zkuste to znovu.',
      );
    } finally {
      setIsGeneratingExamples(false);
    }
  };

  const renderGroupEditor = (
    exId: string,
    side: 'leftGroups' | 'rightGroups',
    label: string
  ) => {
    const ex = mini.examples.find((e) => e.id === exId);
    if (!ex) return null;
    const groups = ex[side].length ? ex[side] : [createEmptyGroup()];

    const setGroups = (next: typeof groups) => {
      updateExample(exId, (e) => ({ ...e, [side]: next }));
    };

    const rows = combine ? groups : [groups[0] ?? createEmptyGroup()];

    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>{label}</div>
        {rows.map((g, idx) => (
          <div
            key={`${exId}-${side}-${idx}`}
            style={{
              marginBottom: combine ? 12 : 0,
            }}
          >
            <CompareCountsStickerField
              stickerUrl={g.stickerUrl}
              count={g.count}
              onCountChange={(n) => {
                const next = [...groups];
                next[idx] = { ...next[idx], count: n };
                if (!combine) setGroups([next[0] || createEmptyGroup()]);
                else setGroups(next);
              }}
              onSelect={(item) => {
                const next = [...groups];
                next[idx] = {
                  ...next[idx],
                  stickerUrl: item.url,
                  stickerId: item.id,
                };
                if (!combine) setGroups([next[0] || createEmptyGroup()]);
                else setGroups(next);
              }}
              onClear={() => {
                const next = [...groups];
                next[idx] = { ...next[idx], stickerUrl: undefined, stickerId: undefined };
                if (!combine) setGroups([next[0] || createEmptyGroup()]);
                else setGroups(next);
              }}
            />
            {combine && groups.length > 1 && (
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setGroups(groups.filter((_, i) => i !== idx))}
                  style={{
                    fontSize: 11,
                    color: '#f87171',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Odstranit typ
                </button>
              </div>
            )}
          </div>
        ))}
        {combine && groups.length < MAX_COMPARE_GROUPS_PER_SIDE && (
          <button
            type="button"
            onClick={() => setGroups([...groups, createEmptyGroup()])}
            style={{
              marginTop: 4,
              fontSize: 11,
              color: '#a5b4fc',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid #4c1d95',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            + Další typ na {label.toLowerCase().includes('lev') ? 'levé' : 'pravé'} straně
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div style={{ ...subtleCardStyle, marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid #334155' }}>
        <h3 style={{ ...sectionTitleStyle, marginBottom: 10 }}>Zadání úlohy (aktivita)</h3>
        <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.45 }}>
          Stejný vzhled jako u klasické otázky — kroužek s číslem a text zadání. Úpravy textu také přímo na stránce.
        </p>
        <label style={labelStyle}>Text zadání</label>
        <textarea
          style={{ ...inputStyle, width: '100%', minHeight: 72, resize: 'vertical', fontFamily: 'inherit' }}
          value={mini.question ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            patchMini({
              question: v,
              questionHtml: legacyQuestionStringToHtml(v),
            });
          }}
          placeholder="Zde zadejte otázku nebo zadání, které se vztahuje k úloze…"
        />
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Kroužek a číslo aktivity</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <ColorPickerField
              value={mini.circleColor ?? '#1e293b'}
              onChange={(c) => patchMini({ circleColor: c })}
            />
            <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>Velikost</span>
              <input
                type="range"
                min={16}
                max={32}
                value={mini.circleSize ?? 21}
                onChange={(e) => patchMini({ circleSize: parseInt(e.target.value, 10) })}
                style={{ flex: 1, height: 4 }}
              />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Písmo zadání</label>
          <select
            style={{ ...inputStyle, width: '100%', marginBottom: 8 }}
            value={mini.qFontFamily ?? ''}
            onChange={(e) => patchMini({ qFontFamily: e.target.value || undefined })}
          >
            <option value="">Výchozí (Fenomen Sans)</option>
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Velikost (pt)</label>
              <input
                type="number"
                min={8}
                max={28}
                style={{ ...inputStyle, width: '100%' }}
                value={mini.qFontSize ?? ''}
                placeholder="auto"
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  patchMini({ qFontSize: Number.isFinite(n) ? n : undefined });
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Řádkování</label>
              <input
                type="number"
                step={0.05}
                min={1}
                max={2.5}
                style={{ ...inputStyle, width: '100%' }}
                value={mini.qLineHeight ?? 1.2}
                onChange={(e) => patchMini({ qLineHeight: parseFloat(e.target.value) || 1.2 })}
              />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>Barva textu zadání</label>
            <ColorPickerField value={mini.qTextColor ?? '#1e293b'} onChange={(c) => patchMini({ qTextColor: c })} />
          </div>
          <label style={{ ...labelStyle, marginTop: 10 }}>Zarovnání</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['left', 'center', 'right', 'justify'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => patchMini({ qAlign: a })}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${(mini.qAlign ?? 'left') === a ? '#6366f1' : '#334155'}`,
                  background: (mini.qAlign ?? 'left') === a ? 'rgba(99,102,241,0.15)' : '#0f172a',
                  color: '#e2e8f0',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {a === 'left' ? 'Vlevo' : a === 'center' ? 'Střed' : a === 'right' ? 'Vpravo' : 'Do bloku'}
              </button>
            ))}
          </div>
          <label style={{ ...labelStyle, marginTop: 10 }}>Styl</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!mini.qIsBold}
                onChange={(e) => patchMini({ qIsBold: e.target.checked })}
              />
              Tučné
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!mini.qIsItalic}
                onChange={(e) => patchMini({ qIsItalic: e.target.checked })}
              />
              Kurzíva
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!mini.qIsUnderline}
                onChange={(e) => patchMini({ qIsUnderline: e.target.checked })}
              />
              Podtržení
            </label>
          </div>
        </div>
      </div>

      {/* Sdílený vzhled karty */}
      <div style={{ ...subtleCardStyle, marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid #334155' }}>
        <h3 style={{ ...sectionTitleStyle, marginBottom: 8 }}>Vzhled karty (všechny příklady)</h3>
        <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12, lineHeight: 1.45 }}>
          Rámeček, barvy, prostřední čtvereček a volby zápisu platí stejně pro všech až {MAX_COMPARE_COUNTS_EXAMPLES}{' '}
          příkladů. Na stránce se příklady skládají do mřížky (max 3 vedle sebe).
        </p>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            fontSize: 12,
            color: '#cbd5e1',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={!!mini.showNumericRow}
            onChange={(e) => patchMini({ showNumericRow: e.target.checked })}
          />
          Číselný zápis pod úlohou
        </label>

        {mini.showNumericRow && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
              marginLeft: 22,
              fontSize: 12,
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={mini.showNumericSolution !== false}
              onChange={(e) => patchMini({ showNumericSolution: e.target.checked })}
            />
            Zobrazit řešení (čísla v řádku — vypnuto = neviditelná, zůstane prostor na zápis)
          </label>
        )}

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            fontSize: 12,
            color: '#cbd5e1',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={combine}
            onChange={(e) => {
              const on = e.target.checked;
              if (!on) {
                patchMini({
                  combineMultipleTypesPerSide: false,
                  examples: mini.examples.map((ex) => ({
                    ...ex,
                    leftGroups: [ex.leftGroups[0] ?? createEmptyGroup()],
                    rightGroups: [ex.rightGroups[0] ?? createEmptyGroup()],
                  })),
                });
              } else {
                patchMini({ combineMultipleTypesPerSide: true });
              }
            }}
          />
          Více typů v jednom poli (číselný řádek s +, např. 4 + 2 … 3 + 2)
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            fontSize: 12,
            color: '#cbd5e1',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={mini.showCenterSlot}
            onChange={(e) => patchMini({ showCenterSlot: e.target.checked })}
          />
          Prostřední čtvereček na zápis (&gt;, &lt;, =) — ve vizuálu i v číselném řádku
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            fontSize: 12,
            color: '#cbd5e1',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={!!mini.randomSymbolPositions}
            onChange={(e) => patchMini({ randomSymbolPositions: e.target.checked })}
          />
          Náhodné pozice symbolů (lehký posun a rotace — u každého příkladu stále stejné)
        </label>

        {mini.showNumericRow && mini.showCenterSlot && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Zvýraznění buňky porovnání (číselný řádek)</label>
            <ColorPickerField
              value={mini.numericCompareHighlight ?? '#ede9fe'}
              onChange={(c) => patchMini({ numericCompareHighlight: c })}
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'start' }}>
          <div>
            <label style={labelStyle}>Výška pole se symboly (px)</label>
            <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 6px', lineHeight: 1.35 }}>
              Pevná výška obou polí; počet symbolů mění jen jejich velikost a mezery uvnitř.
            </p>
            <input
              type="number"
              min={64}
              max={400}
              style={{ ...inputStyle, width: '100%' }}
              value={mini.minHeightPx}
              onChange={(e) => patchMini({ minHeightPx: Number(e.target.value) })}
            />
          </div>
          {mini.showCenterSlot && (
            <div>
              <label style={labelStyle}>Střední čtverec ve vizuálu (px)</label>
              <input
                type="number"
                min={24}
                max={120}
                style={{ ...inputStyle, width: '100%' }}
                value={mini.centerSlotSizePx}
                onChange={(e) => patchMini({ centerSlotSizePx: Number(e.target.value) })}
              />
            </div>
          )}
        </div>
        <p style={{ fontSize: 10, color: '#64748b', margin: '8px 0 0', lineHeight: 1.35 }}>
          Velikost symbolů v poli se dopočítá automaticky podle počtu a výšky pole.
        </p>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Barva textu / čísel v úloze</label>
          <ColorPickerField value={mini.textColor} onChange={(c) => patchMini({ textColor: c })} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Rámeček a přepážka</label>
          <ColorPickerField value={mini.innerBorderColor} onChange={(c) => patchMini({ innerBorderColor: c })} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={labelStyle}>Pozadí dvou polí</label>
          <ColorPickerField value={mini.innerBackground} onChange={(c) => patchMini({ innerBackground: c })} />
        </div>
      </div>

      {/* Příklady */}
      <div style={{ ...subtleCardStyle, marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid #334155' }}>
        <h3 style={{ ...sectionTitleStyle, marginBottom: 8 }}>Příklady v aktivitě</h3>
        <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
          Každý příklad = jedna dvojice polí (levá / pravá). Vyber nálepku a počet.{' '}
          {!combine && 'Bez „více typů“ má každá strana jednu nálepku a počet.'}
        </p>

        {mini.examples.map((ex, index) => (
          <div
            key={ex.id}
            style={{
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: index < mini.examples.length - 1 ? '1px solid #334155' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Příklad {index + 1}</span>
              {mini.examples.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExample(ex.id)}
                  style={{
                    fontSize: 11,
                    color: '#f87171',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Odstranit příklad
                </button>
              )}
            </div>
            {renderGroupEditor(ex.id, 'leftGroups', 'Levá strana')}
            {renderGroupEditor(ex.id, 'rightGroups', 'Pravá strana')}
          </div>
        ))}

        {mini.examples.length < MAX_COMPARE_COUNTS_EXAMPLES && (
          <>
            <button
              type="button"
              disabled={isGeneratingExamples}
              onClick={() => void generateNineExamplesWithAi()}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px dashed #6366f1',
                background: isGeneratingExamples ? 'rgba(99,102,241,0.04)' : 'rgba(99,102,241,0.08)',
                color: '#c4b5fd',
                fontSize: 12,
                fontWeight: 600,
                cursor: isGeneratingExamples ? 'wait' : 'pointer',
                opacity: isGeneratingExamples ? 0.75 : 1,
              }}
            >
              {isGeneratingExamples ? 'Generuji 8 příkladů…' : 'Vygenerovat 9 příkladů (AI podle 1. příkladu)'}
            </button>
            <p style={{ fontSize: 10, color: '#64748b', marginTop: 8, lineHeight: 1.4 }}>
              AI z prvního příkladu odhadne úroveň obtížnosti (velikost čísel, rozdíl stran) a vygeneruje 8 podobně náročných příkladů. Nálepky se u nových řádků vybírají náhodně z katalogu.
            </p>
          </>
        )}
      </div>
    </>
  );
}
