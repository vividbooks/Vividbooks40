import React from 'react';
import type { AppMode } from './ProMiniSidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModeSwitcherOption {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  /** Called when user clicks this mode button */
  onSelect: () => void;
  /** Whether this option is currently active */
  isActive: boolean;
}

export interface ModeSwitcherProps {
  /** Called when user clicks X or outside to close */
  onClose: () => void;
  /** Label + value shown in the context card (e.g. current book/chapter title) */
  contextLabel: string;
  contextValue?: string;
  /** List of mode options to render */
  options: ModeSwitcherOption[];
}

// ─── Laiout logo (static, no animation — for overlay use) ─────────────────────

function LaioutLogo() {
  return (
    <svg viewBox="0 0 572 603" width="52" height="52" fill="none">
      <rect x="0" y="0" width="244" height="284" fill="white"/>
      <rect x="0" y="337" width="143" height="37" fill="white"/>
      <rect x="0" y="406.835" width="244" height="38" fill="white"/>
      <rect x="0" y="477.835" width="244" height="38" fill="white"/>
      <rect x="0" y="548.835" width="244" height="37" fill="white"/>
      <circle cx="430" cy="461" r="142" fill="white"/>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ModeSwitcher({ onClose, contextLabel, contextValue, options }: ModeSwitcherProps) {
  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, width: '368px', height: '100vh',
      backgroundColor: '#0f172a', borderRight: '1px solid #334155',
      display: 'flex', flexDirection: 'column', zIndex: 200,
    }}>
      {/* Header — logo + tagline + context card */}
      <div style={{ padding: '28px 24px 24px', borderBottom: '1px solid #1e293b', position: 'relative' }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            padding: '6px', background: 'none', border: 'none',
            borderRadius: '6px', cursor: 'pointer', color: '#64748b', display: 'flex',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1e293b')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Logo + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
          <LaioutLogo />
          <span style={{ fontSize: '32px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.03em' }}>laiout</span>
        </div>

        {/* Tagline */}
        <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, marginBottom: '16px' }}>
          Design as code.<br/>Publishing, reinvented.
        </div>

        {/* Context card */}
        {contextValue && (
          <div style={{
            padding: '10px 12px', backgroundColor: '#1e293b',
            borderRadius: '8px', border: '1px solid #334155',
          }}>
            <div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              {contextLabel}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {contextValue}
            </div>
          </div>
        )}
      </div>

      {/* Mode buttons */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={opt.onSelect}
            style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '16px 18px', borderRadius: '12px', cursor: 'pointer',
              border: `2px solid ${opt.isActive ? '#3B82F6' : 'transparent'}`,
              backgroundColor: opt.isActive ? '#1e3a5f' : '#1e293b',
              textAlign: 'left', width: '100%',
            }}
            onMouseEnter={e => { if (!opt.isActive) (e.currentTarget as HTMLElement).style.backgroundColor = '#263348'; }}
            onMouseLeave={e => { if (!opt.isActive) (e.currentTarget as HTMLElement).style.backgroundColor = '#1e293b'; }}
          >
            <span style={{ fontSize: '26px', lineHeight: 1, flexShrink: 0 }}>{opt.emoji}</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: opt.isActive ? '#3B82F6' : '#e2e8f0', marginBottom: '3px' }}>
                {opt.label}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{opt.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
