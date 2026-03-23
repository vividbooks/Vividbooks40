/**
 * worksheet-rag-index
 *
 * Vytvoří Gemini embedding pro pracovní list a uloží ho do worksheet_rag_examples.
 * Volá se po přidání worksheetu do RAG databáze (přes addWorksheetToRag v klientovi).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IndexRequest {
  ragId: string;
  topic: string;
  subject?: string;
  grade?: number;
  styleNotes?: string;
  blocksJson?: unknown[];
}

async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  // DB uses vector(768) — all models must output 768 dimensions
  const candidates = [
    { model: 'gemini-embedding-001', outputDimensionality: 768 },
    { model: 'text-embedding-005', outputDimensionality: 768 },
    { model: 'text-embedding-004', outputDimensionality: undefined },
  ];
  for (const { model, outputDimensionality } of candidates) {
    const body: Record<string, unknown> = {
      model: `models/${model}`,
      content: { parts: [{ text }] },
      taskType: 'SEMANTIC_SIMILARITY',
    };
    if (outputDimensionality) body.outputDimensionality = outputDimensionality;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const values = data.embedding?.values as number[];
      console.log(`[RAG Index] Model ${model} succeeded, dims: ${values?.length}`);
      return values;
    }
    const err = await response.text();
    console.warn(`[RAG Index] Model ${model} failed:`, err.substring(0, 300));
  }
  throw new Error('All embedding models failed');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ragId, topic, subject, grade, styleNotes, blocksJson }: IndexRequest = await req.json();

    if (!ragId || !topic) {
      throw new Error('ragId and topic are required');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY_RAG') || Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('No Gemini API key configured (GEMINI_API_KEY_RAG or GEMINI_API_KEY)');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Sestavíme text pro embedding z tématu, předmětu, ročníku a style_notes
    const blocks = Array.isArray(blocksJson) ? blocksJson : [];
    const blockTypes = blocks
      .map((b: any) => b.type)
      .filter(Boolean)
      .join(', ');

    const embeddingText = [
      `Téma: ${topic}`,
      subject ? `Předmět: ${subject}` : '',
      grade ? `Ročník: ${grade}. třída` : '',
      styleNotes ? `Popis: ${styleNotes}` : '',
      blockTypes ? `Typy bloků: ${blockTypes}` : '',
    ].filter(Boolean).join('\n');

    console.log('[RAG Index] Creating embedding for ragId:', ragId);
    console.log('[RAG Index] Text:', embeddingText.substring(0, 200));

    const embedding = await createEmbedding(embeddingText, GEMINI_API_KEY);
    console.log('[RAG Index] Embedding created, dimensions:', embedding.length);

    // Ulož embedding do DB
    const { error } = await supabase
      .from('worksheet_rag_examples')
      .update({ embedding })
      .eq('id', ragId);

    if (error) {
      throw new Error(`Failed to update embedding: ${error.message}`);
    }

    console.log('[RAG Index] ✅ Embedding saved for:', ragId);

    return new Response(
      JSON.stringify({ success: true, ragId, dimensions: embedding.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RAG Index] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
