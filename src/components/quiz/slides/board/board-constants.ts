// Shared constants and utility functions for the Board (Nástěnka) slide

/** Color options for post cards in the add-post modal */
export const POST_COLORS = [
  { name: 'Bílá',    value: '#ffffff' },
  { name: 'Růžová',  value: '#fce7f3' },
  { name: 'Fialová', value: '#ede9fe' },
  { name: 'Modrá',   value: '#dbeafe' },
  { name: 'Zelená',  value: '#dcfce7' },
  { name: 'Žlutá',   value: '#fef9c3' },
  { name: 'Oranžová',value: '#ffedd5' },
  { name: 'Šedá',    value: '#f1f5f9' },
] as const;

/** Card colors for the standard (text) present-mode grid */
export const CARD_COLORS = [
  { bg: '#fef9c3', border: '#fde047' },
  { bg: '#fce7f3', border: '#f9a8d4' },
  { bg: '#e0f2fe', border: '#7dd3fc' },
  { bg: '#ede9fe', border: '#c4b5fd' },
  { bg: '#dcfce7', border: '#86efac' },
  { bg: '#ffedd5', border: '#fdba74' },
  { bg: '#f1f5f9', border: '#cbd5e1' },
  { bg: '#fdf2f8', border: '#e879f9' },
] as const;

/** Card colors for the "Pro" (left) column in pros-cons present mode */
export const PRO_PALETTE = [
  { bg: '#eef2ff', border: '#a5b4fc' },
  { bg: '#ede9fe', border: '#c4b5fd' },
  { bg: '#e0e7ff', border: '#93c5fd' },
  { bg: '#dbeafe', border: '#93c5fd' },
] as const;

/** Card colors for the "Proti" (right) column in pros-cons present mode */
export const CONS_PALETTE = [
  { bg: '#fffbeb', border: '#fcd34d' },
  { bg: '#ffedd5', border: '#fdba74' },
  { bg: '#fef9c3', border: '#fde047' },
  { bg: '#fef3c7', border: '#fbbf24' },
] as const;

/** Calculate dynamic font size based on question length */
export function getQuestionFontSize(text: string): string {
  const length = text.length;
  if (length < 20)  return '2.5rem';
  if (length < 40)  return '2rem';
  if (length < 80)  return '1.75rem';
  if (length < 120) return '1.5rem';
  if (length < 200) return '1.25rem';
  return '1.125rem';
}

/** Extract YouTube video ID from a URL */
export function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}
