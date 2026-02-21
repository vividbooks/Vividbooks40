/**
 * FreeCanvasEditor - Figma SVG viewer pro volné plátno
 *
 * Zobrazuje SVG synchronizovaný z Figmy.
 * Editace probíhá přímo ve Figmě, sync přes boční panel.
 */

import { useState } from 'react';
import { Figma, ExternalLink } from 'lucide-react';
import { FreeCanvasContent } from '../../types/worksheet';

interface FreeCanvasEditorProps {
  content: FreeCanvasContent;
  onUpdate: (content: FreeCanvasContent) => void;
  isEditing?: boolean;
  onEnterFullscreen?: () => void;
}

function openFigma(e: React.MouseEvent, content: FreeCanvasContent) {
  e.stopPropagation(); // neotevírej panel — jen Figmu
  if (!content.figmaFileId) return;
  let url = `https://www.figma.com/design/${content.figmaFileId}`;
  if (content.figmaNodeId) url += `?node-id=${encodeURIComponent(content.figmaNodeId)}`;
  window.open(url, '_blank');
}

export function FreeCanvasEditor({ content }: FreeCanvasEditorProps) {
  const canvasHeight = content.canvasHeight || 400;
  const [hovered, setHovered] = useState(false);
  const hasFigma = !!content.figmaFileId;

  const hoverOverlay = hasFigma ? (
    <div
      style={{
        position: 'absolute', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.18s',
        pointerEvents: hovered ? 'auto' : 'none',
        borderRadius: 4,
      }}
    >
      <button
        onClick={(e) => openFigma(e, content)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          backgroundColor: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 8,
          padding: '10px 18px',
          color: 'white',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <Figma size={16} />
        Otevřít ve Figmě
        <ExternalLink size={13} />
      </button>
    </div>
  ) : null;

  if (content.figmaSvgUrl) {
    return (
      <div
        style={{ width: '100%', height: canvasHeight, backgroundColor: content.backgroundColor || '#ffffff', overflow: 'hidden', position: 'relative' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <img
          src={`${content.figmaSvgUrl}?t=${content.figmaSyncedAt ?? ''}`}
          alt="Figma frame"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
        {hoverOverlay}
      </div>
    );
  }

  // Empty state
  return (
    <div
      style={{
        width: '100%', height: canvasHeight,
        backgroundColor: content.backgroundColor || '#f8fafc',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, border: '2px dashed #e2e8f0', borderRadius: 4, position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Figma size={32} color="#c4b5fd" />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
          {hasFigma ? 'Frame propojen — synchronizuj SVG' : 'Propojte s Figmou'}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          {hasFigma ? 'V bočním panelu klikni Sync SVG' : 'V bočním panelu vlož Figma link'}
        </div>
      </div>
      {hoverOverlay}
    </div>
  );
}
