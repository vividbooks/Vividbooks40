import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VIVIDBOARD_ACTIVITIES_DESCRIPTION = `
## DOSTUPNÉ TYPY AKTIVIT VE VIVIDBOARD:

### 1. [ABC] - Výběr z možností
Klasická testová otázka s 2-4 možnostmi, jedna správná.
Použij pro: faktické otázky, definice, vzorce
Příklad značky: [ABC: Jaký je vzorec pro rychlost? | A) v=s/t (správně) | B) v=t/s | C) v=s*t]

### 2. [OPEN] - Otevřená otázka  
Žák napíše krátkou odpověď (číslo, slovo, větu).
Použij pro: výpočty, doplnění, krátké odpovědi
Příklad značky: [OPEN: Vypočítej: 5 + 3 × 2 = ? | Odpověď: 11]

### 3. [TRUE-FALSE] - Pravda/Nepravda
Tvrzení, které žák označí jako pravdivé nebo nepravdivé.
Použij pro: ověření pochopení, rychlé kontroly
Příklad značky: [TRUE-FALSE: Voda vře při 100°C. | Odpověď: PRAVDA]

### 4. [FILL-BLANKS] - Doplňování slov
Věta s vynechanými slovy, žák doplňuje přetažením.
Použij pro: definice, klíčové pojmy, pravidla
Příklad značky: [FILL-BLANKS: Síla se měří v ___. | Slova: newtonech, kilogramech, metrech]

### 5. [MATCHING] - Přiřazování
Spojení pojmů s jejich definicemi/významy.
Použij pro: slovíčka, definice, vzorce a jejich názvy
Příklad značky: [MATCHING: Spoj pojmy | Newton - síla | Joule - energie | Watt - výkon]

### 6. [ORDERING] - Řazení
Seřazení položek do správného pořadí.
Použij pro: postupy, chronologii, velikosti
Příklad značky: [ORDERING: Seřaď od nejmenšího | 1. milimetr | 2. centimetr | 3. metr]

### 7. [CONNECT-PAIRS] - Spojovačka
Vizuální spojení párů čarami.
Použij pro: vztahy, přiřazování obrázků k textu
Příklad značky: [CONNECT-PAIRS: Spoj | A-1 | B-2 | C-3]

### 8. [EXAMPLE] - Příklad s řešením
Ukázkový příklad s postupem řešení.
Použij pro: matematické úlohy, fyzikální výpočty
Příklad značky: [EXAMPLE: Příklad | Zadání: ... | Řešení: ... | Výsledek: ...]

### 9. [INFO] - Informační slide
Čistý text bez interakce, pro vysvětlení nebo shrnutí.
Použij pro: úvody, teorie, shrnutí kapitol
Příklad značky: [INFO: Nadpis | Text obsahu...]

### 10. [IMAGE-HOTSPOTS] - Označování na obrázku
Žák označí správné body na obrázku.
Použij když: v PDF je obrázek s částmi k označení
Příklad značky: [IMAGE-HOTSPOTS: Označ části buňky | Obrázek: buňka | Body: jádro, cytoplazma]
`

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pdfUrl, includeActivityMarkers = false } = await req.json()

    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing pdfUrl' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('[Extract] Processing PDF:', pdfUrl, 'withMarkers:', includeActivityMarkers)

    // Get Gemini API key from secrets
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY_RAG')
    if (!GEMINI_API_KEY) {
      console.error('[Extract] GEMINI_API_KEY_RAG not found in secrets')
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured. Set GEMINI_API_KEY_RAG in Supabase secrets.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 1. Download PDF
    console.log('[Extract] Downloading PDF...')
    const pdfResponse = await fetch(pdfUrl)
    if (!pdfResponse.ok) {
      console.error('[Extract] Failed to download:', pdfResponse.status, pdfResponse.statusText)
      throw new Error(`Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`)
    }
    
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer())
    console.log('[Extract] PDF downloaded, size:', pdfBytes.byteLength, 'bytes')
    
    // Check size limit (20MB max for inline_data)
    if (pdfBytes.byteLength > 20 * 1024 * 1024) {
      throw new Error('PDF is too large (max 20MB)')
    }
    
    // Use proper base64 encoding for large files
    const pdfBase64 = base64Encode(pdfBytes)
    console.log('[Extract] Base64 encoded, length:', pdfBase64.length)

    // 2. Build prompt based on mode
    let prompt: string
    
    if (includeActivityMarkers) {
      prompt = `Analyzuj tento pracovní list/PDF a přepiš ho do strukturovaného textu SE ZNAČKAMI PRO VIVIDBOARD AKTIVITY.

${VIVIDBOARD_ACTIVITIES_DESCRIPTION}

## TVŮJ ÚKOL:

1. Přečti celý PDF dokument
2. Pro KAŽDÝ úkol/cvičení v PDF přidej odpovídající značku aktivity
3. Zachovej pořadí úkolů z PDF
4. U každé aktivity uveď:
   - Typ aktivity v hranatých závorkách
   - Zadání/otázku
   - Možnosti odpovědí (pokud jsou)
   - Správnou odpověď (pokud je známá)

## PŘÍKLAD VÝSTUPU:

[INFO: Úvod | Tento pracovní list procvičuje základy zlomků.]

[ABC: Cv. 1 | Co je čitatel zlomku 3/4? | A) 3 (správně) | B) 4 | C) 7]

[OPEN: Cv. 2 | Vypočítej: 1/2 + 1/4 = ? | Odpověď: 3/4]

[FILL-BLANKS: Cv. 3 | Zlomek ___ má čitatele 5 a jmenovatele 8. | Slova: 5/8, 8/5, 13]

[MATCHING: Cv. 4 | Spoj zlomky s jejich desetinnými hodnotami | 1/2 - 0,5 | 1/4 - 0,25 | 3/4 - 0,75]

## KRITICKY DŮLEŽITÉ - ČÍSLA ÚKOLŮ:
- VŽDY zachovej čísla cvičení z PDF (Cv. 1, Úkol 2, 1., a) atd.)
- Formát: [TYP: ČÍSLO_ÚKOLU | zadání | další parametry]
- Příklad: [OPEN: Cv. 3 | Vypočítej... | Odpověď: 42]

## DŮLEŽITÉ:
- Každý úkol z PDF = jedna značka
- Pokud PDF obsahuje obrázky, popiš je v [INFO] nebo [IMAGE-HOTSPOTS]
- Pokud nevíš správnou odpověď, napiš "Odpověď: ???"
- **VŽDY zachovej původní čísla cvičení (Cv. 1, Úkol 2, atd.) - vlož je hned za typ!**`
    } else {
      prompt = `Přepiš celý obsah tohoto PDF dokumentu do čistého textu.
Zachovej strukturu (nadpisy, odstavce, seznamy).
Nepřidávej žádné komentáře ani vysvětlení - jen čistý přepis obsahu.
Pokud jsou v PDF obrázky, popiš je stručně v hranatých závorkách [Popis obrázku].`
    }

    // 3. Send to Gemini for text extraction
    console.log('[Extract] Sending to Gemini for extraction...')
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'application/pdf',
                  data: pdfBase64
                }
              }
            ]
          }],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.2
          }
        })
      }
    )

    const responseText = await geminiResponse.text()
    console.log('[Extract] Gemini response status:', geminiResponse.status)

    if (!geminiResponse.ok) {
      console.error('[Extract] Gemini error:', responseText)
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${responseText.substring(0, 200)}`)
    }

    const geminiData = JSON.parse(responseText)
    const extractedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!extractedText) {
      console.error('[Extract] No text in response:', JSON.stringify(geminiData).substring(0, 500))
      throw new Error('No text extracted from PDF')
    }

    console.log('[Extract] ✓ Text extracted, length:', extractedText.length)

    return new Response(
      JSON.stringify({ success: true, text: extractedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Extract] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
