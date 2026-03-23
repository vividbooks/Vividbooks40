-- ============================================================
-- RPC funkce pro čištění base64 z topic_data_sets
-- Běží přímo v DB — žádný přenos dat, žádný timeout
-- ============================================================

-- Odstraní generatedIllustrations, generatedPhotos a images s data: url
-- pro dávku řádků najednou (bez čtení obsahu)
CREATE OR REPLACE FUNCTION purge_base64_datasets(after_id TEXT DEFAULT NULL, batch_size INT DEFAULT 20)
RETURNS TABLE(id TEXT, action TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ds.id
    FROM topic_data_sets ds
    WHERE (after_id IS NULL OR ds.id > after_id)
      AND ds.media IS NOT NULL
    ORDER BY ds.id
    LIMIT batch_size
  LOOP
    -- Odstraň generatedIllustrations a generatedPhotos (vždy base64)
    UPDATE topic_data_sets
    SET media = media
      - 'generatedIllustrations'
      - 'generatedPhotos'
    WHERE topic_data_sets.id = r.id
      AND (
        media ? 'generatedIllustrations'
        OR media ? 'generatedPhotos'
      );

    id := r.id;
    IF FOUND THEN
      action := 'cleaned';
    ELSE
      action := 'skipped';
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Odstraní base64 z images[] pole
CREATE OR REPLACE FUNCTION purge_base64_dataset_images(after_id TEXT DEFAULT NULL, batch_size INT DEFAULT 10)
RETURNS TABLE(id TEXT, action TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ds.id
    FROM topic_data_sets ds
    WHERE (after_id IS NULL OR ds.id > after_id)
      AND ds.media IS NOT NULL
      AND ds.media ? 'images'
      AND jsonb_typeof(ds.media->'images') = 'array'
    ORDER BY ds.id
    LIMIT batch_size
  LOOP
    UPDATE topic_data_sets
    SET media = jsonb_set(
      media,
      '{images}',
      COALESCE(
        (SELECT jsonb_agg(img)
         FROM jsonb_array_elements(media->'images') img
         WHERE NOT (img->>'url' LIKE 'data:%')),
        '[]'::jsonb
      )
    )
    WHERE topic_data_sets.id = r.id
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(media->'images') img
        WHERE img->>'url' LIKE 'data:%'
      );

    id := r.id;
    IF FOUND THEN
      action := 'cleaned';
    ELSE
      action := 'skipped';
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Grant přístup pro service_role
GRANT EXECUTE ON FUNCTION purge_base64_datasets TO service_role;
GRANT EXECUTE ON FUNCTION purge_base64_dataset_images TO service_role;
