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

7. **image** - Obrázek (pro ilustrace, diagramy, fotografie)
   \`\`\`json
   {
     "type": "image",
     "content": {
       "url": "https://example.com/obrazek.jpg",
       "alt": "Popis obrázku pro přístupnost",
       "caption": "Volitelný titulek pod obrázkem",
       "size": "medium",
       "alignment": "center"
     }
   }
   \`\`\`
   - size: "small" | "medium" | "large" | "full"
   - alignment: "left" | "center" | "right"
   - Používej pouze pokud máš k dispozici URL obrázku v kontextu

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
 * Gemini API klíč
 */
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyDcPJrEcxThsVskj2LvYf6VB3mGTM45Ih0';

/**
 * Volá Gemini API
 */
async function callGeminiAPI(userMessage: string): Promise<string> {
  console.log('Calling Gemini API with gemini-2.5-flash...');
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }]
        }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Gemini API error:', errorData);
    throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('Gemini response received');
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
          type: 'infobox',
          order,
          width: 'full' as const,
          content: {
            title: block.content?.title,
            html: block.content?.html || '<p>Informace</p>',
            variant: block.content?.variant || 'blue',
          } as InfoboxContent,
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

      case 'image':
        return {
          id,
          type: 'image',
          order,
          width: 'full' as const,
          content: {
            url: block.content?.url || '',
            alt: block.content?.alt,
            caption: block.content?.caption,
            size: block.content?.size || 'medium',
            alignment: block.content?.alignment || 'center',
          } as ImageContent,
        };

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

