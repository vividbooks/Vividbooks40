/**
 * Dev panel: slidery + JSON pro ladění vodících teček (jen import.meta.env.DEV).
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  defaultGuideDotsDevState,
  loadGuideDotsDevState,
  parseGuideDotsDevState,
  saveGuideDotsDevState,
  stringifyGuideDotsDevState,
  type PisankaGuideDotsDevState,
} from '../../../utils/mini-apps/pisanka-guide-dots-dev';
import { inputStyle, labelStyle, sectionTitleStyle, subtleCardStyle } from '../block-settings/shared';

const sliderWrap: CSSProperties = { marginTop: 6, marginBottom: 10 };

function syncGlobal(
  prev: PisankaGuideDotsDevState,
  patch: Partial<PisankaGuideDotsDevState['global']>,
): PisankaGuideDotsDevState {
  return {
    ...prev,
    global: { ...prev.global, ...patch },
  };
}

export function PisankaGuideDotsDevPanel() {
  const [state, setState] = useState<PisankaGuideDotsDevState>(() => loadGuideDotsDevState());
  const [jsonDraft, setJsonDraft] = useState(() => stringifyGuideDotsDevState(loadGuideDotsDevState()));
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setJsonDraft(stringifyGuideDotsDevState(state));
  }, [state]);

  const persist = useCallback((next: PisankaGuideDotsDevState) => {
    setState(next);
    saveGuideDotsDevState(next);
  }, []);

  const setGlobal = useCallback((patch: Partial<PisankaGuideDotsDevState['global']>) => {
    setState((prev) => {
      const next = syncGlobal(prev, patch);
      saveGuideDotsDevState(next);
      return next;
    });
  }, []);

  const applyJson = useCallback(() => {
    const parsed = parseGuideDotsDevState(jsonDraft);
    if (!parsed) {
      setJsonError('Neplatný JSON');
      return;
    }
    setJsonError(null);
    persist(parsed);
  }, [jsonDraft, persist]);

  const reset = useCallback(() => {
    const next = defaultGuideDotsDevState();
    persist(next);
    setJsonError(null);
  }, [persist]);

  const g = state.global;

  return (
    <div
      style={{
        ...subtleCardStyle,
        marginTop: 16,
        padding: 12,
        borderRadius: 10,
        border: '1px dashed #64748b',
        background: 'rgba(30, 41, 59, 0.85)',
      }}
    >
      <h3 style={{ ...sectionTitleStyle, marginBottom: 6, color: '#fbbf24' }}>DEV — vodící tečky</h3>
      <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10, lineHeight: 1.45 }}>
        Ukládá se do <code style={{ color: '#cbd5e1' }}>localStorage</code>. Úpravy podle prvního znaku řádku doplň v JSONu do{' '}
        <code style={{ color: '#cbd5e1' }}>byFirstChar</code> (např. <code style={{ color: '#cbd5e1' }}>&quot;C&quot;</code>,{' '}
        <code style={{ color: '#cbd5e1' }}>&quot;s&quot;</code>).
      </p>

      <div style={sliderWrap}>
        <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>Osa X (px)</span>
          <span style={{ color: '#94a3b8', fontWeight: 400 }}>{g.offsetXPx}</span>
        </label>
        <input
          type="range"
          min={-40}
          max={40}
          step={1}
          value={g.offsetXPx}
          onChange={(e) => setGlobal({ offsetXPx: parseInt(e.target.value, 10) })}
          style={{ width: '100%' }}
        />
      </div>

      <div style={sliderWrap}>
        <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>Osa Y (px)</span>
          <span style={{ color: '#94a3b8', fontWeight: 400 }}>{g.offsetYPx}</span>
        </label>
        <input
          type="range"
          min={-40}
          max={40}
          step={1}
          value={g.offsetYPx}
          onChange={(e) => setGlobal({ offsetYPx: parseInt(e.target.value, 10) })}
          style={{ width: '100%' }}
        />
      </div>

      <div style={sliderWrap}>
        <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>Rozestup (×)</span>
          <span style={{ color: '#94a3b8', fontWeight: 400 }}>{g.stepMul.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min={50}
          max={200}
          step={5}
          value={Math.round(g.stepMul * 100)}
          onChange={(e) => setGlobal({ stepMul: parseInt(e.target.value, 10) / 100 })}
          style={{ width: '100%' }}
        />
      </div>

      <div style={sliderWrap}>
        <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>Nástřik / lead-in (×)</span>
          <span style={{ color: '#94a3b8', fontWeight: 400 }}>{g.leadInMul.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min={0}
          max={200}
          step={5}
          value={Math.round(g.leadInMul * 100)}
          onChange={(e) => setGlobal({ leadInMul: parseInt(e.target.value, 10) / 100 })}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>JSON (global + byFirstChar)</label>
        <textarea
          value={jsonDraft}
          onChange={(e) => {
            setJsonDraft(e.target.value);
            setJsonError(null);
          }}
          onBlur={applyJson}
          spellCheck={false}
          style={{
            ...inputStyle,
            width: '100%',
            minHeight: 160,
            marginTop: 6,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            lineHeight: 1.35,
            resize: 'vertical',
          }}
        />
        {jsonError ? (
          <p style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>{jsonError}</p>
        ) : (
          <p style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
            Blur z textarea aplikuje změny; slidery ukládají hned.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={applyJson}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #475569',
              background: '#334155',
              color: '#e2e8f0',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Aplikovat JSON
          </button>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #475569',
              background: '#1e293b',
              color: '#94a3b8',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
