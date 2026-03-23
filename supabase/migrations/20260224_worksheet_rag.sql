-- ============================================================
-- Worksheet RAG databáze + propojení worksheetů s datasety
-- ============================================================

-- 1. pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. RAG tabulka příkladů hezkých/funkčních pracovních listů
CREATE TABLE IF NOT EXISTS worksheet_rag_examples (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  subject       TEXT,                         -- 'dejepis', 'matematika', ...
  grade         INT,                          -- 1-9
  topic         TEXT,
  quality_score FLOAT DEFAULT 0.8,            -- skóre kvality (0-1)
  blocks_json   JSONB NOT NULL DEFAULT '[]',  -- pole WorksheetBlock[]
  style_notes   TEXT,                         -- proč je list dobrý (pro AI kontext)
  embedding     vector(768),                  -- Gemini text-embedding-004 (768 dim)
  source        TEXT DEFAULT 'manual',        -- 'manual' | 'auto' | 'import'
  teacher_worksheet_id UUID,                  -- odkaz na původní teacher_worksheets.id
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Index pro vektorové vyhledávání (cosine similarity)
CREATE INDEX IF NOT EXISTS worksheet_rag_embedding_idx
  ON worksheet_rag_examples
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- Index pro filtrování podle předmětu/ročníku
CREATE INDEX IF NOT EXISTS worksheet_rag_subject_grade_idx
  ON worksheet_rag_examples (subject, grade);

-- RLS
ALTER TABLE worksheet_rag_examples ENABLE ROW LEVEL SECURITY;

-- Admin může vše
CREATE POLICY "Admin full access on worksheet_rag_examples"
  ON worksheet_rag_examples
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teacher_profiles
      WHERE teacher_profiles.user_id = auth.uid()
        AND teacher_profiles.role = 'admin'
    )
  );

-- Čtení je povoleno pro přihlášené uživatele (pro generování)
CREATE POLICY "Authenticated read worksheet_rag_examples"
  ON worksheet_rag_examples
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. RPC funkce pro similarity search
CREATE OR REPLACE FUNCTION search_worksheet_rag(
  query_embedding   vector(768),
  filter_subject    TEXT DEFAULT NULL,
  filter_grade      INT  DEFAULT NULL,
  match_count       INT  DEFAULT 3,
  min_quality       FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id            UUID,
  title         TEXT,
  subject       TEXT,
  grade         INT,
  topic         TEXT,
  quality_score FLOAT,
  blocks_json   JSONB,
  style_notes   TEXT,
  similarity    FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.title,
    r.subject,
    r.grade,
    r.topic,
    r.quality_score,
    r.blocks_json,
    r.style_notes,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM worksheet_rag_examples r
  WHERE r.embedding IS NOT NULL
    AND r.quality_score >= min_quality
    AND (filter_subject IS NULL OR r.subject = filter_subject)
    AND (filter_grade IS NULL OR r.grade = filter_grade OR ABS(r.grade - filter_grade) <= 1)
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Přidat source_dataset_id do teacher_worksheets
ALTER TABLE teacher_worksheets
  ADD COLUMN IF NOT EXISTS source_dataset_id UUID REFERENCES topic_data_sets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_worksheets_dataset
  ON teacher_worksheets (source_dataset_id)
  WHERE source_dataset_id IS NOT NULL;

-- 5. Trigger pro updated_at na RAG tabulce
CREATE OR REPLACE FUNCTION update_worksheet_rag_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER worksheet_rag_updated_at
  BEFORE UPDATE ON worksheet_rag_examples
  FOR EACH ROW
  EXECUTE FUNCTION update_worksheet_rag_updated_at();
