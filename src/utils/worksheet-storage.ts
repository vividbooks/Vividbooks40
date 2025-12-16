/**
 * Worksheet Storage - Utility funkce pro ukládání pracovních listů do localStorage
 */

import { Worksheet } from '../types/worksheet';

const WORKSHEETS_KEY = 'vividbooks_worksheets';
const WORKSHEET_PREFIX = 'vividbooks_worksheet_';

/**
 * Typ pro seznam pracovních listů (metadata)
 */
export interface WorksheetListItem {
  id: string;
  title: string;
  subject: string;
  grade: number;
  createdAt: string;
  updatedAt: string;
  blocksCount: number;
  folderId?: string | null; // ID složky, ve které je pracovní list uložen (null = root)
}

/**
 * Získat seznam všech pracovních listů (metadata)
 */
export function getWorksheetList(): WorksheetListItem[] {
  try {
    const list = localStorage.getItem(WORKSHEETS_KEY);
    return list ? JSON.parse(list) : [];
  } catch (error) {
    console.error('Error loading worksheet list:', error);
    return [];
  }
}

/**
 * Uložit/aktualizovat pracovní list
 */
export function saveWorksheet(worksheet: Worksheet): void {
  try {
    // Uložit samotný worksheet
    localStorage.setItem(
      `${WORKSHEET_PREFIX}${worksheet.id}`, 
      JSON.stringify(worksheet)
    );
    
    // Aktualizovat seznam
    const list = getWorksheetList();
    const existingIndex = list.findIndex(item => item.id === worksheet.id);
    
    const listItem: WorksheetListItem = {
      id: worksheet.id,
      title: worksheet.title || 'Bez názvu',
      subject: worksheet.metadata?.subject || 'other',
      grade: worksheet.metadata?.grade || 6,
      updatedAt: new Date().toISOString(),
      createdAt: existingIndex >= 0 ? list[existingIndex].createdAt : new Date().toISOString(),
      blocksCount: worksheet.blocks?.length || 0,
      // Preserve folderId from existing item
      folderId: existingIndex >= 0 ? list[existingIndex].folderId : undefined,
    };
    
    if (existingIndex >= 0) {
      list[existingIndex] = listItem;
    } else {
      list.unshift(listItem); // Nové na začátek
    }
    
    localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(list));
  } catch (error) {
    console.error('Error saving worksheet:', error);
  }
}

/**
 * Načíst pracovní list podle ID
 */
export function getWorksheet(id: string): Worksheet | null {
  try {
    const data = localStorage.getItem(`${WORKSHEET_PREFIX}${id}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading worksheet:', error);
    return null;
  }
}

/**
 * Smazat pracovní list
 */
export function deleteWorksheet(id: string): void {
  try {
    localStorage.removeItem(`${WORKSHEET_PREFIX}${id}`);
    
    const list = getWorksheetList().filter(item => item.id !== id);
    localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(list));
  } catch (error) {
    console.error('Error deleting worksheet:', error);
  }
}

/**
 * Duplikovat pracovní list
 */
export function duplicateWorksheet(id: string): Worksheet | null {
  try {
    const original = getWorksheet(id);
    if (!original) return null;
    
    const duplicate: Worksheet = {
      ...original,
      id: crypto.randomUUID(),
      title: `${original.title || 'Bez názvu'} (kopie)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    saveWorksheet(duplicate);
    return duplicate;
  } catch (error) {
    console.error('Error duplicating worksheet:', error);
    return null;
  }
}

/**
 * Zkontrolovat, zda worksheet existuje
 */
export function worksheetExists(id: string): boolean {
  return localStorage.getItem(`${WORKSHEET_PREFIX}${id}`) !== null;
}

/**
 * Přesunout pracovní list do složky
 */
export function moveWorksheetToFolder(worksheetId: string, folderId: string | null): void {
  try {
    const list = getWorksheetList();
    const index = list.findIndex(item => item.id === worksheetId);
    
    if (index >= 0) {
      list[index].folderId = folderId;
      localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(list));
    }
  } catch (error) {
    console.error('Error moving worksheet to folder:', error);
  }
}

/**
 * Získat pracovní listy v konkrétní složce
 */
export function getWorksheetsInFolder(folderId: string | null): WorksheetListItem[] {
  const list = getWorksheetList();
  return list.filter(item => (item.folderId || null) === folderId);
}

/**
 * Získat pracovní listy v root (bez složky)
 */
export function getRootWorksheets(): WorksheetListItem[] {
  return getWorksheetsInFolder(null);
}


