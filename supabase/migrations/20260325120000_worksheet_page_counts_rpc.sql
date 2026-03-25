-- Rychlé zjištění počtu stran z JSON content (bez stahování celého obsahu klientem jen kvůli meta).
-- Používá se přehledem knihy Laiout při lehkém načtení řádků teacher_worksheets.
-- teacher_worksheets.id je TEXT (ne uuid) — parametr musí být text[].

DROP FUNCTION IF EXISTS public.worksheet_page_counts(uuid[]);

CREATE OR REPLACE FUNCTION public.worksheet_page_counts(p_ids text[])
RETURNS TABLE(id text, page_count integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT w.id,
    GREATEST(
      1,
      LEAST(
        500,
        COALESCE(
          CASE
            WHEN (w.content -> 'metadata' ->> 'pageCount') ~ '^[0-9]+$'
            THEN (w.content -> 'metadata' ->> 'pageCount')::integer
            ELSE NULL
          END,
          (
            SELECT COALESCE(MAX(COALESCE((elem ->> 'pageIndex')::integer, 0)), -1) + 1
            FROM jsonb_array_elements(COALESCE(w.content -> 'blocks', '[]'::jsonb)) AS elem
          ),
          1
        )
      )
    )::integer AS page_count
  FROM public.teacher_worksheets w
  WHERE w.id = ANY (p_ids)
    AND w.teacher_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.worksheet_page_counts(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worksheet_page_counts(text[]) TO authenticated;
