/**
 * Creates the design_systems table in Supabase via Management API.
 * Run: node scripts/create-design-systems-table.mjs
 *
 * Requires SUPABASE_ACCESS_TOKEN env var (get from https://supabase.com/dashboard/account/tokens)
 * Or set it directly below.
 */

const PROJECT_REF = 'njbtqmsxbyvpwigfceke';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

const SQL = `
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

CREATE INDEX IF NOT EXISTS design_systems_teacher_id_idx ON public.design_systems (teacher_id);

ALTER TABLE public.design_systems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teachers_own_design_systems" ON public.design_systems;
CREATE POLICY "teachers_own_design_systems"
  ON public.design_systems
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

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
`;

if (!ACCESS_TOKEN) {
  console.error('❌ Set SUPABASE_ACCESS_TOKEN env var.');
  console.error('   Get it from: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: SQL }),
});

const text = await res.text();
if (res.ok) {
  console.log('✅ design_systems table created successfully!');
} else {
  console.error('❌ Error:', text);
}
