/**
 * AutoScaleQuestion - Automatically scales question text to fill available space
 * 
 * On desktop: scales text to fill container, preferring single line when possible
 * On mobile: uses fixed responsive sizes
 */

import React, { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
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
  const [isMeasured, setIsMeasured] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const recalculate = useCallback(() => {
    if (isMobile) {
      setIsMeasured(true);
      return;
    }

    if (!containerRef.current || !textRef.current || !children) return;

    const container = containerRef.current;
    const text = textRef.current;

    // Skip if container has no size yet (not mounted in DOM)
    if (container.clientWidth === 0 || container.clientHeight === 0) return;

    let low = minFontSize;
    let high = maxFontSize;
    let optimalSize = minFontSize;

    const containerWidth = container.clientWidth * targetFill;
    const containerHeight = container.clientHeight * targetFill;

    text.style.overflowWrap = 'break-word';
    text.style.wordBreak = 'normal';
    text.style.hyphens = 'none';
    text.style.whiteSpace = 'normal';

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      text.style.fontSize = `${mid}px`;

      const textWidth = text.scrollWidth;
      const textHeight = text.scrollHeight;

      if (textHeight <= containerHeight && textWidth <= container.clientWidth * 0.95) {
        optimalSize = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // For short texts: try single-line and use it if it fits well
    const plainLen = children.replace(/\$[^$]*\$/g, 'X').length;
    if (plainLen <= 30) {
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

      if (singleSize >= optimalSize * 0.7 && singleSize >= minFontSize) {
        optimalSize = singleSize;
      }
    }

    setFontSize(optimalSize);
    setIsMeasured(true);
  }, [children, targetFill, minFontSize, maxFontSize, isMobile]);

  // Recalculate before paint to avoid visible size jumping on slide open
  useLayoutEffect(() => {
    if (isMobile) {
      setIsMeasured(true);
      return;
    }
    setIsMeasured(false);
    recalculate();
  }, [recalculate, isMobile]);

  // Recalculate again after fonts are fully ready
  useEffect(() => {
    if (isMobile) return;
    setIsMeasured(false);
    document.fonts.ready.then(() => {
      recalculate();
    });
  }, [recalculate, isMobile]);

  // Recalculate when container is resized (e.g. side panel opens/closes)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(recalculate);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [recalculate]);

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
          color: '#4E5871',
          visibility: isMeasured ? 'visible' : 'hidden',
        }}
      >
        <MathText>{children || 'Otázka...'}</MathText>
      </div>
    </div>
  );
}

export default AutoScaleQuestion;
