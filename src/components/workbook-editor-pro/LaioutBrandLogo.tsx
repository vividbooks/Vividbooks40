import React from 'react';

/** Animované logo Laiout (knihovna + přihlášení). */
export function LaioutBrandLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 572 610" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <style>{`
        @keyframes bar3-in { from { transform: translateX(-260px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes bar2-in { from { transform: translateX(-260px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes bar1-in { from { transform: translateX(-260px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes short-in { from { transform: translateX(-260px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes tall-in { from { transform: translateX(-260px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes circle-in { from { transform: translateX(220px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .lb-bar3 { animation: bar3-in 550ms cubic-bezier(0.34,1.52,0.64,1) 0ms both; }
        .lb-bar2 { animation: bar2-in 550ms cubic-bezier(0.34,1.52,0.64,1) 90ms both; }
        .lb-bar1 { animation: bar1-in 550ms cubic-bezier(0.34,1.52,0.64,1) 180ms both; }
        .lb-short { animation: short-in 550ms cubic-bezier(0.34,1.52,0.64,1) 270ms both; }
        .lb-tall { animation: tall-in 550ms cubic-bezier(0.34,1.52,0.64,1) 360ms both; }
        .lb-circle { animation: circle-in 600ms cubic-bezier(0.34,1.52,0.64,1) 100ms both; }
      `}</style>
      <rect className="lb-bar3" x="0" y="548.835" width="244" height="37" fill="white" />
      <rect className="lb-bar2" x="0" y="477.835" width="244" height="38" fill="white" />
      <rect className="lb-bar1" x="0" y="406.835" width="244" height="38" fill="white" />
      <rect className="lb-short" x="0.234" y="337" width="143" height="37" fill="white" />
      <rect className="lb-tall" x="0.234" y="0" width="244" height="284" fill="white" />
      <circle className="lb-circle" cx="430" cy="461" r="142" fill="white" />
    </svg>
  );
}
