import { Worksheet, createEmptyWorksheet } from '../types/worksheet';
import { getWorksheet, loadWorksheetFromSupabase, saveWorksheet } from './worksheet-storage';

export type WorksheetLoadSource = 'local' | 'remote' | 'new';

export interface LoadedWorksheetResult {
  worksheet: Worksheet;
  source: WorksheetLoadSource;
}

export async function loadWorksheetForEditor(id: string): Promise<LoadedWorksheetResult> {
  const localWorksheet = getWorksheet(id);
  if (localWorksheet) {
    return { worksheet: localWorksheet, source: 'local' };
  }

  const remoteWorksheet = await loadWorksheetFromSupabase(id);
  if (remoteWorksheet) {
    return { worksheet: remoteWorksheet, source: 'remote' };
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
