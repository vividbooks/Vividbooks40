/**
 * purge-base64 v2 — dvoufázové čištění, odolné vůči timeoutům
 *
 * Fáze 1: načti pouze IDs (žádná data = rychlé)
 * Fáze 2: každý řádek zpracuj individuálně
 *   - pokud fetch selže (timeout), přepiš data na prázdná (board byl nepoužitelný)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const body = await req.json().catch(() => ({}))
  const { table = 'teacher_boards', batch = 3, after_id = null } = body

  let result: Record<string, unknown>

  if (table === 'teacher_boards') {
    result = await purgeBoards(supabase, batch, after_id)
  } else if (table === 'teacher_worksheets') {
    result = await purgeWorksheets(supabase, batch, after_id)
  } else if (table === 'topic_data_sets') {
    result = await purgeTopicDataSets(supabase, batch, after_id)
  } else {
    return new Response(JSON.stringify({ error: `Unknown table: ${table}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

// ─── teacher_boards ───────────────────────────────────────────────────────────

async function purgeBoards(supabase: ReturnType<typeof createClient>, batch: number, afterId: string | null) {
  // Fáze 1: načti jen IDs — rychlé, žádná JSONB data
  let idQuery = supabase
    .from('teacher_boards')
    .select('id')
    .order('id')
    .limit(batch)
  if (afterId) idQuery = idQuery.gt('id', afterId)

  const { data: idRows, error: idErr } = await idQuery
  if (idErr) return { processed: 0, done: false, next_id: afterId, message: `ID fetch error: ${idErr.message}` }
  if (!idRows || idRows.length === 0) return { processed: 0, done: true, next_id: null, message: 'No more boards' }

  const lastId = idRows[idRows.length - 1].id
  let cleaned = 0, skipped = 0, nuked = 0, errors = 0

  // Fáze 2: zpracuj každý board individuálně
  for (const { id } of idRows) {
    const { data: row, error: fetchErr } = await supabase
      .from('teacher_boards')
      .select('id, slides')
      .eq('id', id)
      .single()

    if (fetchErr) {
      // Timeout nebo jiná chyba — přepiš slides na [] (board byl nepoužitelný)
      console.warn(`Board ${id} fetch timeout — nuking slides`)
      const { error: nukeErr } = await supabase
        .from('teacher_boards')
        .update({ slides: [] })
        .eq('id', id)
      if (!nukeErr) nuked++
      else errors++
      continue
    }

    const slidesText = JSON.stringify(row.slides ?? [])
    const hasBase64 = hasBase64Content(slidesText)

    if (!hasBase64) {
      skipped++
      continue
    }

    const cleanedSlides = stripBase64FromSlides(row.slides)
    const { error: updateErr } = await supabase
      .from('teacher_boards')
      .update({ slides: cleanedSlides })
      .eq('id', id)

    if (!updateErr) cleaned++
    else errors++
  }

  return {
    processed: cleaned + nuked,
    done: idRows.length < batch,
    next_id: idRows.length < batch ? null : lastId,
    message: `Batch ${idRows.length}: cleaned=${cleaned}, skipped=${skipped}, nuked(timeout)=${nuked}, errors=${errors}`,
  }
}

// ─── teacher_worksheets ───────────────────────────────────────────────────────

async function purgeWorksheets(supabase: ReturnType<typeof createClient>, batch: number, afterId: string | null) {
  let idQuery = supabase
    .from('teacher_worksheets')
    .select('id')
    .order('id')
    .limit(batch)
  if (afterId) idQuery = idQuery.gt('id', afterId)

  const { data: idRows, error: idErr } = await idQuery
  if (idErr) return { processed: 0, done: false, next_id: afterId, message: `ID fetch error: ${idErr.message}` }
  if (!idRows || idRows.length === 0) return { processed: 0, done: true, next_id: null, message: 'No more worksheets' }

  const lastId = idRows[idRows.length - 1].id
  let cleaned = 0, skipped = 0, nuked = 0, errors = 0

  for (const { id } of idRows) {
    const { data: row, error: fetchErr } = await supabase
      .from('teacher_worksheets')
      .select('id, content')
      .eq('id', id)
      .single()

    if (fetchErr) {
      console.warn(`Worksheet ${id} fetch timeout — clearing blocks`)
      const { error: nukeErr } = await supabase
        .from('teacher_worksheets')
        .update({ content: { blocks: [] } })
        .eq('id', id)
      if (!nukeErr) nuked++
      else errors++
      continue
    }

    const text = JSON.stringify(row.content ?? {})
    if (!hasBase64Content(text)) { skipped++; continue }

    const cleanedContent = stripBase64Deep(row.content)
    const { error: updateErr } = await supabase
      .from('teacher_worksheets')
      .update({ content: cleanedContent })
      .eq('id', id)

    if (!updateErr) cleaned++
    else errors++
  }

  return {
    processed: cleaned + nuked,
    done: idRows.length < batch,
    next_id: idRows.length < batch ? null : lastId,
    message: `Batch ${idRows.length}: cleaned=${cleaned}, skipped=${skipped}, nuked=${nuked}, errors=${errors}`,
  }
}

// ─── topic_data_sets ──────────────────────────────────────────────────────────

async function purgeTopicDataSets(supabase: ReturnType<typeof createClient>, batch: number, afterId: string | null) {
  let idQuery = supabase
    .from('topic_data_sets')
    .select('id')
    .order('id')
    .limit(batch)
  if (afterId) idQuery = idQuery.gt('id', afterId)

  const { data: idRows, error: idErr } = await idQuery
  if (idErr) return { processed: 0, done: false, next_id: afterId, message: `ID fetch error: ${idErr.message}` }
  if (!idRows || idRows.length === 0) return { processed: 0, done: true, next_id: null, message: 'No more datasets' }

  const lastId = idRows[idRows.length - 1].id
  let cleaned = 0, skipped = 0, nuked = 0, errors = 0

  for (const { id } of idRows) {
    const { data: row, error: fetchErr } = await supabase
      .from('topic_data_sets')
      .select('id, media')
      .eq('id', id)
      .single()

    if (fetchErr) {
      console.warn(`Dataset ${id} fetch timeout — clearing media`)
      const { error: nukeErr } = await supabase
        .from('topic_data_sets')
        .update({ media: {} })
        .eq('id', id)
      if (!nukeErr) nuked++
      else errors++
      continue
    }

    const text = JSON.stringify(row.media ?? {})
    const hasDirty = hasBase64Content(text) || row.media?.generatedIllustrations || row.media?.generatedPhotos

    if (!hasDirty) { skipped++; continue }

    const cleanedMedia = stripBase64Deep({
      ...row.media,
      generatedIllustrations: undefined,
      generatedPhotos: undefined,
    })

    const { error: updateErr } = await supabase
      .from('topic_data_sets')
      .update({ media: cleanedMedia })
      .eq('id', id)

    if (!updateErr) cleaned++
    else errors++
  }

  return {
    processed: cleaned + nuked,
    done: idRows.length < batch,
    next_id: idRows.length < batch ? null : lastId,
    message: `Batch ${idRows.length}: cleaned=${cleaned}, skipped=${skipped}, nuked=${nuked}, errors=${errors}`,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasBase64Content(text: string): boolean {
  return (
    text.includes('data:image') ||
    text.includes('data:application') ||
    text.includes('data:video') ||
    // Raw base64 signatures bez data: prefixu
    text.includes('/9j/4') ||      // JPEG
    text.includes('iVBORw0KGgo') || // PNG
    text.includes('R0lGOD')         // GIF
  )
}

function stripBase64FromSlides(slides: unknown[]): unknown[] {
  if (!Array.isArray(slides)) return []
  return slides.map((slide: any) => ({
    ...slide,
    blocks: Array.isArray(slide?.blocks)
      ? slide.blocks.map(stripBase64FromBlock)
      : [],
  }))
}

function stripBase64FromBlock(block: any): any {
  if (!block?.content) return block
  const c = block.content
  const updates: Record<string, string> = {}

  for (const key of ['src', 'url', 'image', 'data', 'backgroundImage']) {
    if (typeof c[key] === 'string' && hasBase64Content(c[key])) {
      updates[key] = ''
    }
  }

  if (Object.keys(updates).length === 0) return block
  return { ...block, content: { ...c, ...updates } }
}

function stripBase64Deep(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return hasBase64Content(obj) ? '' : obj
  }
  if (Array.isArray(obj)) return obj.map(stripBase64Deep)
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === undefined) continue
      result[k] = stripBase64Deep(v)
    }
    return result
  }
  return obj
}
