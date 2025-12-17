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

  // Pre-process: Convert LaTeX text commands outside of math mode to styled HTML
  // This handles \textbf{}, \textit{}, \underline{} etc. that are not inside $...$
  // Also handles cases where \t was interpreted as a tab character
  
  // Function to process text commands
  const processTextCommands = (text: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    
    // First, fix common escaping issues:
    // - Replace tab + "extbf{" with "\textbf{" (when \t was interpreted as tab)
    // - Replace tab + "extit{" with "\textit{"
    let fixedText = text
      .replace(/\textbf\{/g, '\\textbf{')  // tab+extbf -> \textbf
      .replace(/\textit\{/g, '\\textit{')  // tab+extit -> \textit
      .replace(/extbf\{/g, '\\textbf{')    // just extbf (backslash eaten) -> \textbf  
      .replace(/extit\{/g, '\\textit{');   // just extit -> \textit
    
    // Match \textbf{...}, \textit{...}, \underline{...}, \emph{...}, \text{...}
    const textCmdRegex = /(\\textbf\{([^}]*)\}|\\textit\{([^}]*)\}|\\underline\{([^}]*)\}|\\emph\{([^}]*)\}|\\text\{([^}]*)\})/g;
    
    let lastIdx = 0;
    let cmdMatch;
    
    while ((cmdMatch = textCmdRegex.exec(fixedText)) !== null) {
      // Add text before the match
      if (cmdMatch.index > lastIdx) {
        result.push(fixedText.slice(lastIdx, cmdMatch.index));
      }
      
      const fullMatch = cmdMatch[0];
      if (fullMatch.startsWith('\\textbf{')) {
        result.push(<strong key={`cmd-${cmdMatch.index}`}>{cmdMatch[2]}</strong>);
      } else if (fullMatch.startsWith('\\textit{') || fullMatch.startsWith('\\emph{')) {
        result.push(<em key={`cmd-${cmdMatch.index}`}>{cmdMatch[3] || cmdMatch[5]}</em>);
      } else if (fullMatch.startsWith('\\underline{')) {
        result.push(<u key={`cmd-${cmdMatch.index}`}>{cmdMatch[4]}</u>);
      } else if (fullMatch.startsWith('\\text{')) {
        result.push(<span key={`cmd-${cmdMatch.index}`}>{cmdMatch[6]}</span>);
      }
      
      lastIdx = cmdMatch.index + fullMatch.length;
    }
    
    // Add remaining text
    if (lastIdx < fixedText.length) {
      result.push(fixedText.slice(lastIdx));
    }
    
    return result.length > 0 ? result : [text];
  };

  // Regex to match LaTeX expressions
  // Matches: $$...$$, $...$, \[...\], \(...\)
  const latexRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;
  
  let lastIndex = 0;
  let match;

  while ((match = latexRegex.exec(children)) !== null) {
    // Add text before the match (process text commands like \textbf)
    if (match.index > lastIndex) {
      const textBefore = children.slice(lastIndex, match.index);
      const processedParts = processTextCommands(textBefore);
      processedParts.forEach(part => {
        parts.push(typeof part === 'string' ? <span key={key++}>{part}</span> : React.cloneElement(part as React.ReactElement, { key: key++ }));
      });
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

  // Add remaining text (process text commands like \textbf)
  if (lastIndex < children.length) {
    const remainingText = children.slice(lastIndex);
    const processedParts = processTextCommands(remainingText);
    processedParts.forEach(part => {
      parts.push(typeof part === 'string' ? <span key={key++}>{part}</span> : React.cloneElement(part as React.ReactElement, { key: key++ }));
    });
  }

  if (parts.length === 0) {
    return <span className={className}>{children}</span>;
  }

  return <span className={className}>{parts}</span>;
}

export default MathText;

