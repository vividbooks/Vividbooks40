import { fetchTeacherClassPreferences, upsertTeacherClassPreferences } from '../repositories/teacher-preferences-repository';
import { getMojeTridaFlags } from '../integration/feature-flags';
import {
  legacyReadLastTab,
  legacyReadSelectedClassId,
  legacyWriteLastTab,
  legacyWriteSelectedClassId,
} from '../compat/legacy-my-classes-storage';
import type { MyClassesTab } from '../domain/types';

export type ResolvedPreferences = {
  lastTab: MyClassesTab;
  selectedClassId: string | null;
};

const DEFAULT_TAB: MyClassesTab = 'results';

export async function loadPreferences(userId: string | null): Promise<ResolvedPreferences> {
  const flags = getMojeTridaFlags();
  const legacyTab = legacyReadLastTab();
  const legacyClassId = legacyReadSelectedClassId();

  if (!userId) {
    return {
      lastTab: legacyTab ?? DEFAULT_TAB,
      selectedClassId: legacyClassId,
    };
  }

  let remote: Awaited<ReturnType<typeof fetchTeacherClassPreferences>> = null;
  try {
    remote = await fetchTeacherClassPreferences(userId);
  } catch {
    remote = null;
  }

  if (flags.repoOnly) {
    if (!remote) {
      return { lastTab: DEFAULT_TAB, selectedClassId: null };
    }
    return {
      lastTab: ((remote.last_tab as MyClassesTab) || DEFAULT_TAB) ?? DEFAULT_TAB,
      selectedClassId: remote.selected_class_id,
    };
  }

  if (remote) {
    return {
      lastTab: ((remote.last_tab as MyClassesTab) ?? legacyTab) || DEFAULT_TAB,
      selectedClassId: remote.selected_class_id ?? legacyClassId,
    };
  }

  if (flags.legacyFallback) {
    return {
      lastTab: legacyTab ?? DEFAULT_TAB,
      selectedClassId: legacyClassId,
    };
  }

  return { lastTab: DEFAULT_TAB, selectedClassId: null };
}

/**
 * Uloží kompletní stav (hook vždy předá obě pole).
 */
export async function persistPreferences(
  userId: string | null,
  full: { lastTab: MyClassesTab; selectedClassId: string | null },
): Promise<void> {
  const flags = getMojeTridaFlags();

  if (flags.dualWrite) {
    legacyWriteLastTab(full.lastTab);
    legacyWriteSelectedClassId(full.selectedClassId);
  }

  if (!userId) return;

  let dismissedSessions: Record<string, boolean> = {};
  try {
    const existing = await fetchTeacherClassPreferences(userId);
    dismissedSessions = existing?.quiz_setup_dismissed_sessions ?? {};
  } catch {
    dismissedSessions = {};
  }

  const ok = await upsertTeacherClassPreferences({
    user_id: userId,
    last_tab: full.lastTab,
    selected_class_id: full.selectedClassId,
    quiz_setup_dismissed_sessions: dismissedSessions,
  });

  if (!ok && !flags.dualWrite) {
    legacyWriteLastTab(full.lastTab);
    legacyWriteSelectedClassId(full.selectedClassId);
  }
}
