/**
 * pdf-export – Supabase Edge Function
 *
 * Generates a print-quality PDF via Browserless.io /pdf REST API.
 *
 * Two approaches (tried in order):
 *  A) URL approach (primary): navigates Browserless to the live GitHub Pages
 *     deployment, injects worksheet data via addScriptTag.
 *  B) HTML approach (fallback): fetches index.html, injects data inline.
 *
 * POST /functions/v1/pdf-export
 * Body: { worksheetId, worksheetData?, filename? }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function pdfResponse(buffer: ArrayBuffer, filename: string) {
  return new Response(buffer, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.byteLength.toString(),
    },
  });
}

async function browserlessFetch(
  apiKey: string,
  body: Record<string, unknown>,
  maxRetries = 2,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(
      `https://production-sfo.browserless.io/pdf?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (res.status !== 429 || attempt === maxRetries) {
      return res;
    }

    const delay = 4000 * Math.pow(2, attempt);
    console.log(`[pdf-export] 429 rate-limited, retry in ${delay}ms (${attempt + 1}/${maxRetries})`);
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error('Unreachable');
}

function resolvePdfFormat(worksheetData?: Record<string, unknown>): 'A4' | 'A5' | 'B5' {
  const metadata = (worksheetData?.metadata as Record<string, unknown> | undefined) ?? {};
  const pageFormat = typeof metadata.pageFormat === 'string' ? metadata.pageFormat.toLowerCase() : 'a4';
  if (pageFormat === 'a5') return 'A5';
  if (pageFormat === 'b5') return 'B5';
  return 'A4';
}

function getBleedPdfSize(pdfFormat: 'A4' | 'A5' | 'B5'): { width: string; height: string } {
  if (pdfFormat === 'A5') return { width: '154mm', height: '216mm' };
  if (pdfFormat === 'B5') return { width: '182mm', height: '256mm' };
  return { width: '216mm', height: '303mm' };
}

function buildPdfOptions(
  pdfFormat: 'A4' | 'A5' | 'B5',
  bleed: boolean,
) {
  const base = {
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  };
  if (!bleed) {
    return {
      ...base,
      format: pdfFormat,
    };
  }
  const bleedSize = getBleedPdfSize(pdfFormat);
  return {
    ...base,
    width: bleedSize.width,
    height: bleedSize.height,
  };
}

// ── Approach A: URL (primary) ───────────────────────────────────────────────
async function generateWithUrl(
  appUrl: string,
  worksheetId: string,
  worksheetData: Record<string, unknown> | undefined,
  apiKey: string,
  pdfFormat: 'A4' | 'A5' | 'B5',
  bleed: boolean,
): Promise<ArrayBuffer> {
  const encodedPath = encodeURIComponent(`/print/${worksheetId}`);
  const printUrl = `${appUrl}/?p=${encodedPath}${bleed ? encodeURIComponent('?bleed=1') : ''}`;

  const addScriptTag = worksheetData
    ? [{ content: `window.__WORKSHEET_DATA__ = ${JSON.stringify(worksheetData)}; window.__PRINT_BLEED__ = ${bleed ? 'true' : 'false'};` }]
    : [];

  const res = await browserlessFetch(apiKey, {
    url: printUrl,
    ...(addScriptTag.length > 0 ? { addScriptTag } : {}),
    waitForFunction: {
      fn: '() => !!window.__PRINT_READY__',
      timeout: 60000,
    },
    gotoOptions: {
      waitUntil: 'networkidle2',
      timeout: 60000,
    },
    options: buildPdfOptions(pdfFormat, bleed),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '(nepřečteno)');
    throw new Error(`Browserless ${res.status}: ${detail.slice(0, 500)}`);
  }

  const pdf = await res.arrayBuffer();
  if (pdf.byteLength < 5000) {
    throw new Error(`PDF podezřele malé (${pdf.byteLength} B) – stránka se nevyrenderovala`);
  }
  return pdf;
}

// ── Approach B: HTML (fallback) ─────────────────────────────────────────────
async function generateWithHtml(
  appUrl: string,
  worksheetData: Record<string, unknown>,
  apiKey: string,
  pdfFormat: 'A4' | 'A5' | 'B5',
  bleed: boolean,
): Promise<ArrayBuffer> {
  const indexRes = await fetch(`${appUrl}/`, { headers: { Accept: 'text/html' } });
  if (!indexRes.ok) {
    throw new Error(`Nepodařilo se načíst index.html (${indexRes.status})`);
  }
  let html = await indexRes.text();

  const basePath = new URL(appUrl).pathname.replace(/\/$/, '');
  if (basePath) {
    html = html.replace(new RegExp(`(src|href)="${basePath}/`, 'g'), `$1="${appUrl}/`);
  }

  const injection = `<script>
window.__BROWSERLESS__ = true;
window.__WORKSHEET_DATA__ = ${JSON.stringify(worksheetData)};
window.__PRINT_BLEED__ = ${bleed ? 'true' : 'false'};
</script>`;
  html = html.replace('</head>', injection + '\n</head>');

  const res = await browserlessFetch(apiKey, {
    html,
    waitForFunction: {
      fn: '() => !!window.__PRINT_READY__',
      timeout: 60000,
    },
    options: buildPdfOptions(pdfFormat, bleed),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '(nepřečteno)');
    throw new Error(`Browserless ${res.status}: ${detail.slice(0, 500)}`);
  }

  const pdf = await res.arrayBuffer();
  if (pdf.byteLength < 5000) {
    throw new Error(`PDF podezřele malé (${pdf.byteLength} B) – stránka se nevyrenderovala`);
  }
  return pdf;
}

/**
 * Converts <span style="background-color: COLOR;">TEXT</span> → <mark style="background: COLOR">TEXT</mark>
 * so that both old code (LatexRenderer which handles <mark>) and new code (dangerouslySetInnerHTML)
 * render heading highlights correctly in the PDF.
 */
function normalizeHeadingHtml(html: string): string {
  return html.replace(
    /<span\s+style="background-color:\s*([^"]+);">([\s\S]*?)<\/span>/gi,
    (_match, color, text) => `<mark style="background: ${color.trim()}">${text}</mark>`,
  );
}

function preprocessWorksheetData(data: Record<string, unknown>): Record<string, unknown> {
  const blocks = data.blocks as Array<Record<string, unknown>> | undefined;
  const metadata = ((data.metadata as Record<string, unknown> | undefined) ?? {});
  const pageHeader = ((metadata.pageHeader as Record<string, unknown> | undefined) ?? {});
  const pageFooter = ((metadata.pageFooter as Record<string, unknown> | undefined) ?? {});

  const normalizedMetadata = {
    ...metadata,
    pageHeader: {
      ...pageHeader,
      enabled: pageHeader.enabled === true,
    },
    pageFooter: {
      ...pageFooter,
      enabled: pageFooter.enabled === true,
    },
  };

  if (!Array.isArray(blocks)) {
    return { ...data, metadata: normalizedMetadata };
  }
  return {
    ...data,
    metadata: normalizedMetadata,
    blocks: blocks
      .filter((block) => block.type !== 'header-footer')
      .map((block) => {
        if (block.type !== 'heading') return block;
        const content = block.content as Record<string, unknown> | undefined;
        if (!content || typeof content.text !== 'string') return block;
        return { ...block, content: { ...content, text: normalizeHeadingHtml(content.text) } };
      }),
  };
}

// ── Upload PDF to Supabase Storage and return public URL ────────────────────
async function uploadPdfToStorage(
  pdf: ArrayBuffer,
  filename: string,
): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY není nastaven');
  }

  const storagePath = `pdfs/${filename}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/teacher-files/${storagePath}`;

  const uploadResp = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: pdf,
  });

  if (!uploadResp.ok) {
    const detail = await uploadResp.text().catch(() => '');
    throw new Error(`Storage upload selhal (${uploadResp.status}): ${detail.slice(0, 200)}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/teacher-files/${storagePath}`;
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const browserlessApiKey = Deno.env.get('BROWSERLESS_API_KEY');
    const appUrl = (
      Deno.env.get('APP_URL') ?? 'https://vividbooks.github.io/Vividbooks40'
    ).replace(/\/$/, '');

    if (!browserlessApiKey) {
      return jsonResponse({ error: 'BROWSERLESS_API_KEY secret není nastaven v Supabase.' }, 500);
    }

    const body = await req.json();
    const { worksheetId, worksheetData, filename = 'pracovni-list.pdf', saveToStorage = false, bleed = false } = body as {
      worksheetId: string;
      worksheetData?: Record<string, unknown>;
      filename?: string;
      /** When true: upload PDF to Supabase Storage and return { pdfUrl } instead of the raw PDF bytes */
      saveToStorage?: boolean;
      bleed?: boolean;
    };

    if (!worksheetId) {
      return jsonResponse({ error: 'Chybí worksheetId' }, 400);
    }

    console.log(`[pdf-export] id=${worksheetId} saveToStorage=${saveToStorage}`);
    const errors: string[] = [];
    let pdf: ArrayBuffer | null = null;

    // Pre-process: convert <span style="background-color: ..."> → <mark> in heading blocks
    // so highlights render correctly even in older deployed frontend code
    const processedData = worksheetData ? preprocessWorksheetData(worksheetData) : undefined;
    const pdfFormat = resolvePdfFormat(processedData);

    // ── A) URL approach (primary) ──────────────────────────────────────────
    try {
      pdf = await generateWithUrl(appUrl, worksheetId, processedData, browserlessApiKey, pdfFormat, bleed);
      console.log('[pdf-export] URL approach succeeded, size:', pdf.byteLength);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[url] ${msg}`);
      console.warn('[pdf-export] URL approach failed:', msg);
    }

    // ── B) HTML approach (fallback) ────────────────────────────────────────
    if (!pdf && processedData) {
      try {
        pdf = await generateWithHtml(appUrl, processedData, browserlessApiKey, pdfFormat, bleed);
        console.log('[pdf-export] HTML approach succeeded, size:', pdf.byteLength);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[html] ${msg}`);
        console.error('[pdf-export] HTML approach failed:', msg);
      }
    }

    if (!pdf) {
      return jsonResponse(
        {
          error: 'PDF generování selhalo.',
          detail: errors.join(' | '),
          hint: 'Zkontrolujte platnost BROWSERLESS_API_KEY a zda je aplikace nasazena na GitHub Pages.',
        },
        502,
      );
    }

    // ── Return: either upload to storage or stream directly ────────────────
    if (saveToStorage) {
      try {
        const pdfUrl = await uploadPdfToStorage(pdf, filename);
        console.log('[pdf-export] Uploaded to storage:', pdfUrl);
        return jsonResponse({ pdfUrl }, 200);
      } catch (uploadErr) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        console.error('[pdf-export] Storage upload failed:', msg);
        return jsonResponse({ error: `Storage upload selhal: ${msg}` }, 500);
      }
    }

    return pdfResponse(pdf, filename);
  } catch (err) {
    console.error('[pdf-export] Unhandled error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
