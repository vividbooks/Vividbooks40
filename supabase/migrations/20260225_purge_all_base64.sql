-- ============================================================
-- KOMPLETNÍ ČIŠTĚNÍ BASE64 – BATCH VERZE (timeout-safe)
-- 20260225 — spustit v Supabase SQL editoru
-- Každý krok zpracuje max. 200 řádků → žádný timeout
-- Spouštěj kroky 1–5 opakovaně dokud vrátí 0 affected rows,
-- pak pokračuj na další krok.
-- ============================================================

-- ══════════════════════════════════════════════════════════
-- KROK 1: topic_data_sets — smaž generatedIllustrations/Photos
-- Spouštěj dokud vrátí 0 rows
-- ══════════════════════════════════════════════════════════
UPDATE topic_data_sets
SET media = media - 'generatedIllustrations' - 'generatedPhotos'
WHERE id IN (
  SELECT id FROM topic_data_sets
  WHERE media ? 'generatedIllustrations' OR media ? 'generatedPhotos'
  LIMIT 200
);

-- ══════════════════════════════════════════════════════════
-- KROK 2: topic_data_sets — vyčisti images[] s data: url
-- Spouštěj dokud vrátí 0 rows
-- ══════════════════════════════════════════════════════════
UPDATE topic_data_sets
SET media = jsonb_set(
  media,
  '{images}',
  COALESCE(
    (SELECT jsonb_agg(img)
     FROM jsonb_array_elements(media->'images') AS img
     WHERE NOT (img->>'url' LIKE 'data:%')),
    '[]'::jsonb
  )
)
WHERE id IN (
  SELECT id FROM topic_data_sets
  WHERE media ? 'images'
    AND jsonb_typeof(media->'images') = 'array'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(media->'images') AS img
      WHERE img->>'url' LIKE 'data:%'
    )
  LIMIT 200
);

-- ══════════════════════════════════════════════════════════
-- KROK 3: teacher_worksheets — vyčisti blocks s data: src/url
-- Spouštěj dokud vrátí 0 rows
-- ══════════════════════════════════════════════════════════
UPDATE teacher_worksheets
SET content = jsonb_set(
  content,
  '{blocks}',
  COALESCE(
    (SELECT jsonb_agg(
      CASE
        WHEN (block->'content'->>'src' LIKE 'data:%')
          OR (block->'content'->>'url' LIKE 'data:%')
        THEN
          (block - 'content') || jsonb_build_object(
            'content',
            (block->'content')
              || '{"src":"","url":""}'::jsonb
          )
        ELSE block
      END
    )
    FROM jsonb_array_elements(content->'blocks') AS block),
    '[]'::jsonb
  )
)
WHERE id IN (
  SELECT id FROM teacher_worksheets
  WHERE content IS NOT NULL
    AND content ? 'blocks'
    AND jsonb_typeof(content->'blocks') = 'array'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(content->'blocks') AS block
      WHERE (block->'content'->>'src' LIKE 'data:%')
         OR (block->'content'->>'url' LIKE 'data:%')
    )
  LIMIT 200
);

-- ══════════════════════════════════════════════════════════
-- KROK 4: teacher_boards — vyčisti slides/blocks s data: src/url/image
-- Spouštěj dokud vrátí 0 rows
-- ══════════════════════════════════════════════════════════
UPDATE teacher_boards
SET slides = (
  SELECT jsonb_agg(
    jsonb_set(
      slide,
      '{blocks}',
      COALESCE(
        (SELECT jsonb_agg(
          CASE
            WHEN (block->'content'->>'src'   LIKE 'data:%')
              OR (block->'content'->>'url'   LIKE 'data:%')
              OR (block->'content'->>'image' LIKE 'data:%')
            THEN
              (block - 'content') || jsonb_build_object(
                'content',
                (block->'content')
                  || '{"src":"","url":"","image":""}'::jsonb
              )
            ELSE block
          END
        )
        FROM jsonb_array_elements(slide->'blocks') AS block),
        '[]'::jsonb
      )
    )
  )
  FROM jsonb_array_elements(slides) AS slide
)
WHERE id IN (
  SELECT id FROM teacher_boards
  WHERE slides IS NOT NULL
    AND jsonb_typeof(slides) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(slides) AS slide,
           jsonb_array_elements(COALESCE(slide->'blocks', '[]'::jsonb)) AS block
      WHERE (block->'content'->>'src'   LIKE 'data:%')
         OR (block->'content'->>'url'   LIKE 'data:%')
         OR (block->'content'->>'image' LIKE 'data:%')
    )
  LIMIT 50
);

-- ══════════════════════════════════════════════════════════
-- KROK 5a: Ověření topic_data_sets (rychlé — žádné array_elements)
-- ══════════════════════════════════════════════════════════
SELECT COUNT(*) AS zbývá_topic_data_sets
FROM topic_data_sets
WHERE media ? 'generatedIllustrations'
   OR media ? 'generatedPhotos'
   OR media::text LIKE '%data:image%';

-- ══════════════════════════════════════════════════════════
-- KROK 5b: Ověření teacher_worksheets (rychlé — LIMIT 1 na text scan)
-- ══════════════════════════════════════════════════════════
SELECT COUNT(*) AS zbývá_worksheets
FROM teacher_worksheets
WHERE content::text LIKE '%data:image%'
  AND id IN (
    SELECT id FROM teacher_worksheets
    WHERE content::text LIKE '%data:image%'
    LIMIT 500
  );

-- ══════════════════════════════════════════════════════════
-- KROK 5c: Ověření teacher_boards (rychlé — text scan)
-- ══════════════════════════════════════════════════════════
SELECT COUNT(*) AS zbývá_boards
FROM teacher_boards
WHERE slides::text LIKE '%data:image%'
  AND id IN (
    SELECT id FROM teacher_boards
    WHERE slides::text LIKE '%data:image%'
    LIMIT 500
  );

-- ══════════════════════════════════════════════════════════
-- KROK 6: Velikost tabulek po čištění
-- ══════════════════════════════════════════════════════════
SELECT
  relname AS tabulka,
  pg_size_pretty(pg_total_relation_size('public.' || relname)) AS celková_velikost,
  n_live_tup AS živé_řádky
FROM pg_stat_user_tables
WHERE relname IN ('topic_data_sets', 'teacher_boards', 'teacher_worksheets')
ORDER BY pg_total_relation_size('public.' || relname) DESC;

-- ══════════════════════════════════════════════════════════
-- KROK 7: VACUUM — spusť MANUÁLNĚ až bude vše 0
-- ══════════════════════════════════════════════════════════
-- VACUUM (VERBOSE, ANALYZE) topic_data_sets;
-- VACUUM (VERBOSE, ANALYZE) teacher_boards;
-- VACUUM (VERBOSE, ANALYZE) teacher_worksheets;
