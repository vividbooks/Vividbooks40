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

    // ── Step 1: Ensure worksheet is in Supabase DB ─────────────────────────────
    // This is critical for offline/unauthenticated users whose worksheets only
    // exist in localStorage. Browserless cannot access localStorage, so it must
    // be able to fetch the worksheet via the get-worksheet edge function.
    // We use the service_role key to bypass RLS entirely.
    if (worksheetData && serviceRoleKey) {
      try {
        const upsertRes = await fetch(
          `${supabaseUrl}/rest/v1/teacher_worksheets`,
          {
            method: 'POST',
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify({
              id: worksheetId,
              name: (worksheetData.title as string) || 'Pracovní list',
              worksheet_type: ((worksheetData as any).metadata?.subject) || null,
              content: worksheetData,
              updated_at: new Date().toISOString(),
            }),
          }
        );
        if (!upsertRes.ok) {
          const txt = await upsertRes.text();
          console.warn('Worksheet upsert warning:', upsertRes.status, txt);
        } else {
          console.log('Worksheet upserted to DB:', worksheetId);
        }
      } catch (upsertErr) {
        console.warn('Worksheet upsert failed (non-fatal):', upsertErr);
      }
    }

    // ── Step 2: Build Browserless URL ──────────────────────────────────────────
    // Use ?p= query format to bypass the GitHub Pages 404.html SPA redirect.
    // If we sent /Vividbooks40/print/ws-1, GitHub Pages serves 404.html which
    // does window.location.replace() – a JS navigation that destroys Puppeteer's
    // waitForFunction context before __PRINT_READY__ is set.
    // With /?p=%2Fprint%2Fws-1, index.html is served with HTTP 200 and its
    // inline script calls history.replaceState (no navigation) – stable context.
    const encodedPath = encodeURIComponent(`/print/${worksheetId}`);
    const printUrl = `${appUrl}/?p=${encodedPath}`;

    const browserlessBody = {
      url: printUrl,

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
