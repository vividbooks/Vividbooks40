/**
 * Moje třída — feature modul (repository vrstva, služby, kompatibilita s legacy localStorage).
 */

export { getMojeTridaFlags } from './integration/feature-flags';
export type { MojeTridaFeatureFlags } from './integration/feature-flags';

export type { MyClassesTab, ClassSummary } from './domain/types';

export { classRepository } from './repositories/class-repository';
export { fetchTeacherClassPreferences, upsertTeacherClassPreferences } from './repositories/teacher-preferences-repository';
export {
  getClassRuntimeValue,
  upsertClassRuntimeValue,
} from './repositories/class-runtime-repository';
export { listStudentContentForStudent } from './repositories/student-content-repository';

export { loadPreferences, persistPreferences } from './services/preferences-service';
export { isQuizSetupDismissed, persistQuizSetupDismissal } from './services/quiz-setup-dismissal-service';
export type { ResolvedPreferences } from './services/preferences-service';
export { loadClassesOverview, refreshClassesCache } from './services/classes-overview-service';

export {
  LEGACY_KEYS,
  legacyReadLastTab,
  legacyWriteLastTab,
  legacyReadSelectedClassId,
  legacyWriteSelectedClassId,
  legacyReadClassesCache,
  legacyWriteClassesCache,
} from './compat/legacy-my-classes-storage';

export { useMyClassesPreferences } from './state/useMyClassesPreferences';
export { useMyClassesClassesOverview } from './state/useMyClassesClassesOverview';

export {
  runMigrateClassLocalStorageToSupabase,
  type MigrateClassLocalStorageResult,
} from '../../utils/migration/migrate-class-localstorage-to-supabase';
