-- ============================================
-- Function to update teacher stats from user_events
-- This should be called periodically or triggered
-- Both tables have user_id as UUID
-- ============================================

CREATE OR REPLACE FUNCTION update_teacher_stats()
RETURNS void AS $$
BEGIN
  -- Update teacher metrics based on user_events
  UPDATE teachers t
  SET 
    -- Monthly access count (events in last 30 days)
    monthly_access = COALESCE((
      SELECT COUNT(DISTINCT DATE(created_at))
      FROM user_events
      WHERE user_id = t.user_id
        AND created_at > NOW() - INTERVAL '30 days'
    ), 0),
    
    -- Document counts
    documents_count = COALESCE((
      SELECT COUNT(*)
      FROM user_events
      WHERE user_id = t.user_id
        AND event_type IN ('document_opened', 'document_created')
    ), 0),
    
    -- Worksheet counts
    worksheets_count = COALESCE((
      SELECT COUNT(*)
      FROM user_events
      WHERE user_id = t.user_id
        AND event_type IN ('worksheet_opened', 'worksheet_created')
    ), 0),
    
    -- Vividboard counts
    vividboards_count = COALESCE((
      SELECT COUNT(*)
      FROM user_events
      WHERE user_id = t.user_id
        AND event_type IN ('vividboard_opened', 'vividboard_created')
    ), 0),
    
    -- AI usage (percentage of AI-assisted actions)
    ai_usage_percent = COALESCE((
      SELECT ROUND(
        COUNT(*) FILTER (WHERE event_type LIKE 'ai_%')::float / 
        NULLIF(COUNT(*), 0) * 100
      )
      FROM user_events
      WHERE user_id = t.user_id
        AND created_at > NOW() - INTERVAL '30 days'
    ), 0),
    
    -- Activity level based on monthly access
    activity_level = CASE 
      WHEN (
        SELECT COUNT(DISTINCT DATE(created_at))
        FROM user_events
        WHERE user_id = t.user_id
          AND created_at > NOW() - INTERVAL '7 days'
      ) > 5 THEN 'very_active'
      WHEN (
        SELECT COUNT(DISTINCT DATE(created_at))
        FROM user_events
        WHERE user_id = t.user_id
          AND created_at > NOW() - INTERVAL '7 days'
      ) > 2 THEN 'active'
      WHEN (
        SELECT COUNT(DISTINCT DATE(created_at))
        FROM user_events
        WHERE user_id = t.user_id
          AND created_at > NOW() - INTERVAL '30 days'
      ) > 0 THEN 'low'
      ELSE 'inactive'
    END,
    
    -- Last active timestamp
    last_active = COALESCE((
      SELECT MAX(created_at)
      FROM user_events
      WHERE user_id = t.user_id
    ), t.last_active),
    
    updated_at = NOW()
  WHERE t.user_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- View for real-time teacher stats
-- This pulls data directly from user_events
-- Both tables have user_id as UUID - direct comparison
-- ============================================

DROP VIEW IF EXISTS teacher_live_stats;

CREATE OR REPLACE VIEW teacher_live_stats AS
SELECT 
  t.id,
  t.school_id,
  t.user_id,
  t.name,
  t.email,
  t.subject,
  
  -- Real-time metrics from user_events
  COALESCE((
    SELECT COUNT(DISTINCT DATE(ue.created_at))
    FROM user_events ue
    WHERE ue.user_id = t.user_id
      AND ue.created_at > NOW() - INTERVAL '30 days'
  ), 0)::integer as monthly_access,
  
  COALESCE((
    SELECT COUNT(*)
    FROM user_events ue
    WHERE ue.user_id = t.user_id
      AND ue.event_type IN ('document_opened', 'document_created')
  ), 0)::integer as documents_count,
  
  COALESCE((
    SELECT COUNT(*)
    FROM user_events ue
    WHERE ue.user_id = t.user_id
      AND ue.event_type IN ('worksheet_opened', 'worksheet_created')
  ), 0)::integer as worksheets_count,
  
  COALESCE((
    SELECT COUNT(*)
    FROM user_events ue
    WHERE ue.user_id = t.user_id
      AND ue.event_type IN ('vividboard_opened', 'vividboard_created')
  ), 0)::integer as vividboards_count,
  
  CASE 
    WHEN (
      SELECT COUNT(DISTINCT DATE(ue.created_at))
      FROM user_events ue
      WHERE ue.user_id = t.user_id
        AND ue.created_at > NOW() - INTERVAL '7 days'
    ) > 5 THEN 'very_active'
    WHEN (
      SELECT COUNT(DISTINCT DATE(ue.created_at))
      FROM user_events ue
      WHERE ue.user_id = t.user_id
        AND ue.created_at > NOW() - INTERVAL '7 days'
    ) > 2 THEN 'active'
    WHEN (
      SELECT COUNT(DISTINCT DATE(ue.created_at))
      FROM user_events ue
      WHERE ue.user_id = t.user_id
        AND ue.created_at > NOW() - INTERVAL '30 days'
    ) > 0 THEN 'low'
    ELSE 'inactive'
  END as activity_level,
  
  COALESCE((
    SELECT MAX(ue.created_at)
    FROM user_events ue
    WHERE ue.user_id = t.user_id
  ), t.created_at) as last_active,
  
  t.created_at

FROM teachers t;

-- Grant access to the view
GRANT SELECT ON teacher_live_stats TO anon, authenticated;

-- ============================================
-- Trigger to update teacher's last_active on new event
-- ============================================

CREATE OR REPLACE FUNCTION update_teacher_last_active()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the teacher record when a new event is logged
  UPDATE teachers
  SET 
    last_active = NEW.created_at,
    updated_at = NOW()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (if it doesn't exist)
DROP TRIGGER IF EXISTS teacher_activity_trigger ON user_events;
CREATE TRIGGER teacher_activity_trigger
  AFTER INSERT ON user_events
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION update_teacher_last_active();

