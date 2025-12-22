-- NPS (Net Promoter Score) responses table
-- Stores all NPS survey responses from teachers

-- Drop existing table if exists
DROP TABLE IF EXISTS nps_responses;

-- Create NPS responses table
CREATE TABLE nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  school_id UUID,
  
  -- NPS Score (0-10)
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  
  -- Category derived from score
  category TEXT NOT NULL CHECK (category IN ('detractor', 'passive', 'promoter')),
  
  -- Follow-up question response
  feedback TEXT,
  
  -- Metadata
  triggered_by TEXT DEFAULT 'automatic' CHECK (triggered_by IN ('automatic', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- User info at time of response (denormalized for history)
  user_name TEXT,
  user_email TEXT
);

-- Create indexes
CREATE INDEX idx_nps_responses_user_id ON nps_responses(user_id);
CREATE INDEX idx_nps_responses_school_id ON nps_responses(school_id);
CREATE INDEX idx_nps_responses_created_at ON nps_responses(created_at DESC);
CREATE INDEX idx_nps_responses_score ON nps_responses(score);

-- Enable RLS
ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;

-- Policies for development (allow all)
CREATE POLICY "Allow all for development" ON nps_responses
  FOR ALL USING (true) WITH CHECK (true);

-- Create view for NPS statistics
CREATE OR REPLACE VIEW nps_stats AS
SELECT 
  date_trunc('month', created_at)::date as month,
  COUNT(*) as total_responses,
  COUNT(*) FILTER (WHERE category = 'promoter') as promoters,
  COUNT(*) FILTER (WHERE category = 'passive') as passives,
  COUNT(*) FILTER (WHERE category = 'detractor') as detractors,
  ROUND(AVG(score)::numeric, 1) as avg_score,
  -- NPS = % Promoters - % Detractors
  ROUND(
    (COUNT(*) FILTER (WHERE category = 'promoter')::numeric / NULLIF(COUNT(*), 0) * 100) -
    (COUNT(*) FILTER (WHERE category = 'detractor')::numeric / NULLIF(COUNT(*), 0) * 100)
  ) as nps_score
FROM nps_responses
GROUP BY date_trunc('month', created_at)
ORDER BY month DESC;

-- Create view for weekly NPS trend
CREATE OR REPLACE VIEW nps_weekly_trend AS
SELECT 
  date_trunc('week', created_at)::date as week_start,
  'T' || EXTRACT(WEEK FROM created_at)::text as week,
  COUNT(*) as responses,
  ROUND(AVG(score)::numeric, 1) as avg_score,
  ROUND(
    (COUNT(*) FILTER (WHERE category = 'promoter')::numeric / NULLIF(COUNT(*), 0) * 100) -
    (COUNT(*) FILTER (WHERE category = 'detractor')::numeric / NULLIF(COUNT(*), 0) * 100)
  ) as nps_score
FROM nps_responses
WHERE created_at >= NOW() - INTERVAL '52 weeks'
GROUP BY date_trunc('week', created_at), EXTRACT(WEEK FROM created_at)
ORDER BY week_start ASC;

-- Grant access
GRANT SELECT, INSERT ON nps_responses TO anon, authenticated;
GRANT SELECT ON nps_stats TO anon, authenticated;
GRANT SELECT ON nps_weekly_trend TO anon, authenticated;

-- Add comment
COMMENT ON TABLE nps_responses IS 'Stores NPS survey responses from teachers';



