-- ============================================
-- Customer Success - Schools & Teachers Tables
-- ============================================

-- Schools table
CREATE TABLE IF NOT EXISTS cs_schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  
  -- Contact info
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_role TEXT,
  
  -- License info
  license_type TEXT DEFAULT 'basic', -- basic, premium, enterprise
  license_expiry TIMESTAMP WITH TIME ZONE,
  
  -- Subject licenses (JSONB array)
  subject_licenses JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"subject": "Matematika", "tier": "premium", "validUntil": "2025-06-30"}]
  
  -- Features
  has_ecosystem_vividbooks BOOLEAN DEFAULT false,
  has_vividboard BOOLEAN DEFAULT false,
  has_vividboard_wall BOOLEAN DEFAULT false,
  
  -- Stats
  total_teachers INTEGER DEFAULT 0,
  active_teachers INTEGER DEFAULT 0,
  total_students INTEGER DEFAULT 0,
  active_students INTEGER DEFAULT 0,
  
  -- Usage metrics
  monthly_access INTEGER DEFAULT 0,
  monthly_ai_cost DECIMAL(10, 2) DEFAULT 0,
  
  -- Health metrics
  health_score INTEGER DEFAULT 50, -- 0-100
  activity_level TEXT DEFAULT 'inactive', -- very_active, active, low, inactive
  trend TEXT DEFAULT 'stable', -- up, down, stable
  
  -- Timestamps
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teachers table
CREATE TABLE IF NOT EXISTS cs_teachers (
  id TEXT PRIMARY KEY,
  school_id TEXT REFERENCES cs_schools(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  
  -- Teaching info
  subject TEXT,
  classes JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"id": "class1", "name": "7.A", "studentCount": 25}]
  
  -- Usage metrics
  monthly_access INTEGER DEFAULT 0,
  documents_count INTEGER DEFAULT 0,
  worksheets_count INTEGER DEFAULT 0,
  vividboards_count INTEGER DEFAULT 0,
  
  -- AI usage
  ai_usage_percent INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  
  -- Storage
  storage_used_mb DECIMAL(10, 2) DEFAULT 0,
  
  -- Activity
  activity_level TEXT DEFAULT 'inactive', -- very_active, active, low, inactive
  last_active TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teacher documents (for detailed tracking)
CREATE TABLE IF NOT EXISTS cs_teacher_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  teacher_id TEXT REFERENCES cs_teachers(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  type TEXT DEFAULT 'document', -- document, worksheet, vividboard
  subject TEXT,
  
  -- Source tracking
  is_vividbooks_content BOOLEAN DEFAULT false,
  is_custom BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  ai_generated BOOLEAN DEFAULT false,
  
  -- Usage
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cs_teachers_school_id ON cs_teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_cs_teachers_activity ON cs_teachers(activity_level);
CREATE INDEX IF NOT EXISTS idx_cs_schools_health ON cs_schools(health_score);
CREATE INDEX IF NOT EXISTS idx_cs_schools_license_expiry ON cs_schools(license_expiry);
CREATE INDEX IF NOT EXISTS idx_cs_teacher_documents_teacher ON cs_teacher_documents(teacher_id);

-- Enable RLS
ALTER TABLE cs_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_teacher_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for development - tighten for production)
CREATE POLICY "Allow all access to cs_schools" ON cs_schools FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to cs_teachers" ON cs_teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to cs_teacher_documents" ON cs_teacher_documents FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_cs_schools_updated_at ON cs_schools;
CREATE TRIGGER trigger_cs_schools_updated_at
  BEFORE UPDATE ON cs_schools
  FOR EACH ROW
  EXECUTE FUNCTION update_cs_updated_at();

DROP TRIGGER IF EXISTS trigger_cs_teachers_updated_at ON cs_teachers;
CREATE TRIGGER trigger_cs_teachers_updated_at
  BEFORE UPDATE ON cs_teachers
  FOR EACH ROW
  EXECUTE FUNCTION update_cs_updated_at();

-- ============================================
-- Optional: Insert sample data for testing
-- Uncomment to populate with test data
-- ============================================

/*
INSERT INTO cs_schools (id, name, contact_name, contact_email, contact_role, license_type, license_expiry, total_teachers, active_teachers, total_students, active_students, monthly_access, health_score, activity_level, trend, has_ecosystem_vividbooks, has_vividboard)
VALUES 
  ('school_1', 'ZŠ Květinová', 'Jan Novák', 'novak@zskvetinova.cz', 'Ředitel', 'premium', '2025-06-30', 45, 38, 520, 485, 1250, 92, 'very_active', 'up', true, true),
  ('school_2', 'Gymnázium Praha', 'Marie Svobodová', 'svobodova@gympra.cz', 'Zástupce ředitele', 'basic', '2025-03-15', 62, 28, 890, 320, 450, 45, 'low', 'down', false, false);

INSERT INTO cs_teachers (id, school_id, name, email, subject, monthly_access, activity_level, last_active)
VALUES
  ('teacher_1', 'school_1', 'Petr Horák', 'horak@zskvetinova.cz', 'Matematika', 89, 'very_active', NOW() - INTERVAL '1 day'),
  ('teacher_2', 'school_1', 'Eva Malá', 'mala@zskvetinova.cz', 'Čeština', 45, 'active', NOW() - INTERVAL '3 days');
*/



