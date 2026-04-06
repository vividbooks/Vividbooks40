import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadClassesOverview, refreshClassesCache } from '../services/classes-overview-service';
import type { ClassSummary } from '../domain/types';
import { legacyReadClassesCache } from '../compat/legacy-my-classes-storage';

export function useMyClassesClassesOverview(
  useSupabaseData: boolean,
  demoWhenLocal: ClassSummary[],
) {
  const demoStable = useMemo(() => demoWhenLocal, [demoWhenLocal]);

  const [classes, setClassesState] = useState<ClassSummary[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classesLoaded, setClassesLoaded] = useState(false);

  const runLoad = useCallback(
    async (forceNetwork?: boolean) => {
      if (!useSupabaseData) {
        setClassesState(demoStable);
        setLoadingClasses(false);
        setClassesLoaded(true);
        return;
      }
      setLoadingClasses(true);
      try {
        const { classes: list, fromCache } = await loadClassesOverview({
          useSupabaseData: true,
          forceNetwork,
        });
        setClassesState(list);
        setClassesLoaded(true);

        if (fromCache && list.length > 0) {
          const meta = legacyReadClassesCache();
          if (meta && meta.ageMs > 30_000) {
            void (async () => {
              const fresh = await loadClassesOverview({ useSupabaseData: true, forceNetwork: true });
              setClassesState(fresh.classes);
            })();
          }
        }
      } finally {
        setLoadingClasses(false);
      }
    },
    [useSupabaseData, demoStable],
  );

  useEffect(() => {
    void runLoad(false);
  }, [runLoad]);

  useEffect(() => {
    if (!useSupabaseData || !classesLoaded) return;
    if (classes.length > 0) return;
    const t = setTimeout(() => void runLoad(false), 1000);
    return () => clearTimeout(t);
  }, [useSupabaseData, classesLoaded, classes.length, runLoad]);

  const refreshClassesInBackground = useCallback(async () => {
    try {
      const fresh = await loadClassesOverview({ useSupabaseData: true, forceNetwork: true });
      setClassesState(fresh.classes);
    } catch {
      /* ignore */
    }
  }, []);

  const setClasses = useCallback((next: ClassSummary[] | ((prev: ClassSummary[]) => ClassSummary[])) => {
    setClassesState((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: ClassSummary[]) => ClassSummary[])(prev) : next;
      refreshClassesCache(resolved);
      return resolved;
    });
  }, []);

  return {
    classes,
    setClasses,
    loadingClasses,
    classesLoaded,
    refreshClassesInBackground,
    reload: runLoad,
  };
}
