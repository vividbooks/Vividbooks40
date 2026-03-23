import React from 'react';
import { WorksheetBlock } from '../../../types/worksheet';

// ─── helpers ────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function getBlockLabel(block: WorksheetBlock): string {
  switch (block.type) {
    case 'heading': {
      const text = stripHtml((block.content as any).text || '');
      return text.slice(0, 28) || 'Nadpis';
    }
    case 'image':
      return (block.content as any).alt || 'Obrázek';
    case 'paragraph':
      return 'Odstavec';
    case 'infobox':
      return (block.content as any).title || 'Infobox';
    case 'table':
      return 'Tabulka';
    default:
      return 'Blok';
  }
}

/** Effective mergeCount — supports legacy mergeWithNext */
function effectiveMergeCount(block: WorksheetBlock): number {
  const bs = block.boardSettings;
  if (!bs) return 0;
  if (typeof bs.mergeCount === 'number') return bs.mergeCount;
  return bs.mergeWithNext ? 1 : 0;
}

/**
 * Returns the group leader of `block` if it belongs to a merge group started
 * by a different block, or null if it is itself the leader (mergeCount > 0)
 * or not in any group.
 */
function findGroupLeader(block: WorksheetBlock, allBlocks: WorksheetBlock[]): WorksheetBlock | null {
  const idx = allBlocks.findIndex(b => b.id === block.id);
  if (idx <= 0) return null;

  // Walk backwards — find the closest leader whose range covers idx
  for (let i = idx - 1; i >= Math.max(0, idx - 20); i--) {
    const candidate = allBlocks[i];
    const count = effectiveMergeCount(candidate);
    if (count > 0 && idx - i <= count) {
      return candidate;
    }
    // If this candidate has no merge, break — chain is interrupted
    if (count === 0) break;
  }
  return null;
}

// ─── Toggle ─────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        flexShrink: 0, width: 34, height: 18, borderRadius: 9,
        backgroundColor: checked ? '#7c3aed' : '#334155',
        border: 'none', cursor: 'pointer', position: 'relative', transition: 'background-color 0.15s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 16 : 2,
        width: 14, height: 14, borderRadius: '50%', backgroundColor: '#fff',
        transition: 'left 0.15s', display: 'block',
      }} />
    </button>
  );
}

// ─── Counter ─────────────────────────────────────────────────────────────────

function Counter({
  value, min = 0, max = 10, onChange,
}: { value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{
          width: 22, height: 22, borderRadius: 5, border: 'none',
          backgroundColor: value <= min ? '#1e293b' : '#334155',
          color: value <= min ? '#475569' : '#cbd5e1',
          cursor: value <= min ? 'default' : 'pointer',
          fontSize: 14, fontWeight: 700, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >−</button>
      <span style={{
        minWidth: 18, textAlign: 'center', fontSize: 13, fontWeight: 700,
        color: value > 0 ? '#a78bfa' : '#64748b',
      }}>{value}</span>
      <button
        type="button"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{
          width: 22, height: 22, borderRadius: 5, border: 'none',
          backgroundColor: value >= max ? '#1e293b' : '#334155',
          color: value >= max ? '#475569' : '#cbd5e1',
          cursor: value >= max ? 'default' : 'pointer',
          fontSize: 14, fontWeight: 700, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >+</button>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface BoardSettingsSectionProps {
  block: WorksheetBlock;
  allBlocks?: WorksheetBlock[];
  onUpdateBlock: (id: string, updates: Partial<WorksheetBlock>) => void;
}

export function BoardSettingsSection({ block, allBlocks = [], onUpdateBlock }: BoardSettingsSectionProps) {
  const bs = block.boardSettings ?? {};
  const isFreeAnswer = block.type === 'free-answer';
  const hasSubQ = isFreeAnswer && ((block as any).content?.subQuestions?.length ?? 0) > 0;
  const isActivity = ['multiple-choice', 'free-answer', 'fill-blank', 'connect-pairs', 'image-hotspots', 'examples', 'video-quiz'].includes(block.type);
  const isInformational = ['heading', 'paragraph', 'infobox', 'image', 'table', 'spacer', 'qr-code', 'header-footer'].includes(block.type);

  const updateBS = (patch: Partial<NonNullable<WorksheetBlock['boardSettings']>>) => {
    onUpdateBlock(block.id, { boardSettings: { ...bs, ...patch } } as any);
  };

  // Group state
  const myMergeCount = effectiveMergeCount(block);
  const groupLeader = allBlocks.length > 0 ? findGroupLeader(block, allBlocks) : null;
  const isMember = groupLeader !== null;
  const isLeader = myMergeCount > 0;

  // How many blocks follow that could be merged (max counter limit)
  const myIdx = allBlocks.findIndex(b => b.id === block.id);
  const informationalAfter = allBlocks.slice(myIdx + 1)
    .filter(b => ['heading', 'paragraph', 'infobox', 'image', 'table', 'spacer', 'qr-code'].includes(b.type))
    .length;

  const sectionLabel = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Pokročilé volby</span>
    </div>
  );

  return (
    <div style={{ borderTop: '1px solid #334155', marginTop: 16, paddingTop: 16, paddingBottom: 4 }}>
      {sectionLabel}

      {/* ── Zobrazení boardu header ── */}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8 }}>
        Zobrazení boardu
      </div>

      {/* ── Activity: hide answer ── */}
      {isActivity && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>Skrýt odpověď</div>
            <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>Správná odpověď nebude viditelná</div>
          </div>
          <Toggle checked={!!bs.hideAnswer} onChange={v => updateBS({ hideAnswer: v })} />
        </div>
      )}

      {/* ── Informational: group merge ── */}
      {isInformational && (
        <>
          {/* If this block is a non-leader member of a group → show info badge */}
          {isMember && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
              padding: '6px 8px', borderRadius: 6, backgroundColor: '#1e293b',
              border: '1px solid #4c1d95',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#a78bfa' }}>Sloučeno ve skupině</div>
                <div style={{ fontSize: 10, color: '#7c3aed', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  s „{getBlockLabel(groupLeader!)}"
                </div>
              </div>
            </div>
          )}

          {/* Group counter — only show for non-member blocks (leaders or ungrouped) */}
          {!isMember && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isLeader ? '#a78bfa' : '#cbd5e1' }}>
                    Seskupit s dalšími bloky
                  </div>
                  <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>
                    {isLeader
                      ? `Tento a dalších ${myMergeCount} ${myMergeCount === 1 ? 'blok' : myMergeCount <= 4 ? 'bloky' : 'bloků'} na jednom slidu`
                      : 'Přidat bloky do skupiny na jeden slide'}
                  </div>
                </div>
                <Counter
                  value={myMergeCount}
                  min={0}
                  max={Math.min(10, informationalAfter)}
                  onChange={v => updateBS({ mergeCount: v, mergeWithNext: v > 0 ? true : undefined })}
                />
              </div>

              {/* Show which blocks will be in the group */}
              {isLeader && myIdx >= 0 && (
                <div style={{ paddingLeft: 0 }}>
                  {allBlocks.slice(myIdx, myIdx + 1 + myMergeCount).map((b, i) => (
                    <div key={b.id} style={{
                      display: 'flex', alignItems: 'center', gap: 5, marginTop: 3,
                      fontSize: 10, color: i === 0 ? '#7c3aed' : '#64748b',
                    }}>
                      <span style={{
                        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                        backgroundColor: i === 0 ? '#4c1d95' : '#1e293b',
                        border: `1px solid ${i === 0 ? '#7c3aed' : '#334155'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 700, color: i === 0 ? '#a78bfa' : '#475569',
                      }}>{i + 1}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {i === 0 ? `${getBlockLabel(b)} (tento blok)` : getBlockLabel(b)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Sub-questions mode (3-way) — only for free-answer with subQ */}
      {hasSubQ && !bs.skip && (
        <div style={{ marginTop: 4, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
            Podotázky v boardu
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(
              [
                { val: 'single', label: 'Jeden slide',    desc: 'Vše dohromady' },
                { val: 'each',   label: 'Každá zvlášť',   desc: 'Samostatné slidy' },
                { val: 'html',   label: 'HTML obrázek',   desc: 'Zachytit jako obr.' },
              ] as Array<{ val: 'single' | 'each' | 'html'; label: string; desc: string }>
            ).map(opt => {
              const active = (bs.subQuestionsMode ?? 'single') === opt.val;
              return (
                <button
                  key={opt.val}
                  type="button"
                  title={opt.desc}
                  onClick={() => updateBS({ subQuestionsMode: opt.val })}
                  style={{
                    flex: 1, padding: '5px 4px', borderRadius: 6, border: 'none',
                    cursor: 'pointer', textAlign: 'center',
                    backgroundColor: active ? '#6366f1' : '#1e293b',
                    color: active ? '#fff' : '#64748b',
                    fontSize: 10, fontWeight: active ? 600 : 400,
                    transition: 'all 0.12s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
