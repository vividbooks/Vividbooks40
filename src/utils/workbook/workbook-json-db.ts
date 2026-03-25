/**
 * Načtení knihy z DB pro JSON export a import JSON do existující knihy (Supabase).
 */

import { supabase } from '../supabase/client';
import { stripBase64FromObject } from '../supabase/upload-image';
import { saveWorksheet, deleteWorksheet } from '../worksheet-storage';
import type { Workbook } from '../../types/workbook';
import {
  CHAPTER_COLORS,
  DEFAULT_WORKBOOK_SETTINGS,
} from '../../types/workbook';
import type { Worksheet } from '../../types/worksheet';
import { deriveWorksheetPageCount } from '../worksheet-page-count';
import {
  wrapWorkbookForExport,
  parseWorkbookImportRoot,
  remapImportedWorkbookIds,
  workbookPagesReferenceMissingWorksheets,
  type LaioutBookJsonFile,
} from './workbook-json-io';

const DEFAULT_PAGE_LIMIT = 96;

async function upsertWorksheetForBook(ws: Worksheet, bookId: string, teacherId: string): Promise<void> {
  const safeWorksheet = stripBase64FromObject(ws) as Worksheet;
  const upsertData: Record<string, unknown> = {
    id: safeWorksheet.id,
    teacher_id: teacherId,
    name: safeWorksheet.title || 'Nový pracovní list',
    worksheet_type: safeWorksheet.metadata?.subject || null,
    content: safeWorksheet,
    pdf_settings: (safeWorksheet as Worksheet & { pdfSettings?: unknown }).pdfSettings ?? {},
    folder_id: null,
    book_id: bookId,
    source_dataset_id: safeWorksheet.metadata?.sourceDatasetId ?? null,
    created_at: safeWorksheet.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('teacher_worksheets').upsert(upsertData, { onConflict: 'id' });
  if (error) throw error;
  saveWorksheet(safeWorksheet, null, bookId);
}

/**
 * Složí Workbook z DB (book_id + legacy folder_id), včetně plného obsahu listů.
 */
export async function fetchWorkbookForJsonExport(bookId: string): Promise<Workbook | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: bookRow, error: bookErr } = await supabase
    .from('teacher_books')
    .select('title, total_pages, teacher_id')
    .eq('id', bookId)
    .single();

  if (bookErr || !bookRow || bookRow.teacher_id !== user.id) return null;

  const { data: byBook } = await supabase
    .from('teacher_worksheets')
    .select('id, name, content, created_at')
    .eq('teacher_id', user.id)
    .eq('book_id', bookId)
    .order('created_at', { ascending: true });

  const { data: byFolder } = await supabase
    .from('teacher_worksheets')
    .select('id, name, content, created_at')
    .eq('teacher_id', user.id)
    .eq('folder_id', bookId)
    .order('created_at', { ascending: true });

  const seen = new Set<string>();
  const rows: { id: string; name: string; content: unknown; created_at: string }[] = [];
  for (const r of [...(byBook ?? []), ...(byFolder ?? [])]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    rows.push(r);
  }
  rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (rows.length === 0) {
    const limit =
      bookRow.total_pages != null && Number(bookRow.total_pages) > 0
        ? Math.round(Number(bookRow.total_pages))
        : DEFAULT_PAGE_LIMIT;
    return {
      id: bookId,
      title: bookRow.title || 'Kniha',
      description: '',
      pages: [],
      chapters: [],
      worksheets: {},
      settings: { ...DEFAULT_WORKBOOK_SETTINGS, pageLimit: limit },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const worksheets: Record<string, Worksheet> = {};
  const pages: Workbook['pages'] = [];
  const chapters: Workbook['chapters'] = [];
  let pageNum = 1;

  rows.forEach((row, i) => {
    const content = row.content as Worksheet | null;
    if (!content || typeof content !== 'object') return;
    const wid = row.id;
    const ws: Worksheet = { ...content, id: wid };
    worksheets[wid] = ws;
    const pageCount = deriveWorksheetPageCount(ws);
    const chapter = {
      id: `chapter-${wid}`,
      title: ws.title || row.name || `Kapitola ${i + 1}`,
      color: CHAPTER_COLORS[i % CHAPTER_COLORS.length],
      order: i + 1,
    };
    chapters.push(chapter);
    for (let p = 0; p < pageCount; p++) {
      pages.push({
        id: `page-${wid}-${p}`,
        pageNumber: pageNum++,
        worksheetId: wid,
        worksheetPageIndex: p,
        startsChapterId: p === 0 ? chapter.id : undefined,
      });
    }
  });

  const dbLimit =
    bookRow.total_pages != null && Number(bookRow.total_pages) > 0
      ? Math.round(Number(bookRow.total_pages))
      : DEFAULT_PAGE_LIMIT;
  const pageLimit = Math.max(dbLimit, pages.length, 1);

  return {
    id: bookId,
    title: bookRow.title || 'Kniha',
    description: '',
    pages,
    chapters,
    worksheets,
    settings: {
      ...DEFAULT_WORKBOOK_SETTINGS,
      pageLimit,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function buildLaioutBookJsonFileForBook(bookId: string): Promise<LaioutBookJsonFile | null> {
  const wb = await fetchWorkbookForJsonExport(bookId);
  if (!wb) return null;
  return wrapWorkbookForExport(wb);
}

export type BookJsonImportErrorCode =
  | 'PARSE'
  | 'INVALID'
  | 'INCOMPLETE'
  | 'AUTH'
  | 'UNKNOWN';

export class BookJsonImportError extends Error {
  code: BookJsonImportErrorCode;
  constructor(code: BookJsonImportErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

/**
 * Přepíše obsah existující knihy importem (nová UUID listů, smaže staré řádky knihy).
 */
export async function importLaioutBookJsonIntoBook(bookId: string, jsonText: string): Promise<Workbook> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new BookJsonImportError('PARSE');
  }

  const raw = parseWorkbookImportRoot(parsed);
  if (!raw) throw new BookJsonImportError('INVALID');

  if (workbookPagesReferenceMissingWorksheets(raw)) {
    throw new BookJsonImportError('INCOMPLETE');
  }

  const next = remapImportedWorkbookIds(raw, bookId);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new BookJsonImportError('AUTH');

  const { data: existingRows } = await supabase
    .from('teacher_worksheets')
    .select('id')
    .eq('book_id', bookId)
    .eq('teacher_id', user.id);

  const existingIds = new Set((existingRows ?? []).map((r: { id: string }) => r.id));
  const newIds = new Set(Object.keys(next.worksheets));

  for (const ws of Object.values(next.worksheets)) {
    await upsertWorksheetForBook(ws, bookId, user.id);
  }

  const toRemove = [...existingIds].filter((oid) => !newIds.has(oid));
  for (const oid of toRemove) {
    await supabase.from('teacher_worksheets').delete().eq('id', oid).eq('teacher_id', user.id);
    deleteWorksheet(oid);
  }

  const pageLimit = Math.max(1, Math.min(500, next.settings.pageLimit ?? DEFAULT_PAGE_LIMIT));

  await supabase
    .from('teacher_books')
    .update({
      title: next.title,
      total_pages: pageLimit,
    })
    .eq('id', bookId)
    .eq('teacher_id', user.id);

  return next;
}
