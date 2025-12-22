-- Extended Analytics Schema for Vividbooks
-- Adds comprehensive tracking for teachers, students, and content usage

-- ============================================
-- 1. ENHANCED USER EVENTS (add indexes)
-- ============================================

-- Add category column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_events' AND column_name = 'category') THEN
    ALTER TABLE user_events ADD COLUMN category TEXT;
  END IF;
END $$;

-- Additional indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_school_id ON user_events(school_id);
CREATE INDEX IF NOT EXISTS idx_user_events_date ON user_events(DATE(created_at));

-- ============================================
-- 2. TEACHER STATS (Enhanced)
-- ============================================

-- Drop and recreate with all fields
DROP TABLE IF EXISTS teacher_stats CASCADE;

CREATE TABLE teacher_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  school_id UUID,
  
  -- Time tracking
  total_time_minutes INTEGER DEFAULT 0,
  weekly_time_minutes INTEGER[] DEFAULT ARRAY[]::INTEGER[], -- Last 50 weeks
  last_active_at TIMESTAMP WITH TIME ZONE,
  
  -- Library usage
  documents_opened INTEGER DEFAULT 0,
  worksheets_opened INTEGER DEFAULT 0,
  vividboards_opened INTEGER DEFAULT 0,
  
  -- Content creation
  custom_documents_created INTEGER DEFAULT 0,
  edited_documents INTEGER DEFAULT 0,
  custom_worksheets_created INTEGER DEFAULT 0,
  edited_worksheets INTEGER DEFAULT 0,
  custom_vividboards_created INTEGER DEFAULT 0,
  edited_vividboards INTEGER DEFAULT 0,
  
  -- AI Usage
  ai_teach_me_sessions INTEGER DEFAULT 0,
  ai_creation_percentage NUMERIC(5,2) DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  ai_cost_cents INTEGER DEFAULT 0,
  
  -- Collaboration
  connect_students_sessions INTEGER DEFAULT 0,
  share_links_created INTEGER DEFAULT 0,
  files_uploaded INTEGER DEFAULT 0,
  storage_used_mb NUMERIC(10,2) DEFAULT 0,
  
  -- Classes
  classes_count INTEGER DEFAULT 0,
  total_students INTEGER DEFAULT 0,
  tests_assigned_monthly INTEGER DEFAULT 0,
  shares_with_class BOOLEAN DEFAULT FALSE,
  
  -- Scores
  activity_score INTEGER DEFAULT 0, -- 0-100
  technology_adoption INTEGER DEFAULT 0, -- 0-100
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_teacher_stats_user_id ON teacher_stats(user_id);
CREATE INDEX idx_teacher_stats_school_id ON teacher_stats(school_id);
CREATE INDEX idx_teacher_stats_activity ON teacher_stats(activity_score);

-- ============================================
-- 3. STUDENT STATS
-- ============================================

CREATE TABLE IF NOT EXISTS student_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL,
  school_id UUID,
  class_id UUID,
  
  -- Time tracking
  total_time_minutes INTEGER DEFAULT 0,
  weekly_time_minutes INTEGER[] DEFAULT ARRAY[]::INTEGER[], -- Last 50 weeks
  last_active_at TIMESTAMP WITH TIME ZONE,
  
  -- Content consumption
  documents_viewed INTEGER DEFAULT 0,
  worksheets_started INTEGER DEFAULT 0,
  worksheets_completed INTEGER DEFAULT 0,
  tests_started INTEGER DEFAULT 0,
  tests_completed INTEGER DEFAULT 0,
  
  -- Performance
  average_score NUMERIC(5,2),
  completion_rate NUMERIC(5,2),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_stats_student_id ON student_stats(student_id);
CREATE INDEX IF NOT EXISTS idx_student_stats_school_id ON student_stats(school_id);
CREATE INDEX IF NOT EXISTS idx_student_stats_class_id ON student_stats(class_id);

-- ============================================
-- 4. CONTENT ANALYTICS
-- ============================================

CREATE TABLE IF NOT EXISTS content_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('document', 'worksheet', 'vividboard', 'test')),
  school_id UUID,
  
  -- Usage stats
  total_views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  total_time_spent_minutes INTEGER DEFAULT 0,
  avg_time_per_view NUMERIC(8,2) DEFAULT 0,
  
  -- Sharing
  share_count INTEGER DEFAULT 0,
  qr_code_scans INTEGER DEFAULT 0,
  
  -- For worksheets/tests
  completions INTEGER DEFAULT 0,
  average_score NUMERIC(5,2),
  
  -- Daily breakdown (last 30 days as JSONB)
  daily_views JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_analytics_content ON content_analytics(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_analytics_school ON content_analytics(school_id);

-- ============================================
-- 5. SESSION ANALYTICS
-- ============================================

CREATE TABLE IF NOT EXISTS session_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  user_id UUID,
  school_id UUID,
  
  -- Session info
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  
  -- Device info
  user_agent TEXT,
  device_type TEXT, -- 'desktop', 'tablet', 'mobile'
  browser TEXT,
  os TEXT,
  
  -- Activity summary
  pages_viewed INTEGER DEFAULT 0,
  documents_opened INTEGER DEFAULT 0,
  ai_features_used INTEGER DEFAULT 0,
  
  -- Engagement
  is_active BOOLEAN DEFAULT TRUE,
  idle_time_minutes INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_session_analytics_user ON session_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_session_analytics_school ON session_analytics(school_id);
CREATE INDEX IF NOT EXISTS idx_session_analytics_date ON session_analytics(DATE(started_at));

-- ============================================
-- 6. AGGREGATED DAILY STATS
-- ============================================

CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  school_id UUID,
  
  -- User activity
  active_teachers INTEGER DEFAULT 0,
  active_students INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_time_minutes INTEGER DEFAULT 0,
  
  -- Content
  documents_opened INTEGER DEFAULT 0,
  worksheets_completed INTEGER DEFAULT 0,
  tests_completed INTEGER DEFAULT 0,
  
  -- AI Usage
  ai_requests INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  ai_cost_cents INTEGER DEFAULT 0,
  
  -- Sharing
  share_links_created INTEGER DEFAULT 0,
  connect_sessions INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_stats_date_school ON daily_stats(date, school_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

-- ============================================
-- 7. RLS POLICIES
-- ============================================

ALTER TABLE teacher_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- Allow all for development (update for production)
CREATE POLICY "Allow all teacher_stats" ON teacher_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all student_stats" ON student_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all content_analytics" ON content_analytics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all session_analytics" ON session_analytics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all daily_stats" ON daily_stats FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 8. HELPER FUNCTIONS
-- ============================================

-- Function to increment teacher stat
CREATE OR REPLACE FUNCTION increment_teacher_stat(
  p_user_id UUID,
  p_stat_name TEXT,
  p_increment INTEGER DEFAULT 1
) RETURNS void AS $$
BEGIN
  -- Insert if not exists, otherwise update
  INSERT INTO teacher_stats (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Update the stat dynamically
  EXECUTE format('UPDATE teacher_stats SET %I = COALESCE(%I, 0) + $1, updated_at = NOW() WHERE user_id = $2', 
    p_stat_name, p_stat_name)
  USING p_increment, p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment student stat
CREATE OR REPLACE FUNCTION increment_student_stat(
  p_student_id UUID,
  p_stat_name TEXT,
  p_increment INTEGER DEFAULT 1
) RETURNS void AS $$
BEGIN
  INSERT INTO student_stats (student_id)
  VALUES (p_student_id)
  ON CONFLICT (student_id) DO NOTHING;
  
  EXECUTE format('UPDATE student_stats SET %I = COALESCE(%I, 0) + $1, updated_at = NOW() WHERE student_id = $2', 
    p_stat_name, p_stat_name)
  USING p_increment, p_student_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update last active
CREATE OR REPLACE FUNCTION update_last_active(
  p_user_id UUID,
  p_is_teacher BOOLEAN DEFAULT TRUE
) RETURNS void AS $$
BEGIN
  IF p_is_teacher THEN
    UPDATE teacher_stats SET last_active_at = NOW(), updated_at = NOW() WHERE user_id = p_user_id;
  ELSE
    UPDATE student_stats SET last_active_at = NOW(), updated_at = NOW() WHERE student_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;



