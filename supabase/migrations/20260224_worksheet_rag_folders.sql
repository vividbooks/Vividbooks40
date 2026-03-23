-- ============================================================
-- Přidat folder sloupec do worksheet_rag_examples
-- ============================================================

ALTER TABLE worksheet_rag_examples
  ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'Bez složky';

CREATE INDEX IF NOT EXISTS worksheet_rag_folder_idx
  ON worksheet_rag_examples (folder);
