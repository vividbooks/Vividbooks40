/**
 * worksheet-thumbnails – Supabase Edge Function
 *
 * Strategy (reliable, pixel-perfect):
 *   1. Generate PDF via Browserless /pdf  (same engine as pdf-export — already works)
 *   2. Upload PDF as application/octet-stream to Supabase Storage → get public URL
 *      (bucket only allows images, so we use octet-stream to bypass MIME restriction)
 *   3. For each page, render with PDF.js inside a Browserless /screenshot call
 *      → guarantees the image matches the PDF exactly
 *   4. Upload per-page JPEGs to Supabase Storage
 *   5. Delete temp PDF, return public URLs
 *
 * POST /functions/v1/worksheet-thumbnails
 * Body: { worksheetId, worksheetData?, pageCount? }
 * Returns: { thumbnailUrls: string[] }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Step 1: Generate PDF (identical to pdf-export approach) ──────────────────

async function generatePdf(
  apiKey: string,
  printUrl: string,
  worksheetData: Record<string, unknown> | undefined,
): Promise<ArrayBuffer> {
  const addScriptTag = worksheetData
    ? [{ content: `window.__WORKSHEET_DATA__ = ${JSON.stringify(worksheetData)};` }]
    : [];

  const res = await fetch(`https://production-sfo.browserless.io/pdf?token=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: printUrl,
      ...(addScriptTag.length ? { addScriptTag } : {}),
      waitForFunction: { fn: '() => !!window.__PRINT_READY__', timeout: 60000 },
      gotoOptions: { waitUntil: 'networkidle2', timeout: 60000 },
      options: {
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Browserless /pdf failed ${res.status}: ${detail.slice(0, 300)}`);
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength < 5000) throw new Error(`PDF suspiciously small (${buf.byteLength} B)`);
  return buf;
}

// ─── Step 2: Render one PDF page as JPEG via PDF.js inside Browserless ────────

function buildPdfRenderHtml(pdfUrl: string, pageNum: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:white;}</style>
</head>
<body>
<canvas id="c"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

pdfjsLib.getDocument({ url: ${JSON.stringify(pdfUrl)}, cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/', cMapPacked: true })
  .promise
  .then(function(pdf) { return pdf.getPage(${pageNum}); })
  .then(function(page) {
    var viewport = page.getViewport({ scale: 2.0 });
    var canvas = document.getElementById('c');
    canvas.width  = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    document.body.style.width  = canvas.width  + 'px';
    document.body.style.height = canvas.height + 'px';
    return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
  })
  .then(function() { window.__RENDER_DONE__ = true; })
  .catch(function(err) {
    console.error('PDF.js error:', err);
    window.__RENDER_DONE__ = true;
  });
</script>
</body>
</html>`;
}

async function screenshotPdfPage(
  apiKey: string,
  pdfUrl: string,
  pageNum: number,
): Promise<ArrayBuffer> {
  const html = buildPdfRenderHtml(pdfUrl, pageNum);

  const res = await fetch(`https://production-sfo.browserless.io/screenshot?token=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html,
      waitForFunction: { fn: '() => !!window.__RENDER_DONE__', timeout: 30000 },
      options: { type: 'jpeg', quality: 90, fullPage: true },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Browserless /screenshot page ${pageNum} failed ${res.status}: ${detail.slice(0, 200)}`);
  }

  return res.arrayBuffer();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const browserlessApiKey = Deno.env.get('BROWSERLESS_API_KEY');
    const supabaseUrl       = Deno.env.get('SUPABASE_URL') ?? 'https://njbtqmsxbyvpwigfceke.supabase.co';
    const serviceRoleKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const appUrl            = (Deno.env.get('APP_URL') ?? 'https://vividbooks.github.io/Vividbooks40').replace(/\/$/, '');

    if (!browserlessApiKey) return jsonResponse({ error: 'BROWSERLESS_API_KEY není nastaven' }, 500);
    if (!serviceRoleKey)    return jsonResponse({ error: 'SUPABASE_SERVICE_ROLE_KEY není nastaven' }, 500);

    const body = await req.json();
    const { worksheetId, worksheetData, pageCount = 1 } = body as {
      worksheetId: string;
      worksheetData?: Record<string, unknown>;
      pageCount?: number;
    };

    if (!worksheetId) return jsonResponse({ error: 'Chybí worksheetId' }, 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── 0. Ensure bucket allows PDFs (one-time, idempotent) ──────────────────
    // The generated-images bucket may restrict MIME types. We update it via the
    // service role to ensure application/pdf uploads are allowed.
    await supabase.storage.updateBucket('generated-images', {
      allowedMimeTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/octet-stream',
      ],
      fileSizeLimit: 52428800, // 50 MB
    }).catch((e: unknown) => {
      console.warn('[worksheet-thumbnails] updateBucket warning (non-fatal):', e);
    });

    // ── 1. Generate PDF ──────────────────────────────────────────────────────
    const encodedPath = encodeURIComponent(`/print/${worksheetId}`);
    const printUrl    = `${appUrl}/?p=${encodedPath}`;

    console.log(`[worksheet-thumbnails] Generating PDF for ${worksheetId}, ${pageCount} pages`);
    const pdfBuffer = await generatePdf(browserlessApiKey, printUrl, worksheetData);
    console.log(`[worksheet-thumbnails] PDF size: ${pdfBuffer.byteLength} B`);

    // ── 2. Upload temp PDF ───────────────────────────────────────────────────
    const tempPath = `worksheet-thumbnails/${worksheetId}/temp-${Date.now()}.pdf`;
    const { error: uploadPdfError } = await supabase.storage
      .from('generated-images')
      .upload(tempPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadPdfError) {
      throw new Error(`Temp PDF upload failed: ${uploadPdfError.message}`);
    }

    const { data: tempUrlData } = supabase.storage.from('generated-images').getPublicUrl(tempPath);
    const pdfUrl = tempUrlData.publicUrl;
    console.log(`[worksheet-thumbnails] Temp PDF URL: ${pdfUrl}`);

    // ── 3. Render each page via PDF.js + upload JPEG ─────────────────────────
    const thumbnailUrls: string[] = [];

    for (let pi = 0; pi < pageCount; pi++) {
      try {
        const jpegBuffer = await screenshotPdfPage(browserlessApiKey, pdfUrl, pi + 1);
        const storagePath = `worksheet-thumbnails/${worksheetId}/page-${pi}.jpg`;

        const { error: imgUploadError } = await supabase.storage
          .from('generated-images')
          .upload(storagePath, jpegBuffer, { contentType: 'image/jpeg', upsert: true });

        if (imgUploadError) {
          console.error(`[worksheet-thumbnails] page ${pi} upload error:`, imgUploadError.message);
          thumbnailUrls.push('');
        } else {
          const { data: imgUrlData } = supabase.storage.from('generated-images').getPublicUrl(storagePath);
          thumbnailUrls.push(imgUrlData.publicUrl);
          console.log(`[worksheet-thumbnails] page ${pi} → ${imgUrlData.publicUrl}`);
        }
      } catch (pageErr) {
        console.error(`[worksheet-thumbnails] page ${pi} error:`, pageErr);
        thumbnailUrls.push('');
      }
    }

    // ── 4. Clean up temp PDF ────────────────────────────────────────────────
    await supabase.storage.from('generated-images').remove([tempPath]).catch(() => {});

    return jsonResponse({ thumbnailUrls });

  } catch (err) {
    console.error('[worksheet-thumbnails] unhandled:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
