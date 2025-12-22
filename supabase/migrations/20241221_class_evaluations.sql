-- Class Evaluations - Periodic student evaluations (semester, final, etc.)
-- This is critical data that must never be lost

-- Table for evaluation periods (e.g. "Pololetní hodnocení 2024/25")
CREATE TABLE IF NOT EXISTS class_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- e.g. "Pololetní hodnocení", "Závěrečné hodnocení"
  period_type TEXT NOT NULL DEFAULT 'semester', -- semester, final, quarterly, custom
  subject TEXT, -- optional subject filter
  date_from DATE, -- period start date
  date_to DATE, -- period end date
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for individual student evaluations within a period
CREATE TABLE IF NOT EXISTS student_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES class_evaluations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  average_score INTEGER, -- calculated average for the period
  results_count INTEGER DEFAULT 0, -- number of results in the period
  teacher_input TEXT, -- teacher's notes for AI generation
  ai_generated_text TEXT, -- AI-generated evaluation
  final_text TEXT, -- final text (edited by teacher)
  is_edited BOOLEAN DEFAULT FALSE, -- whether teacher edited the AI text
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(evaluation_id, student_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_evaluations_class_id ON class_evaluations(class_id);
CREATE INDEX IF NOT EXISTS idx_class_evaluations_status ON class_evaluations(status);
CREATE INDEX IF NOT EXISTS idx_student_evaluations_evaluation_id ON student_evaluations(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_student_evaluations_student_id ON student_evaluations(student_id);

-- Enable RLS
ALTER TABLE class_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all operations for authenticated users (teachers)
CREATE POLICY "Allow all for authenticated users" ON class_evaluations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON student_evaluations
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_class_evaluations_updated_at
  BEFORE UPDATE ON class_evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_evaluations_updated_at
  BEFORE UPDATE ON student_evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

