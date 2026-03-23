-- Opravit typ teacher_worksheet_id z UUID na TEXT
-- (worksheet IDs mají formát "worksheet-TIMESTAMP", ne UUID)
ALTER TABLE worksheet_rag_examples
  ALTER COLUMN teacher_worksheet_id TYPE TEXT;
