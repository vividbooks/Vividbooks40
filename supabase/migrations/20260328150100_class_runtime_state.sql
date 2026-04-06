-- Runtime stav třídy (náhrada za class_${id}_subjects / colleagues / dismissals v localStorage).
CREATE TABLE IF NOT EXISTS class_runtime_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (class_id, key)
);

CREATE INDEX IF NOT EXISTS idx_class_runtime_state_class ON class_runtime_state(class_id);
CREATE INDEX IF NOT EXISTS idx_class_runtime_state_key ON class_runtime_state(key);

ALTER TABLE class_runtime_state ENABLE ROW LEVEL SECURITY;

-- Aplikace filtruje podle teacher_id na klientovi; zpřísnit RLS v další iteraci (join na classes.teacher_id).
CREATE POLICY "Authenticated manage class runtime state"
  ON class_runtime_state
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
