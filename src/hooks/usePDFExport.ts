/**
 * usePDFExport - Hook pro export pracovního listu do PDF
 * 
 * Používá nativní window.print() - text zůstává vybíratelný/prohledávatelný
 */

import { useRef, useCallback, useState } from 'react';
import { Worksheet } from '../types/worksheet';

interface UsePDFExportReturn {
  printRef: React.RefObject<HTMLDivElement>;
  handleExport: (worksheet: Worksheet) => Promise<void>;
  isExporting: boolean;
  error: string | null;
  clearError: () => void;
}

export function usePDFExport(): UsePDFExportReturn {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async (_worksheet: Worksheet) => {
    console.log('[PDF Export] Starting native print...');
    
    setIsExporting(true);
    setError(null);

    try {
      // Wait for next frame
      await Promise.resolve();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      
      // Wait for fonts to be ready
      if ((document as any).fonts?.ready) {
        try {
          await (document as any).fonts.ready;
        } catch {
          // Ignore font loading errors
        }
      }
      
      // Use native print - keeps text selectable/searchable
      window.print();
      
      console.log('[PDF Export] Print dialog opened');
      
    } catch (err) {
      console.error('[PDF Export] Error:', err);
      setError(err instanceof Error ? err.message : 'Export se nezdařil');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { 
    printRef, 
    handleExport, 
    isExporting, 
    error, 
    clearError 
  };
}
