-- Jednorázová migrace: referenční obrázky z design_systems.dataset.files → teacher_illustration_reference_library,
-- poté odstranění obrázků z dataset.files (zůstane text + ostatní klíče datasetu).
-- Spusť po vytvoření tabulky teacher_illustration_reference_library.

-- 1) Sloučit všechny obrázky (kind = image) podle učitele; u stejného id jen jeden výskyt.
WITH per_teacher_image AS (
  SELECT DISTINCT ON (ds.teacher_id, (elem->>'id'))
    ds.teacher_id,
    elem
  FROM public.design_systems ds
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ds.dataset->'files', '[]'::jsonb)) AS elem
  WHERE elem->>'kind' = 'image'
    AND coalesce(elem->>'id', '') <> ''
  ORDER BY ds.teacher_id, elem->>'id'
),
agg AS (
  SELECT
    teacher_id,
    jsonb_agg(elem ORDER BY elem->>'id') AS files_json
  FROM per_teacher_image
  GROUP BY teacher_id
)
INSERT INTO public.teacher_illustration_reference_library (teacher_id, files, updated_at)
SELECT teacher_id, files_json, now()
FROM agg
ON CONFLICT (teacher_id) DO UPDATE SET
  files = (
    SELECT COALESCE(jsonb_agg(d.e ORDER BY d.e->>'id'), '[]'::jsonb)
    FROM (
      SELECT DISTINCT ON ((e->>'id'))
        e
      FROM (
        SELECT jsonb_array_elements(COALESCE(public.teacher_illustration_reference_library.files, '[]'::jsonb)) AS e
        UNION ALL
        SELECT jsonb_array_elements(EXCLUDED.files) AS e
      ) u
      ORDER BY e->>'id'
    ) d
  ),
  updated_at = now();

-- 2) V každém design systému nechat v dataset.files jen netextové věci mimo image — typicky text.
UPDATE public.design_systems ds
SET dataset = jsonb_set(
  COALESCE(ds.dataset, '{}'::jsonb),
  '{files}',
  COALESCE(
    (
      SELECT jsonb_agg(elem ORDER BY ord)
      FROM jsonb_array_elements(COALESCE(ds.dataset->'files', '[]'::jsonb))
        WITH ORDINALITY AS t(elem, ord)
      WHERE elem->>'kind' IS DISTINCT FROM 'image'
    ),
    '[]'::jsonb
  )
)
WHERE ds.dataset IS NOT NULL
  AND jsonb_typeof(COALESCE(ds.dataset->'files', '[]'::jsonb)) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(ds.dataset->'files', '[]'::jsonb)) e
    WHERE e->>'kind' = 'image'
  );
