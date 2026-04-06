/**
 * class_runtime_state — klíč/hodnota JSON pro náhradu legacy localStorage u třídy.
 */

import { supabase } from '../../../utils/supabase/client';

export async function getClassRuntimeValue(
  classId: string,
  key: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('class_runtime_state')
    .select('value')
    .eq('class_id', classId)
    .eq('key', key)
    .maybeSingle();

  if (error || !data?.value) return null;
  return data.value as Record<string, unknown>;
}

export async function upsertClassRuntimeValue(
  classId: string,
  key: string,
  value: Record<string, unknown>,
  updatedBy?: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('class_runtime_state').upsert(
    {
      class_id: classId,
      key,
      value,
      updated_by: updatedBy ?? null,
      updated_at: now,
    },
    { onConflict: 'class_id,key' },
  );

  if (error) {
    console.warn('[moje-trida] upsertClassRuntimeValue', error.message);
    return false;
  }
  return true;
}
