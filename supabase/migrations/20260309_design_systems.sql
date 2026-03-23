-- Design Systems table
-- Stores reusable design kits (colors, fonts, AI prompts, block preferences)
-- that teachers can apply to multiple worksheet projects.

CREATE TABLE IF NOT EXISTS public.design_systems (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  description   text,
  thumbnail_color text      DEFAULT '#5C5CFF',
  colors        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  typography    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  page_defaults jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ai_prompts    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  block_preferences jsonb   NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-teacher lookups
CREATE INDEX IF NOT EXISTS design_systems_teacher_id_idx ON public.design_systems (teacher_id);

-- Row Level Security
ALTER TABLE public.design_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_own_design_systems"
  ON public.design_systems
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS design_systems_updated_at ON public.design_systems;
CREATE TRIGGER design_systems_updated_at
  BEFORE UPDATE ON public.design_systems
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
