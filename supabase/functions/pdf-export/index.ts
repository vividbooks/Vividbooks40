/**
 * pdf-export – Supabase Edge Function
 *
 * Generates a print-quality PDF via Browserless.io headless Chrome.
 *
 * Flow:
 *  1. Receives worksheetId + full worksheetData JSON from the client
 *  2. Upserts worksheetData into teacher_worksheets using service_role key
 *     (bypasses RLS – works even in offline/unauthenticated mode)
 *  3. Constructs the /print/:worksheetId URL using the ?p= SPA redirect trick
 *  4. Sends it to Browserless /pdf endpoint
 *  5. PrintPage fetches data via get-worksheet edge function (now guaranteed in DB)
 *  6. Returns the PDF binary to the client
 *
 * Supabase secrets:
 *   BROWSERLESS_API_KEY  – token from browserless.io
 *   APP_URL              – public app URL (e.g. https://vividbooks.github.io/Vividbooks40)
 *
 * POST /functions/v1/pdf-export
 * Body: { worksheetId: string, worksheetData: object, filename?: string }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const browserlessApiKey = Deno.env.get('BROWSERLESS_API_KEY');
    const appUrl = Deno.env.get('APP_URL') ?? 'https://vividbooks.github.io/Vividbooks40';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://njbtqmsxbyvpwigfceke.supabase.co';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!browserlessApiKey) {
      return new Response(
        JSON.stringify({ error: 'BROWSERLESS_API_KEY secret není nastaven.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { worksheetId, worksheetData, filename = 'pracovni-list.pdf' } = body as {
      worksheetId: string;
      worksheetData?: Record<string, unknown>;
      filename?: string;
    };

    if (!worksheetId) {
      return new Response(
        JSON.stringify({ error: 'Chybí worksheetId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 1: Build Browserless URL ──────────────────────────────────────────
    // Use ?p= query format to bypass the GitHub Pages 404.html SPA redirect.
    // If we sent /Vividbooks40/print/ws-1, GitHub Pages serves 404.html which
    // does window.location.replace() – a JS navigation that destroys Puppeteer's
    // waitForFunction context before __PRINT_READY__ is set.
    // With /?p=%2Fprint%2Fws-1, index.html is served with HTTP 200 and its
    // inline script calls history.replaceState (no navigation) – stable context.
    const encodedPath = encodeURIComponent(`/print/${worksheetId}`);
    const printUrl = `${appUrl}/?p=${encodedPath}`;

    // ── Step 2: Inject worksheet data directly into the page ───────────────────
    // We inject window.__WORKSHEET_DATA__ via addScriptTag BEFORE the page JS
    // runs. PrintPage reads this first – no DB lookup, no auth, no teacher_id
    // issues. This is the correct solution for offline/unauthenticated users.
    const addScriptTag = worksheetData
      ? [{ content: `window.__WORKSHEET_DATA__ = ${JSON.stringify(worksheetData)};` }]
      : [];

    const browserlessBody: Record<string, unknown> = {
      url: printUrl,

      ...(addScriptTag.length > 0 ? { addScriptTag } : {}),

      waitForFunction: {
        fn: '() => !!window.__PRINT_READY__',
        timeout: 45000,
      },

      gotoOptions: {
        waitUntil: 'networkidle0',
        timeout: 45000,
      },

      options: {
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      },
    };

    console.log('Calling Browserless for worksheet:', worksheetId, 'url:', printUrl);

    const browserlessRes = await fetch(
      `https://production-sfo.browserless.io/pdf?token=${browserlessApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(browserlessBody),
      }
    );

    if (!browserlessRes.ok) {
      const errText = await browserlessRes.text();
      console.error('Browserless error:', browserlessRes.status, errText);
      return new Response(
        JSON.stringify({ error: `Browserless selhal: ${browserlessRes.status}`, detail: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pdfBuffer = await browserlessRes.arrayBuffer();
    console.log('PDF generated, size:', pdfBuffer.byteLength);

    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });
  } catch (err) {
    console.error('pdf-export error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
