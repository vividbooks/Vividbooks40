/**
 * worksheet-rag-search
 *
 * Hledá podobné pracovní listy v RAG databázi pomocí Gemini embeddingů.
 * Používá pgvector cosine similarity search přes RPC funkci search_worksheet_rag.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RagSearchRequest {
  topic: string;
  subject?: string;
  grade?: number;
  keyTerms?: string[];
  matchCount?: number;
  minQuality?: number;
}

interface RagExample {
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
      console.log(`[RAG Search] Model ${model} succeeded, dims: ${values?.length}`);
      return values;
    }
    const err = await response.text();
    console.warn(`[RAG Search] Model ${model} failed:`, err.substring(0, 300));
  }
  throw new Error('All embedding models failed');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      topic,
      subject,
      grade,
      keyTerms = [],
      matchCount = 3,
      minQuality = 0.6,
    }: RagSearchRequest = await req.json();

    if (!topic) {
      throw new Error('topic is required');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY_RAG') || Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('No Gemini API key configured');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Sestav vyhledávací text z tématu + klíčových slov
    const queryText = [
      `Téma: ${topic}`,
      subject ? `Předmět: ${subject}` : '',
      grade ? `Ročník: ${grade}. třída` : '',
      keyTerms.length > 0 ? `Klíčová slova: ${keyTerms.slice(0, 10).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    console.log('[RAG Search] Creating embedding for:', queryText.substring(0, 100));

    const embedding = await createEmbedding(queryText, GEMINI_API_KEY);

    console.log('[RAG Search] Embedding created, dimensions:', embedding.length);

    // Vektorové vyhledávání přes RPC
    const { data: results, error } = await supabase.rpc('search_worksheet_rag', {
      query_embedding: embedding,
      filter_subject: subject || null,
      filter_grade: grade || null,
      match_count: matchCount,
      min_quality: minQuality,
    });

    if (error) {
      console.error('[RAG Search] RPC error:', error);
      // Pokud pgvector není dostupný nebo tabulka je prázdná, vrátíme prázdný výsledek
      return new Response(
        JSON.stringify({ success: true, examples: [], fallback: true, reason: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const examples: RagExample[] = results || [];

    console.log(`[RAG Search] Found ${examples.length} similar worksheets`);

    return new Response(
      JSON.stringify({ success: true, examples }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RAG Search] Error:', error);
    // Soft fail — generování může pokračovat bez RAG
    return new Response(
      JSON.stringify({
        success: true,
        examples: [],
        fallback: true,
        reason: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
