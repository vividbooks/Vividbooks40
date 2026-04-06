/**
 * Rozbalovací seznam workflow — stejný vizuální jazyk jako `DesignSystemLibraryMenuList`
 * v DesignSystemCanvasWorkspace (Nový / Historie, tečky, Upraveno, zaškrtnutí).
 */

import { Check } from 'lucide-react';
import type { BookAgentWorkflow } from '../../types/book-agent-pipeline';
import { CURRICULUM_FACTORY_PRESET } from '../../data/book-agent-workflow-presets';

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function dotColorForWorkflowId(id: string): string {
  return `hsl(${hashHue(id)} 62% 52%)`;
}

function clipText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export function AgentWorkflowLibraryMenuList({
  workflows,
  activeWorkflowId,
  onSelectWorkflow,
  onSelectNewEmpty,
  onSelectCurriculumFactory,
  align = 'left',
}: {
  workflows: BookAgentWorkflow[];
  activeWorkflowId: string;
  onSelectWorkflow: (id: string) => void;
  onSelectNewEmpty: () => void;
  onSelectCurriculumFactory: () => void;
  /** Stejně jako u DS: trigger vlevo → menu pod levým okrajem; vpravo → zarovnat doprava. */
  align?: 'left' | 'right';
}) {
  const sortedHistory = [...workflows].sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return tb - ta;
  });

  return (
    <div
      role="listbox"
      style={{
        position: 'absolute',
        top: '100%',
        ...(align === 'right' ? { left: 'auto', right: 0 } : { left: 0, right: 'auto' }),
        marginTop: 8,
        minWidth: '100%',
        width: 'max-content',
        maxWidth: 'min(360px, calc(100vw - 48px))',
        maxHeight: 'min(52vh, 420px)',
        overflowY: 'auto',
        borderRadius: 12,
        border: '1px solid rgba(71, 85, 105, 0.95)',
        backgroundColor: 'rgba(15, 23, 42, 0.98)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        padding: 6,
        zIndex: 230,
      }}
    >
      <button
        type="button"
        role="option"
        onClick={() => onSelectNewEmpty()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 10px',
          borderRadius: 8,
          border: 'none',
          backgroundColor: 'transparent',
          color: '#f8fafc',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(51, 65, 85, 0.55)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: 'linear-gradient(135deg, #22d3ee, #6366f1)',
            flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>Nový</span>
          <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Prázdné workflow</span>
        </span>
      </button>

      <button
        type="button"
        role="option"
        onClick={() => onSelectCurriculumFactory()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '9px 10px',
          borderRadius: 8,
          border: 'none',
          backgroundColor: 'transparent',
          color: '#e2e8f0',
          cursor: 'pointer',
          textAlign: 'left',
          marginTop: 2,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(51, 65, 85, 0.55)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: 'linear-gradient(135deg, #f472b6, #fb923c)',
            flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{CURRICULUM_FACTORY_PRESET.name}</span>
          <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Šablona · 5 agentů</span>
        </span>
      </button>

      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#64748b',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '10px 10px 6px',
          marginTop: 2,
          borderTop: '1px solid rgba(51, 65, 85, 0.75)',
        }}
      >
        Historie
      </div>

      {sortedHistory.map((wf) => {
        const active = activeWorkflowId === wf.id;
        const dot = dotColorForWorkflowId(wf.id);
        const dateLabel = wf.updatedAt ? String(wf.updatedAt).slice(0, 10) : '';
        return (
          <button
            key={wf.id}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelectWorkflow(wf.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '9px 10px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: active ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
              color: '#e2e8f0',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(51, 65, 85, 0.55)';
            }}
            onMouseLeave={(e) => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                flexShrink: 0,
                boxSizing: 'border-box',
                ...(active
                  ? {
                      backgroundColor: 'transparent',
                      border: '2px solid #94a3b8',
                    }
                  : {
                      backgroundColor: dot,
                      border: '1px solid rgba(255,255,255,0.15)',
                    }),
              }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {clipText(wf.name, 42)}
              </span>
              {dateLabel ? (
                <span style={{ display: 'block', fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  Upraveno {dateLabel}
                </span>
              ) : null}
            </span>
            {active ? <Check size={16} style={{ flexShrink: 0, color: '#818cf8' }} /> : null}
          </button>
        );
      })}
    </div>
  );
}
