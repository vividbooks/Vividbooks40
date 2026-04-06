/**
 * Supabase: teacher_class_preferences (user_id = auth.users).
 */

import { supabase } from '../../../utils/supabase/client';
import type { MyClassesTab } from '../domain/types';

export type TeacherPreferencesUpsert = {
  user_id: string;
  last_tab?: MyClassesTab | null;
  selected_class_id?: string | null;
  /** Mapa live session id -> true po zavření first-time dialogu u výsledků kvízu */
  quiz_setup_dismissed_sessions?: Record<string, boolean> | null;
};

export async function fetchTeacherClassPreferences(userId: string) {
  const { data, error } = await supabase
    .from('teacher_class_preferences')
    .select('user_id, last_tab, selected_class_id, quiz_setup_dismissed_sessions, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[moje-trida] fetchTeacherClassPreferences', error.message);
    return null;
  }
  return data as {
    user_id: string;
    last_tab: string | null;
    selected_class_id: string | null;
    quiz_setup_dismissed_sessions: Record<string, boolean> | null;
    updated_at: string;
  } | null;
}

export async function upsertTeacherClassPreferences(payload: TeacherPreferencesUpsert): Promise<boolean> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    user_id: payload.user_id,
    last_tab: payload.last_tab ?? null,
    selected_class_id: payload.selected_class_id ?? null,
    updated_at: now,
  };
  if (payload.quiz_setup_dismissed_sessions !== undefined) {
    row.quiz_setup_dismissed_sessions = payload.quiz_setup_dismissed_sessions;
  }
  const { error } = await supabase.from('teacher_class_preferences').upsert(row, { onConflict: 'user_id' });

  if (error) {
    console.error('[moje-trida] upsertTeacherClassPreferences', error.message);
    return false;
  }
  return true;
}
