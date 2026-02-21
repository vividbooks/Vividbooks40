/**
 * pdf-export – klientská utilita pro generování PDF přes Supabase Edge Function
 * (která volá Browserless.io headless Chrome)
 */

import { supabase } from './supabase/client';

const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

export interface PDFExportOptions {
  worksheetId: string;
  /** Full worksheet JSON – sent to edge function so it can upsert to DB
   *  before Browserless loads the print page. Required for offline users
   *  whose worksheets only exist in localStorage. */
  worksheetData?: Record<string, unknown>;
  /** Suggested filename for the downloaded file */
  filename?: string;
  /** Open /print page preview in a new tab instead of generating PDF */
  preview?: boolean;
}

/**
 * Generates a print-quality PDF via Browserless.io edge function
 * and triggers a browser download.
 */
export async function exportWorksheetPDF(opts: PDFExportOptions): Promise<void> {
  const { worksheetId, worksheetData, filename = 'pracovni-list.pdf', preview = false } = opts;

  if (preview) {
    const base = import.meta.env.PROD ? '/Vividbooks40' : '';
    window.open(`${base}/print/${worksheetId}`, '_blank');
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/pdf-export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ worksheetId, worksheetData, filename }),
  });

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    try { errMsg = (await response.json()).error ?? errMsg; } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
