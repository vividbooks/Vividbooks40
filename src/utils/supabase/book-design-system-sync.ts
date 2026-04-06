import type { DesignSystem } from '../../types/design-system';
import type { Worksheet } from '../../types/worksheet';
import { applyDesignSystemSnapshotToWorksheet } from '../design-system-sync';
import { supabase } from './client';
import { stripBase64FromObject } from './upload-image';

type WorksheetRow = {
  id: string;
  name: string | null;
  content: unknown;
};

function rowToWorksheet(row: WorksheetRow): Worksheet | null {
  if (!row.content || typeof row.content !== 'object') return null;
  return row.content as Worksheet;
}

export async function syncDesignSystemToBookWorksheets(
  bookId: string,
  ds: DesignSystem,
): Promise<{ syncedCount: number }> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error('User not authenticated');

  const [byBookRes, byFolderRes] = await Promise.all([
    supabase
      .from('teacher_worksheets')
      .select('id, name, content')
      .eq('teacher_id', user.id)
      .eq('book_id', bookId),
    supabase
      .from('teacher_worksheets')
      .select('id, name, content')
      .eq('teacher_id', user.id)
      .eq('folder_id', bookId),
  ]);

  if (byBookRes.error) throw byBookRes.error;
  if (byFolderRes.error) throw byFolderRes.error;

  const deduped = new Map<string, WorksheetRow>();
  for (const row of ([...(byBookRes.data ?? []), ...(byFolderRes.data ?? [])] as WorksheetRow[])) {
    if (!deduped.has(row.id)) deduped.set(row.id, row);
  }

  const rows = [...deduped.values()];
  if (rows.length === 0) return { syncedCount: 0 };

  const timestamp = new Date().toISOString();
  await Promise.all(rows.map(async (row) => {
    const worksheet = rowToWorksheet(row);
    if (!worksheet) return;

    const synced = applyDesignSystemSnapshotToWorksheet(
      {
        ...worksheet,
        updatedAt: timestamp,
      },
      ds,
      { forceTypography: true, respectCustomSources: true },
    );
    const safeWorksheet = stripBase64FromObject(synced) as Worksheet;

    const { error } = await supabase
      .from('teacher_worksheets')
      .update({
        name: safeWorksheet.title || row.name || 'Nová kapitola',
        content: safeWorksheet,
        source_dataset_id: safeWorksheet.metadata?.sourceDatasetId ?? null,
        updated_at: timestamp,
      })
      .eq('id', row.id)
      .eq('teacher_id', user.id);

    if (error) throw error;
  }));

  return { syncedCount: rows.length };
}
