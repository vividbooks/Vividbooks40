/**
 * usePDFExport – Hook pro export pracovního listu do PDF
 *
 * Strategie (v pořadí):
 *  1. Volá Supabase Edge Function `pdf-export` → Browserless.io → stáhne .pdf
 *  2. Pokud edge function selže (chybí API klíč / CORS / offline), otevře
 *     /print/:id v nové záložce, kde uživatel použije Ctrl+P / Save as PDF.
 */

import { useRef, useCallback, useState } from 'react';
import { Worksheet } from '../types/worksheet';
import { exportWorksheetPDF } from '../utils/pdf-export';
import { toast } from 'sonner';

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

  const handleExport = useCallback(async (worksheet: Worksheet) => {
    if (!worksheet?.id) return;
    setIsExporting(true);
    setError(null);

    const filename = `${(worksheet.metadata?.title || 'pracovni-list')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')}.pdf`;

    const toastId = toast.loading('Generuji PDF…');

    try {
      // Attempt 1: Browserless edge function → download .pdf
      // Pass full worksheet JSON so the edge function can upsert it to Supabase
      // before Browserless loads the print page. This is critical for offline users
      // whose worksheets only exist in localStorage (Browserless can't access it).
      await exportWorksheetPDF({
        worksheetId: worksheet.id,
        worksheetData: worksheet as unknown as Record<string, unknown>,
        filename,
      });
      toast.success('PDF staženo!', { id: toastId });
    } catch (err) {
      console.warn('[PDF Export] Edge function selhal, otevírám náhled:', err);
      toast.dismiss(toastId);

      // Attempt 2: open /print page in new tab (user can Ctrl+P → Save as PDF)
      try {
        exportWorksheetPDF({ worksheetId: worksheet.id, filename, preview: true });
        toast.info(
          'PDF se nepodařilo vygenerovat automaticky. Otevřena tiskárna – použijte Ctrl+P → Uložit jako PDF.',
          { duration: 8000 }
        );
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : 'Export se nezdařil';
        setError(msg);
        toast.error(msg, { id: toastId });
      }
    } finally {
      setIsExporting(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { printRef, handleExport, isExporting, error, clearError };
}
