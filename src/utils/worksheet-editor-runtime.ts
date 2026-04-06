import { Worksheet, createEmptyWorksheet } from '../types/worksheet';
import { stripBase64FromObject } from './supabase/upload-image';
import { migrateWorksheetTextContent } from './worksheet-text';
import {
  getWorksheet,
  loadWorksheetFromSupabase,
  saveWorksheet,
  tryCacheWorksheetInBrowserStorage,
} from './worksheet-storage';

/** Jednorázový náhled / draft — `loadWorksheetForEditor` načte před localStorage/Supabase. */
const EDITOR_SESSION_STASH_PREFIX = 'vb-editor-stash:';

export function stashWorksheetForEditorSession(id: string, worksheet: Worksheet): void {
  const safe = stripBase64FromObject(worksheet) as Worksheet;
  const payload = { ...safe, id };
  const key = `${EDITOR_SESSION_STASH_PREFIX}${id}`;
  const json = JSON.stringify(payload);
  sessionStorage.setItem(key, json);
  /** Nová karta (`window.open`) nemá přístup k sessionStorage rodiče — stejný klíč v localStorage. */
  try {
    localStorage.setItem(key, json);
  } catch {
    // kvóta / privátní režim
  }
}

/**
 * URL do **Pro editoru** (`/admin/worksheet-pro/`) s obsahem z paměti (sessionStorage + localStorage).
 * localStorage je potřeba při `window.open` — nová karta nesdílí sessionStorage s rodičem.
 */
export function buildStashedWorksheetEditorUrl(
  worksheet: Worksheet,
  options: { pageIndex: number; pageFormat: string; bookId: string; workbookId: string },
): string {
  const previewId = `preview-ds-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  stashWorksheetForEditorSession(previewId, worksheet);
  const params = new URLSearchParams({
    offline: '1',
    page: String(Math.max(1, options.pageIndex + 1)),
    pageFormat: options.pageFormat,
    workbookId: options.workbookId,
    bookId: options.bookId,
  });
  return `/admin/worksheet-pro/${previewId}?${params.toString()}`;
}

export type WorksheetLoadSource = 'local' | 'remote' | 'new';

export interface LoadedWorksheetResult {
  worksheet: Worksheet;
  source: WorksheetLoadSource;
}

function worksheetUpdatedAtMs(ws: Worksheet): number {
  const t = ws.updatedAt;
  if (!t) return 0;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Po selhání zápisu do localStorage může být v cache starší verze než v Supabase.
 * Vždy stáhneme remote a vybereme novější podle updatedAt.
 */
export async function loadWorksheetForEditor(id: string): Promise<LoadedWorksheetResult> {
  const key = `${EDITOR_SESSION_STASH_PREFIX}${id}`;
  try {
    const rawSession = sessionStorage.getItem(key);
    const rawLocal = rawSession ?? (() => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    })();
    if (rawLocal) {
      sessionStorage.removeItem(key);
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      const parsed = migrateWorksheetTextContent(JSON.parse(rawLocal)) as Worksheet;
      return { worksheet: { ...parsed, id }, source: 'local' };
    }
  } catch (e) {
    console.warn('[loadWorksheetForEditor] stash parse failed', e);
  }

  const localWorksheet = getWorksheet(id);
  const remoteWorksheet = await loadWorksheetFromSupabase(id, { skipCache: true });

  let chosen: Worksheet | null = null;
  let source: WorksheetLoadSource = 'new';

  if (localWorksheet && remoteWorksheet) {
    if (worksheetUpdatedAtMs(remoteWorksheet) >= worksheetUpdatedAtMs(localWorksheet)) {
      chosen = remoteWorksheet;
      source = 'remote';
    } else {
      chosen = localWorksheet;
      source = 'local';
    }
  } else if (remoteWorksheet) {
    chosen = remoteWorksheet;
    source = 'remote';
  } else if (localWorksheet) {
    chosen = localWorksheet;
    source = 'local';
  }

  if (chosen) {
    tryCacheWorksheetInBrowserStorage(chosen);
    return { worksheet: chosen, source };
  }

  return { worksheet: createEmptyWorksheet(id), source: 'new' };
}

export function persistWorksheetForEditor(
  worksheet: Worksheet,
  options?: { bookId?: string | null; folderId?: string | null }
): void {
  saveWorksheet(worksheet, options?.folderId, options?.bookId);
}

export function buildWorksheetEditorPath(
  id: string,
  options?: { studentMode?: boolean }
): string {
  const params = new URLSearchParams();
  if (options?.studentMode) {
    params.set('studentMode', 'true');
  }
  const query = params.toString();
  return `/library/my-content/worksheet-editor/${id}${query ? `?${query}` : ''}`;
}
