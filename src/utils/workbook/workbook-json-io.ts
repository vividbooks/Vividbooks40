/**
 * Export / import celé knihy (Workbook + worksheets) jako JSON pro Laiout.
 */

import type { Workbook } from '../../types/workbook';
import type { Worksheet } from '../../types/worksheet';

export const LAIOUT_BOOK_JSON_FORMAT = 'laiout-book' as const;
export const LAIOUT_BOOK_JSON_VERSION = 1;

export interface LaioutBookJsonFile {
  format: typeof LAIOUT_BOOK_JSON_FORMAT;
  version: number;
  exportedAt: string;
  workbook: Workbook;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function wrapWorkbookForExport(workbook: Workbook): LaioutBookJsonFile {
  return {
    format: LAIOUT_BOOK_JSON_FORMAT,
    version: LAIOUT_BOOK_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    workbook: JSON.parse(JSON.stringify(workbook)) as Workbook,
  };
}

/** Vrátí workbook z exportního obalu nebo z holého objektu (zpětná kompatibilita). */
export function parseWorkbookImportRoot(data: unknown): Workbook | null {
  let wb: unknown = data;
  if (isRecord(data) && data.format === LAIOUT_BOOK_JSON_FORMAT && isRecord(data.workbook)) {
    wb = data.workbook;
  }
  if (!isRecord(wb)) return null;
  if (typeof wb.title !== 'string') return null;
  if (!Array.isArray(wb.pages)) return null;
  if (!Array.isArray(wb.chapters)) return null;
  if (!isRecord(wb.worksheets)) return null;
  if (!isRecord(wb.settings)) return null;
  return wb as Workbook;
}

export function workbookPagesReferenceMissingWorksheets(wb: Workbook): boolean {
  for (const p of wb.pages) {
    if (!wb.worksheets[p.worksheetId]) return true;
  }
  return false;
}

/**
 * Nové UUID pro každý list → bez kolizí při importu do existující knihy.
 * Předpoklad: id kapitoly je `chapter-${worksheetId}` (jako v applyMeta).
 */
export function remapImportedWorkbookIds(source: Workbook, targetBookId: string): Workbook {
  const worksheets = source.worksheets;
  const oldIds = Object.keys(worksheets);
  const idMap = new Map<string, string>();
  for (const oid of oldIds) {
    idMap.set(oid, crypto.randomUUID());
  }

  const newWorksheets: Record<string, Worksheet> = {};
  for (const oid of oldIds) {
    const nid = idMap.get(oid)!;
    const ws = worksheets[oid];
    newWorksheets[nid] = {
      ...ws,
      id: nid,
      updatedAt: new Date().toISOString(),
    };
  }

  const remapChapterId = (chId: string | undefined): string | undefined => {
    if (!chId || !chId.startsWith('chapter-')) return chId;
    const oldWs = chId.slice('chapter-'.length);
    const nid = idMap.get(oldWs);
    return nid ? `chapter-${nid}` : chId;
  };

  const newPages = source.pages.map((p) => {
    const newWsId = idMap.get(p.worksheetId) ?? p.worksheetId;
    return {
      ...p,
      id: `page-${newWsId}-${p.worksheetPageIndex}`,
      worksheetId: newWsId,
      startsChapterId: remapChapterId(p.startsChapterId),
    };
  });

  const newChapters = source.chapters.map((ch) => {
    if (!ch.id.startsWith('chapter-')) {
      return { ...ch };
    }
    const oldWs = ch.id.slice('chapter-'.length);
    const newWsId = idMap.get(oldWs);
    return {
      ...ch,
      id: newWsId ? `chapter-${newWsId}` : ch.id,
    };
  });

  return {
    ...source,
    id: targetBookId,
    pages: newPages,
    chapters: newChapters,
    worksheets: newWorksheets,
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeFilenamePart(name: string, maxLen = 80): string {
  const t = name.trim().replace(/[^\p{L}\p{N}\s\-_.]+/gu, '_').replace(/\s+/g, '-').slice(0, maxLen);
  return t || 'kniha';
}
