import React from 'react';
import katex from 'katex';

interface LatexRendererProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders text with LaTeX math formulas.
 * 
 * Syntax:
 * - Inline math: $formula$ or \(formula\)
 * - Display/block math: $$formula$$ or \[formula\]
 * 
 * Examples:
 * - "Vzorec: $x^2 + y^2 = z^2$"
 * - "Rovnice: $$\frac{a}{b} = c$$"
 */
export function LatexRenderer({ text, className, style }: LatexRendererProps) {
  const renderLatex = (content: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = content;
    let keyIndex = 0;

    // Regex patterns for LaTeX
    // Display math: $$...$$ or \[...\]
    // Inline math: $...$ or \(...\)
    const displayPattern = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g;
    const inlinePattern = /\$([^$\n]+?)\$|\\\(([^)]+?)\\\)/g;

    // First, handle display math ($$...$$)
    let lastIndex = 0;
    let match;

    // Process display math first
    const displayMatches: Array<{ start: number; end: number; formula: string; isDisplay: true }> = [];
    while ((match = displayPattern.exec(content)) !== null) {
      displayMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        formula: match[1] || match[2],
        isDisplay: true,
      });
    }

    // Process inline math
    const inlineMatches: Array<{ start: number; end: number; formula: string; isDisplay: false }> = [];
    while ((match = inlinePattern.exec(content)) !== null) {
      // Check if this inline match overlaps with any display match
      const overlaps = displayMatches.some(
        dm => match!.index >= dm.start && match!.index < dm.end
      );
      if (!overlaps) {
        inlineMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          formula: match[1] || match[2],
          isDisplay: false,
        });
      }
    }

    // Combine and sort all matches
    const allMatches = [...displayMatches, ...inlineMatches].sort((a, b) => a.start - b.start);

    if (allMatches.length === 0) {
      return [<span key={0} style={style}>{content}</span>];
    }

    // Build the result
    for (const m of allMatches) {
      // Add text before this match
      if (m.start > lastIndex) {
        parts.push(<span key={keyIndex++} style={style}>{content.slice(lastIndex, m.start)}</span>);
      }

      // Render the LaTeX
      try {
        const html = katex.renderToString(m.formula, {
          displayMode: m.isDisplay,
          throwOnError: false,
          errorColor: '#cc0000',
        });
        
        if (m.isDisplay) {
          parts.push(
            <div
              key={keyIndex++}
              className="my-2 text-center"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } else {
          parts.push(
            <span
              key={keyIndex++}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
      } catch (error) {
        // If LaTeX fails, show the original text in red
        parts.push(
          <span key={keyIndex++} style={{ color: '#cc0000' }}>
            {m.isDisplay ? `$$${m.formula}$$` : `$${m.formula}$`}
          </span>
        );
      }

      lastIndex = m.end;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(<span key={keyIndex++}>{content.slice(lastIndex)}</span>);
    }

    return parts;
  };

  return (
    <span className={className} style={style}>
      {renderLatex(text)}
    </span>
  );
}

/**
 * Simple inline LaTeX component for single formulas
 */
export function InlineMath({ formula }: { formula: string }) {
  try {
    const html = katex.renderToString(formula, {
      displayMode: false,
      throwOnError: false,
    });
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <span style={{ color: '#cc0000' }}>${formula}$</span>;
  }
}

/**
 * Display/block LaTeX component for single formulas
 */
export function DisplayMath({ formula }: { formula: string }) {
  try {
    const html = katex.renderToString(formula, {
      displayMode: true,
      throwOnError: false,
    });
    return <div className="my-2 text-center" dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <div style={{ color: '#cc0000' }}>$${formula}$$</div>;
  }
}

export default LatexRenderer;


