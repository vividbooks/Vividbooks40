/**
 * Math Compare Utility
 * 
 * Compares mathematical answers, ignoring formatting differences
 * and recognizing equivalent values (e.g., 8/8 = 1, 0.5 = 1/2)
 * Handles basic LaTeX (like \frac).
 */

/**
 * Normalize a string for comparison:
 * - Remove spaces
 * - Replace comma with dot (European decimal)
 * - Trim whitespace
 * - Remove empty LaTeX groups {}
 * - Remove $ wrappers from inline math
 */
function normalizeAnswer(answer: string): string {
  if (!answer) return '';
  return answer
    .toString()
    .trim()
    .replace(/\$\$/g, '')     // Remove display math markers $$
    .replace(/\$/g, '')       // Remove inline math markers $
    .replace(/\s+/g, '')      // Remove all whitespace
    .replace(/,/g, '.')       // Replace comma with dot
    .replace(/\{\}/g, '')     // Remove empty LaTeX groups
    .replace(/\.+$/, '')      // Remove trailing dots
    .toLowerCase();
}

/**
 * Robustly parse a mathematical string as a number.
 * Returns null if not a valid number or if there's trailing garbage.
 */
export function parseNumber(str: string): number | null {
  let normalized = normalizeAnswer(str);
  if (!normalized) return null;

  // 1. Handle fractions in LaTeX format: \frac{a}{b}
  // This can be part of a mixed number: 7\frac{8}{9}
  const fracRegex = /^(-?\d+)?\\frac\{(-?\d+(?:\.\d+)?)\}\{([-]?\d+(?:\.\d+)?)\}$/;
  const fracMatch = normalized.match(fracRegex);
  
  if (fracMatch) {
    const whole = fracMatch[1] ? parseInt(fracMatch[1]) : 0;
    const numerator = parseFloat(fracMatch[2]);
    const denominator = parseFloat(fracMatch[3]);
    
    if (denominator === 0) return null;
    
    const sign = whole < 0 ? -1 : 1;
    // For mixed numbers like 7 8/9, both whole and fraction are same sign
    // LaTeX 7\frac{8}{9} usually means 7 + 8/9
    return whole + (whole >= 0 ? 1 : -1) * (numerator / denominator);
  }

  // 2. Handle simple fractions: a/b
  const simpleFracRegex = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/;
  const simpleFracMatch = normalized.match(simpleFracRegex);
  if (simpleFracMatch) {
    const numerator = parseFloat(simpleFracMatch[1]);
    const denominator = parseFloat(simpleFracMatch[2]);
    if (denominator === 0) return null;
    return numerator / denominator;
  }

  // 3. Handle mixed numbers: a b/c (standard format with space)
  // Check the original string for mixed numbers before aggressive normalization.
  const originalTrimmed = str.trim().replace(/,/g, '.');
  const mixedRegex = /^(-?\d+)\s+(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/;
  const mixedMatch = originalTrimmed.match(mixedRegex);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const numerator = parseFloat(mixedMatch[2]);
    const denominator = parseFloat(mixedMatch[3]);
    if (denominator === 0) return null;
    return whole + (whole >= 0 ? 1 : -1) * (numerator / denominator);
  }

  // 4. Try regular number parsing
  // Use a strict regex to ensure the WHOLE string is a number
  const numRegex = /^-?\d+(?:\.\d+)?$/;
  if (numRegex.test(normalized)) {
    return parseFloat(normalized);
  }

  return null;
}

/**
 * Compare two mathematical values with tolerance for floating point errors
 */
function numbersAreEqual(a: number, b: number, tolerance = 1e-6): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * Compare two answers mathematically
 * Returns true if they represent the same value
 */
export function compareMathAnswers(userAnswer: string, correctAnswer: string): boolean {
  if (userAnswer === undefined || correctAnswer === undefined) return false;
  
  // First, try exact string comparison (case-insensitive, normalized)
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  
  if (normalizedUser === normalizedCorrect) {
    return true;
  }
  
  // Try mathematical comparison
  const userNum = parseNumber(userAnswer);
  const correctNum = parseNumber(correctAnswer);
  
  if (userNum !== null && correctNum !== null) {
    return numbersAreEqual(userNum, correctNum);
  }
  
  return false;
}

/**
 * Check if user answer matches any of the correct answers
 */
export function checkMathAnswer(userAnswer: string, correctAnswers: string[]): boolean {
  if (userAnswer === undefined || !correctAnswers || correctAnswers.length === 0) {
    return false;
  }
  
  // Filter out empty strings from correct answers
  const validCorrectAnswers = correctAnswers.filter(c => c && c.trim() !== '');
  if (validCorrectAnswers.length === 0) return false;

  return validCorrectAnswers.some(correct => compareMathAnswers(userAnswer, correct));
}

export default { compareMathAnswers, checkMathAnswer, parseNumber };
