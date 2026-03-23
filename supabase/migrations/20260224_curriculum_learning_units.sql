-- =====================================================
-- curriculum_learning_units
-- Každá "learning unit" = 1 DataSet s kontextem
-- Planner je generuje místo flat týdenních plánů
-- =====================================================

CREATE TABLE IF NOT EXISTS curriculum_learning_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vazba na RVP téma
  rvp_data_id uuid REFERENCES curriculum_rvp_data(id) ON DELETE CASCADE,
  subject_code text NOT NULL,
  grade integer NOT NULL,
  school_year text NOT NULL DEFAULT '2025/2026',
  
  -- Pořadí
  order_in_topic integer NOT NULL,   -- 1, 2, 3... v rámci RVP tématu
  order_global integer NOT NULL,     -- globální pořadí v celém školním roce
  
  -- Obsah
  title text NOT NULL,               -- "Řecko – Athény vs Sparta"
  bloom_level text NOT NULL DEFAULT 'remember',  -- remember/understand/apply/analyze/evaluate/create
  material_types text[] DEFAULT '{}', -- ['explanation', 'worksheet', 'quiz']
  
  -- Časové rozvržení
  weeks integer[] DEFAULT '{}',      -- [5, 6] – čísla školních týdnů
  hours integer NOT NULL DEFAULT 2,
  
  -- Context chain – klíčová část
  new_concepts text[] DEFAULT '{}',           -- pojmy POPRVÉ zavedené v této lekci
  prerequisite_concepts text[] DEFAULT '{}',  -- pojmy z předchozích lekcí
  already_covered_summary text DEFAULT '',    -- "V předchozích lekcích jsme probírali X, Y, Z"
  
  -- Výukové cíle (podmnožina rvp expected_outcomes)
  learning_goals text[] DEFAULT '{}',
  
  -- Vazba na DataSet (vyplní Agent 3)
  dataset_id uuid,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(subject_code, grade, school_year, order_global)
);

-- Přidat learning_unit_id do curriculum_weekly_plans
ALTER TABLE curriculum_weekly_plans
  ADD COLUMN IF NOT EXISTS learning_unit_id uuid REFERENCES curriculum_learning_units(id) ON DELETE SET NULL;

-- Přidat kontext do topic_data_sets
ALTER TABLE topic_data_sets
  ADD COLUMN IF NOT EXISTS learning_unit_id uuid REFERENCES curriculum_learning_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bloom_level text DEFAULT 'remember',
  ADD COLUMN IF NOT EXISTS context_summary text DEFAULT '';

-- Indexy
CREATE INDEX IF NOT EXISTS idx_learning_units_subject_grade
  ON curriculum_learning_units(subject_code, grade, school_year);

CREATE INDEX IF NOT EXISTS idx_learning_units_rvp
  ON curriculum_learning_units(rvp_data_id);

-- RLS
ALTER TABLE curriculum_learning_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learning_units_read" ON curriculum_learning_units
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "learning_units_write" ON curriculum_learning_units
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
