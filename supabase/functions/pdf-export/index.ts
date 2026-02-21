/**
 * pdf-export – Supabase Edge Function
 *
 * Generates a print-quality PDF via Browserless.io headless Chrome.
 *
 * Flow:
 *  1. Receives worksheetId from the client
 *  2. Constructs the /print/:worksheetId URL
 *  3. Sends it to Browserless /pdf endpoint
 *  4. PrintPage fetches data itself via the get-worksheet edge function
 *  5. Returns the PDF binary to the client
 *
 * Supabase secrets:
 *   BROWSERLESS_API_KEY  – token from browserless.io
 *   APP_URL              – public app URL (e.g. https://vividbooks.github.io/Vividbooks40)
 *
 * POST /functions/v1/pdf-export
 * Body: { worksheetId: string, filename?: string }
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

    if (!browserlessApiKey) {
      return new Response(
        JSON.stringify({ error: 'BROWSERLESS_API_KEY secret není nastaven.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { worksheetId, filename = 'pracovni-list.pdf' } = body as {
      worksheetId: string;
      filename?: string;
    };

    if (!worksheetId) {
      return new Response(
        JSON.stringify({ error: 'Chybí worksheetId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bypass the GitHub Pages 404.html SPA redirect by using the ?p= query format directly.
    // If we send /Vividbooks40/print/ws-1, GitHub Pages serves 404.html which does a JS
    // window.location.replace() – that causes Puppeteer's waitForFunction context to be
    // destroyed before __PRINT_READY__ is ever set.
    // By targeting /Vividbooks40/?p=%2Fprint%2Fws-1, index.html is served with a 200 and
    // its inline script does history.replaceState (no navigation), so everything stays stable.
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
