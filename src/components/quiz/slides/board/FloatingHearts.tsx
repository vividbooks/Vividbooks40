import React, { useMemo } from 'react';
import { Heart } from 'lucide-react';

interface FloatingHeartsProps {
  count: number;
}

/**
 * Animace létajících srdíček při likenutí příspěvku.
 * Pozice a velikosti jsou pre-computovány jednou (useMemo) – ne při každém renderu.
 */
export function FloatingHearts({ count }: FloatingHeartsProps) {
  const hearts = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: `${20 + Math.random() * 60}%`,
        size: `${18 + Math.random() * 10}px`,
      })),
    [count],
  );

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 50 }}>
      {hearts.map((h, i) => (
        <Heart
          key={i}
          style={{
            position: 'absolute',
            left: h.left,
            bottom: '0px',
            color: '#ec4899',
            fill: '#ec4899',
            width: h.size,
            height: h.size,
            animation: 'float-up 1s ease-out forwards',
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}
