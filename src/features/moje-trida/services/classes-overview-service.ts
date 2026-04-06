import { classRepository } from '../repositories/class-repository';
import { getMojeTridaFlags } from '../integration/feature-flags';
import {
  legacyReadClassesCache,
  legacyWriteClassesCache,
} from '../compat/legacy-my-classes-storage';
import type { ClassSummary } from '../domain/types';

export async function loadClassesOverview(options: {
  useSupabaseData: boolean;
  teacherId?: string;
  /** Přeskočit legacy cache (pozadí po čerstvém hitu). */
  forceNetwork?: boolean;
}): Promise<{ classes: ClassSummary[]; fromCache: boolean }> {
  const { useSupabaseData, teacherId, forceNetwork } = options;
  const flags = getMojeTridaFlags();

  if (!useSupabaseData) {
    return { classes: [], fromCache: false };
  }

  if (!forceNetwork && !flags.repoOnly) {
    const cached = legacyReadClassesCache();
    if (cached) {
      return { classes: cached.classes as ClassSummary[], fromCache: true };
    }
  }

  const classes = await classRepository.list(teacherId);
  if (flags.dualWrite || !flags.repoOnly) {
    legacyWriteClassesCache(classes);
  }
  return { classes, fromCache: false };
}

export function refreshClassesCache(classes: ClassSummary[]): void {
  legacyWriteClassesCache(classes);
}
