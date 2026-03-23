/**
 * ČSÚ DataStat Proxy Edge Function
 *
 * Proxuje požadavky na Czech Statistical Office DataStat API.
 * Řeší CORS problém – browser nemůže volat ČSÚ API přímo.
 *
 * API ČSÚ: https://data.csu.gov.cz/api/dotaz/v1/data/vybery/{kod}?format=CSV
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CSU_BASE = 'https://data.csu.gov.cz/api/dotaz/v1/data/vybery';

/** Parsuje CSV (s uvozovkami) do pole objektů */
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return rows;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const selectionCode = url.searchParams.get('code');
    const limitParam = url.searchParams.get('limit');
    const filterParam = url.searchParams.get('filter'); // např. "Ukazatel=Průměrná hrubá měsíční mzda"

    if (!selectionCode) {
      return new Response(
        JSON.stringify({ error: 'Parametr code je povinný (kód výběru ČSÚ DataStat)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const csuUrl = `${CSU_BASE}/${encodeURIComponent(selectionCode)}?format=CSV`;

    const response = await fetch(csuUrl, {
      headers: { 'Accept': 'text/csv,application/json' },
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `ČSÚ API vrátila chybu ${response.status}`, detail: errText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const csvText = await response.text();

    // Detekce JSON chybové odpovědi (ČSÚ vrací JSON i přes format=CSV pro chyby)
    if (csvText.trim().startsWith('{')) {
      const jsonErr = JSON.parse(csvText);
      return new Response(
        JSON.stringify({ error: jsonErr.chyba ?? 'Neznámá chyba ČSÚ API' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let rows = parseCSV(csvText);

    // Volitelný filtr – shoda hodnoty v daném sloupci
    if (filterParam) {
      const [filterCol, ...filterValParts] = filterParam.split('=');
      const filterVal = filterValParts.join('=');
      rows = rows.filter((r) => r[filterCol] === filterVal);
    }

    // Volitelný limit
    if (limitParam) {
      const n = parseInt(limitParam, 10);
      if (!isNaN(n) && n > 0) rows = rows.slice(0, n);
    }

    return new Response(JSON.stringify({ rows, total: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
