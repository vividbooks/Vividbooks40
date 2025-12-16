/**
 * MathText - Renders text with inline LaTeX support
 * 
 * Supports both inline ($...$) and block ($$...$$) LaTeX
 * Math expressions are rendered slightly larger for better visibility
 */

import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface MathTextProps {
  children: string;
  className?: string;
  /** Scale factor for math expressions (default: 1.3 = 30% larger) */
  mathScale?: number;
}

/**
 * Wrapper to make math larger and more visible
 */
function ScaledMath({ children, scale = 1.3 }: { children: React.ReactNode; scale?: number }) {
  return (
    <span style={{ 
      fontSize: `${scale}em`, 
      display: 'inline-block',
      verticalAlign: 'middle',
      lineHeight: 1.2,
    }}>
      {children}
    </span>
  );
}

/**
 * Parses text and renders LaTeX expressions
 * Supports:
 * - Inline math: $expression$ or \(expression\)
 * - Block math: $$expression$$ or \[expression\]
 */
export function MathText({ children, className, mathScale = 1.3 }: MathTextProps) {
  if (!children || typeof children !== 'string') {
    return <span className={className}>{children}</span>;
  }

  // Check if the entire string is just a LaTeX expression
  const trimmed = children.trim();
  
  // Block math: $$...$$ or \[...\]
  if ((trimmed.startsWith('$$') && trimmed.endsWith('$$')) ||
      (trimmed.startsWith('\\[') && trimmed.endsWith('\\]'))) {
    const latex = trimmed.startsWith('$$') 
      ? trimmed.slice(2, -2) 
      : trimmed.slice(2, -2);
    try {
      return (
        <ScaledMath scale={mathScale}>
          <BlockMath math={latex} />
        </ScaledMath>
      );
    } catch (e) {
      return <span className={className}>{children}</span>;
    }
  }
  
  // Inline math only: $...$ or \(...\)
  if ((trimmed.startsWith('$') && trimmed.endsWith('$') && !trimmed.startsWith('$$')) ||
      (trimmed.startsWith('\\(') && trimmed.endsWith('\\)'))) {
    const latex = trimmed.startsWith('$') 
      ? trimmed.slice(1, -1) 
      : trimmed.slice(2, -2);
    try {
      return (
        <ScaledMath scale={mathScale}>
          <InlineMath math={latex} />
        </ScaledMath>
      );
    } catch (e) {
      return <span className={className}>{children}</span>;
    }
  }

  // Mixed content: parse and render parts
  const parts: React.ReactNode[] = [];
  let key = 0;

  // Regex to match LaTeX expressions
  // Matches: $$...$$, $...$, \[...\], \(...\)
  const latexRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;
  
  let lastIndex = 0;
  let match;

  while ((match = latexRegex.exec(children)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++}>{children.slice(lastIndex, match.index)}</span>
      );
    }

    const latex = match[0];
    
    try {
      if (latex.startsWith('$$') || latex.startsWith('\\[')) {
        // Block math
        const content = latex.startsWith('$$') 
          ? latex.slice(2, -2) 
          : latex.slice(2, -2);
        parts.push(
          <ScaledMath key={key++} scale={mathScale}>
            <BlockMath math={content} />
          </ScaledMath>
        );
      } else {
        // Inline math
        const content = latex.startsWith('$') 
          ? latex.slice(1, -1) 
          : latex.slice(2, -2);
        parts.push(
          <ScaledMath key={key++} scale={mathScale}>
            <InlineMath math={content} />
          </ScaledMath>
        );
      }
    } catch (e) {
      // If LaTeX parsing fails, show original text
      parts.push(<span key={key++}>{latex}</span>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < children.length) {
    parts.push(<span key={key++}>{children.slice(lastIndex)}</span>);
  }

  if (parts.length === 0) {
    return <span className={className}>{children}</span>;
  }

  return <span className={className}>{parts}</span>;
}

export default MathText;

