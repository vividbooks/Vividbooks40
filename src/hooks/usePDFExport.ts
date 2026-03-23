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
import { saveWorksheet } from '../utils/worksheet-storage';
import { toast } from 'sonner';

interface UsePDFExportReturn {
  printRef: React.RefObject<HTMLDivElement>;
  handleExport: (worksheet: Worksheet, opts?: { bleed?: boolean }) => Promise<void>;
  isExporting: boolean;
  error: string | null;
  clearError: () => void;
}

export function usePDFExport(): UsePDFExportReturn {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async (worksheet: Worksheet, opts?: { bleed?: boolean }) => {
    if (!worksheet?.id) return;
    const bleed = opts?.bleed ?? false;
    setIsExporting(true);
    setError(null);

    const suffix = bleed ? '-tisk' : '';
    const filename = `${(worksheet.metadata?.title || 'pracovni-list')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')}${suffix}.pdf`;

    const toastId = toast.loading(bleed ? 'Generuji tiskové PDF se spadávkami…' : 'Generuji PDF…');

    // Save worksheet to Supabase NOW (before Browserless loads the print page).
    // This ensures get-worksheet can find it even if addScriptTag injection fails.
    // saveWorksheet is a fire-and-forget with internal auth check – safe to call.
    saveWorksheet(worksheet);
    // Give the async DB write a moment to complete before Browserless starts.
    await new Promise(r => setTimeout(r, 800));

    // Strip legacy header-footer blocks — they appear twice when global header/footer is on,
    // and appear in the PDF even when the user has turned them off.
    // PageHeader/PageFooter components (driven by worksheet.metadata) handle this separately.
    const cleanWorksheet: Worksheet = {
      ...worksheet,
      blocks: (worksheet.blocks ?? []).filter(b => b.type !== 'header-footer'),
    };

    // Temporary dev-only fallback:
    // Browserless PDF export renders the deployed GitHub Pages app, not localhost.
    // Keep this in mind during deployment: once /print changes are deployed and verified,
    // direct one-click PDF export should be re-tested against the live build.
    if (import.meta.env.DEV) {
      try {
        exportWorksheetPDF({
          worksheetId: worksheet.id,
          worksheetData: cleanWorksheet as unknown as Record<string, unknown>,
          filename,
          preview: true,
          bleed,
        });
        toast.info(
          bleed
            ? 'V dev režimu otevírám lokální tiskovou stránku se spadávkou. Cloud PDF běží proti nasazenému buildu.'
            : 'V dev režimu otevírám lokální tiskovou stránku. Cloud PDF běží proti nasazenému buildu.',
          { id: toastId, duration: 9000 }
        );
        return;
      } finally {
        setIsExporting(false);
      }
    }

    try {
      await exportWorksheetPDF({
        worksheetId: worksheet.id,
        worksheetData: cleanWorksheet as unknown as Record<string, unknown>,
        filename,
        bleed,
      });
      toast.success('PDF staženo!', { id: toastId });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[PDF Export] Edge function selhala:', errMsg);
      toast.dismiss(toastId);

      // Fallback: open /print page in new tab (user uses Ctrl+P → Save as PDF)
      try {
        exportWorksheetPDF({ worksheetId: worksheet.id, filename, preview: true, bleed });
        toast.info(
          bleed
            ? 'Automatické tiskové PDF selhalo. Otevřena tisková stránka se spadávkou a značkami.'
            : 'Automatické PDF selhalo. Otevřena tiskárna – použijte Ctrl+P → Uložit jako PDF.',
          { duration: 10000 }
        );
        console.warn('[PDF Export] Důvod selhání:', errMsg);
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
