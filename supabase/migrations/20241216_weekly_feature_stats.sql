-- ============================================
-- Weekly Feature Usage Statistics
-- Agregace používání funkcí učiteli po týdnech
-- ============================================

-- View pro týdenní statistiky používání funkcí
CREATE OR REPLACE VIEW weekly_feature_usage AS
SELECT 
  date_trunc('week', created_at)::date as week_start,
  'T' || EXTRACT(WEEK FROM created_at)::text as week_label,
  
  -- Dokumenty
  COUNT(*) FILTER (WHERE event_type IN ('document_opened', 'document_created', 'document_time_spent')) as documents,
  
  -- Pracovní listy
  COUNT(*) FILTER (WHERE event_type IN ('worksheet_opened', 'worksheet_created', 'worksheet_completed')) as worksheets,
  
  -- Vividboardy
  COUNT(*) FILTER (WHERE event_type IN ('vividboard_opened', 'vividboard_created')) as vividboards,
  
  -- AI funkce
  COUNT(*) FILTER (WHERE event_type IN ('ai_teach_me_used', 'ai_generation_completed', 'ai_alerts_generated', 'ai_email_generated')) as ai_usage

FROM user_events
WHERE created_at >= NOW() - INTERVAL '50 weeks'
GROUP BY date_trunc('week', created_at), EXTRACT(WEEK FROM created_at)
ORDER BY week_start DESC
LIMIT 50;

-- Tabulka pro ukládání denních agregátů (pro rychlejší dotazy)
CREATE TABLE IF NOT EXISTS daily_feature_stats (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  
  -- Počty událostí
  documents_opened INTEGER DEFAULT 0,
  documents_created INTEGER DEFAULT 0,
  worksheets_opened INTEGER DEFAULT 0,
  worksheets_created INTEGER DEFAULT 0,
  worksheets_completed INTEGER DEFAULT 0,
  vividboards_opened INTEGER DEFAULT 0,
  vividboards_created INTEGER DEFAULT 0,
  ai_teach_me INTEGER DEFAULT 0,
  ai_generations INTEGER DEFAULT 0,
  
  -- Unikátní uživatelé
  unique_teachers INTEGER DEFAULT 0,
  unique_students INTEGER DEFAULT 0,
  
  -- Časové razítko
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pro rychlé dotazy
CREATE INDEX IF NOT EXISTS idx_daily_feature_stats_date ON daily_feature_stats(date DESC);

-- RLS
ALTER TABLE daily_feature_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all daily_feature_stats" ON daily_feature_stats FOR ALL USING (true) WITH CHECK (true);

-- Funkce pro agregaci denních statistik
CREATE OR REPLACE FUNCTION aggregate_daily_stats(target_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS void AS $$
BEGIN
  INSERT INTO daily_feature_stats (
    date,
    documents_opened,
    documents_created,
    worksheets_opened,
    worksheets_created,
    worksheets_completed,
    vividboards_opened,
    vividboards_created,
    ai_teach_me,
    ai_generations,
    unique_teachers
  )
  SELECT 
    target_date,
    COUNT(*) FILTER (WHERE event_type = 'document_opened'),
    COUNT(*) FILTER (WHERE event_type = 'document_created'),
    COUNT(*) FILTER (WHERE event_type = 'worksheet_opened'),
    COUNT(*) FILTER (WHERE event_type = 'worksheet_created'),
    COUNT(*) FILTER (WHERE event_type = 'worksheet_completed'),
    COUNT(*) FILTER (WHERE event_type = 'vividboard_opened'),
    COUNT(*) FILTER (WHERE event_type = 'vividboard_created'),
    COUNT(*) FILTER (WHERE event_type = 'ai_teach_me_used'),
    COUNT(*) FILTER (WHERE event_type IN ('ai_generation_completed', 'ai_alerts_generated', 'ai_email_generated')),
    COUNT(DISTINCT user_id)
  FROM user_events
  WHERE created_at::date = target_date
  ON CONFLICT (date) DO UPDATE SET
    documents_opened = EXCLUDED.documents_opened,
    documents_created = EXCLUDED.documents_created,
    worksheets_opened = EXCLUDED.worksheets_opened,
    worksheets_created = EXCLUDED.worksheets_created,
    worksheets_completed = EXCLUDED.worksheets_completed,
    vividboards_opened = EXCLUDED.vividboards_opened,
    vividboards_created = EXCLUDED.vividboards_created,
    ai_teach_me = EXCLUDED.ai_teach_me,
    ai_generations = EXCLUDED.ai_generations,
    unique_teachers = EXCLUDED.unique_teachers,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- View pro týdenní agregáty z daily_feature_stats (rychlejší než přímý dotaz na user_events)
CREATE OR REPLACE VIEW weekly_feature_stats AS
SELECT 
  date_trunc('week', date)::date as week_start,
  'T' || EXTRACT(WEEK FROM date)::text as week,
  SUM(documents_opened + documents_created) as documents,
  SUM(worksheets_opened + worksheets_created + worksheets_completed) as worksheets,
  SUM(vividboards_opened + vividboards_created) as vividboards,
  SUM(ai_teach_me + ai_generations) as ai_usage
FROM daily_feature_stats
WHERE date >= CURRENT_DATE - INTERVAL '50 weeks'
GROUP BY date_trunc('week', date), EXTRACT(WEEK FROM date)
ORDER BY week_start ASC;



