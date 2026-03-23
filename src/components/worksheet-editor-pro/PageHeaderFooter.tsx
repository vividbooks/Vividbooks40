/**
 * PageHeaderFooter - Shared components for rendering configurable
 * page headers and footers in the PRO worksheet editor.
 */

import React from 'react';
import { PageHeaderConfig, PageFooterConfig, FooterFeedbackStyle } from '../../types/worksheet';

// ============================================
// DEFAULT CONFIGS
// ============================================

export const DEFAULT_HEADER: PageHeaderConfig = {
  enabled: false,
  showName: true,
  showClass: true,
  showGrade: true,
  nameLabel: 'Jméno a příjmení',
  classLabel: 'Třída',
  gradeLabel: 'Známka',
  lineColor: '#94a3b8',
};

export const DEFAULT_FOOTER: PageFooterConfig = {
  enabled: false,
  showSeparator: true,
  leftType: 'branding',
  leftText: '',
  rightType: 'feedback',
  feedbackStyle: 'faces',
  feedbackText: 'Jak se ti odpovídalo na tento pracovní list?',
  rightText: '',
};

export const HEADER_HEIGHT_ENABLED = 60;
export const HEADER_HEIGHT_DISABLED = 0;
export const FOOTER_HEIGHT_ENABLED = 56;
export const FOOTER_HEIGHT_DISABLED = 0;

export function getHeaderHeight(config?: PageHeaderConfig): number {
  const cfg = { ...DEFAULT_HEADER, ...config };
  if (!cfg.enabled) return HEADER_HEIGHT_DISABLED;
  return HEADER_HEIGHT_ENABLED;
}

export function getFooterHeight(config?: PageFooterConfig): number {
  const cfg = { ...DEFAULT_FOOTER, ...config };
  if (!cfg.enabled) return FOOTER_HEIGHT_DISABLED;
  return FOOTER_HEIGHT_ENABLED;
}

// ============================================
// FEEDBACK ICONS
// ============================================

const FEEDBACK_FACES: { icon: string; label: string }[] = [
  { icon: '😊', label: 'Super' },
  { icon: '😐', label: 'ok' },
  { icon: '😞', label: 'Špatně' },
];

const FEEDBACK_SMILEYS: { icon: string; label: string }[] = [
  { icon: '😢', label: '1' },
  { icon: '🙁', label: '2' },
  { icon: '😐', label: '3' },
  { icon: '🙂', label: '4' },
  { icon: '😊', label: '5' },
];

const FEEDBACK_HEARTS: { icon: string; label: string }[] = [
  { icon: '💔', label: '1' },
  { icon: '🖤', label: '2' },
  { icon: '🤍', label: '3' },
  { icon: '🩷', label: '4' },
  { icon: '❤️', label: '5' },
];

const FEEDBACK_STARS: { icon: string; label: string }[] = [
  { icon: '☆', label: '1' },
  { icon: '☆', label: '2' },
  { icon: '☆', label: '3' },
  { icon: '☆', label: '4' },
  { icon: '★', label: '5' },
];

function getFeedbackIcons(style: FooterFeedbackStyle) {
  switch (style) {
    case 'faces': return FEEDBACK_FACES;
    case 'smileys': return FEEDBACK_SMILEYS;
    case 'hearts': return FEEDBACK_HEARTS;
    case 'stars': return FEEDBACK_STARS;
    default: return FEEDBACK_FACES;
  }
}

// ============================================
// PAGE HEADER COMPONENT
// ============================================

interface PageHeaderProps {
  config?: PageHeaderConfig;
  padding?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function PageHeader({ config, padding = 24, className = '', style }: PageHeaderProps) {
  const cfg = { ...DEFAULT_HEADER, ...config };
  if (!cfg.enabled) return null;
  
  const lineColor = cfg.lineColor || '#94a3b8';
  const hasAnyField = cfg.showName || cfg.showClass || cfg.showGrade;
  
  return (
    <div
      className={className}
      style={{
        height: HEADER_HEIGHT_ENABLED,
        padding: `12px ${padding}px 8px`,
        borderBottom: '2px dotted #cbd5e1',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '16px',
        ...style,
      }}
    >
      {hasAnyField && (
        <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
          {cfg.showName && (
            <div style={{ flex: 2, minWidth: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                {cfg.nameLabel || 'Jméno a příjmení'}:
              </span>
              <div style={{
                borderBottom: `2px dotted ${lineColor}`,
                marginTop: '4px',
                height: '20px',
              }} />
            </div>
          )}
          {cfg.showClass && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                {cfg.classLabel || 'Třída'}:
              </span>
              <div style={{
                borderBottom: `2px dotted ${lineColor}`,
                marginTop: '4px',
                height: '20px',
              }} />
            </div>
          )}
          {cfg.showGrade && (
            <div style={{ width: '80px', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                {cfg.gradeLabel || 'Známka'}:
              </span>
              <div style={{
                borderBottom: `2px dotted ${lineColor}`,
                marginTop: '4px',
                height: '20px',
              }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// PAGE FOOTER COMPONENT
// ============================================

interface PageFooterProps {
  config?: PageFooterConfig;
  pageNumber: number;
  totalPages: number;
  padding?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function PageFooter({ config, pageNumber, totalPages, padding = 24, className = '', style }: PageFooterProps) {
  const cfg = { ...DEFAULT_FOOTER, ...config };
  if (!cfg.enabled) return null;
  
  const feedbackIcons = getFeedbackIcons(cfg.feedbackStyle || 'faces');

  const renderLeft = () => {
    if (cfg.leftType === 'none') return <div />;
    if (cfg.leftType === 'text') {
      return (
        <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.4 }}>
          {cfg.leftText || ''}
        </div>
      );
    }
    // branding (default)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '9px', color: '#94a3b8' }}>Vytvořeno</span>
        <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', letterSpacing: '0.5px', lineHeight: 1 }}>
          VIVID<br/>
          <span style={{ fontWeight: 400 }}>BOOKS</span>
        </span>
        <span style={{ fontSize: '9px', color: '#94a3b8', maxWidth: '160px', lineHeight: 1.3 }}>
          Využívat tento materiál můžete pouze po dobu platnosti vaší licence.
        </span>
      </div>
    );
  };

  const renderRight = () => {
    if (cfg.rightType === 'none') return <div />;
    if (cfg.rightType === 'pageNumber') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            Strana {pageNumber}{totalPages > 1 ? ` / ${totalPages}` : ''}
          </span>
        </div>
      );
    }
    if (cfg.rightType === 'text') {
      return (
        <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.4, textAlign: 'right' }}>
          {cfg.rightText || ''}
        </div>
      );
    }
    // feedback (default)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '10px', color: '#64748b', maxWidth: '140px', lineHeight: 1.3 }}>
          {cfg.feedbackText || 'Jak se ti odpovídalo na tento pracovní list?'}
        </span>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {feedbackIcons.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontSize: '18px', opacity: 0.5 }}>{item.icon}</span>
              <span style={{ fontSize: '8px', color: '#94a3b8' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div
      className={className}
      style={{
        height: FOOTER_HEIGHT_ENABLED,
        padding: `6px ${padding}px`,
        borderTop: cfg.showSeparator !== false ? '1px solid #e2e8f0' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        ...style,
      }}
    >
      {renderLeft()}
      {renderRight()}
    </div>
  );
}
