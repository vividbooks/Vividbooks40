import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../utils/supabase/client';
import { loadPreferences, persistPreferences } from '../services/preferences-service';
import type { MyClassesTab } from '../domain/types';

export function useMyClassesPreferences() {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTabState] = useState<MyClassesTab>('results');
  const [selectedClassId, setSelectedClassIdState] = useState<string | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const prefs = await loadPreferences(userId);
      if (cancelled) return;
      setActiveTabState(prefs.lastTab);
      setSelectedClassIdState(prefs.selectedClassId);
      setPreferencesLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setActiveTab = useCallback(
    (tab: MyClassesTab) => {
      setActiveTabState(tab);
      void persistPreferences(userId, { lastTab: tab, selectedClassId });
    },
    [userId, selectedClassId],
  );

  const setSelectedClassId = useCallback(
    (id: string | null) => {
      setSelectedClassIdState(id);
      void persistPreferences(userId, { lastTab: activeTab, selectedClassId: id });
    },
    [userId, activeTab],
  );

  return {
    userId,
    activeTab,
    setActiveTab,
    selectedClassId,
    setSelectedClassId,
    preferencesLoaded,
  };
}
