/**
 * Generování pracovního listu z extrahovaného textu pomocí Gemini AI
 */

import { WorksheetBlock, createEmptyBlock } from '../types/worksheet';

// API klíč z environment variables
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * System prompt pro generování pracovního listu
 */
const WORKSHEET_GENERATION_PROMPT = `Jsi expert na tvorbu vzdělávacích materiálů pro české základní školy.

Na základě poskytnutého textu z dokumentu vytvoř pracovní list s různými typy cvičení.

## Typy bloků které můžeš vytvořit:

1. **heading** - Nadpis sekce
   \`\`\`json
   { "type": "heading", "content": { "text": "Nadpis", "level": "h1" } }
   \`\`\`

2. **text** - Odstavec textu
   \`\`\`json
   { "type": "text", "content": { "text": "Text odstavce..." } }
   \`\`\`

3. **multiple-choice** - Výběr z možností
   \`\`\`json
   {
     "type": "multiple-choice",
     "content": {
       "question": "Otázka?",
       "options": ["Možnost A", "Možnost B", "Možnost C", "Možnost D"],
       "correctIndex": 0
     }
   }
   \`\`\`

4. **fill-in-blank** - Doplňování do textu
   \`\`\`json
   {
     "type": "fill-in-blank",
     "content": {
       "textBefore": "Text před",
       "blank": "správná odpověď",
       "textAfter": "text po"
     }
   }
   \`\`\`

5. **short-answer** - Krátká odpověď
   \`\`\`json
   {
     "type": "short-answer",
     "content": {
       "question": "Otázka?",
       "expectedAnswer": "Očekávaná odpověď"
     }
   }
   \`\`\`

6. **matching** - Spojování párů
   \`\`\`json
   {
     "type": "matching",
     "content": {
       "instruction": "Spoj správně:",
       "pairs": [{ "left": "Levá", "right": "Pravá" }]
     }
   }
   \`\`\`

7. **ordering** - Řazení
   \`\`\`json
   {
     "type": "ordering",
     "content": {
       "instruction": "Seřaď:",
       "items": ["První", "Druhý", "Třetí"],
       "correctOrder": [0, 1, 2]
     }
   }
   \`\`\`

8. **table** - Tabulka (pro přehledné zobrazení dat, porovnání)
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
   - Používej tabulky pro přehledné zobrazení dat, porovnání, slovíčka

## Pravidla:
1. Vytvoř 6-10 různorodých cvičení
2. Začni nadpisem H1
3. Střídej typy úloh
4. Testuj porozumění hlavním konceptům
5. Správná čeština

## Formát odpovědi - POUZE validní JSON:
\`\`\`json
{
  "title": "Název pracovního listu",
  "blocks": [ ... ]
}
\`\`\``;

/**
 * Výsledek generování
 */
export interface GenerateFromTextResult {
  success: boolean;
  title?: string;
  blocks?: WorksheetBlock[];
  error?: string;
}

/**
 * Parsuje JSON z odpovědi AI
 */
function parseAIResponse(response: string): any {
  let cleaned = response.trim();
  
  // Odstranit markdown code block
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  
  cleaned = cleaned.trim();
  
  // Zkusit najít JSON objekt v textu
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  
  const parsed = JSON.parse(cleaned);
  
  // Normalizovat strukturu - někdy AI vrátí pole přímo
  if (Array.isArray(parsed)) {
    return { title: 'Pracovní list', blocks: parsed };
  }
  
  return parsed;
}

/**
 * Mapování typů z AI na interní typy
 * AI typy → Interní typy v aplikaci
 */
const TYPE_MAPPING: Record<string, string> = {
  // Text typy
  'text': 'paragraph',
  
  // Odpovědi
  'short-answer': 'free-answer',
  'long-answer': 'free-answer',
  'open-answer': 'free-answer',
  
  // Doplňování
  'fill-in-blank': 'fill-blank',
  'fill-in-the-blank': 'fill-blank',
  
  // Typy které neexistují - převedeme na free-answer nebo paragraph
  'matching': 'free-answer',      // Spojování → volná odpověď
  'ordering': 'free-answer',      // Řazení → volná odpověď
  'true-false': 'multiple-choice', // Pravda/nepravda → výběr
};

/**
 * Transformuje raw bloky z AI na WorksheetBlock
 */
function transformBlocks(rawBlocks: any[], startOrder: number = 0): WorksheetBlock[] {
  console.log('[WorksheetGen] Transforming', rawBlocks.length, 'blocks');
  
  const results: WorksheetBlock[] = [];
  
  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    
    if (!block || !block.type) {
      console.warn('[WorksheetGen] Skipping invalid block:', block);
      continue;
    }
    
    try {
      // Mapovat typ pokud je potřeba
      const mappedType = TYPE_MAPPING[block.type] || block.type;
      console.log('[WorksheetGen] Creating block:', mappedType, 'from', block.type);
      
      const worksheetBlock = createEmptyBlock(mappedType as any, startOrder + i);
      
      if (!worksheetBlock) {
        console.warn('[WorksheetGen] createEmptyBlock returned undefined for type:', mappedType);
        // Vytvořit paragraph jako fallback
        const fallback = createEmptyBlock('paragraph', startOrder + i);
        if (fallback && block.content?.text) {
          fallback.content = { html: block.content.text };
        }
        if (fallback) results.push(fallback);
        continue;
      }
      
      // Bezpečný merge contentu s konverzí pro různé typy
      if (block.content && typeof block.content === 'object') {
        // Speciální handling podle typu
        if (mappedType === 'paragraph' && block.content.text) {
          // text → paragraph (text → html)
          worksheetBlock.content = { html: block.content.text };
          
        } else if (mappedType === 'multiple-choice') {
          // Konverze AI formátu na interní formát
          // AI: {question, options: ["A", "B", "C"], correctIndex: 0}
          // Interní: {question, options: [{id, text}], correctAnswers: [id]}
          const aiOptions = block.content.options || [];
          const options = aiOptions.map((opt: string, idx: number) => ({
            id: `opt-${Date.now()}-${idx}`,
            text: opt
          }));
          const correctIdx = block.content.correctIndex ?? 0;
          const correctAnswers = options[correctIdx] ? [options[correctIdx].id] : [];
          
          worksheetBlock.content = {
            question: block.content.question || '',
            options,
            correctAnswers
          };
          
        } else if (mappedType === 'fill-blank') {
          // Konverze AI formátu na interní formát
          // AI: {textBefore, blank, textAfter}
          // Interní: {instruction?, segments: [{type: 'text'|'blank', content, correctAnswer}]}
          const segments = [];
          
          if (block.content.textBefore) {
            segments.push({ type: 'text', content: block.content.textBefore });
          }
          
          segments.push({ 
            type: 'blank', 
            content: '',
            correctAnswer: block.content.blank || block.content.correctAnswer || ''
          });
          
          if (block.content.textAfter) {
            segments.push({ type: 'text', content: block.content.textAfter });
          }
          
          worksheetBlock.content = {
            instruction: '',
            segments
          };
          
        } else if (mappedType === 'free-answer' && block.type === 'matching') {
          // matching → free-answer (převést pairs na text)
          const pairs = block.content.pairs || [];
          const pairsText = pairs.map((p: any) => `${p.left} → ${p.right}`).join('\n');
          worksheetBlock.content = { 
            question: block.content.instruction || 'Spoj správně:',
            lines: 4,
            hint: pairsText
          };
          
        } else if (mappedType === 'free-answer' && block.type === 'ordering') {
          // ordering → free-answer
          const items = block.content.items || [];
          worksheetBlock.content = { 
            question: block.content.instruction || 'Seřaď do správného pořadí:',
            lines: 4,
            hint: items.join(', ')
          };
          
        } else if (mappedType === 'free-answer' && (block.type === 'short-answer' || block.type === 'long-answer')) {
          // short-answer/long-answer → free-answer
          worksheetBlock.content = { 
            question: block.content.question || '',
            lines: 3,
            hint: block.content.expectedAnswer || block.content.hints || ''
          };
          
        } else {
          // Ostatní typy - přímý merge
          worksheetBlock.content = { ...worksheetBlock.content, ...block.content };
        }
      }
      
      results.push(worksheetBlock);
    } catch (err) {
      console.warn('[WorksheetGen] Failed to transform block:', block.type, err);
      // Vytvořit paragraph jako fallback
      const fallback = createEmptyBlock('paragraph', startOrder + i);
      if (fallback) {
        fallback.content = { html: block.content?.text || JSON.stringify(block) };
        results.push(fallback);
      }
    }
  }
  
  console.log('[WorksheetGen] Successfully created', results.length, 'blocks');
  return results;
}

/**
 * Generuje pracovní list z extrahovaného textu
 */
export async function generateWorksheetFromText(
  extractedText: string,
  fileName: string
): Promise<GenerateFromTextResult> {
  console.log('[WorksheetGen] Generating from text, length:', extractedText.length);
  
  if (!extractedText || extractedText.length < 50) {
    return {
      success: false,
      error: 'Text z dokumentu je příliš krátký nebo prázdný'
    };
  }
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: `Zde je text z dokumentu "${fileName}":\n\n---\n${extractedText}\n---\n\nVytvoř z tohoto pracovní list. Odpověz POUZE validním JSON.`
          }]
        }],
        systemInstruction: {
          parts: [{ text: WORKSHEET_GENERATION_PROMPT }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WorksheetGen] Gemini error:', errorText);
      throw new Error('Chyba při volání AI');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log('[WorksheetGen] Raw AI response:', text?.substring(0, 500));
    
    if (!text) throw new Error('AI nevrátila obsah');
    
    let parsed;
    try {
      parsed = parseAIResponse(text);
      console.log('[WorksheetGen] Parsed response:', {
        title: parsed?.title,
        blocksCount: parsed?.blocks?.length,
        firstBlock: parsed?.blocks?.[0]
      });
    } catch (parseError) {
      console.error('[WorksheetGen] Parse error:', parseError);
      console.error('[WorksheetGen] Failed to parse:', text);
      throw new Error('Nepodařilo se zparsovat odpověď AI');
    }
    
    if (!parsed.blocks || !Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      console.error('[WorksheetGen] No blocks in parsed response:', parsed);
      throw new Error('AI nevygenerovala žádné bloky');
    }
    
    const blocks = transformBlocks(parsed.blocks, 0);
    
    console.log('[WorksheetGen] Generated', blocks.length, 'blocks');
    
    return {
      success: true,
      title: parsed.title || fileName.replace(/\.[^.]+$/, ''),
      blocks
    };
    
  } catch (error) {
    console.error('[WorksheetGen] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    };
  }
}

// Keep old function for backwards compatibility but redirect to new one
export async function generateWorksheetFromPDF(
  filePath: string,
  fileName: string,
  mimeType: string
): Promise<GenerateFromTextResult> {
  // This should now use extracted text from the file
  // The caller should pass extractedText directly using generateWorksheetFromText
  return {
    success: false,
    error: 'Použijte generateWorksheetFromText s již extrahovaným textem'
  };
}
