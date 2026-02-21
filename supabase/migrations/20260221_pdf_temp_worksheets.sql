-- Temporary storage for PDF export.
-- No teacher_id required – used by the pdf-export edge function (service_role)
-- to make worksheet data available to Browserless without requiring auth.
-- Records expire after 1 hour and are safe to clean up periodically.

CREATE TABLE IF NOT EXISTS pdf_temp_worksheets (
  id TEXT PRIMARY KEY,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

-- No RLS – only accessible via service_role key in edge functions
ALTER TABLE pdf_temp_worksheets DISABLE ROW LEVEL SECURITY;
