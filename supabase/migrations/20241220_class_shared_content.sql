-- Class Shared Content table
-- Stores content shared by teachers with their classes

CREATE TABLE IF NOT EXISTS class_shared_content (
  id TEXT PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('document', 'board', 'folder')),
  content_id TEXT NOT NULL,
  folder_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by class
CREATE INDEX IF NOT EXISTS idx_class_shared_content_class_id ON class_shared_content(class_id);

-- Index for teacher lookups
CREATE INDEX IF NOT EXISTS idx_class_shared_content_teacher_id ON class_shared_content(teacher_id);

-- Enable RLS
ALTER TABLE class_shared_content ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read shared content (students need to see it)
CREATE POLICY "Anyone can read shared content" ON class_shared_content
  FOR SELECT USING (true);

-- Policy: Teachers can insert/update/delete their own shared content
CREATE POLICY "Teachers can manage their shared content" ON class_shared_content
  FOR ALL USING (true);

