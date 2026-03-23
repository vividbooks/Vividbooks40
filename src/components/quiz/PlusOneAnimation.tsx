/**
 * PlusOneAnimation
 *
 * Floating "+1" bubble rendered via createPortal at the exact click position.
 * Mount with a unique key (e.g. Date.now()) so each click spawns a fresh instance.
 * The component unmounts itself after the CSS animation ends.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PlusOneAnimationProps {
  x: number;
  y: number;
  color?: string;
  onDone?: () => void;
}

export function PlusOneAnimation({ x, y, color = '#6366f1', onDone }: PlusOneAnimationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 900);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: x - 20,
        top: y - 20,
        zIndex: 99999,
        pointerEvents: 'none',
        animation: 'plusOneFly 0.9s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes plusOneFly {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          60%  { opacity: 1; transform: translateY(-60px) scale(1.15); }
          100% { opacity: 0; transform: translateY(-100px) scale(0.8); }
        }
      `}</style>
      <div
        style={{
          background: color,
          color: '#fff',
          fontWeight: 800,
          fontSize: 22,
          lineHeight: 1,
          padding: '8px 14px',
          borderRadius: 999,
          boxShadow: `0 4px 20px ${color}88`,
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        +1
      </div>
    </div>,
    document.body,
  );
}
