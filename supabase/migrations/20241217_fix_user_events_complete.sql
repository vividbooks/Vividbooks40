-- ============================================
-- Complete fix for user_events table
-- Allows events from both authenticated and anonymous users
-- ============================================

-- Make user_id nullable since not all users are Supabase-authenticated
ALTER TABLE user_events ALTER COLUMN user_id DROP NOT NULL;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can insert their own events" ON user_events;
DROP POLICY IF EXISTS "Users can view their own events" ON user_events;
DROP POLICY IF EXISTS "Anyone can insert events" ON user_events;
DROP POLICY IF EXISTS "Anyone can view events" ON user_events;
DROP POLICY IF EXISTS "Authenticated users can insert events" ON user_events;
DROP POLICY IF EXISTS "Anon can insert events" ON user_events;
DROP POLICY IF EXISTS "Service role has full access" ON user_events;

-- Create permissive policies for analytics
-- Allow anyone to insert events (authenticated or not)
CREATE POLICY "Anyone can insert events" ON user_events 
  FOR INSERT 
  TO anon, authenticated
  WITH CHECK (true);

-- Allow reading for aggregation and debugging
CREATE POLICY "Anyone can read events" ON user_events 
  FOR SELECT 
  TO anon, authenticated
  USING (true);

-- Service role full access
CREATE POLICY "Service role full access" ON user_events 
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- View for teacher activity stats from user_events
-- ============================================

DROP TABLE IF EXISTS teacher_activity_summary;
DROP VIEW IF EXISTS teacher_activity_summary;

CREATE OR REPLACE VIEW teacher_activity_summary AS
SELECT 
  user_id,
  
  -- Session time (count sessions and estimate time)
  COUNT(DISTINCT CASE WHEN event_type = 'session_started' THEN id END) as session_count,
  
  -- Documents
  COUNT(CASE WHEN event_type = 'document_opened' THEN 1 END) as documents_opened,
  COUNT(CASE WHEN event_type = 'document_created' THEN 1 END) as documents_created,
  
  -- Worksheets
  COUNT(CASE WHEN event_type = 'worksheet_opened' THEN 1 END) as worksheets_opened,
  COUNT(CASE WHEN event_type = 'worksheet_created' THEN 1 END) as worksheets_created,
  
  -- Vividboards
  COUNT(CASE WHEN event_type = 'vividboard_opened' THEN 1 END) as vividboards_opened,
  COUNT(CASE WHEN event_type = 'vividboard_created' THEN 1 END) as vividboards_created,
  
  -- AI usage
  COUNT(CASE WHEN event_type = 'ai_teach_me_used' THEN 1 END) as ai_teach_me_sessions,
  COUNT(CASE WHEN event_type LIKE 'ai_%' THEN 1 END) as ai_total_actions,
  
  -- Classes
  COUNT(CASE WHEN event_type = 'connect_students_session' THEN 1 END) as connect_student_sessions,
  COUNT(CASE WHEN event_type = 'share_link_created' THEN 1 END) as share_links_created,
  COUNT(CASE WHEN event_type = 'test_assigned' THEN 1 END) as tests_assigned,
  
  -- File uploads
  COUNT(CASE WHEN event_type = 'file_uploaded' THEN 1 END) as files_uploaded,
  
  -- Activity metrics
  COUNT(DISTINCT DATE(created_at)) as active_days_total,
  COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN DATE(created_at) END) as active_days_30d,
  COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN DATE(created_at) END) as active_days_7d,
  
  MAX(created_at) as last_activity,
  MIN(created_at) as first_activity

FROM user_events
WHERE user_id IS NOT NULL
GROUP BY user_id;

GRANT SELECT ON teacher_activity_summary TO anon, authenticated;

-- ============================================
-- Weekly activity stats per user
-- ============================================

DROP TABLE IF EXISTS user_weekly_activity;
DROP VIEW IF EXISTS user_weekly_activity;

CREATE OR REPLACE VIEW user_weekly_activity AS
SELECT 
  user_id,
  DATE_TRUNC('week', created_at) as week_start,
  COUNT(*) as event_count,
  COUNT(DISTINCT DATE(created_at)) as active_days,
  COUNT(CASE WHEN event_type = 'document_opened' THEN 1 END) as documents_opened,
  COUNT(CASE WHEN event_type = 'session_started' THEN 1 END) as sessions
FROM user_events
WHERE user_id IS NOT NULL
GROUP BY user_id, DATE_TRUNC('week', created_at)
ORDER BY user_id, week_start;

GRANT SELECT ON user_weekly_activity TO anon, authenticated;

