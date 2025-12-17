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

  // Pre-process: Fix corrupted LaTeX commands
  // The data might contain broken LaTeX like "\tNEROVNÁ" (should be \textbf{NEROVNÁ})
  // or "\f" + fraction (should be \frac{}{})
  
  let processedInput = children;
  
  // Step 1: Fix literal "\t" followed by word (corrupted \textbf)
  // Pattern: \t followed by uppercase word = was \textbf{}
  processedInput = processedInput.replace(/\\t([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž]*)/g, '\\textbf{$1}');
  
  // Step 2: Fix literal "\f" that appears before math content  
  // Remove stray \f that precedes $ (math delimiter) or \frac
  processedInput = processedInput.replace(/\\f\s*(?=\$)/g, ''); // Remove \f before $
  processedInput = processedInput.replace(/\\f\s*(?=\\frac)/g, ''); // Remove \f before \frac
  // If \f is followed by { it was probably \frac{
  processedInput = processedInput.replace(/\\f\s*\{/g, '\\frac{');
  
  // Step 3: Handle actual control characters (ASCII codes)
  processedInput = processedInput.replace(/\x0Crac\{/g, '\\frac{');  // form-feed + rac{
  processedInput = processedInput.replace(/\x09extbf\{/g, '\\textbf{'); // tab + extbf{
  processedInput = processedInput.replace(/\x09extit\{/g, '\\textit{'); // tab + extit{
  
  // Step 4: Handle orphaned command parts (backslash completely eaten)
  processedInput = processedInput.replace(/(?<![\\a-zA-Z])rac\{([^}]*)\}\{([^}]*)\}/g, '\\frac{$1}{$2}');
  processedInput = processedInput.replace(/(?<![\\a-zA-Z])extbf\{([^}]*)\}/g, '\\textbf{$1}');
  processedInput = processedInput.replace(/(?<![\\a-zA-Z])extit\{([^}]*)\}/g, '\\textit{$1}');
  
  // Step 5: Clean up any remaining stray escape sequences before math
  processedInput = processedInput.replace(/\\[tfnrb]\s*(?=\$)/g, ''); // Remove \t, \f, \n, \r, \b before $
  
  // Auto-wrap LaTeX math commands not inside $...$ with inline math delimiters
  // This handles cases where content contains \frac, \sqrt, etc. without $ wrapping
  const mathPatterns = [
    /\\frac\{[^}]*\}\{[^}]*\}/g,        // \frac{a}{b}
    /\\sqrt(?:\[[^\]]*\])?\{[^}]*\}/g,  // \sqrt{x} or \sqrt[n]{x}
    /\\sum/g, /\\prod/g, /\\int/g,      // summation, product, integral
    /\\times/g, /\\div/g, /\\pm/g,      // operators
    /\\cdot/g, /\\ldots/g, /\\dots/g,
    /\\alpha/g, /\\beta/g, /\\gamma/g, /\\delta/g, /\\pi/g,  // Greek letters
    /\\infty/g, /\\leq/g, /\\geq/g, /\\neq/g,
    /\{,\}/g,  // European decimal comma notation like 0{,}06
  ];
  
  // Check if content has math patterns but no $ delimiters
  const hasMathPatterns = mathPatterns.some(p => p.test(processedInput));
  const hasDollarDelimiters = processedInput.includes('$') || processedInput.includes('\\(') || processedInput.includes('\\[');
  
  // If it has math patterns but no delimiters, wrap each recognizable math segment
  if (hasMathPatterns && !hasDollarDelimiters) {
    // Wrap \frac{}{} in $...$
    processedInput = processedInput.replace(
      /(\\frac\{[^}]*\}\{[^}]*\})/g, 
      '$$$1$$'
    );
    // Wrap \sqrt{} in $...$
    processedInput = processedInput.replace(
      /(\\sqrt(?:\[[^\]]*\])?\{[^}]*\})/g, 
      '$$$1$$'
    );
    // Wrap numbers with {,} (European decimal) in $...$
    processedInput = processedInput.replace(
      /(\d+\{,\}\d+)/g,
      '$$$1$$'
    );
  }

  // Check if the entire string is just a LaTeX expression
  const trimmed = processedInput.trim();
  
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
      return <span className={className}>{processedInput}</span>;
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
      return <span className={className}>{processedInput}</span>;
    }
  }

  // Mixed content: parse and render parts
  const parts: React.ReactNode[] = [];
  let key = 0;

  // Pre-process: Convert LaTeX text commands outside of math mode to styled HTML
  // This handles \textbf{}, \textit{}, \underline{} etc. that are not inside $...$
  
  // Function to process text commands
  const processTextCommands = (text: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    
    // Match \textbf{...}, \textit{...}, \underline{...}, \emph{...}, \text{...}
    const textCmdRegex = /(\\textbf\{([^}]*)\}|\\textit\{([^}]*)\}|\\underline\{([^}]*)\}|\\emph\{([^}]*)\}|\\text\{([^}]*)\})/g;
    
    let lastIdx = 0;
    let cmdMatch;
    
    while ((cmdMatch = textCmdRegex.exec(text)) !== null) {
      // Add text before the match
      if (cmdMatch.index > lastIdx) {
        result.push(text.slice(lastIdx, cmdMatch.index));
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
    if (lastIdx < text.length) {
      result.push(text.slice(lastIdx));
    }
    
    return result.length > 0 ? result : [text];
  };

  // Regex to match LaTeX expressions
  // Matches: $$...$$, $...$, \[...\], \(...\)
  const latexRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;
  
  let lastIndex = 0;
  let match;

  while ((match = latexRegex.exec(processedInput)) !== null) {
    // Add text before the match (process text commands like \textbf)
    if (match.index > lastIndex) {
      const textBefore = processedInput.slice(lastIndex, match.index);
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
  if (lastIndex < processedInput.length) {
    const remainingText = processedInput.slice(lastIndex);
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

