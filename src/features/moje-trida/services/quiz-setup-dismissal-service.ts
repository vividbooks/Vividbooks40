import { supabase } from '../../../utils/supabase/client';
import { isUsingSupabase } from '../../../utils/supabase/classes';
import { fetchTeacherClassPreferences, upsertTeacherClassPreferences } from '../repositories/teacher-preferences-repository';
import { getMojeTridaFlags } from '../integration/feature-flags';
import type { MyClassesTab } from '../domain/types';

/** Zda má být skrytý first-time dialog synchronizace výsledků do třídy (po zavření uživatelem). */
export async function isQuizSetupDismissed(sessionId: string): Promise<boolean> {
  const flags = getMojeTridaFlags();
  if (!flags.repoOnly && flags.legacyFallback) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(`quiz_setup_dismissed_${sessionId}`)) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  if (!isUsingSupabase()) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const prefs = await fetchTeacherClassPreferences(user.id);
  return !!(prefs?.quiz_setup_dismissed_sessions?.[sessionId]);
}

/** Uloží zavření dialogu (Supabase + případně localStorage podle flagů). */
export async function persistQuizSetupDismissal(sessionId: string): Promise<void> {
  const flags = getMojeTridaFlags();
  if (flags.dualWrite || !flags.repoOnly) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`quiz_setup_dismissed_${sessionId}`, 'true');
      }
    } catch {
      /* ignore */
    }
  }
  if (!isUsingSupabase()) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const current = await fetchTeacherClassPreferences(user.id);
  const map = { ...(current?.quiz_setup_dismissed_sessions || {}), [sessionId]: true };
  await upsertTeacherClassPreferences({
    user_id: user.id,
    last_tab: (current?.last_tab as MyClassesTab | null) ?? null,
    selected_class_id: current?.selected_class_id ?? null,
    quiz_setup_dismissed_sessions: map,
  });
}
