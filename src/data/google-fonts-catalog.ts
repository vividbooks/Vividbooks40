/**
 * Katalog Google Fonts dostupný v design systému (výběr „knihovny“).
 * Načítání CSS probíhá jen v tiskové / PDF cestě (PrintGridCanvas).
 */

export type GoogleFontCatalogCategory = 'sans-serif' | 'serif' | 'display' | 'mono';

export interface GoogleFontCatalogEntry {
  family: string;
  label: string;
  category: GoogleFontCatalogCategory;
}

/** Rodiny vhodné pro učebnice; family = přesný název pro fonts.googleapis.com */
export const GOOGLE_FONTS_CATALOG: GoogleFontCatalogEntry[] = [
  // Sans
  { family: 'Inter', label: 'Inter', category: 'sans-serif' },
  { family: 'Open Sans', label: 'Open Sans', category: 'sans-serif' },
  { family: 'Roboto', label: 'Roboto', category: 'sans-serif' },
  { family: 'Lato', label: 'Lato', category: 'sans-serif' },
  { family: 'Nunito', label: 'Nunito', category: 'sans-serif' },
  { family: 'Poppins', label: 'Poppins', category: 'sans-serif' },
  { family: 'Raleway', label: 'Raleway', category: 'sans-serif' },
  { family: 'DM Sans', label: 'DM Sans', category: 'sans-serif' },
  { family: 'Outfit', label: 'Outfit', category: 'sans-serif' },
  { family: 'Source Sans 3', label: 'Source Sans 3', category: 'sans-serif' },
  { family: 'Rubik', label: 'Rubik', category: 'sans-serif' },
  { family: 'Ubuntu', label: 'Ubuntu', category: 'sans-serif' },
  { family: 'Work Sans', label: 'Work Sans', category: 'sans-serif' },
  { family: 'Manrope', label: 'Manrope', category: 'sans-serif' },
  { family: 'Figtree', label: 'Figtree', category: 'sans-serif' },
  { family: 'Lexend', label: 'Lexend', category: 'sans-serif' },
  { family: 'Quicksand', label: 'Quicksand', category: 'sans-serif' },
  { family: 'Montserrat', label: 'Montserrat', category: 'sans-serif' },
  { family: 'Mulish', label: 'Mulish', category: 'sans-serif' },
  { family: 'Noto Sans', label: 'Noto Sans', category: 'sans-serif' },
  // Serif
  { family: 'Lora', label: 'Lora', category: 'serif' },
  { family: 'Merriweather', label: 'Merriweather', category: 'serif' },
  { family: 'Playfair Display', label: 'Playfair Display', category: 'serif' },
  { family: 'PT Serif', label: 'PT Serif', category: 'serif' },
  { family: 'Libre Baskerville', label: 'Libre Baskerville', category: 'serif' },
  { family: 'Source Serif 4', label: 'Source Serif 4', category: 'serif' },
  { family: 'EB Garamond', label: 'EB Garamond', category: 'serif' },
  { family: 'Crimson Pro', label: 'Crimson Pro', category: 'serif' },
  { family: 'Bitter', label: 'Bitter', category: 'serif' },
  { family: 'Noto Serif', label: 'Noto Serif', category: 'serif' },
  // Display / výraznější
  { family: 'Fraunces', label: 'Fraunces', category: 'display' },
  { family: 'Space Grotesk', label: 'Space Grotesk', category: 'display' },
  { family: 'Sora', label: 'Sora', category: 'display' },
  { family: 'Comfortaa', label: 'Comfortaa', category: 'display' },
  { family: 'Fredoka', label: 'Fredoka', category: 'display' },
  // Mono
  { family: 'JetBrains Mono', label: 'JetBrains Mono', category: 'mono' },
  { family: 'Fira Code', label: 'Fira Code', category: 'mono' },
  { family: 'IBM Plex Mono', label: 'IBM Plex Mono', category: 'mono' },
];
