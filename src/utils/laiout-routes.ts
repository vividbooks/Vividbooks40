/** Veřejná URL knihovny Laiout + editoru konkrétní knihy (alias k /admin/pro a /admin/workbook-pro/…). */
export const LAIOUT_BOOKSHELF_PATH = '/laiout';

export function laioutBookEditorPath(bookId: string): string {
  return `/laiout/${encodeURIComponent(bookId)}`;
}
