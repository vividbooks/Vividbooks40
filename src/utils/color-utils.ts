/**
 * Utility functions for color manipulation and contrast calculation
 */

/**
 * Calculates the relative luminance of a color
 * @param hexColor Hex color string (e.g. "#FFFFFF" or "FFFFFF")
 * @returns Luminance value between 0 and 1
 */
export function getLuminance(hexColor: string): number {
  if (!hexColor) return 1;
  
  const color = hexColor.replace('#', '');
  
  // Handle shorthand hex like #FFF
  let fullHex = color;
  if (color.length === 3) {
    fullHex = color.split('').map(char => char + char).join('');
  }
  
  const r = parseInt(fullHex.substr(0, 2), 16);
  const g = parseInt(fullHex.substr(2, 2), 16);
  const b = parseInt(fullHex.substr(4, 2), 16);
  
  // WCAG formula for relative luminance
  // https://www.w3.org/TR/WCAG20/#relativeluminancedef
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Determines the best contrast color (black or white) for a given background color
 * @param hexColor Background color in hex
 * @returns "#000000" or "#FFFFFF"
 */
export function getContrastColor(hexColor: string): string {
  const luminance = getLuminance(hexColor);
  return luminance > 0.179 ? '#000000' : '#FFFFFF';
}





