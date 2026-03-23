/**
 * Flashcard Slide View
 *
 * Landscape card (5:3), tilted -2.5°, light background.
 * Image LEFT / text RIGHT (normal mode with image).
 * frontImageOnly: front = full image, back = word + translation.
 * After Znám/Neznám → both sides side by side.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import { FlashcardActivitySlide } from '../../../types/quiz';

// Palette of vibrant card colors
const CARD_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#f59e0b', // amber
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#7c3aed', // deep violet
];

/** Tiny seeded PRNG — always returns the same sequence for a given seed string */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >> 7;
    h ^= h << 17;
    return ((h >>> 0) / 0xffffffff);
  };
}

/** Returns { tilt, color } deterministically from the slide id/word */
function cardStyle(slide: FlashcardActivitySlide): { tilt: number; color: string } {
  const seed = slide.id || slide.word || 'default';
  const rand = seededRandom(seed);

  // Tilt: ±3–7°, alternating sign so cards feel scattered
  const magnitude = 3 + rand() * 4;           // 3–7 deg
  const tilt = rand() > 0.5 ? magnitude : -magnitude;

  // Color: pick from palette (skip slide.cardColor override only when not set)
  const color = slide.cardColor || CARD_COLORS[Math.floor(rand() * CARD_COLORS.length)];

  return { tilt, color };
}

interface FlashcardSlideViewProps {
  slide: FlashcardActivitySlide;
  onSelfAssess?: (knows: boolean) => void;
  selfAssessResult?: boolean | null;
  startFlipped?: boolean;
  compact?: boolean;
}

export function FlashcardSlideView({
  slide,
  onSelfAssess,
  selfAssessResult,
  startFlipped = false,
  compact = false,
}: FlashcardSlideViewProps) {
  const [isFlipped, setIsFlipped] = useState(startFlipped);
  const [assessed, setAssessed] = useState<boolean | null>(selfAssessResult ?? null);

  const isLanguage = slide.mode !== 'general';
  const { tilt, color: frontColor } = useMemo(() => cardStyle(slide), [slide.id, slide.word]);
  const hasImage = !!slide.image;
  const imageOnly = slide.frontImageOnly && hasImage;

  const handleFlip = useCallback(() => {
    if (assessed === null) setIsFlipped((f) => !f);
  }, [assessed]);

  const handleAssess = useCallback(
    (knows: boolean) => {
      setAssessed(knows);
      onSelfAssess?.(knows);
    },
    [onSelfAssess]
  );

  const handleReset = useCallback(() => {
    setAssessed(null);
    setIsFlipped(false);
  }, []);

  // ── Compact thumbnail ──────────────────────────────────────────
  if (compact) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center rounded-lg overflow-hidden p-2"
        style={{ backgroundColor: frontColor }}
      >
        {hasImage && (
          <img src={slide.image} alt={slide.word} className="w-8 h-8 object-cover rounded mb-1" />
        )}
        <div className="text-white font-bold text-center truncate w-full text-xs">
          {slide.word || 'Kartička'}
        </div>
      </div>
    );
  }


  // ── ASSESSED — single merged card showing both sides ──────────
  if (assessed !== null) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: '#f0f1f9' }}
      >
        {/* Badge + reset */}
        <div className="flex items-center gap-3" style={{ transform: `rotate(${tilt}deg)` }}>
          <span
            className="flex items-center gap-2 px-5 py-2 rounded-2xl text-sm font-semibold text-white shadow"
            style={{ backgroundColor: assessed ? '#16a34a' : '#dc2626' }}
          >
            {assessed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {assessed ? 'Výborně! Znáš.' : 'Ještě procvič.'}
          </span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-800 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Znovu
          </button>
        </div>

        {/* One merged card */}
        <div
          className="rounded-3xl overflow-hidden flex flex-row flex-shrink-0"
          style={{
            width: 'min(90%, 728px)',
            aspectRatio: '5 / 3',
            transform: `rotate(${tilt}deg)`,
            border: `4px solid ${frontColor}`,
            boxShadow: `0 10px 36px ${frontColor}44`,
            backgroundColor: '#f5f4ff',
          }}
        >
          {/* LEFT — front color panel (image or colored strip with word) */}
          <div
            className="h-full flex-shrink-0 flex flex-col items-center justify-center overflow-hidden"
            style={{ width: hasImage ? '45%' : '40%', backgroundColor: frontColor }}
          >
            {hasImage ? (
              <img src={slide.image} alt={slide.word} className="w-full h-full object-cover" />
            ) : (
              <span
                className="text-white font-bold px-4 text-center leading-none"
                style={{ fontSize: 'clamp(1.6rem, 5vw, 3.8rem)' }}
              >
                {slide.word || '—'}
              </span>
            )}
          </div>

          {/* RIGHT — both word (if image) + translation */}
          <div className="flex flex-col items-center justify-center gap-2 px-6 text-center flex-1 min-w-0">
            {/* If there's an image, show the word on the right too */}
            {hasImage && (
              <div className="flex flex-col items-center gap-1">
                {isLanguage && (
                  <span className="text-slate-400 text-xs uppercase tracking-widest">🇬🇧 Anglicky</span>
                )}
                <span
                  className="font-extrabold leading-none"
                  style={{ fontSize: 'clamp(1.4rem, 3.8vw, 3rem)', color: frontColor }}
                >
                  {slide.word || '—'}
                </span>
                {isLanguage && slide.phonetic && (
                  <span className="text-slate-400 font-mono" style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1rem)' }}>
                    {slide.phonetic}
                  </span>
                )}
              </div>
            )}

            <div
              className="w-12 border-t-2"
              style={{ borderColor: `${frontColor}44` }}
            />

            <div className="flex flex-col items-center gap-1">
              {isLanguage && (
                <span className="text-slate-400 text-xs uppercase tracking-widest">🇨🇿 Česky</span>
              )}
              <span
                className="font-extrabold leading-none"
                style={{ fontSize: 'clamp(1.4rem, 3.8vw, 3rem)', color: frontColor }}
              >
                {slide.translation || '—'}
              </span>
            </div>

            {isLanguage && slide.exampleSentence && (
              <p
                className="text-slate-400 italic leading-snug mt-1"
                style={{ fontSize: 'clamp(0.7rem, 1.4vw, 0.9rem)' }}
              >
                &ldquo;{slide.exampleSentence}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── NORMAL — single flipping card ─────────────────────────────
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: '#f0f1f9' }}
    >
      {/* Tilt + perspective wrapper */}
      <div
        style={{
          perspective: '1400px',
          transform: `rotate(${tilt}deg)`,
          width: 'min(90%, 728px)',
          aspectRatio: '5 / 3',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onClick={handleFlip}
      >
        {/* Flip inner */}
        <div
          className="relative w-full h-full"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.45s ease',
          }}
        >
          {/* ══ FRONT ════════════════════════════════════════════ */}
          <div
            className="absolute inset-0 rounded-3xl overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              backgroundColor: frontColor,
              border: `4px solid ${frontColor}`,
              boxShadow: `0 10px 36px ${frontColor}44`,
              display: 'flex',
              flexDirection: imageOnly ? 'column' : 'row',
            }}
          >
            {imageOnly ? (
              // ── Image-only front ──────────────────────────────
              <img
                src={slide.image}
                alt={slide.word}
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                {/* Image — LEFT side */}
                {hasImage && (
                  <div className="h-full overflow-hidden flex-shrink-0" style={{ width: '45%' }}>
                    <img src={slide.image} alt={slide.word} className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Word — RIGHT side (or full width if no image) */}
                <div className="flex flex-col items-center justify-center gap-3 px-8 text-center flex-1 min-w-0">
                  {isLanguage && (
                    <span className="text-white/50 text-xs uppercase tracking-widest font-medium">
                      🇬🇧 Anglicky
                    </span>
                  )}
                  <h1
                    className="text-white font-bold leading-none"
                    style={{ fontSize: 'clamp(2rem, 6vw, 4.5rem)' }}
                  >
                    {slide.word || '—'}
                  </h1>
                  {isLanguage && slide.phonetic && (
                    <span
                      className="text-white/60 font-mono"
                      style={{ fontSize: 'clamp(1rem, 2.2vw, 1.8rem)' }}
                    >
                      {slide.phonetic}
                    </span>
                  )}
                  <span className="text-white/25 text-xs flex items-center gap-1 mt-1">
                    <RotateCcw className="w-3 h-3" />
                    Klikni pro otočení
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ══ BACK ═════════════════════════════════════════════ */}
          <div
            className="absolute inset-0 rounded-3xl overflow-hidden flex flex-col"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              backgroundColor: '#f5f4ff',
              border: `4px solid ${frontColor}`,
              boxShadow: `0 10px 36px ${frontColor}44`,
            }}
          >
            {/* Content area */}
            <div
              className="flex flex-col items-center justify-center gap-3 px-8 text-center"
              style={{ flex: 1, minHeight: 0, paddingBottom: 68 }}
            >
              {/* When imageOnly: show word on back first, then translation */}
              {imageOnly && (
                <div className="flex flex-col items-center gap-1">
                  {isLanguage && (
                    <span className="text-indigo-400 text-xs uppercase tracking-widest font-medium">
                      🇬🇧 Anglicky
                    </span>
                  )}
                  <h2
                    className="font-extrabold leading-none"
                    style={{ fontSize: 'clamp(1.8rem, 5vw, 3.8rem)', color: frontColor }}
                  >
                    {slide.word || '—'}
                  </h2>
                  {isLanguage && slide.phonetic && (
                    <span
                      className="font-mono"
                      style={{ fontSize: 'clamp(0.9rem, 2vw, 1.5rem)', color: `${frontColor}99` }}
                    >
                      {slide.phonetic}
                    </span>
                  )}
                </div>
              )}

              {isLanguage && !imageOnly && (
                <span className="text-indigo-400 text-xs uppercase tracking-widest font-medium">
                  🇨🇿 Česky
                </span>
              )}

              <h2
                className="font-bold leading-none"
                style={{
                  fontSize: imageOnly ? 'clamp(1.4rem, 3.5vw, 2.8rem)' : 'clamp(2rem, 6vw, 4.5rem)',
                  color: frontColor,
                }}
              >
                {slide.translation || '—'}
              </h2>

              {isLanguage && slide.exampleSentence && (
                <div className="border-t border-indigo-100 pt-3 mt-1 max-w-md w-full">
                  <p
                    className="text-slate-500 italic leading-relaxed"
                    style={{ fontSize: 'clamp(0.85rem, 1.8vw, 1.15rem)' }}
                  >
                    &ldquo;{slide.exampleSentence}&rdquo;
                  </p>
                  {slide.exampleTranslation && (
                    <p className="text-slate-400 mt-1" style={{ fontSize: 'clamp(0.75rem, 1.4vw, 0.95rem)' }}>
                      {slide.exampleTranslation}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Znám / Neznám */}
            {isFlipped && assessed === null && (
              <div
                className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-3 py-3.5 border-t border-slate-200"
                style={{ backgroundColor: '#f5f4ff' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => handleAssess(false)}
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl text-sm font-semibold active:scale-95 transition-transform"
                  style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '2px solid #fca5a5' }}
                >
                  <X className="w-4 h-4" /> Neznám
                </button>
                <button
                  onClick={() => handleAssess(true)}
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl text-sm font-semibold active:scale-95 transition-transform"
                  style={{ backgroundColor: '#dcfce7', color: '#16a34a', border: '2px solid #86efac' }}
                >
                  <Check className="w-4 h-4" /> Znám
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isFlipped && (
        <p
          className="text-slate-400 text-xs"
          style={{ transform: `rotate(${tilt}deg)` }}
        >
          Klikni na kartičku pro otočení
        </p>
      )}
    </div>
  );
}

export default FlashcardSlideView;
