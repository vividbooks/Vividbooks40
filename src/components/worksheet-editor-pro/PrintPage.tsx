/**
 * PrintPage – Standalone print-quality render of a worksheet.
 *
 * Accessed at /print/:worksheetId
 * Used by Browserless.io (headless Chrome) to produce a pixel-perfect PDF.
 * Also usable directly in the browser via Ctrl+P.
 *
 * Ready-signal flow:
 *   1. Worksheet data is fetched (localStorage → get-worksheet edge function)
 *   2. PrintGridCanvas renders and measures all blocks via ResizeObserver
 *   3. Once block heights stabilise, PrintGridCanvas fires `onStable`
 *   4. We wait for document.fonts.ready (external fonts: Fenomen Sans, Cooper Light)
 *   5. Only then we set window.__PRINT_READY__ = true for Browserless
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Worksheet } from '../../types/worksheet';
import { PrintGridCanvas } from './PrintGridCanvas';
import { PAGE_DIMENSIONS } from '../../utils/page-layout';

const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

const PAGE_W = PAGE_DIMENSIONS.a4.width; // 794px

const printStyles = `
  *, *::before, *::after {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: white;
    width: ${PAGE_W}px;
    font-size: 16px; /* Explicitly match editor's var(--font-size) */
  }
  @page {
    size: 210mm 297mm;
    margin: 0;
  }
  @media screen {
    html, body {
      background: #d1d5db;
      width: auto;
    }
    body {
      padding: 40px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 40px;
    }
    .a4-page {
      box-shadow: 0 4px 40px rgba(0,0,0,0.25);
    }
  }
  @media print {
    .a4-page {
      box-shadow: none !important;
    }
  }
`;

async function fetchWorksheetViaProxy(worksheetId: string): Promise<Worksheet | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/get-worksheet?id=${encodeURIComponent(worksheetId)}`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!res.ok) return null;
    return await res.json() as Worksheet;
  } catch {
    return null;
  }
}

export function PrintPage() {
  const { worksheetId } = useParams<{ worksheetId: string }>();
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!worksheetId) {
      setError('Chybí ID pracovního listu');
      setLoading(false);
      return;
    }

    // ── Priority 1: window.__WORKSHEET_DATA__ injected by Browserless addScriptTag ──
    // addScriptTag in Browserless runs AFTER page.goto() resolves – which means
    // it may fire before or after React's useEffect depending on network timing.
    // We poll for up to 5 s so we catch it regardless of injection timing.
    const tryLoad = async () => {
      let resolved = false;

      // Immediate check (best case: addScriptTag ran before React)
      try {
        const injected = (window as any).__WORKSHEET_DATA__;
        if (injected && typeof injected === 'object' && injected.blocks) {
          setWorksheet(injected as Worksheet);
          setLoading(false);
          return;
        }
      } catch { /* ignore */ }

      // Poll for up to 5 s (50 × 100 ms)
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const poll = setInterval(() => {
          attempts++;
          try {
            const injected = (window as any).__WORKSHEET_DATA__;
            if (injected && typeof injected === 'object' && injected.blocks) {
              clearInterval(poll);
              resolved = true;
              setWorksheet(injected as Worksheet);
              setLoading(false);
              resolve();
              return;
            }
          } catch { /* ignore */ }
          if (attempts >= 50) {
            clearInterval(poll);
            resolve();
          }
        }, 100);
      });

      if (resolved) return; // worksheet already set by polling

      // ── Priority 2: localStorage (same browser preview) ──
      try {
        const local = localStorage.getItem(`vividbooks_worksheet_${worksheetId}`);
        if (local) {
          setWorksheet(JSON.parse(local));
          setLoading(false);
          return;
        }
      } catch { /* ignore */ }

      // ── Priority 3: get-worksheet edge function (service role DB) ──
      const ws = await fetchWorksheetViaProxy(worksheetId);
      if (ws) {
        setWorksheet(ws);
        setLoading(false);
        return;
      }

      setError('Pracovní list nebyl nalezen.');
      setLoading(false);
    };

    tryLoad();
  }, [worksheetId]);

  // Signal readiness ONLY after layout stabilisation + font loading
  const handleStable = useCallback(() => {
    document.fonts.ready.then(() => {
      // Small buffer to let the final repaint settle
      setTimeout(() => {
        (window as any).__PRINT_READY__ = true;
      }, 200);
    });
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      {loading && (
        <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui', color: '#64748b' }}>
          Načítám pracovní list…
        </div>
      )}

      {error && (
        <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {worksheet && (
        <PrintGridCanvas worksheet={worksheet} onStable={handleStable} />
      )}
    </>
  );
}
