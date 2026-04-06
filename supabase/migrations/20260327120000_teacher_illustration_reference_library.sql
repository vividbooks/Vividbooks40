-- Jedna sdílená sada referenčních obrázků (URL v Storage) pro učitele — napříč všemi design systémy.
-- Obrázky se neukládají opakovaně do každého design_systems.dataset.

CREATE TABLE IF NOT EXISTS public.teacher_illustration_reference_library (
  teacher_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  files      jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.teacher_illustration_reference_library IS 'DatasetFile[] (kind image) — sdílené reference pro všechny design systémy učitele; nikdy base64';

ALTER TABLE public.teacher_illustration_reference_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_own_illustration_ref_library"
  ON public.teacher_illustration_reference_library
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP TRIGGER IF EXISTS teacher_illustration_reference_library_updated_at ON public.teacher_illustration_reference_library;
CREATE TRIGGER teacher_illustration_reference_library_updated_at
  BEFORE UPDATE ON public.teacher_illustration_reference_library
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
