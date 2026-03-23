/**
 * AI Worksheet Generator
 * 
 * Utility pro generování pracovních listů pomocí AI (Anthropic Claude)
 */

import {
  Worksheet,
  WorksheetBlock,
  BlockType,
  HeadingContent,
  ParagraphContent,
  InfoboxContent,
  MultipleChoiceContent,
  FillBlankContent,
  FreeAnswerContent,
  ImageContent,
  Subject,
  Grade,
  generateBlockId,
} from '../types/worksheet';
import { AIAction, AIMessage, createAIMessage } from '../types/worksheet-editor';
import { chatWithAIProxy } from './ai-chat-proxy';

// ============================================
// TYPES
// ============================================

/**
 * Request pro AI generování
 */
export interface AIGenerateRequest {
  /** Uživatelský prompt */
  prompt: string;
  /** Kontext pracovního listu */
  context: {
    subject?: Subject;
    grade?: Grade;
    topic?: string;
    existingBlocks?: WorksheetBlock[];
  };
  /** API klíč (volitelný, může být v env) */
  apiKey?: string;
}

/**
 * Response z AI
 */
export interface AIGenerateResponse {
  /** Textová odpověď pro chat */
  message: string;
  /** Vygenerované bloky */
  blocks?: WorksheetBlock[];
  /** Navržené akce */
  suggestedActions?: AIAction[];
  /** Navržená metadata stránky (např. pageColumnLayout) */
  suggestedMetadata?: {
    pageColumnLayout?: 'single' | 'two-columns';
    twoColumnRatio?: number;
  };
  /** Chybová zpráva */
  error?: string;
}

/**
 * Struktura bloku vrácená z AI (před transformací)
 */
interface AIBlockOutput {
  type: BlockType;
  content: any;
}

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `Jsi expertní asistent pro tvorbu vzdělávacích pracovních listů pro české základní školy.

## KRITICKY DŮLEŽITÉ - PŘIZPŮSOBENÍ VĚKU:

Musíš VŽDY odhadnout cílovou věkovou skupinu podle tématu a přizpůsobit:
1. **Slovní zásobu** - jednodušší slova pro mladší děti
2. **Délku vět** - kratší a přehlednější pro mladší
3. **Složitost otázek** - přiměřenou věku
4. **Tón komunikace** - přátelský a povzbuzující

### Příklady odhadu věku podle tématu:

| Téma | Ročník | Věk | Jak psát |
|------|--------|-----|----------|
| Sčítání do 10 | 1. třída | 6-7 let | Velmi jednoduché věty, obrázky, hravý tón |
| Hmota a atomy | 6. třída | 11-12 let | Srozumitelné vysvětlení, ne příliš odborné termíny |
| Zlomky | 5. třída | 10-11 let | Praktické příklady ze života |
| Kvadratické rovnice | 9. třída | 14-15 let | Může být odbornější, ale stále srozumitelné |
| Starověký Egypt | 6. třída | 11-12 let | Zajímavosti, příběhy, ne suchá fakta |
| Fotosyntéza | 7. třída | 12-13 let | Vysvětlit proces jednoduše, s příklady |

### Pravidla pro 6. třídu (11-12 let):
- Jsou to STÁLE DĚTI, ne středoškoláci!
- Používej běžná slova, vysvětli odborné termíny
- Otázky formuluj jasně a jednoznačně
- Přidej zajímavosti a příklady ze života
- Vyhni se dlouhým složitým souvětím
- Buď přátelský: "Zkus přemýšlet...", "Vzpomeneš si...?"

### Pravidla pro 1.-3. třídu (6-9 let):
- Velmi krátké věty
- Základní slovní zásoba
- Hodně vizuální podpory v textu
- Hravý a povzbuzující tón
- Jednoduché otázky typu ANO/NE nebo výběr ze 2-3 možností

## Tvoje schopnosti:
- Vytváříš strukturované pracovní listy s různými typy bloků
- AUTOMATICKY odhaduješ věk podle tématu a přizpůsobuješ jazyk
- Používáš srozumitelný český jazyk přiměřený věku
- Vytváříš pestré a zajímavé úlohy

## Dostupné typy bloků:

1. **heading** - Nadpis
   \`\`\`json
   { "type": "heading", "content": { "text": "Text nadpisu", "level": "h1" | "h2" | "h3" } }
   \`\`\`

2. **paragraph** - Odstavec textu
   \`\`\`json
   { "type": "paragraph", "content": { "html": "<p>Text odstavce</p>" } }
   \`\`\`

3. **infobox** - Informační box (pro důležité informace, definice, tipy)
   \`\`\`json
   { "type": "infobox", "content": { "title": "Titulek", "html": "<p>Text</p>", "variant": "blue" | "green" | "yellow" | "purple" } }
   \`\`\`

4. **multiple-choice** - Otázka s výběrem odpovědí
   \`\`\`json
   {
     "type": "multiple-choice",
     "content": {
       "question": "Text otázky?",
       "options": [
         { "id": "a", "text": "Možnost A" },
         { "id": "b", "text": "Možnost B" },
         { "id": "c", "text": "Možnost C" }
       ],
       "correctAnswers": ["a"],
       "allowMultiple": false,
       "explanation": "Vysvětlení správné odpovědi"
     }
   }
   \`\`\`

5. **fill-blank** - Doplňování do textu
   \`\`\`json
   {
     "type": "fill-blank",
     "content": {
       "instruction": "Doplňte chybějící slova:",
       "segments": [
         { "type": "text", "content": "Hlavní město České republiky je " },
         { "type": "blank", "id": "b1", "correctAnswer": "Praha", "acceptedAnswers": ["Praha"] },
         { "type": "text", "content": "." }
       ]
     }
   }
   \`\`\`

6. **free-answer** - Otázka s volnou odpovědí
   \`\`\`json
   {
     "type": "free-answer",
     "content": {
       "question": "Otázka pro žáka?",
       "lines": 3,
       "hint": "Nápověda (volitelné)",
       "sampleAnswer": "Vzorová odpověď pro učitele"
     }
   }
   \`\`\`

7. **image** - Obrázek nebo galerie obrázků
   Jeden obrázek:
   \`\`\`json
   {
     "type": "image",
     "content": {
       "url": "https://example.com/obrazek.jpg",
       "alt": "Popis obrázku pro přístupnost",
       "caption": "Volitelný titulek pod obrázkem",
       "size": 100,
       "alignment": "center",
       "gallery": ["https://example.com/obrazek.jpg"],
       "galleryCaptions": ["Popisek k obrázku"],
       "gridColumns": 1
     }
   }
   \`\`\`
   Galerie více obrázků vedle sebe (např. 4 obrázky ve 2 sloupcích):
   \`\`\`json
   {
     "type": "image",
     "content": {
       "url": "https://example.com/img1.jpg",
       "alt": "Popis galerie",
       "caption": "Volitelný společný popisek",
       "size": 100,
       "alignment": "center",
       "gallery": [
         "https://example.com/img1.jpg",
         "https://example.com/img2.jpg",
         "https://example.com/img3.jpg",
         "https://example.com/img4.jpg"
       ],
       "galleryCaptions": ["Popisek 1", "Popisek 2", "Popisek 3", "Popisek 4"],
       "gridColumns": 2
     }
   }
   \`\`\`
   - size: číslo 10–200 (100 = původní velikost, <100 = zmenšení, >100 = ořez)
   - alignment: "left" | "center" | "right" (platí jen pro 1 obrázek)
   - gallery: pole URL adres obrázků (vždy vyplnit, i pro 1 obrázek)
   - gridColumns: 1 | 2 | 3 | 4 (počet sloupců v galerii)
   - Pro 4 obrázky vedle sebe použij gridColumns: 4; pro 2×2 použij gridColumns: 2
   - Používej pouze pokud máš k dispozici URL obrázků v kontextu

8. **table** - Tabulka (pro přehledné zobrazení dat, porovnání, seznamy)
   \`\`\`json
   {
     "type": "table",
     "content": {
       "html": "<table><thead><tr><th>Sloupec 1</th><th>Sloupec 2</th></tr></thead><tbody><tr><td>Data 1</td><td>Data 2</td></tr></tbody></table>",
       "rows": 3,
       "columns": 2,
       "hasHeader": true,
       "hasBorder": true,
       "hasRoundedCorners": true,
       "colorStyle": "blue"
     }
   }
   \`\`\`
   - colorStyle: "default" | "blue" | "green" | "purple" | "yellow" | "red" | "pink" | "cyan"
   - Používej tabulky pro:
     - Porovnání vlastností (např. živočichové, planety)
     - Přehled dat (např. historické události, chemické prvky)
     - Doplňovací cvičení v tabulkové formě
     - Slovíčka a jejich překlady
     - Matematické tabulky (násobky, převody jednotek)

## Formát odpovědi:

Vždy odpovídej v tomto JSON formátu:
\`\`\`json
{
  "message": "Krátká odpověď pro uživatele v češtině",
  "blocks": [
    // Pole bloků podle struktury výše
  ]
}
\`\`\`

## Pravidla:
- Odpovídej POUZE validním JSON
- Vytvárej obsah přiměřený zadanému ročníku
- Používej češtinu bez pravopisných chyb
- Pro matematiku používej správné matematické výrazy
- Vždy začni nadpisem (h1) s názvem pracovního listu
- Střídej různé typy úloh pro zajímavost
- U multiple-choice dávej 3-4 možnosti
- Správné odpovědi musí být vždy správné!
- Pokud jsou v kontextu dostupné obrázky (URL), můžeš je vložit jako image bloky tam, kde dávají smysl
- Obrázky vkládej pouze pokud máš platnou URL adresu`;

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Generuje pracovní list pomocí AI
 */
export async function generateWorksheetContent(
  request: AIGenerateRequest
): Promise<AIGenerateResponse> {
  const { prompt, context, apiKey } = request;

  // Build context string
  let contextStr = '';
  if (context.subject) {
    contextStr += `Předmět: ${getSubjectLabel(context.subject)}\n`;
  }
  if (context.grade) {
    contextStr += `Ročník: ${context.grade}. třída ZŠ\n`;
  }
  if (context.topic) {
    contextStr += `Téma: ${context.topic}\n`;
  }
  if (context.existingBlocks && context.existingBlocks.length > 0) {
    contextStr += `\nExistující bloky v pracovním listu: ${context.existingBlocks.length}\n`;
  }

  const userMessage = contextStr 
    ? `${contextStr}\nPožadavek: ${prompt}`
    : prompt;

  try {
    // Call Gemini API
    const response = await callGeminiAPI(userMessage);
    
    // Parse response
    const parsed = parseAIResponse(response);
    
    // Transform blocks (add IDs and order)
    if (parsed.blocks) {
      parsed.blocks = transformBlocks(parsed.blocks, context.existingBlocks?.length || 0);
    }

    return parsed;
  } catch (error) {
    console.error('AI generation error:', error);
    return {
      message: 'Omlouvám se, při generování došlo k chybě. Zkuste to prosím znovu.',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Volá Gemini API přes Supabase Edge Function (bezpečné - API klíč je na serveru)
 */
async function callGeminiAPI(userMessage: string): Promise<string> {
  console.log('Calling Gemini API via Supabase Edge Function...');
  
  const response = await chatWithAIProxy(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage }
    ],
    'gemini-2.5-flash',
    { 
      temperature: 0.7, 
      max_tokens: 8192 
    }
  );
  
  console.log('Gemini response received via proxy');
  return response;
}

/**
 * Volá Anthropic API (záložní)
 */
async function callAnthropicAPI(userMessage: string, apiKey?: string): Promise<string> {
  const key = apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('anthropic_api_key');
  
  if (!key) {
    // Demo mode - return mock response
    console.log('No API key found, using mock response');
    return generateMockResponse(userMessage);
  }

  console.log('Calling Anthropic API with Claude Sonnet...');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('API error:', errorData);
    throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('AI response received');
  return data.content[0]?.text || '';
}

/**
 * Parsuje AI odpověď
 */
function parseAIResponse(response: string): AIGenerateResponse {
  // Try to extract JSON from response
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                    response.match(/\{[\s\S]*"blocks"[\s\S]*\}/);
  
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      return {
        message: json.message || 'Pracovní list byl vygenerován.',
        blocks: json.blocks || [],
        suggestedActions: createActionsFromBlocks(json.blocks || []),
      };
    } catch (e) {
      console.error('JSON parse error:', e);
    }
  }

  // Fallback - return message only
  return {
    message: response || 'Odpověď byla vygenerována, ale nepodařilo se ji zpracovat.',
  };
}

/**
 * Transformuje bloky z AI - přidá ID, order a width: 'full'
 * DŮLEŽITÉ: Všechny bloky mají vždy width: 'full' - půl stránky se nastavuje
 * pouze při párování s obrázkem!
 */
function transformBlocks(blocks: AIBlockOutput[], startOrder: number): WorksheetBlock[] {
  return blocks.map((block, index) => {
    const id = generateBlockId();
    const order = startOrder + index;

    // Validate and transform based on type
    // ALWAYS set width: 'full' - half width is only for image+content pairs!
    switch (block.type) {
      case 'heading':
        return {
          id,
          type: 'heading',
          order,
          width: 'full' as const,
          content: {
            text: block.content?.text || 'Nadpis',
            level: block.content?.level || 'h2',
          } as HeadingContent,
        };

      case 'paragraph':
        return {
          id,
          type: 'paragraph',
          order,
          width: 'full' as const,
          content: {
            html: block.content?.html || '<p>Text odstavce</p>',
          } as ParagraphContent,
        };

      case 'infobox':
        return {
          id,
          type: 'paragraph',
          order,
          width: 'full' as const,
          content: {
            html: `<strong>${block.content?.title || 'Informace'}</strong><br/>${block.content?.html || '<p>Text infoboxu</p>'}`,
          } as ParagraphContent,
          visualStyles: {
            displayPreset: 'infobox',
            backgroundColor: (() => {
              const variant = block.content?.variant || 'blue';
              switch (variant) {
                case 'green': return '#dcfce7'; // green-100
                case 'yellow': return '#fef9c3'; // yellow-100
                case 'purple': return '#f3e8ff'; // purple-100
                case 'red': return '#fee2e2'; // red-100
                default: return '#dbeafe'; // blue-100
              }
            })(),
            borderColor: (() => {
              const variant = block.content?.variant || 'blue';
              switch (variant) {
                case 'green': return '#22c55e'; // green-500
                case 'yellow': return '#eab308'; // yellow-500
                case 'purple': return '#a855f7'; // purple-500
                case 'red': return '#ef4444'; // red-500
                default: return '#3b82f6'; // blue-500
              }
            })(),
            borderRadius: 12,
            shadow: 'none',
          }
        };

      case 'multiple-choice':
        return {
          id,
          type: 'multiple-choice',
          order,
          width: 'full' as const,
          content: {
            question: block.content?.question || 'Otázka?',
            options: (block.content?.options || []).map((opt: any, i: number) => ({
              id: opt.id || `opt-${i}`,
              text: opt.text || `Možnost ${i + 1}`,
            })),
            correctAnswers: block.content?.correctAnswers || [],
            allowMultiple: block.content?.allowMultiple || false,
            explanation: block.content?.explanation,
          } as MultipleChoiceContent,
        };

      case 'fill-blank':
        return {
          id,
          type: 'fill-blank',
          order,
          width: 'full' as const,
          content: {
            instruction: block.content?.instruction,
            segments: (block.content?.segments || []).map((seg: any, i: number) => {
              if (seg.type === 'blank') {
                return {
                  type: 'blank' as const,
                  id: seg.id || `blank-${i}`,
                  correctAnswer: seg.correctAnswer || '',
                  acceptedAnswers: seg.acceptedAnswers,
                };
              }
              return {
                type: 'text' as const,
                content: seg.content || '',
              };
            }),
          } as FillBlankContent,
        };

      case 'free-answer':
        return {
          id,
          type: 'free-answer',
          order,
          width: 'full' as const,
          content: {
            question: block.content?.question || 'Otázka?',
            lines: block.content?.lines || 3,
            hint: block.content?.hint,
            sampleAnswer: block.content?.sampleAnswer,
          } as FreeAnswerContent,
        };

      case 'image': {
        const rawGallery: string[] = Array.isArray(block.content?.gallery) ? block.content.gallery : [];
        const mainUrl = block.content?.url || rawGallery[0] || '';
        // Normalise gallery: always an array; if empty, seed with mainUrl
        const gallery = rawGallery.length > 0 ? rawGallery : (mainUrl ? [mainUrl] : []);
        // Normalise size: convert string variants to numeric
        const rawSize = block.content?.size;
        const size = typeof rawSize === 'number' ? rawSize
          : rawSize === 'small' ? 50
          : rawSize === 'large' ? 100
          : rawSize === 'full' ? 100
          : 100; // default / 'medium'
        return {
          id,
          type: 'image',
          order,
          width: 'full' as const,
          content: {
            url: mainUrl,
            alt: block.content?.alt,
            caption: block.content?.caption,
            size,
            alignment: block.content?.alignment || 'center',
            gallery,
            galleryCaptions: Array.isArray(block.content?.galleryCaptions) ? block.content.galleryCaptions : [],
            gridColumns: typeof block.content?.gridColumns === 'number' ? block.content.gridColumns : (gallery.length > 1 ? 2 : 1),
          } as ImageContent,
        };
      }

      default:
        // Fallback to paragraph
        return {
          id,
          type: 'paragraph',
          order,
          width: 'full' as const,
          content: {
            html: '<p>Neznámý typ bloku</p>',
          } as ParagraphContent,
        };
    }
  }) as WorksheetBlock[];
}

/**
 * Vytvoří akce z bloků pro UI
 */
function createActionsFromBlocks(blocks: any[]): AIAction[] {
  if (!blocks || blocks.length === 0) return [];

  return [
    {
      type: 'generate-content',
      description: `Přidat ${blocks.length} bloků do pracovního listu`,
      payload: {},
    },
  ];
}

// ============================================
// HELPERS
// ============================================

/**
 * Vrátí český název předmětu
 */
function getSubjectLabel(subject: Subject): string {
  const labels: Record<Subject, string> = {
    fyzika: 'Fyzika',
    chemie: 'Chemie',
    matematika: 'Matematika',
    prirodopis: 'Přírodopis',
    zemepis: 'Zeměpis',
    dejepis: 'Dějepis',
    cestina: 'Čeština',
    anglictina: 'Angličtina',
    other: 'Jiný předmět',
  };
  return labels[subject] || subject;
}

/**
 * Generuje mock odpověď pro demo bez API klíče
 */
function generateMockResponse(userMessage: string): string {
  // Extract topic from user message
  const topicMatch = userMessage.match(/téma[:\s]+([^\n]+)/i) ||
                     userMessage.match(/na\s+(.+?)(?:\s+pro|\s*$)/i);
  const topic = topicMatch?.[1]?.trim() || 'Základy';

  // Extract grade
  const gradeMatch = userMessage.match(/(\d+)\.\s*(?:třída|ročník)/i);
  const grade = gradeMatch ? parseInt(gradeMatch[1]) : 6;

  // Generate response based on detected content
  const response = {
    message: `Vytvořil jsem pracovní list na téma "${topic}" pro ${grade}. ročník. Obsahuje úvodní text, otázky s výběrem a doplňovací cvičení.`,
    blocks: [
      {
        type: 'heading',
        content: {
          text: `Pracovní list: ${topic}`,
          level: 'h1',
        },
      },
      {
        type: 'paragraph',
        content: {
          html: `<p>Tento pracovní list je určen pro žáky ${grade}. ročníku a zaměřuje se na téma ${topic.toLowerCase()}. Pečlivě si přečti zadání každé úlohy a odpovídej na otázky.</p>`,
        },
      },
      {
        type: 'infobox',
        content: {
          title: 'Důležité',
          html: '<p>Nezapomeň odpovídat celými větami a kontrolovat si pravopis!</p>',
          variant: 'blue',
        },
      },
      {
        type: 'heading',
        content: {
          text: 'Úloha 1: Otázky s výběrem odpovědi',
          level: 'h2',
        },
      },
      {
        type: 'multiple-choice',
        content: {
          question: `Která z následujících možností nejlépe vystihuje téma "${topic}"?`,
          options: [
            { id: 'a', text: 'První možnost' },
            { id: 'b', text: 'Druhá možnost' },
            { id: 'c', text: 'Třetí možnost' },
            { id: 'd', text: 'Čtvrtá možnost' },
          ],
          correctAnswers: ['b'],
          allowMultiple: false,
          explanation: 'Správná odpověď je B, protože...',
        },
      },
      {
        type: 'heading',
        content: {
          text: 'Úloha 2: Doplň chybějící slova',
          level: 'h2',
        },
      },
      {
        type: 'fill-blank',
        content: {
          instruction: 'Doplň do textu chybějící slova:',
          segments: [
            { type: 'text', content: `${topic} je důležité téma, které se zabývá ` },
            { type: 'blank', id: 'b1', correctAnswer: 'základy', acceptedAnswers: ['základy', 'principy'] },
            { type: 'text', content: ' a pomáhá nám pochopit ' },
            { type: 'blank', id: 'b2', correctAnswer: 'svět', acceptedAnswers: ['svět', 'okolí'] },
            { type: 'text', content: ' kolem nás.' },
          ],
        },
      },
      {
        type: 'heading',
        content: {
          text: 'Úloha 3: Otevřená otázka',
          level: 'h2',
        },
      },
      {
        type: 'free-answer',
        content: {
          question: `Vysvětli vlastními slovy, proč je téma "${topic}" důležité pro každodenní život.`,
          lines: 4,
          hint: 'Zamysli se nad příklady z běžného života.',
          sampleAnswer: `${topic} je důležité, protože nám pomáhá lépe rozumět světu kolem nás a využívat tyto znalosti v praxi.`,
        },
      },
    ],
  };

  return '```json\n' + JSON.stringify(response, null, 2) + '\n```';
}

// ============================================
// CHAT HELPERS
// ============================================

/**
 * Vytvoří AI zprávu z response
 */
export function createAIResponseMessage(response: AIGenerateResponse): AIMessage {
  return createAIMessage(
    'assistant',
    response.message,
    response.suggestedActions,
    response.blocks
  );
}

/**
 * Quick prompts pro prázdný pracovní list
 */
export const QUICK_PROMPTS_EMPTY = [
  {
    label: 'Nový pracovní list',
    prompt: 'Vytvoř kompletní pracovní list s informacemi a různými typy úloh',
    icon: '📝',
  },
  {
    label: 'Nový test',
    prompt: 'Vytvoř test s otázkami ABC a otevřenými otázkami',
    icon: '📋',
  },
  {
    label: 'Nová písemka',
    prompt: 'Vytvoř písemku pouze s otevřenými otázkami',
    icon: '✍️',
  },
  {
    label: 'Nový učební text',
    prompt: 'Vytvoř učební text s vysvětlením tématu a informačními boxy',
    icon: '📖',
  },
];

/**
 * Quick prompts pro pracovní list s obsahem
 */
export const QUICK_PROMPTS_WITH_CONTENT = [
  {
    label: 'Přidat otázku',
    prompt: 'Přidej otázku s výběrem odpovědí na aktuální téma',
    icon: '❓',
  },
  {
    label: 'Přidat doplňovačku',
    prompt: 'Vytvoř cvičení na doplňování slov do textu',
    icon: '✏️',
  },
  {
    label: 'Přidat infobox',
    prompt: 'Přidej informační box s důležitými fakty',
    icon: 'ℹ️',
  },
  {
    label: 'Přidat otevřenou otázku',
    prompt: 'Přidej otevřenou otázku na zamyšlení',
    icon: '💭',
  },
  {
    label: 'Více úloh',
    prompt: 'Přidej další 3 různorodé úlohy k procvičení',
    icon: '➕',
  },
];

/**
 * Legacy export pro zpětnou kompatibilitu
 */
export const QUICK_PROMPTS = QUICK_PROMPTS_EMPTY;

/**
 * Vytvoří přirozené shrnutí obsahu pracovního listu
 */
export function summarizeWorksheetContent(blocks: WorksheetBlock[]): string {
  if (!blocks || blocks.length === 0) return '';
  
  const counts: Record<string, number> = {};
  blocks.forEach(block => {
    counts[block.type] = (counts[block.type] || 0) + 1;
  });
  
  // Count question types
  const questionCount = (counts['multiple-choice'] || 0) + (counts['free-answer'] || 0) + (counts['fill-blank'] || 0);
  const hasInfoboxes = (counts['infobox'] || 0) > 0;
  const hasText = (counts['paragraph'] || 0) > 0;
  
  const parts: string[] = [];
  
  if (questionCount > 0) {
    if (questionCount === 1) {
      parts.push('jednu úlohu');
    } else if (questionCount < 5) {
      parts.push(`${questionCount} úlohy`);
    } else {
      parts.push(`${questionCount} úloh`);
    }
  }
  
  if (hasInfoboxes) {
    const count = counts['infobox'];
    parts.push(count === 1 ? 'informační box' : `${count} informační boxy`);
  }
  
  if (hasText) {
    parts.push('textové bloky');
  }
  
  if (parts.length === 0) {
    return 'základní strukturu';
  }
  
  return parts.join(', ');
}

/**
 * Vytvoří kontextovou úvodní zprávu AI
 */
export function createContextualGreeting(blocks: WorksheetBlock[], topic?: string): string {
  if (!blocks || blocks.length === 0) {
    return `Ahoj! 👋 Pracovní list je zatím prázdný – pojďme to změnit!

Co chceš vytvořit?
• **Pracovní list** – mix informací a různých cvičení
• **Test** – otázky s výběrem odpovědí + otevřené otázky  
• **Písemka** – jen otevřené otázky k zamyšlení
• **Učební text** – vysvětlení látky s infoboxes

Klikni na některou z rychlých akcí nebo mi napiš, co potřebuješ.`;
  }
  
  const summary = summarizeWorksheetContent(blocks);
  const topicInfo = topic ? ` „${topic}"` : '';
  
  // Different greetings based on content amount
  if (blocks.length < 5) {
    return `Ahoj! 👋 Koukám, že${topicInfo} máš rozděláno – zatím tam je ${summary}.

Co bys chtěl přidat? Můžu vygenerovat další otázky, doplňovačky nebo třeba shrnutí v infoboxu.`;
  }
  
  if (blocks.length < 15) {
    return `Ahoj! 👋 Pěkná práce${topicInfo}! Už máš ${summary}.

Chceš přidat něco dalšího? Třeba víc úloh k procvičení, nebo informační box se shrnutím?`;
  }
  
  return `Ahoj! 👋 Ten pracovní list${topicInfo} už je pořádně nabitý – ${summary} a další obsah.

Pokud potřebuješ ještě něco doladit nebo přidat, jsem tu pro tebe!`;
}

// ============================================
// BLOCK-LEVEL AI EDITING
// ============================================

/**
 * Request pro úpravu jednoho bloku pomocí AI
 */
export interface EditBlockRequest {
  block: WorksheetBlock;
  prompt: string;
  subject?: Subject;
  grade?: Grade;
  existingBlocks?: WorksheetBlock[];
}

/**
 * Response z úpravy bloku
 */
export interface EditBlockResponse {
  success: boolean;
  content?: any;
  error?: string;
}

/**
 * System prompt pro úpravu bloku
 */
const BLOCK_EDIT_SYSTEM_PROMPT = `Jsi expertní asistent pro úpravu vzdělávacího obsahu.

## Tvůj úkol:
Upravit nebo vytvořit obsah bloku podle uživatelova požadavku.

## Pravidla:
1. Odpovídej POUZE validním JSON s obsahem bloku
2. Zachovej strukturu odpovídající typu bloku
3. Používej češtinu bez pravopisných chyb
4. Pro matematiku používej správné výrazy
5. Buď kreativní, ale přiměřený úrovni žáků ZŠ

## Struktury podle typu bloku:

### heading (nadpis):
{ "text": "Text nadpisu", "level": "h1" | "h2" | "h3" }

### paragraph (odstavec):
{ "html": "<p>Text odstavce...</p>" }

### infobox (informační box):
{ "html": "<p>Obsah infoboxu...</p>", "variant": "blue" | "green" | "yellow" | "purple" }

### multiple-choice (výběr odpovědí):
{
  "question": "Otázka?",
  "options": [
    { "id": "opt1", "text": "Možnost 1" },
    { "id": "opt2", "text": "Možnost 2" },
    { "id": "opt3", "text": "Možnost 3" }
  ],
  "correctAnswers": ["opt1"],
  "allowMultiple": false
}

### fill-blank (doplňování):
{
  "question": "Doplň větu: Hlavní město ČR je ____.",
  "blanks": [{ "correctAnswer": "Praha" }]
}

### free-answer (volná odpověď):
{
  "question": "Otázka pro písemnou odpověď?",
  "lines": 3
}### table (tabulka):
{
  "rows": 3,
  "columns": 3,
  "cells": [
    [{ "content": "A1" }, { "content": "B1" }, { "content": "C1" }],
    [{ "content": "A2" }, { "content": "B2" }, { "content": "C2" }],
    [{ "content": "A3" }, { "content": "B3" }, { "content": "C3" }]
  ],
  "hasHeader": true
}

Odpověz POUZE JSON objektem s obsahem bloku, bez dalšího textu.`;

/**
 * Upraví blok pomocí AI
 */
export async function editBlockWithAI(request: EditBlockRequest): Promise<EditBlockResponse> {
  const { block, prompt, subject, grade, existingBlocks } = request;
  
  // Build context about the block
  const blockTypeLabel = getBlockTypeLabel(block.type);
  let contentDescription = '';
  
  if (block.content) {
    if ('text' in block.content && typeof block.content.text === 'string') {
      contentDescription = `Aktuální text: "${block.content.text}"`;
    } else if ('html' in block.content && typeof block.content.html === 'string') {
      contentDescription = `Aktuální obsah: "${block.content.html.replace(/<[^>]*>/g, '')}"`;
    } else if ('question' in block.content && typeof block.content.question === 'string') {
      contentDescription = `Aktuální otázka: "${block.content.question}"`;
    }
  }
  
  // Build context from existing blocks
  let worksheetContext = '';
  if (existingBlocks && existingBlocks.length > 0) {
    const contentParts: string[] = [];
    existingBlocks.forEach((b) => {
      if (b.id === block.id) return; // Skip current block
      const content = b.content as any;
      if (content?.text) {
        contentParts.push(content.text);
      } else if (content?.html) {
        const textOnly = content.html.replace(/<[^>]*>/g, '').trim();
        if (textOnly) contentParts.push(textOnly);
      } else if (content?.question) {
        contentParts.push(`Otázka: ${content.question}`);
      }
    });
    if (contentParts.length > 0) {
      worksheetContext = `\n## Obsah pracovního listu (pro kontext):\n${contentParts.slice(0, 5).join('\n---\n')}\n`;
    }
  }
  
  const userMessage = `Typ bloku: ${blockTypeLabel} (${block.type})
${contentDescription ? contentDescription + '\n' : ''}
${subject ? `Předmět: ${getSubjectLabel(subject)}\n` : ''}${grade ? `Ročník: ${grade}. třída ZŠ\n` : ''}${worksheetContext}
Požadavek uživatele: ${prompt}

Vytvoř nebo uprav obsah tohoto bloku podle požadavku. NAVAZUJ NA OBSAH PRACOVNÍHO LISTU, pokud je k dispozici. Odpověz POUZE validním JSON.`;

  try {
    const response = await chatWithAIProxy(
      [
        { role: 'system', content: BLOCK_EDIT_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      'gemini-2.5-flash',
      { temperature: 0.7, max_tokens: 2048 }
    );
    
    // Parse response
    const parsed = parseBlockEditResponse(response, block.type);
    
    if (parsed) {
      return { success: true, content: parsed };
    } else {
      return { success: false, error: 'Nepodařilo se zpracovat odpověď AI' };
    }
  } catch (error) {
    console.error('Block edit AI error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Neznámá chyba' 
    };
  }
}

/**
 * Parsuje odpověď pro úpravu bloku
 */
function parseBlockEditResponse(response: string, blockType: BlockType): any {
  try {
    // Try to extract JSON
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                      response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const json = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      
      // Validate basic structure based on type
      switch (blockType) {
        case 'heading':
          if (json.text) return json;
          break;
        case 'paragraph':
        case 'infobox':
          if (json.html || json.text) {
            // Convert text to html if needed
            if (!json.html && json.text) {
              json.html = `<p>${json.text}</p>`;
            }
            return json;
          }
          break;
        case 'multiple-choice':
          if (json.question && json.options) {
            // Ensure options have IDs
            json.options = json.options.map((opt: any, i: number) => ({
              id: opt.id || `opt${i + 1}`,
              text: opt.text || opt
            }));
            // Ensure correctAnswers is an array
            if (!json.correctAnswers) {
              json.correctAnswers = json.correctAnswer !== undefined 
                ? [json.options[json.correctAnswer]?.id || 'opt1']
                : [];
            }
            return json;
          }
          break;
        case 'fill-blank':
          if (json.question) {
            // Ensure blanks structure
            if (!json.blanks && json.answer) {
              json.blanks = [{ correctAnswer: json.answer }];
            }
            return json;
          }
          break;
        case 'free-answer':
          if (json.question) return json;
          break;
        case 'table':
          if (json.cells || json.rows) return json;
          break;
        default:
          return json;
      }
    }
    
    return null;
  } catch (e) {
    console.error('Parse block edit response error:', e);
    return null;
  }
}

/**
 * Vrátí český label pro typ bloku
 */
function getBlockTypeLabel(type: BlockType): string {
  const labels: Record<BlockType, string> = {
    'heading': 'Nadpis',
    'paragraph': 'Odstavec',
    'infobox': 'Informační box',
    'layout-section': 'Layout sekce',
    'multiple-choice': 'Výběr odpovědí',
    'fill-blank': 'Doplňování',
    'free-answer': 'Volná odpověď',
    'spacer': 'Volný prostor',
    'examples': 'Příklady',
    'image': 'Obrázek',
    'table': 'Tabulka',
    'connect-pairs': 'Spojovačka',
    'image-hotspots': 'Poznávačka',
    'video-quiz': 'Video kvíz',
    'qr-code': 'QR kód',
    'header-footer': 'Hlavička/Patička',
  };
  return labels[type] || type;
}