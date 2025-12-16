-- CS Alerts table for AI-generated customer success alerts
CREATE TABLE IF NOT EXISTS cs_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Alert identification
  type TEXT NOT NULL CHECK (type IN ('churn_risk', 'upsell', 'renewal', 'engagement', 'onboarding', 'support')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  
  -- Related entities
  school_id TEXT NOT NULL,
  school_name TEXT NOT NULL,
  teacher_id TEXT,
  teacher_name TEXT,
  
  -- Alert content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT,
  ai_reasoning TEXT, -- Why AI generated this alert
  
  -- Metrics snapshot at time of alert
  metrics_snapshot JSONB DEFAULT '{}'::jsonb,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'in_progress', 'resolved', 'dismissed', 'false_positive')),
  assigned_to UUID, -- CS manager assigned
  
  -- Actions taken
  actions_taken JSONB DEFAULT '[]'::jsonb,
  resolution_notes TEXT,
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  
  -- Generation metadata
  generation_batch_id UUID, -- Links alerts generated in same batch
  generation_model TEXT DEFAULT 'gemini-2.0-flash',
  
  -- Prevent duplicates
  fingerprint TEXT, -- Hash of key alert attributes to prevent duplicates
  
  UNIQUE(fingerprint)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_cs_alerts_school_id ON cs_alerts(school_id);
CREATE INDEX IF NOT EXISTS idx_cs_alerts_type ON cs_alerts(type);
CREATE INDEX IF NOT EXISTS idx_cs_alerts_severity ON cs_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_cs_alerts_status ON cs_alerts(status);
CREATE INDEX IF NOT EXISTS idx_cs_alerts_created_at ON cs_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_alerts_fingerprint ON cs_alerts(fingerprint);

-- Alert history for tracking changes
CREATE TABLE IF NOT EXISTS cs_alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES cs_alerts(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'status_changed', 'assigned', 'note_added'
  old_value JSONB,
  new_value JSONB,
  performed_by UUID,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_cs_alert_history_alert_id ON cs_alert_history(alert_id);

-- Generation logs to track AI agent runs
CREATE TABLE IF NOT EXISTS cs_alert_generation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  schools_analyzed INTEGER DEFAULT 0,
  alerts_generated INTEGER DEFAULT 0,
  alerts_skipped INTEGER DEFAULT 0, -- Duplicates or low confidence
  model_used TEXT,
  tokens_used INTEGER,
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE cs_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_alert_generation_logs ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth setup)
-- For now, allow authenticated users to read/write
CREATE POLICY "Authenticated users can read alerts" ON cs_alerts 
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert alerts" ON cs_alerts 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update alerts" ON cs_alerts 
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Function to update alert status with history tracking
CREATE OR REPLACE FUNCTION update_alert_status(
  p_alert_id UUID,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_old_status TEXT;
BEGIN
  -- Get current status
  SELECT status INTO v_old_status FROM cs_alerts WHERE id = p_alert_id;
  
  -- Update the alert
  UPDATE cs_alerts 
  SET 
    status = p_new_status,
    acknowledged_at = CASE WHEN p_new_status = 'acknowledged' AND acknowledged_at IS NULL THEN NOW() ELSE acknowledged_at END,
    resolved_at = CASE WHEN p_new_status IN ('resolved', 'dismissed', 'false_positive') THEN NOW() ELSE resolved_at END,
    resolution_notes = COALESCE(p_notes, resolution_notes)
  WHERE id = p_alert_id;
  
  -- Log the change
  INSERT INTO cs_alert_history (alert_id, action, old_value, new_value, performed_by, notes)
  VALUES (
    p_alert_id, 
    'status_changed', 
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_new_status),
    p_user_id,
    p_notes
  );
END;
$$ LANGUAGE plpgsql;



