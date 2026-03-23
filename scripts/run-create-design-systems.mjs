/**
 * Creates design_systems table via Supabase REST + service_role key.
 * We create a temporary helper RPC function first, then drop it.
 */

const SUPABASE_URL = 'https://njbtqmsxbyvpwigfceke.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYnRxbXN4Ynl2cHdpZ2ZjZWtlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgzNzM4OSwiZXhwIjoyMDc4NDEzMzg5fQ.N-WSwZMAKWGrDWNsfYzFLG8iOgMS6o-CQNmh49p9Vcw';

// Step 1: Create a helper execute function via REST
const createFnSQL = `
CREATE OR REPLACE FUNCTION public._tmp_exec(sql text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN EXECUTE sql; END;
$$;
`;

// Step 2: The actual table creation SQL (split into safe single statements)
const statements = [
  `CREATE TABLE IF NOT EXISTS public.design_systems (
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
  )`,
  `CREATE INDEX IF NOT EXISTS design_systems_teacher_id_idx ON public.design_systems (teacher_id)`,
  `ALTER TABLE public.design_systems ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "teachers_own_design_systems" ON public.design_systems`,
  `CREATE POLICY "teachers_own_design_systems" ON public.design_systems FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid())`,
  `CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$`,
  `DROP TRIGGER IF EXISTS design_systems_updated_at ON public.design_systems`,
  `CREATE TRIGGER design_systems_updated_at BEFORE UPDATE ON public.design_systems FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()`,
  `DROP FUNCTION IF EXISTS public._tmp_exec(text)`,
];

async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

// First create the helper function via a known RPC if possible
// Actually we need to create it another way... Let me try via pg REST directly

// Try using the query endpoint
async function query(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

console.log('Trying to create design_systems table...\n');

// Try each statement via _tmp_exec RPC if it exists, otherwise report
for (const sql of statements) {
  const short = sql.trim().split('\n')[0].slice(0, 60);
  const result = await rpc('_tmp_exec', { sql });
  if (result.ok) {
    console.log(`✅ ${short}`);
  } else {
    console.log(`⚠️  ${short}`);
    console.log(`   → ${result.text.slice(0, 120)}`);
  }
}

console.log('\nDone. Check above for any errors.');
console.log('\nIf _tmp_exec does not exist, manually run this SQL in Supabase Dashboard → SQL Editor:');
console.log('https://supabase.com/dashboard/project/njbtqmsxbyvpwigfceke/sql/new');
