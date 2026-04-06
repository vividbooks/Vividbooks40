import { supabase } from './client';
import type { DatasetFile } from '../../types/design-system';
import { stripBase64FromObject } from './upload-image';

/**
 * Sdílená knihovna referenčních obrázků učitele (napříč design systémy).
 * Řádek vznikne při prvním uložení (upsert).
 */
export async function getTeacherIllustrationReferenceLibrary(): Promise<DatasetFile[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('teacher_illustration_reference_library')
    .select('files')
    .eq('teacher_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[teacher-illustration-ref-library] get error:', error);
    return [];
  }
  const raw = data?.files;
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is DatasetFile => f != null && typeof f === 'object' && (f as DatasetFile).kind === 'image');
}

export async function saveTeacherIllustrationReferenceLibrary(files: DatasetFile[]): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const safe = stripBase64FromObject(files) as DatasetFile[];

  const { error } = await supabase.from('teacher_illustration_reference_library').upsert(
    {
      teacher_id: user.id,
      files: safe,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'teacher_id' },
  );

  if (error) {
    console.error('[teacher-illustration-ref-library] save error:', error);
    return false;
  }
  return true;
}
