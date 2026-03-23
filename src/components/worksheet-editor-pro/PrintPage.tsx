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

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Worksheet } from '../../types/worksheet';
import { PrintGridCanvas } from './PrintGridCanvas';
import { MM_TO_PX, PAGE_DIMENSIONS, type PageFormat } from '../../utils/page-layout';

const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzczODksImV4cCI6MjA3ODQxMzM4OX0.nY0THq2YU9wrjYsPoxYwXRXczE3Vh7cB1opzAV8c50g';

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
  const [searchParams] = useSearchParams();
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pageFormat = (worksheet?.metadata?.pageFormat as PageFormat | undefined) || 'a4';
  const pageDimensions = PAGE_DIMENSIONS[pageFormat] || PAGE_DIMENSIONS.a4;
  const showBleed = searchParams.get('bleed') === '1' || Boolean((window as any).__PRINT_BLEED__);
  const bleedPx = showBleed ? 3 * MM_TO_PX : 0;
  const pageWidthPx = pageDimensions.width + bleedPx * 2;
  const pageHeightPx = pageDimensions.height + bleedPx * 2;
  const pageWidthMm = showBleed ? (pageFormat === 'a4' ? 216 : pageFormat === 'a5' ? 154 : 182) : (pageFormat === 'a4' ? 210 : pageFormat === 'a5' ? 148 : 176);
  const pageHeightMm = showBleed ? (pageFormat === 'a4' ? 303 : pageFormat === 'a5' ? 216 : 256) : (pageFormat === 'a4' ? 297 : pageFormat === 'a5' ? 210 : 250);
  const printStyles = useMemo(() => `
  *, *::before, *::after {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
    transition: none !important;
    animation: none !important;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: white;
    width: ${pageWidthPx}px;
    font-size: 16px;
  }
  @page {
    size: ${pageWidthMm}mm ${pageHeightMm}mm;
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
    .print-sheet {
      box-shadow: 0 4px 40px rgba(0,0,0,0.25);
    }
  }
  @media print {
    .print-sheet {
      box-shadow: none !important;
    }
  }
  .a4-page .overflow-hidden {
    overflow: hidden !important;
  }
`, [pageHeightMm, pageWidthMm, pageWidthPx]);

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

  // Signal readiness ONLY after layout stabilisation + font loading + image loading
  const handleStable = useCallback(() => {
    const waitForImages = (): Promise<void> => {
      const images = Array.from(document.querySelectorAll('img'));
      if (images.length === 0) return Promise.resolve();

      return Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
            setTimeout(resolve, 10_000);
          });
        }),
      ).then(() => {});
    };

    Promise.all([document.fonts.ready, waitForImages()]).then(() => {
      setTimeout(() => {
        (window as any).__PRINT_READY__ = true;
        console.log('[PrintPage] __PRINT_READY__ set (fonts + images loaded)');
      }, 500);
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
        <PrintGridCanvas worksheet={worksheet} onStable={handleStable} bleed={showBleed} />
      )}
    </>
  );
}
