/**
 * worksheet-rag.ts
 *
 * Klientská utilita pro práci s RAG databází pracovních listů.
 * - Vyhledávání podobných příkladů před generováním
 * - Indexace kvalitních listů do databáze
 */

import { supabase } from './supabase/client';

// =====================================================
// TYPY
// =====================================================

export interface RagExample {
  id: string;
  title: string;
  subject: string;
  grade: number;
  topic: string;
  quality_score: number;
  blocks_json: unknown[];
  style_notes: string;
  similarity: number;
}

export interface RagSearchParams {
  topic: string;
  subject?: string;
  grade?: number;
  keyTerms?: string[];
  matchCount?: number;
  minQuality?: number;
}

/**
 * ContentPlan — výstup Agenta 1 (obsahový agent).
 * Popisuje CO bude na listu, bez layoutových rozhodnutí.
 */
export interface ContentPlan {
  title: string;
  learningGoal: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTimeMinutes: number;
  selectedImages: SelectedImage[];
  sections: ContentSection[];
}

export interface SelectedImage {
  url: string;
  title: string;
  description: string;
  license?: string;
  /** Kde Agent 2 (designér) obrázek umístí */
  suggestedPlacement: 'header' | 'intro' | 'alongside-section' | 'standalone';
  /** Ke které sekci obrázek patří (index do sections[]) */
  sectionIndex?: number;
  sectionHint?: string;
}

export interface ContentSection {
  type: 'intro' | 'vocabulary' | 'exercise-multiple-choice' | 'exercise-fill-blank'
      | 'exercise-free-answer' | 'exercise-connect-pairs' | 'timeline' | 'reading' | 'summary';
  title: string;
  /** Hlavní textový obsah sekce */
  content: string;
  /** Položky pro tabulky, seznamy, páry, odpovědi */
  items?: string[];
  /** Nápověda pro Agenta 2 (designéra) — jak tuto sekci vizuálně ztvárnit */
  layoutHint?: string;
}

// =====================================================
// RAG VYHLEDÁVÁNÍ
// =====================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Vyhledá podobné pracovní listy v RAG databázi.
 * Při selhání (prázdná DB, chyba sítě) vrátí prázdné pole — generování může pokračovat.
 */
export async function searchRagExamples(params: RagSearchParams): Promise<RagExample[]> {
  try {
    console.log('[RAG] Searching for similar worksheets:', params.topic);

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/worksheet-rag-search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      console.warn('[RAG] Search request failed:', response.status);
      return [];
    }

    const data = await response.json();

    if (data.fallback) {
      console.log('[RAG] Fallback (no examples yet or error):', data.reason);
      return [];
    }

    console.log(`[RAG] Found ${data.examples?.length || 0} examples`);
    return data.examples || [];

  } catch (err) {
    console.warn('[RAG] Search failed (soft fail):', err);
    return [];
  }
}

/**
 * Formátuje RAG příklady pro vložení do AI promptu.
 * @param examples - RAG příklady
 * @param mode - 'worksheet' | 'textbook' — mění label v promptu
 */
export function formatRagExamplesForPrompt(
  examples: RagExample[],
  mode: 'worksheet' | 'textbook' = 'worksheet'
): string {
  if (examples.length === 0) return '';

  const label = mode === 'textbook' ? 'LISTŮ UČEBNICE' : 'PRACOVNÍCH LISTŮ';

  // Aggregate stats across all examples
  const allBlockCounts: Record<string, number[]> = {};
  examples.forEach(ex => {
    const blocks = Array.isArray(ex.blocks_json) ? ex.blocks_json : [];
    const counts: Record<string, number> = {};
    blocks.forEach((b: any) => { if (b?.type) counts[b.type] = (counts[b.type] || 0) + 1; });
    Object.entries(counts).forEach(([type, cnt]) => {
      if (!allBlockCounts[type]) allBlockCounts[type] = [];
      allBlockCounts[type].push(cnt);
    });
  });
  const avgStats = Object.entries(allBlockCounts)
    .map(([type, counts]) => `${type}: průměrně ${Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)}x`)
    .join(', ');

  const lines = examples.map((ex, i) => {
    const blocks = Array.isArray(ex.blocks_json) ? ex.blocks_json : [];

    const blockTypeCounts = blocks.reduce((acc: Record<string, number>, b: any) => {
      if (b?.type) acc[b.type] = (acc[b.type] || 0) + 1;
      return acc;
    }, {});
    const blockSummary = Object.entries(blockTypeCounts)
      .map(([type, count]) => `${type}(${count}x)`)
      .join(', ') || 'neznámé';

    // Extract meaningful block details: headings, section titles, visual styles
    const blockDetails: string[] = [];
    blocks.forEach((b: any, idx: number) => {
      if (!b?.type) return;
      const c = b.content || {};
      if (b.type === 'heading') {
        const text = (c.text || '').replace(/<[^>]+>/g, '').trim().substring(0, 80);
        const style = c.headingStyle ? ` [styl: ${c.headingStyle}]` : '';
        const hl = c.highlightColor && c.highlightColor !== 'transparent' ? ` [barva: ${c.highlightColor}]` : '';
        if (text) blockDetails.push(`  ${idx + 1}. Nadpis: "${text}"${style}${hl}`);
      } else if (b.type === 'paragraph') {
        const text = (c.html || '').replace(/<[^>]+>/g, '').trim().substring(0, 120);
        if (text) blockDetails.push(`  ${idx + 1}. Odstavec: "${text}..."`);
      } else if (b.type === 'image') {
        const span = b.gridSpan ? ` [gridSpan: ${b.gridSpan}]` : '';
        blockDetails.push(`  ${idx + 1}. Obrázek${c.caption ? `: "${c.caption}"` : ''}${span}`);
      } else if (b.type === 'infobox') {
        const text = (c.html || '').replace(/<[^>]+>/g, '').trim().substring(0, 80);
        blockDetails.push(`  ${idx + 1}. Infobox${text ? `: "${text}..."` : ''}`);
      } else if (['connect-pairs', 'fill-blank', 'free-answer', 'multiple-choice'].includes(b.type)) {
        blockDetails.push(`  ${idx + 1}. [CVIČENÍ] ${b.type}`);
      } else {
        blockDetails.push(`  ${idx + 1}. ${b.type}`);
      }
    });

    const styleNotes = (ex.style_notes || '').startsWith('Vygenerováno Curriculum Factory')
      ? 'automaticky generovaný obsah'
      : (ex.style_notes || 'kvalitní obsah a struktura');

    return `
### VZOR ${i + 1}: "${ex.title}" (podobnost: ${Math.round((ex.similarity || 0) * 100)}%)
- Předmět: ${ex.subject || '–'}, Ročník: ${ex.grade || '–'}. třída, Téma: ${ex.topic || '–'}
- Počet bloků celkem: ${blocks.length} (${blockSummary})
- Sekvence bloků:
${blockDetails.slice(0, 15).join('\n')}
- Styl: ${styleNotes}`.trim();
  });

  return `
## ⚠️ ZÁVAZNÉ VZORY — POVINNĚ DODRŽUJ TUTO STRUKTURU

Níže jsou ${examples.length} kvalitní příklady ${label} z naší databáze se shodným tématem.
MUSÍŠ generovat obsah ve STEJNÉM stylu, stejném rozsahu a se STEJNÝMI typy bloků.

PRŮMĚRNÉ POČTY BLOKŮ v úspěšných příkladech: ${avgStats}
→ Tvůj výsledek MUSÍ mít PODOBNÉ počty bloků. Nesnižuj počet bloků oproti vzorům!
→ Zachovej stejný poměr OBRÁZKŮ a TEXTU jako ve vzorech.
→ Pokud vzory obsahují interaktivní bloky (cvičení), ZAHRŇ je také.

${lines.join('\n\n')}

SHRNUTÍ POŽADAVKŮ:
- Celkový počet bloků: ${Math.round(examples.reduce((s, ex) => s + (Array.isArray(ex.blocks_json) ? ex.blocks_json.length : 0), 0) / examples.length)} bloků (průměr ze vzorů)
- Struktura: kopíruj pořadí typů bloků z VZOR 1 (nejvyšší podobnost)
- NEDĚLEJ jednoduchý seznam — vytvoř vizuálně bohatý obsah jako ve vzorech
---`.trim();
}

/**
 * Converts the best RAG example's blocks_json into Agent 2's text block format.
 * This gives Agent 2 a concrete structural template to follow instead of abstract counts.
 */
export function formatRagAsLayoutTemplate(examples: RagExample[]): string {
  if (examples.length === 0) return '';

  // Use the highest-similarity example
  const best = examples[0];
  const blocks = Array.isArray(best.blocks_json) ? best.blocks_json : [];
  if (blocks.length === 0) return '';

  // Detect consecutive half-width pairs (same gridSpan ≤ 4, adjacent blocks)
  // Mark blocks that are paired side-by-side
  const gridSpans = blocks.map((b: any) => b.gridSpan ?? 6);
  const isHalfPair = (i: number) => {
    const span = gridSpans[i];
    if (span >= 6) return false;
    // Check if adjacent block also has reduced span (together they fill the row)
    const prev = gridSpans[i - 1] ?? 6;
    const next = gridSpans[i + 1] ?? 6;
    return (span + prev <= 6 && prev < 6) || (span + next <= 6 && next < 6);
  };

  const templateLines: string[] = [];
  blocks.forEach((b: any, i: number) => {
    if (!b?.type) return;
    const c = b.content || {};
    const span = b.gridSpan ?? 6;
    const isHalf = span <= 4 || isHalfPair(i);

    if (b.type === 'heading') {
      const level = c.level === 'h1' ? 'HEADING-H1' : 'HEADING';
      const hStyle = c.headingStyle && c.headingStyle !== 'plain' ? ` [styl: ${c.headingStyle}]` : '';
      templateLines.push(`${level}:${hStyle}`);
    } else if (b.type === 'paragraph') {
      const layout = isHalf ? 'PARAGRAPH: HALF LAYOUT' : 'PARAGRAPH';
      templateLines.push(`${layout}:`);
    } else if (b.type === 'image') {
      const layout = isHalf ? 'OBRÁZEK: HALF LAYOUT' : 'OBRÁZEK:';
      const caption = c.caption ? ` "${c.caption}"` : '';
      templateLines.push(`${layout}${caption}`);
    } else if (b.type === 'infobox') {
      const layout = isHalf ? 'INFOBOX: HALF LAYOUT' : 'INFOBOX:';
      templateLines.push(layout);
    } else if (b.type === 'table') {
      templateLines.push('TABLE:');
    } else if (b.type === 'multiple-choice') {
      templateLines.push('MULTIPLE-CHOICE:');
    } else if (b.type === 'fill-blank') {
      templateLines.push('FILL-BLANK:');
    } else if (b.type === 'free-answer') {
      templateLines.push('FREE-ANSWER:');
    } else if (b.type === 'connect-pairs') {
      templateLines.push('CONNECT-PAIRS:');
    }
  });

  if (templateLines.length === 0) return '';

  // Count block types in template for summary
  const typeCounts: Record<string, number> = {};
  templateLines.forEach(l => {
    const key = l.split(':')[0].trim();
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  });
  const typeCountStr = Object.entries(typeCounts).map(([k, v]) => `${k}×${v}`).join(', ');

  return `
## 📐 STRUKTURÁLNÍ ŠABLONA — POVINNĚ DODRŽUJ (z nejlepšího vzoru: "${best.title}", ${Math.round((best.similarity || 0) * 100)}% podobnost)

Tato sekvence bloků MUSÍ být zachována. Naplň každý blok jiným obsahem z ContentPlan:

${templateLines.map((line, i) => `${String(i + 1).padStart(2, ' ')}. ${line}`).join('\n')}

Shrnutí šablony: ${typeCountStr} = ${templateLines.length} bloků celkem
⚠️ NEDODÁVEJ méně bloků! Pokud ContentPlan nestačí, rozpiš texty do více odstavců.
---`.trim();
}

// =====================================================
// INDEXACE DO RAG DATABÁZE
// =====================================================

export interface AddToRagParams {
  worksheetId: string;
  title: string;
  subject: string;
  grade: number;
  topic: string;
  blocksJson: unknown[];
  styleNotes: string;
  qualityScore?: number;
}

/**
 * Přidá pracovní list do RAG databáze.
 * Embedding se vytváří na straně edge function.
 */
export async function addWorksheetToRag(params: AddToRagParams): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Sestavíme text pro embedding lokálně — embedding vytvoří edge function při search
    // Pro indexaci ukládáme přímo do DB (embedding bude NULL, doplní se při prvním vyhledávání)
    // teacher_worksheet_id is UUID in DB – only pass if it looks like a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.worksheetId);

    const { data, error } = await supabase
      .from('worksheet_rag_examples')
      .insert({
        title: params.title,
        subject: params.subject,
        grade: params.grade,
        topic: params.topic,
        quality_score: params.qualityScore ?? 0.8,
        blocks_json: params.blocksJson,
        style_notes: params.styleNotes,
        teacher_worksheet_id: isUuid ? params.worksheetId : null,
        created_by: user?.id ?? null,
        source: 'manual',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[RAG] Failed to add worksheet:', error);
      return { success: false, error: error.message };
    }

    // Spustíme embedding asynchronně — zavoláme edge function která ho vytvoří
    void triggerEmbeddingGeneration(data.id, params);

    console.log('[RAG] Worksheet added to RAG database:', data.id);
    return { success: true, id: data.id };

  } catch (err) {
    console.error('[RAG] addWorksheetToRag error:', err);
    return { success: false, error: String(err) };
  }
}

async function triggerEmbeddingGeneration(ragId: string, params: AddToRagParams): Promise<void> {
  try {
    console.log('[RAG] Triggering embedding generation for:', ragId);

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/worksheet-rag-index`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          ragId,
          topic: params.topic,
          subject: params.subject,
          grade: params.grade,
          styleNotes: params.styleNotes,
          blocksJson: params.blocksJson,
        }),
      }
    );

    if (!response.ok) {
      console.warn('[RAG] Embedding generation request failed:', response.status);
      return;
    }

    const data = await response.json();
    if (data.success) {
      console.log('[RAG] ✅ Embedding generated and saved for:', ragId);
    } else {
      console.warn('[RAG] Embedding generation returned error:', data.error);
    }
  } catch (err) {
    console.warn('[RAG] Embedding generation trigger failed (soft fail):', err);
  }
}
