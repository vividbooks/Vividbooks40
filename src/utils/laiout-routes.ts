/** Veřejná URL knihovny Laiout + editoru konkrétní knihy (alias k /admin/pro a /admin/workbook-pro/…).
 * Kanonická cesta má koncové / — na GitHub Pages pak sedí fyzický soubor laiout/index.html (200). */
export const LAIOUT_BOOKSHELF_PATH = '/laiout/';

export function laioutBookEditorPath(bookId: string): string {
  return `/laiout/${encodeURIComponent(bookId)}`;
}
