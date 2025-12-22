/**
 * YouTube Transcript Extractor
 * Extrahuje titulky/přepis z YouTube videí pro AI generování
 */

const GEMINI_API_KEY = (typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null) || import.meta.env.VITE_GEMINI_API_KEY || '';

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
 * Získá transcript z YouTube videa pomocí Gemini API
 * Gemini může přímo analyzovat YouTube videa
 */
export async function getYouTubeTranscript(videoUrl: string): Promise<TranscriptResult> {
  console.log('[YouTubeTranscript] Starting extraction for:', videoUrl);
  
  if (!GEMINI_API_KEY) {
    console.error('[YouTubeTranscript] No API key');
    return { success: false, error: 'Chybí Gemini API klíč' };
  }

  try {
    // Gemini 2.0 Flash může analyzovat YouTube videa přímo
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                fileData: {
                  fileUri: videoUrl,
                  mimeType: 'video/mp4'
                }
              },
              {
                text: `Analyzuj toto video a vytvoř podrobný přepis/transcript obsahu.
                
Pokud je video v angličtině, přelož ho do češtiny.

Zaměř se na:
1. Hlavní témata a koncepty
2. Klíčové body a myšlenky
3. Důležité informace a fakta
4. Závěry a shrnutí

Výstup by měl být strukturovaný text, který lze použít jako základ pro vytvoření pracovního listu.`
              }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[YouTubeTranscript] API error:', errorText);
      
      // Fallback - zkusit extrakci titulků jiným způsobem
      return await getTranscriptFallback(videoUrl);
    }

    const data = await response.json();
    console.log('[YouTubeTranscript] Response:', data);
    
    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (transcript) {
      return {
        success: true,
        transcript: transcript.trim()
      };
    }
    
    return await getTranscriptFallback(videoUrl);
    
  } catch (error) {
    console.error('[YouTubeTranscript] Error:', error);
    return await getTranscriptFallback(videoUrl);
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
 * Generuje pracovní list z transkriptu pomocí AI
 */
export async function generateWorksheetFromTranscript(
  transcript: string,
  videoTitle: string
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
              text: `Jsi expert na tvorbu vzdělávacích pracovních listů. Z následujícího obsahu vytvoř interaktivní pracovní list pro žáky.

OBSAH:
${transcript}

Vytvoř pracovní list v JSON formátu s následující strukturou:
{
  "title": "Název pracovního listu",
  "blocks": [
    {
      "type": "heading",
      "content": { "text": "Nadpis sekce", "level": "h2" }
    },
    {
      "type": "paragraph",
      "content": { "text": "Úvodní text nebo vysvětlení" }
    },
    {
      "type": "multiple-choice",
      "content": {
        "question": "Otázka?",
        "options": ["Možnost A", "Možnost B", "Možnost C", "Možnost D"],
        "correctAnswer": 0
      }
    },
    {
      "type": "free-answer",
      "content": {
        "question": "Otázka pro písemnou odpověď?",
        "placeholder": "Zde napiš svou odpověď..."
      }
    },
    {
      "type": "fill-blank",
      "content": {
        "text": "Doplňte: Správná odpověď je ___.",
        "blanks": [{ "answer": "správná odpověď" }]
      }
    }
  ]
}

PRAVIDLA:
1. Začni krátkým úvodem (heading + paragraph)
2. Zahrň mix typů úloh (multiple-choice, free-answer, fill-blank)
3. Otázky by měly testovat porozumění obsahu
4. Používej češtinu
5. Vytvoř 8-12 bloků

Odpověz POUZE validním JSON objektem, bez dalšího textu.`
            }]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 8192,
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse JSON
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const parsed = JSON.parse(content);
    
    if (parsed.blocks && Array.isArray(parsed.blocks)) {
      // Transform blocks to match internal format
      const transformedBlocks = parsed.blocks.map((block: any, index: number) => ({
        id: `gen-${Date.now()}-${index}`,
        type: mapBlockType(block.type),
        order: index,
        width: 'full' as const,
        content: transformContent(block.type, block.content)
      }));
      
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
        correctAnswers: [correctId], // Required by MultipleChoiceContent interface
        allowMultiple: false
      };
    }
      
    case 'free-answer':
      return {
        question: content.question || '',
        placeholder: content.placeholder || 'Napište odpověď...',
        lines: 3
      };
      
    case 'fill-blank':
      return {
        segments: parseFilLBlankText(content.text || '', content.blanks || [])
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

