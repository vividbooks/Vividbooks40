import React from 'react';
import katex from 'katex';
import { preventOrphans } from '../math/MathText';

/**
 * Applies Czech orphan-prevention (non-breaking spaces after single-char prepositions)
 * to HTML string – only touches text nodes between tags, never inside tag attributes.
 */
export function preventOrphansInHtml(html: string): string {
  if (!html) return html;
  // Process ALL text nodes: between tags (>TEXT<) AND at end of string (>TEXT with no closing <).
  // Using />([^<]+)/g instead of />([^<]+)</g so the final text node is also processed.
  return html
    .replace(/>([^<]+)/g, (match, text) => '>' + preventOrphans(text))
    .replace(/(\s[aioukvszAIOUKVSZ])(<)/gi, (_, word, tag) => word.trimEnd() + '\u00A0' + tag);
}

interface LatexRendererProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders inline markdown/HTML formatting recursively:
 *   **bold**, *italic*, <u>underline</u>,
 *   <mark style="background:COLOR">highlight</mark>
 *
 * Nested combinations like ***bold+italic*** or **<u>bold+underline</u>** are handled
 * by recursively parsing the content of each matched group.
 */
function renderInlineMarkdown(text: string, style?: React.CSSProperties, startKey = 0): [React.ReactNode[], number] {
  const parts: React.ReactNode[] = [];
  // Order matters: **bold** before *italic*, then <u>, then <mark ...>
  const mdPattern = /\*\*([\s\S]+?)\*\*|<strong>([\s\S]+?)<\/strong>|<b>([\s\S]+?)<\/b>|\*([\s\S]+?)\*|<em>([\s\S]+?)<\/em>|<i>([\s\S]+?)<\/i>|<u>([\s\S]+?)<\/u>|<mark(?:\s+style="([^"]*)")?>(\s*[\s\S]+?)<\/mark>/g;
  let last = 0;
  let k = startKey;
  let match: RegExpExecArray | null;

  while ((match = mdPattern.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > last) {
      parts.push(<span key={k++} style={style}>{text.slice(last, match.index)}</span>);
    }

    // New groups: [1]=**bold** [2]=<strong> [3]=<b> [4]=*italic* [5]=<em> [6]=<i> [7]=<u> [8]=mark-style [9]=mark-text
    const boldContent = match[1] ?? match[2] ?? match[3];
    const italicContent = match[4] ?? match[5] ?? match[6];
    const underlineContent = match[7];
    const markStyle = match[8];
    const markContent = match[9];

    if (boldContent !== undefined) {
      // **bold** / <strong> / <b>
      const [children, nextK] = renderInlineMarkdown(boldContent, style, k);
      k = nextK;
      parts.push(<strong key={k++} style={style}>{children}</strong>);
    } else if (italicContent !== undefined) {
      // *italic* / <em> / <i>
      const [children, nextK] = renderInlineMarkdown(italicContent, style, k);
      k = nextK;
      parts.push(<em key={k++} style={style}>{children}</em>);
    } else if (underlineContent !== undefined) {
      // <u>underline</u>
      const [children, nextK] = renderInlineMarkdown(underlineContent, style, k);
      k = nextK;
      parts.push(<u key={k++} style={style}>{children}</u>);
    } else if (markContent !== undefined) {
      // <mark style="...">highlight</mark>
      const inlineStyle = markStyle || '';
      const bgMatch = inlineStyle.match(/background(?:-color)?:\s*([^;]+)/);
      const bg = bgMatch ? bgMatch[1].trim() : '#fef08a';
      const [children, nextK] = renderInlineMarkdown(markContent, style, k);
      k = nextK;
      parts.push(
        <mark key={k++} style={{ background: bg, borderRadius: '7px', padding: '0.11em 0.28em', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>
          {children}
        </mark>
      );
    }

    last = match.index + match[0].length;
  }

  // Remaining plain text
  if (last < text.length) {
    parts.push(<span key={k++} style={style}>{text.slice(last)}</span>);
  }
  return [parts, k];
}

/**
 * Renders text with LaTeX math formulas and inline markdown (**bold**, *italic*, <u>underline</u>).
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
  // Apply Czech typography: bind single-char prepositions to the following word
  text = preventOrphans(text ?? '');

  const renderLatex = (content: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
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
      const [mdParts] = renderInlineMarkdown(content, style, 0);
      return mdParts;
    }

    // Build the result
    for (const m of allMatches) {
      // Add text before this match (with inline markdown support)
      if (m.start > lastIndex) {
        const [mdParts, nextKey] = renderInlineMarkdown(content.slice(lastIndex, m.start), style, keyIndex);
        mdParts.forEach(p => parts.push(p));
        keyIndex = nextKey;
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

    // Add remaining text (with inline markdown support)
    if (lastIndex < content.length) {
      const [mdParts] = renderInlineMarkdown(content.slice(lastIndex), style, keyIndex);
      mdParts.forEach(p => parts.push(p));
    }

    return parts;
  };

  // Split on newlines so \n renders as <br>
  const lines = text.split('\n');
  if (lines.length === 1) {
    return (
      <span className={className} style={style}>
        {renderLatex(text)}
      </span>
    );
  }
  return (
    <span className={className} style={style}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {renderLatex(line)}
        </React.Fragment>
      ))}
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


