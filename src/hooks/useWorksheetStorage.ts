/**
 * useWorksheetStorage - Hook pro autosave a načítání pracovních listů
 */

import { useEffect, useCallback, useRef } from 'react';
import { Worksheet } from '../types/worksheet';
import { saveWorksheet, getWorksheet } from '../utils/worksheet-storage';

interface UseWorksheetStorageOptions {
  worksheetId: string;
  onLoad: (worksheet: Worksheet) => void;
  autosaveDelay?: number; // ms, default 2000
}

interface UseWorksheetStorageReturn {
  scheduleSave: (worksheet: Worksheet) => void;
  saveNow: (worksheet: Worksheet) => void;
  isLoaded: boolean;
}

export function useWorksheetStorage({
  worksheetId,
  onLoad,
  autosaveDelay = 2000
}: UseWorksheetStorageOptions): UseWorksheetStorageReturn {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');
  const isLoadedRef = useRef(false);

  // Načíst při mountu
  useEffect(() => {
    if (!worksheetId) return;
    
    const saved = getWorksheet(worksheetId);
    if (saved) {
      onLoad(saved);
      lastSavedRef.current = JSON.stringify(saved);
      isLoadedRef.current = true;
    }
  }, [worksheetId, onLoad]);

  // Autosave s debounce
  const scheduleSave = useCallback((worksheet: Worksheet) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const currentData = JSON.stringify(worksheet);
      
      // Uložit jen pokud se něco změnilo
      if (currentData !== lastSavedRef.current) {
        saveWorksheet({
          ...worksheet,
          updatedAt: new Date().toISOString()
        });
        lastSavedRef.current = currentData;
        console.log('Worksheet autosaved:', worksheet.id);
      }
    }, autosaveDelay);
  }, [autosaveDelay]);

  // Okamžité uložení
  const saveNow = useCallback((worksheet: Worksheet) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    const updatedWorksheet = {
      ...worksheet,
      updatedAt: new Date().toISOString()
    };
    
    saveWorksheet(updatedWorksheet);
    lastSavedRef.current = JSON.stringify(updatedWorksheet);
    console.log('Worksheet saved immediately:', worksheet.id);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return { 
    scheduleSave, 
    saveNow, 
    isLoaded: isLoadedRef.current 
  };
}



