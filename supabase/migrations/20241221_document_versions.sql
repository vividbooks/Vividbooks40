-- =====================================================
-- Document Versions - Historie verzí dokumentů
-- =====================================================

-- Tabulka pro ukládání verzí dokumentů
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifikace dokumentu
  document_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  category TEXT,
  
  -- Obsah verze
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'html',
  
  -- Metadata verze
  version_number INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  content_size INTEGER,
  
  -- Kdo a kdy
  created_by UUID,
  created_by_type TEXT DEFAULT 'teacher',
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Typ změny
  change_type TEXT DEFAULT 'auto',
  change_description TEXT,
  
  -- Dodatečná metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexy
CREATE INDEX IF NOT EXISTS idx_document_versions_document 
  ON document_versions(document_id, document_type);
  
CREATE INDEX IF NOT EXISTS idx_document_versions_created_at 
  ON document_versions(created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_document_versions_hash 
  ON document_versions(content_hash);

CREATE INDEX IF NOT EXISTS idx_document_versions_user 
  ON document_versions(created_by);

-- Enable Row Level Security
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- Policies
-- Umožní čtení verzí: vlastní + všechny pro učitele
CREATE POLICY "Users can read document versions"
  ON document_versions
  FOR SELECT
  USING (
    -- Vlastní verze
    created_by = auth.uid() 
    OR 
    -- Učitelé vidí všechny verze
    EXISTS (SELECT 1 FROM teachers t WHERE t.id = auth.uid())
    OR
    -- Studenti vidí své verze (přes auth_id)
    EXISTS (SELECT 1 FROM students s WHERE s.auth_id = auth.uid())
  );

-- Umožní vytvoření verzí pro přihlášené uživatele
CREATE POLICY "Users can create document versions"
  ON document_versions
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Teachers can delete own versions"
  ON document_versions
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM teachers t 
      WHERE t.id = auth.uid()
    )
  );

-- Funkce pro čištění starých verzí
CREATE OR REPLACE FUNCTION cleanup_old_versions(
  max_versions_per_doc INTEGER DEFAULT 50,
  max_age_days INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER := 0;
BEGIN
  -- Smaž verze starší než max_age_days
  WITH versions_to_delete AS (
    SELECT dv.id
    FROM document_versions dv
    WHERE dv.created_at < NOW() - (max_age_days || ' days')::INTERVAL
    AND dv.id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY document_id, document_type 
          ORDER BY created_at DESC
        ) as rn
        FROM document_versions
      ) ranked
      WHERE rn <= 5
    )
  )
  DELETE FROM document_versions 
  WHERE id IN (SELECT id FROM versions_to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Smaž verze nad limit
  WITH excess_versions AS (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY document_id, document_type 
        ORDER BY created_at DESC
      ) as rn
      FROM document_versions
    ) ranked
    WHERE rn > max_versions_per_doc
  )
  DELETE FROM document_versions 
  WHERE id IN (SELECT id FROM excess_versions);
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  RETURN deleted_count;
END;
$$;

-- Komentáře
COMMENT ON TABLE document_versions IS 'Historie verzí všech typů dokumentů';
