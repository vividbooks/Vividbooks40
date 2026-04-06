/**
 * Boční „bobánky“ průběhu multi-kroků při generování design systému z briefu.
 */

import { useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronUp, Loader2, Rocket } from 'lucide-react';
import type { DesignSystemPipelineEvent } from '../../utils/ai/design-system-pipeline-types';

const STEP_ORDER = ['crops', 'prepare', 'intent', 'design', 'save'];

type Props = {
  steps: DesignSystemPipelineEvent[];
  /** Zobrazit panel (např. během generování nebo krátce po něm) */
  visible: boolean;
};

export function DesignSystemAgentLogPanel({ steps, visible }: Props) {
  const [expanded, setExpanded] = useState(true);

  const sorted = useMemo(() => {
    return [...steps].sort(
      (a, b) => STEP_ORDER.indexOf(a.stepId) - STEP_ORDER.indexOf(b.stepId),
    );
  }, [steps]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        bottom: 16,
        zIndex: 260,
        width: 'min(300px, calc(100vw - 32px))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 8,
        pointerEvents: 'auto',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          alignSelf: 'flex-end',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 999,
          border: '1px solid rgba(71, 85, 105, 0.85)',
          backgroundColor: 'rgba(30, 41, 59, 0.92)',
          color: '#e2e8f0',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        }}
      >
        <Rocket size={14} strokeWidth={2} />
        Agent log
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
            borderRadius: 14,
            border: '1px solid rgba(51, 65, 85, 0.75)',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            maxHeight: 'min(52vh, 420px)',
            overflowY: 'auto',
          }}
        >
          {sorted.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Čekám na kroky…</p>
          ) : (
            sorted.map((s) => (
              <div
                key={s.stepId}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(71, 85, 105, 0.55)',
                  backgroundColor: 'rgba(30, 41, 59, 0.55)',
                }}
              >
                <span style={{ flexShrink: 0, marginTop: 2 }}>
                  {s.status === 'running' ? (
                    <Loader2 size={14} className="animate-spin" style={{ color: '#38bdf8' }} />
                  ) : s.status === 'error' ? (
                    <AlertCircle size={14} style={{ color: '#f87171' }} />
                  ) : (
                    <Check size={14} style={{ color: '#4ade80' }} />
                  )}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#f1f5f9',
                      lineHeight: 1.35,
                    }}
                  >
                    {s.label}
                  </span>
                  {s.detail ? (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 10,
                        color: '#94a3b8',
                        marginTop: 4,
                        lineHeight: 1.35,
                      }}
                    >
                      {s.detail}
                    </span>
                  ) : null}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
