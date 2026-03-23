import { useCallback, useEffect, useRef, useState } from 'react';
import type { Worksheet } from '../types/worksheet';
import type { SaveStatus } from '../types/worksheet-editor';
import {
  loadWorksheetForEditor,
  persistWorksheetForEditor,
  type LoadedWorksheetResult,
} from '../utils/worksheet-editor-runtime';

interface UseWorksheetEditorRuntimeOptions {
  id?: string;
  autosaveDelayMs?: number;
  hasPendingChanges?: (worksheet: Worksheet | null, isDirty: boolean) => boolean;
  normalizeUpdatedWorksheet?: (worksheet: Worksheet) => Worksheet;
  prepareWorksheetForSave?: (worksheet: Worksheet) => Worksheet;
  persistWorksheet?: (worksheet: Worksheet) => void;
  onLoaded?: (result: LoadedWorksheetResult) => void;
}

export function useWorksheetEditorRuntime({
  id,
  autosaveDelayMs = 2000,
  hasPendingChanges = (_worksheet, isDirty) => isDirty,
  normalizeUpdatedWorksheet,
  prepareWorksheetForSave,
  persistWorksheet = persistWorksheetForEditor,
  onLoaded,
}: UseWorksheetEditorRuntimeOptions) {
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const worksheetRef = useRef<Worksheet | null>(null);
  const isDirtyRef = useRef(false);
  const hasPendingChangesRef = useRef(hasPendingChanges);
  const normalizeUpdatedWorksheetRef = useRef(normalizeUpdatedWorksheet);
  const prepareWorksheetForSaveRef = useRef(prepareWorksheetForSave);
  const persistWorksheetRef = useRef(persistWorksheet);
  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    worksheetRef.current = worksheet;
  }, [worksheet]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    hasPendingChangesRef.current = hasPendingChanges;
    normalizeUpdatedWorksheetRef.current = normalizeUpdatedWorksheet;
    prepareWorksheetForSaveRef.current = prepareWorksheetForSave;
    persistWorksheetRef.current = persistWorksheet;
    onLoadedRef.current = onLoaded;
  }, [hasPendingChanges, normalizeUpdatedWorksheet, prepareWorksheetForSave, persistWorksheet, onLoaded]);

  useEffect(() => {
    if (!id) return;

    let isCancelled = false;
    setSaveStatus('saving');

    loadWorksheetForEditor(id).then((result) => {
      if (isCancelled) return;
      setWorksheet(result.worksheet);
      setSaveStatus('saved');
      onLoadedRef.current?.(result);
    });

    return () => {
      isCancelled = true;
    };
  }, [id]);

  const updateWorksheet = useCallback((
    updates: Partial<Worksheet> | ((prev: Worksheet) => Worksheet)
  ) => {
    setWorksheet((prev) => {
      if (!prev) return prev;
      const updated = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
      const normalized = normalizeUpdatedWorksheetRef.current ? normalizeUpdatedWorksheetRef.current(updated) : updated;
      return {
        ...normalized,
        updatedAt: new Date().toISOString(),
      };
    });
    setIsDirty(true);
  }, []);

  const performSave = useCallback(() => {
    if (!worksheet) return;

    setSaveStatus('saving');

    const baseWorksheet = prepareWorksheetForSaveRef.current
      ? prepareWorksheetForSaveRef.current(worksheet)
      : {
          ...worksheet,
          updatedAt: new Date().toISOString(),
        };

    persistWorksheetRef.current(baseWorksheet);

    setTimeout(() => {
      setSaveStatus('saved');
      setIsDirty(false);
    }, 500);
  }, [worksheet]);

  const saveIfPendingChanges = useCallback((): Worksheet | null => {
    const currentWorksheet = worksheetRef.current;
    const hasChanges = hasPendingChangesRef.current(currentWorksheet, isDirtyRef.current);

    if (!currentWorksheet) return null;
    if (!hasChanges) return currentWorksheet;

    const preparedWorksheet = prepareWorksheetForSaveRef.current
      ? prepareWorksheetForSaveRef.current(currentWorksheet)
      : {
          ...currentWorksheet,
          updatedAt: new Date().toISOString(),
        };

    persistWorksheetRef.current(preparedWorksheet);
    worksheetRef.current = preparedWorksheet;
    setWorksheet(preparedWorksheet);
    setSaveStatus('saved');
    setIsDirty(false);

    return preparedWorksheet;
  }, []);

  const handleManualSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    performSave();
  }, [performSave]);

  useEffect(() => {
    if (!worksheet || !hasPendingChangesRef.current(worksheet, isDirty)) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setSaveStatus('unsaved');

    autoSaveTimerRef.current = setTimeout(() => {
      performSave();
    }, autosaveDelayMs);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autosaveDelayMs, isDirty, performSave, worksheet]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasPendingChangesRef.current(worksheetRef.current, isDirtyRef.current)) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    return () => {
      if (!hasPendingChangesRef.current(worksheetRef.current, isDirtyRef.current)) return;
      if (!worksheetRef.current) return;
      persistWorksheetRef.current(worksheetRef.current);
    };
  }, []);

  return {
    worksheet,
    setWorksheet,
    isDirty,
    setIsDirty,
    saveStatus,
    setSaveStatus,
    updateWorksheet,
    performSave,
    handleManualSave,
    saveIfPendingChanges,
  };
}
