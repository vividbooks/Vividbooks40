/**
 * AutoScaleQuestion - Automatically scales question text to fill available space
 * 
 * On desktop: scales text to fill container, preferring single line when possible
 * On mobile: uses fixed responsive sizes
 */

import React, { useRef, useEffect, useState } from 'react';
import { MathText } from '../math/MathText';

interface AutoScaleQuestionProps {
  children: string;
  className?: string;
  /** Target fill percentage (0-1), default 0.85 */
  targetFill?: number;
  /** Minimum font size in px */
  minFontSize?: number;
  /** Maximum font size in px */
  maxFontSize?: number;
}

export function AutoScaleQuestion({
  children,
  className = '',
  targetFill = 0.85,
  minFontSize = 32,
  maxFontSize = 180,
}: AutoScaleQuestionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(64);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile || !containerRef.current || !textRef.current || !children) {
      return;
    }

    const container = containerRef.current;
    const text = textRef.current;

    // Binary search for optimal font size
    let low = minFontSize;
    let high = maxFontSize;
    let optimalSize = minFontSize;

    const containerWidth = container.clientWidth * targetFill;
    const containerHeight = container.clientHeight * targetFill;

    // Allow word wrapping to multiple lines
    text.style.overflowWrap = 'break-word';
    text.style.wordBreak = 'normal';
    text.style.hyphens = 'none';
    text.style.whiteSpace = 'normal';

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      text.style.fontSize = `${mid}px`;

      const textWidth = text.scrollWidth;
      const textHeight = text.scrollHeight;

      // Text can wrap, so we mainly check height fits
      if (textHeight <= containerHeight && textWidth <= container.clientWidth * 0.95) {
        optimalSize = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // After finding the wrapping optimal, check if we can still fit on one line
    // by slightly reducing font. If text is short enough, prefer single-line.
    const plainLen = children.replace(/\$[^$]*\$/g, 'X').length;
    if (plainLen <= 30) {
      // Try to find a size where it stays on one line
      text.style.whiteSpace = 'nowrap';
      let singleLow = minFontSize;
      let singleHigh = optimalSize;
      let singleSize = minFontSize;

      while (singleLow <= singleHigh) {
        const mid = Math.floor((singleLow + singleHigh) / 2);
        text.style.fontSize = `${mid}px`;

        if (text.scrollWidth <= containerWidth && text.scrollHeight <= containerHeight) {
          singleSize = mid;
          singleLow = mid + 1;
        } else {
          singleHigh = mid - 1;
        }
      }

      text.style.whiteSpace = 'normal';

      // Use single-line if it's at least 70% of the wrapped size
      if (singleSize >= optimalSize * 0.7 && singleSize >= minFontSize) {
        optimalSize = singleSize;
      }
    }

    setFontSize(optimalSize);
  }, [children, targetFill, minFontSize, maxFontSize, isMobile]);

  // On mobile, use large responsive text
  if (isMobile) {
    return (
      <h1 className={`font-bold text-center leading-tight ${className}`} style={{ color: '#4E5871', fontSize: 'clamp(2rem, 10vw, 4rem)' }}>
        <MathText>{children || 'Otázka...'}</MathText>
      </h1>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full flex items-center justify-center ${className}`}
    >
      <div
        ref={textRef}
        className="font-bold text-center leading-snug"
        style={{ 
          fontSize: `${fontSize}px`,
          overflowWrap: 'break-word',
          wordBreak: 'normal',
          hyphens: 'none',
          whiteSpace: 'normal',
          maxWidth: '95%',
          color: '#4E5871'
        }}
      >
        <MathText>{children || 'Otázka...'}</MathText>
      </div>
    </div>
  );
}

export default AutoScaleQuestion;
