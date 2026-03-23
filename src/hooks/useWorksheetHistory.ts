import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Worksheet } from '../types/worksheet';

interface UseWorksheetHistoryOptions {
  worksheet: Worksheet | null;
  setWorksheet: Dispatch<SetStateAction<Worksheet | null>>;
  maxHistory?: number;
}

function cloneWorksheet(worksheet: Worksheet): Worksheet {
  return JSON.parse(JSON.stringify(worksheet)) as Worksheet;
}

export function useWorksheetHistory({
  worksheet,
  setWorksheet,
  maxHistory = 100,
}: UseWorksheetHistoryOptions) {
  const historyStackRef = useRef<Worksheet[]>([]);
  const historyIdxRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const refreshUndoRedoButtons = useCallback(() => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyStackRef.current.length - 1);
  }, []);

  useEffect(() => {
    if (!worksheet) return;

    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      refreshUndoRedoButtons();
      return;
    }

    historyStackRef.current = historyStackRef.current.slice(0, historyIdxRef.current + 1);
    historyStackRef.current.push(cloneWorksheet(worksheet));
    if (historyStackRef.current.length > maxHistory) {
      historyStackRef.current.shift();
    }
    historyIdxRef.current = historyStackRef.current.length - 1;
    refreshUndoRedoButtons();
  }, [maxHistory, refreshUndoRedoButtons, worksheet]);

  const handleUndo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    isUndoRedoRef.current = true;
    historyIdxRef.current--;
    setWorksheet(cloneWorksheet(historyStackRef.current[historyIdxRef.current]));
  }, [setWorksheet]);

  const handleRedo = useCallback(() => {
    if (historyIdxRef.current >= historyStackRef.current.length - 1) return;
    isUndoRedoRef.current = true;
    historyIdxRef.current++;
    setWorksheet(cloneWorksheet(historyStackRef.current[historyIdxRef.current]));
  }, [setWorksheet]);

  return {
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
  };
}
