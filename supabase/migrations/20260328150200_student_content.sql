-- Obsah žáka (složky / odkazy) — doplnění k existující tabulce students.
CREATE TABLE IF NOT EXISTS student_content (
  id TEXT PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('document', 'board', 'folder')),
  content_id TEXT,
  folder_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_content_student_id ON student_content(student_id);
CREATE INDEX IF NOT EXISTS idx_student_content_student_folder ON student_content(student_id, folder_id);

ALTER TABLE student_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access student_content"
  ON student_content
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
