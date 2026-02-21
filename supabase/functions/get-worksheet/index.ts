/**
 * get-worksheet – veřejný proxy endpoint pro čtení worksheetu
 *
 * Interně používá service_role → obchází RLS.
 * PrintPage ho volá jen s anon klíčem, bez user JWT.
 *
 * GET /functions/v1/get-worksheet?id=WORKSHEET_ID
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
    const url = new URL(req.url);
    const worksheetId = url.searchParams.get('id');

    if (!worksheetId) {
      return new Response(JSON.stringify({ error: 'Chybí id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? 'https://njbtqmsxbyvpwigfceke.supabase.co';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const res = await fetch(
      `${supabaseUrl}/rest/v1/teacher_worksheets?id=eq.${encodeURIComponent(worksheetId)}&select=id,name,content,worksheet_type`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      console.error('Supabase error:', res.status, txt);
      return new Response(JSON.stringify({ error: 'DB error', detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rows = await res.json();
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenalezeno' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const row = rows[0];
    const rawContent = row.content;

    let worksheet: Record<string, unknown>;
    if (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent) && rawContent.blocks) {
      worksheet = { ...rawContent as Record<string, unknown>, id: row.id, title: row.name || rawContent.title };
    } else {
      worksheet = {
        id: row.id,
        title: row.name || 'Pracovní list',
        description: '',
        blocks: Array.isArray(rawContent) ? rawContent : [],
        metadata: { subject: row.worksheet_type || 'other', grade: 6 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
      };
    }

    return new Response(JSON.stringify(worksheet), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('get-worksheet error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
