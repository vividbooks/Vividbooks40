-- Function to aggregate user stats
CREATE OR REPLACE FUNCTION aggregate_daily_stats()
RETURNS void AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  -- 1. Aggregate User Stats from user_events
  -- We process all events to recalculate totals (or we could do incremental if we tracked last processed)
  -- For simplicity, we recalculate totals from scratch or since a specific date. 
  -- Here we assume we want all-time totals.
  
  -- Use a temporary table or CTE to calculate stats
  WITH event_counts AS (
    SELECT 
      user_id,
      school_id,
      COUNT(*) FILTER (WHERE event_type = 'lesson_opened') as lessons_opened,
      COUNT(*) FILTER (WHERE event_type = 'lesson_edited') as lessons_edited,
      COUNT(*) FILTER (WHERE event_type = 'document_created') as documents_created,
      COUNT(*) FILTER (WHERE event_type = 'worksheet_created') as worksheets_created,
      COUNT(*) FILTER (WHERE event_type = 'board_created') as boards_created,
      SUM(CASE WHEN event_type = 'ai_chat_message' OR event_type = 'ai_teach_me_used' THEN 1 ELSE 0 END) as ai_tokens_used, -- Placeholder count, real tokens should be in event_data
      MAX(created_at) as last_active_at,
      SUM(CASE WHEN event_type = 'time_spent' THEN COALESCE((event_data->>'duration_minutes')::float, 0) ELSE 0 END) as total_time_minutes
    FROM user_events
    GROUP BY user_id, school_id
  )
  INSERT INTO user_stats (
    user_id, 
    school_id, 
    lessons_opened, 
    lessons_edited, 
    documents_created, 
    worksheet_created, 
    boards_created, 
    ai_tokens_used, 
    last_active_at,
    total_time_minutes,
    updated_at
  )
  SELECT 
    ec.user_id,
    ec.school_id,
    ec.lessons_opened,
    ec.lessons_edited,
    ec.documents_created,
    ec.worksheets_created,
    ec.boards_created,
    ec.ai_tokens_used,
    ec.last_active_at,
    ROUND(ec.total_time_minutes),
    NOW()
  FROM event_counts ec
  ON CONFLICT (user_id) DO UPDATE SET
    lessons_opened = EXCLUDED.lessons_opened,
    lessons_edited = EXCLUDED.lessons_edited,
    documents_created = EXCLUDED.documents_created,
    worksheets_created = EXCLUDED.worksheet_created,
    boards_created = EXCLUDED.boards_created,
    ai_tokens_used = EXCLUDED.ai_tokens_used,
    last_active_at = EXCLUDED.last_active_at,
    total_time_minutes = EXCLUDED.total_time_minutes,
    updated_at = NOW();

  -- 2. Calculate Activity Score and Percentile (simple logic)
  -- Activity score: simple weighted sum
  UPDATE user_stats
  SET activity_score = LEAST(100, (
    lessons_opened * 1 + 
    lessons_edited * 5 + 
    documents_created * 10 + 
    worksheets_created * 10 +
    boards_created * 10
  ));

  -- Percentile Rank
  WITH ranked_users AS (
    SELECT 
      user_id, 
      PERCENT_RANK() OVER (ORDER BY activity_score) as p_rank 
    FROM user_stats
  )
  UPDATE user_stats us
  SET percentile_rank = ROUND(ru.p_rank * 100)
  FROM ranked_users ru
  WHERE us.user_id = ru.user_id;

  -- 3. Aggregate School Stats
  WITH school_aggregates AS (
    SELECT
      school_id,
      COUNT(user_id) as total_teachers,
      COUNT(user_id) FILTER (WHERE last_active_at > NOW() - INTERVAL '7 days') as active_teachers_7d,
      COUNT(user_id) FILTER (WHERE last_active_at > NOW() - INTERVAL '30 days') as active_teachers_30d,
      SUM(ai_cost_cents) as total_ai_cost_cents
    FROM user_stats
    WHERE school_id IS NOT NULL
    GROUP BY school_id
  )
  INSERT INTO school_stats (
    school_id,
    total_teachers,
    active_teachers_7d,
    active_teachers_30d,
    total_ai_cost_cents,
    activity_level,
    updated_at
  )
  SELECT
    sa.school_id,
    sa.total_teachers,
    sa.active_teachers_7d,
    sa.active_teachers_30d,
    sa.total_ai_cost_cents,
    CASE 
      WHEN sa.active_teachers_7d::float / NULLIF(sa.total_teachers, 0) > 0.5 THEN 'very_active'
      WHEN sa.active_teachers_30d::float / NULLIF(sa.total_teachers, 0) > 0.3 THEN 'active'
      ELSE 'inactive'
    END,
    NOW()
  FROM school_aggregates sa
  ON CONFLICT (school_id) DO UPDATE SET
    total_teachers = EXCLUDED.total_teachers,
    active_teachers_7d = EXCLUDED.active_teachers_7d,
    active_teachers_30d = EXCLUDED.active_teachers_30d,
    total_ai_cost_cents = EXCLUDED.total_ai_cost_cents,
    activity_level = EXCLUDED.activity_level,
    updated_at = NOW();

END;
$$ LANGUAGE plpgsql;


