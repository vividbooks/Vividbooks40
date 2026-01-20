-- ============================================
-- Schools & Licenses - Main Tables
-- Propojení Správy licencí s Customer Success
-- ============================================

-- Drop existing cs_schools if exists (we'll use a unified schools table)
-- DROP TABLE IF EXISTS cs_teachers CASCADE;
-- DROP TABLE IF EXISTS cs_schools CASCADE;

-- ============================================
-- SCHOOLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,  -- 6-char code like VVD123
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  
  -- Contact info (for CS dashboard)
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_role TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SCHOOL LICENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS school_licenses (
  id TEXT PRIMARY KEY,
  school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
  
  -- Subject licenses as JSONB array
  -- Example: [{"id": "sublic-1", "subject": "fyzika", "tier": "digital-library", "validFrom": "...", "validUntil": "..."}]
  subjects JSONB DEFAULT '[]'::jsonb,
  
  -- Feature flags
  features JSONB DEFAULT '{
    "vividboardWall": true,
    "ecosystemVividbooks": false,
    "vividboard": false
  }'::jsonb,
  
  -- Timestamps
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(school_id)
);

-- ============================================
-- TEACHERS TABLE (for CS Dashboard)
-- ============================================
CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  subject TEXT,
  
  -- Activity metrics (updated by analytics)
  monthly_access INTEGER DEFAULT 0,
  documents_count INTEGER DEFAULT 0,
  worksheets_count INTEGER DEFAULT 0,
  vividboards_count INTEGER DEFAULT 0,
  ai_usage_percent INTEGER DEFAULT 0,
  storage_used_mb DECIMAL(10, 2) DEFAULT 0,
  
  activity_level TEXT DEFAULT 'inactive',
  last_active TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SCHOOL STATS VIEW (for CS Dashboard)
-- Computed metrics from schools + licenses + teachers
-- ============================================
CREATE OR REPLACE VIEW school_stats_view AS
SELECT 
  s.id,
  s.code,
  s.name,
  s.city,
  s.contact_name,
  s.contact_email,
  s.contact_phone,
  s.contact_role,
  s.created_at,
  
  -- License info
  sl.subjects,
  sl.features,
  
  -- Computed metrics
  COALESCE((SELECT COUNT(*) FROM teachers t WHERE t.school_id = s.id), 0) as total_teachers,
  COALESCE((SELECT COUNT(*) FROM teachers t WHERE t.school_id = s.id AND t.activity_level IN ('active', 'very_active')), 0) as active_teachers,
  
  -- Health score (simple calculation)
  CASE 
    WHEN (SELECT COUNT(*) FROM teachers t WHERE t.school_id = s.id) = 0 THEN 30
    ELSE LEAST(100, 30 + (
      (SELECT COUNT(*) FROM teachers t WHERE t.school_id = s.id AND t.activity_level IN ('active', 'very_active'))::float / 
      NULLIF((SELECT COUNT(*) FROM teachers t WHERE t.school_id = s.id), 0) * 70
    )::integer)
  END as health_score,
  
  -- Activity level
  CASE 
    WHEN (SELECT AVG(monthly_access) FROM teachers t WHERE t.school_id = s.id) > 50 THEN 'very_active'
    WHEN (SELECT AVG(monthly_access) FROM teachers t WHERE t.school_id = s.id) > 20 THEN 'active'
    WHEN (SELECT AVG(monthly_access) FROM teachers t WHERE t.school_id = s.id) > 5 THEN 'low'
    ELSE 'inactive'
  END as activity_level,
  
  -- License expiry (from subjects)
  (SELECT MAX(sub->>'validUntil') FROM jsonb_array_elements(sl.subjects) sub) as license_expiry

FROM schools s
LEFT JOIN school_licenses sl ON sl.school_id = s.id;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(code);
CREATE INDEX IF NOT EXISTS idx_school_licenses_school ON school_licenses(school_id);
CREATE INDEX IF NOT EXISTS idx_teachers_school ON teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_teachers_user ON teachers(user_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all schools
CREATE POLICY "Anyone can read schools" ON schools FOR SELECT USING (true);

-- Allow authenticated users to manage schools (for admin)
CREATE POLICY "Authenticated users can manage schools" ON schools 
  FOR ALL USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Same for licenses
CREATE POLICY "Anyone can read licenses" ON school_licenses FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage licenses" ON school_licenses 
  FOR ALL USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Same for teachers
CREATE POLICY "Anyone can read teachers" ON teachers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage teachers" ON teachers 
  FOR ALL USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- TRIGGERS for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schools_updated_at ON schools;
CREATE TRIGGER schools_updated_at
  BEFORE UPDATE ON schools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS school_licenses_updated_at ON school_licenses;
CREATE TRIGGER school_licenses_updated_at
  BEFORE UPDATE ON school_licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS teachers_updated_at ON teachers;
CREATE TRIGGER teachers_updated_at
  BEFORE UPDATE ON teachers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();



