-- Weekly subject access statistics view
-- Aggregates subject_accessed events from user_events table by week

-- Drop existing view if it exists
DROP VIEW IF EXISTS weekly_subject_stats;

-- Create view for weekly subject access statistics
CREATE OR REPLACE VIEW weekly_subject_stats AS
SELECT 
  date_trunc('week', created_at)::date as week_start,
  'T' || EXTRACT(WEEK FROM created_at)::text as week,
  
  -- 2. stupeň subjects
  COUNT(*) FILTER (WHERE 
    event_type = 'subject_accessed' AND 
    (event_data->>'subject_id' = 'fyzika')
  ) as fyzika,
  
  COUNT(*) FILTER (WHERE 
    event_type = 'subject_accessed' AND 
    (event_data->>'subject_id' = 'chemie')
  ) as chemie,
  
  COUNT(*) FILTER (WHERE 
    event_type = 'subject_accessed' AND 
    (event_data->>'subject_id' = 'prirodopis')
  ) as prirodopis,
  
  COUNT(*) FILTER (WHERE 
    event_type = 'subject_accessed' AND 
    (event_data->>'subject_id' IN ('matematika', 'matematika-2'))
  ) as matematika2,
  
  -- 1. stupeň subjects
  COUNT(*) FILTER (WHERE 
    event_type = 'subject_accessed' AND 
    (event_data->>'subject_id' = 'matematika-1')
  ) as matematika1,
  
  COUNT(*) FILTER (WHERE 
    event_type = 'subject_accessed' AND 
    (event_data->>'subject_id' = 'prvouka')
  ) as prvouka,
  
  -- Total accesses
  COUNT(*) FILTER (WHERE event_type = 'subject_accessed') as total_accesses

FROM user_events
WHERE 
  created_at >= NOW() - INTERVAL '50 weeks'
  AND event_type = 'subject_accessed'
GROUP BY date_trunc('week', created_at), EXTRACT(WEEK FROM created_at)
ORDER BY week_start ASC;

-- Grant access to the view
GRANT SELECT ON weekly_subject_stats TO anon, authenticated;

-- Add comment
COMMENT ON VIEW weekly_subject_stats IS 'Weekly aggregated subject access statistics from user_events';
