/**
 * YouTube Transcript Extractor
 * Extrahuje titulky/přepis z YouTube videí pro AI generování
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyDcPJrEcxThsVskj2LvYf6VB3mGTM45Ih0';

export interface TranscriptResult {
  success: boolean;
  transcript?: string;
  error?: string;
  videoTitle?: string;
}

/**
 * Extrahuje video ID z YouTube URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Získá skutečný přepis/titulky z YouTube videa
 * Používá Edge Function pro extrakci titulků a Gemini jako fallback
 */
export async function getYouTubeTranscript(videoUrl: string): Promise<TranscriptResult> {
  console.log('[YouTubeTranscript] Starting extraction for:', videoUrl);
  
  const videoId = extractYouTubeVideoId(videoUrl);
  
  // 1. Získat informace o videu z oEmbed
  let videoTitle = '';
  let videoAuthor = '';
  
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const oembedResponse = await fetch(oembedUrl);
    if (oembedResponse.ok) {
      const oembedData = await oembedResponse.json();
      videoTitle = oembedData.title || '';
      videoAuthor = oembedData.author_name || '';
      console.log('[YouTubeTranscript] Got video info:', { title: videoTitle, author: videoAuthor });
    }
  } catch (e) {
    console.log('[YouTubeTranscript] oEmbed failed');
  }
  
  // 2. Zkusit získat skutečné titulky přes Edge Function
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://njbtqmsxbyvpwigfceke.supabase.co';
    const response = await fetch(`${supabaseUrl}/functions/v1/youtube-transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoUrl, videoId })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.transcript && result.transcript.length > 100) {
        console.log('[YouTubeTranscript] Got real transcript from Edge Function, length:', result.transcript.length);
        return {
          success: true,
          transcript: result.transcript,
          videoTitle: videoTitle
        };
      }
      console.log('[YouTubeTranscript] Edge Function returned no transcript:', result.error);
    } else {
      console.log('[YouTubeTranscript] Edge Function failed:', response.status);
    }
  } catch (e) {
    console.log('[YouTubeTranscript] Edge Function error:', e);
  }
  
  // 3. Fallback - použít Gemini pro generování obsahu na základě názvu
  if (!GEMINI_API_KEY) {
    return { 
      success: false, 
      error: 'Video nemá dostupné titulky a chybí Gemini API klíč pro generování obsahu' 
    };
  }
  
  console.log('[YouTubeTranscript] Using Gemini fallback for video:', videoTitle);
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Jsi expert na vzdělávání. Na základě názvu YouTube videa vytvoř podrobný vzdělávací obsah vhodný pro pracovní list.

VIDEO:
- Název: "${videoTitle || 'Neznámý název'}"
- Autor: "${videoAuthor || 'Neznámý autor'}"
- URL: ${videoUrl}

ÚKOL:
Vytvoř strukturovaný vzdělávací text (v češtině), který bude sloužit jako základ pro pracovní list. Zaměř se na:

1. **Úvod** - O čem video pravděpodobně pojednává (2-3 věty)
2. **Hlavní témata** - 3-5 klíčových témat/konceptů
3. **Klíčové pojmy** - Definice 5-8 důležitých pojmů
4. **Diskuzní otázky** - 5-7 otázek pro žáky
5. **Fakta k zapamatování** - 5-8 důležitých faktů
6. **Praktické aktivity** - 2-3 návrhy aktivit
7. **Shrnutí** - Co by se žáci měli naučit

Piš v češtině. Výstup by měl být strukturovaný text.`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error('Gemini API failed');
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (content && content.length > 200) {
      console.log('[YouTubeTranscript] Generated content from Gemini, length:', content.length);
      return {
        success: true,
        transcript: `[Obsah generovaný AI na základě názvu videa]\n\n${content.trim()}`,
        videoTitle: videoTitle
      };
    }

    throw new Error('Prázdná odpověď z AI');
    
  } catch (error) {
    console.error('[YouTubeTranscript] Gemini error:', error);
    return {
      success: false,
      error: 'Video nemá dostupné titulky a nepodařilo se vygenerovat obsah'
    };
  }
}

/**
 * Fallback metoda - použije Gemini pro popis videa na základě URL
 */
async function getTranscriptFallback(videoUrl: string): Promise<TranscriptResult> {
  console.log('[YouTubeTranscript] Using fallback method');
  
  const videoId = extractYouTubeVideoId(videoUrl);
  
  try {
    // Zkusit získat informace o videu a nechat AI generovat obsah
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Pro YouTube video s URL: ${videoUrl}
              
Vytvoř vzdělávací obsah vhodný pro pracovní list. Zahrnuj:

1. **Úvod** - O čem video pravděpodobně pojednává (na základě URL/ID: ${videoId})
2. **Klíčové koncepty** - Obecné vzdělávací koncepty související s tématem
3. **Diskuzní otázky** - 3-5 otázek pro žáky
4. **Aktivity** - 2-3 návrhy aktivit

Poznámka: Bez přímého přístupu k videu vytváříme obecný vzdělávací obsah.
Odpověz v češtině.`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (content) {
      return {
        success: true,
        transcript: content.trim()
      };
    }
    
    return {
      success: false,
      error: 'Nepodařilo se získat obsah z videa'
    };
    
  } catch (error) {
    console.error('[YouTubeTranscript] Fallback error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    };
  }
}

/**
 * Generuje komplexní pracovní list z transkriptu pomocí AI
 */
export async function generateWorksheetFromTranscript(
  transcript: string,
  videoTitle: string,
  videoUrl?: string
): Promise<{
  success: boolean;
  blocks?: any[];
  title?: string;
  error?: string;
}> {
  console.log('[WorksheetGen] Generating from transcript, length:', transcript.length);
  
  if (!GEMINI_API_KEY) {
    return { success: false, error: 'Chybí Gemini API klíč' };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Jsi expert na tvorbu vzdělávacích pracovních listů pro základní a střední školy. Z následujícího obsahu vytvoř KOMPLEXNÍ a INTERAKTIVNÍ pracovní list pro žáky.

OBSAH VIDEA/ZDROJE:
${transcript}

Vytvoř pracovní list v JSON formátu. MUSÍŠ vytvořit MINIMÁLNĚ 12-15 různorodých bloků!

POVINNÁ STRUKTURA:
{
  "title": "Název pracovního listu (krátký, výstižný)",
  "blocks": [
    // 1. ÚVOD - nadpis a krátký úvodní text
    { "type": "heading", "content": { "text": "Úvodní nadpis", "level": "h1" } },
    { "type": "paragraph", "content": { "text": "Krátký úvodní text co se žáci naučí..." } },
    
    // 2. KLÍČOVÉ POJMY - infobox s důležitými pojmy
    { "type": "infobox", "content": { "title": "📚 Klíčové pojmy", "text": "Seznam klíčových pojmů a definic...", "variant": "info" } },
    
    // 3. SEKCE 1 - multiple choice otázky
    { "type": "heading", "content": { "text": "Test porozumění", "level": "h2" } },
    { "type": "multiple-choice", "content": { "question": "Otázka?", "options": ["A", "B", "C", "D"], "correctAnswer": 0 } },
    { "type": "multiple-choice", "content": { "question": "Další otázka?", "options": ["A", "B", "C", "D"], "correctAnswer": 1 } },
    
    // 4. SEKCE 2 - doplňovačky
    { "type": "heading", "content": { "text": "Doplň chybějící slova", "level": "h2" } },
    { "type": "fill-blank", "content": { "text": "Věta s ___ mezerou.", "blanks": [{"answer": "odpověď"}] } },
    
    // 5. SEKCE 3 - otevřené otázky
    { "type": "heading", "content": { "text": "Přemýšlej a odpověz", "level": "h2" } },
    { "type": "free-answer", "content": { "question": "Otevřená otázka?", "placeholder": "Napiš odpověď...", "lines": 4 } },
    
    // 6. PRAKTICKÁ ÚLOHA
    { "type": "heading", "content": { "text": "Praktická úloha", "level": "h2" } },
    { "type": "paragraph", "content": { "text": "Popis praktické úlohy nebo aktivity..." } },
    { "type": "free-answer", "content": { "question": "Napiš svůj závěr:", "placeholder": "...", "lines": 5 } },
    
    // 7. SHRNUTÍ
    { "type": "infobox", "content": { "title": "✅ Shrnutí", "text": "Co jsme se naučili...", "variant": "success" } }
  ]
}

TYPY BLOKŮ:
- "heading" - nadpisy (level: "h1", "h2", "h3")
- "paragraph" - odstavec textu
- "infobox" - zvýrazněný box (variant: "info", "warning", "success", "tip")
- "multiple-choice" - testová otázka s možnostmi (correctAnswer = index správné odpovědi 0-3)
- "fill-blank" - doplňovačka (___ označuje mezeru)
- "free-answer" - otevřená otázka (lines = počet řádků 2-6)

PRAVIDLA:
1. Vytvoř MINIMÁLNĚ 12-15 bloků!
2. Zahrň MIX všech typů úloh
3. Otázky musí testovat SKUTEČNÉ porozumění obsahu
4. Multiple-choice: vždy 4 možnosti, logické distraktory
5. Fill-blank: smysluplné věty z obsahu
6. Free-answer: otevřené otázky na přemýšlení
7. Infobox použij pro klíčové pojmy a shrnutí
8. Používej češtinu, poutavý styl pro žáky
9. Různorodé typy úloh - ne jen multiple-choice!

Odpověz POUZE validním JSON objektem, bez dalšího textu nebo markdown.`
            }]
          }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 16384,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WorksheetGen] API error:', errorText);
      throw new Error('API request failed');
    }

    const data = await response.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('[WorksheetGen] Raw response length:', content.length);
    
    // Parse JSON - remove markdown code blocks
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const parsed = JSON.parse(content);
    
    if (parsed.blocks && Array.isArray(parsed.blocks)) {
      const transformedBlocks: any[] = [];
      let order = 0;
      
      // Přidat QR kód na video jako první blok (pokud máme URL)
      if (videoUrl) {
        transformedBlocks.push({
          id: `gen-${Date.now()}-qr`,
          type: 'qr-code',
          order: order++,
          width: 'half',
          content: {
            url: videoUrl,
            caption: '📺 Naskenuj a podívej se na video',
            captionPosition: 'under',
            size: 120
          }
        });
      }
      
      // Transform AI generated blocks
      for (const block of parsed.blocks) {
        transformedBlocks.push({
          id: `gen-${Date.now()}-${order}`,
          type: mapBlockType(block.type),
          order: order++,
          width: block.type === 'infobox' ? 'full' : (order % 3 === 0 ? 'full' : 'full'),
          content: transformContent(block.type, block.content)
        });
      }
      
      console.log('[WorksheetGen] Generated', transformedBlocks.length, 'blocks');
      
      return {
        success: true,
        title: parsed.title || videoTitle,
        blocks: transformedBlocks
      };
    }
    
    return { success: false, error: 'Neplatný formát odpovědi' };
    
  } catch (error) {
    console.error('[WorksheetGen] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    };
  }
}

function mapBlockType(type: string): string {
  const typeMap: Record<string, string> = {
    'text': 'paragraph',
    'short-answer': 'free-answer',
    'fill-in-blank': 'fill-blank',
    'matching': 'paragraph',
    'ordering': 'paragraph',
  };
  return typeMap[type] || type;
}

function transformContent(type: string, content: any): any {
  if (!content) return { text: '' };
  
  switch (type) {
    case 'multiple-choice': {
      const correctIndex = content.correctAnswer || 0;
      const correctId = `opt-${correctIndex}`;
      return {
        question: content.question || '',
        options: (content.options || []).map((opt: string, i: number) => ({
          id: `opt-${i}`,
          text: opt,
          isCorrect: i === correctIndex
        })),
        correctAnswers: [correctId],
        allowMultiple: false
      };
    }
      
    case 'free-answer':
      return {
        question: content.question || '',
        placeholder: content.placeholder || 'Napište odpověď...',
        lines: content.lines || 4
      };
      
    case 'fill-blank':
      return {
        segments: parseFilLBlankText(content.text || '', content.blanks || [])
      };
      
    case 'infobox':
      return {
        title: content.title || 'Informace',
        text: content.text || '',
        html: `<p>${(content.text || '').replace(/\n/g, '<br/>')}</p>`,
        variant: content.variant || 'info'
      };
      
    case 'heading':
      return {
        text: content.text || '',
        level: content.level || 'h2'
      };
      
    case 'paragraph':
      const text = content.text || '';
      return {
        text: text,
        html: `<p>${text.replace(/\n/g, '<br/>')}</p>`
      };
      
    default:
      return content;
  }
}

function parseFilLBlankText(text: string, blanks: any[]): any[] {
  const segments: any[] = [];
  const parts = text.split('___');
  
  parts.forEach((part, i) => {
    if (part) {
      segments.push({ type: 'text', content: part });
    }
    if (i < blanks.length) {
      segments.push({
        type: 'blank',
        id: `blank-${i}`,
        answer: blanks[i]?.answer || '',
        userAnswer: ''
      });
    }
  });
  
  return segments;
}

