-- Teacher content table - stores worksheets, quizzes, and folders for sharing
CREATE TABLE IF NOT EXISTS teacher_content (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('document', 'board', 'folder')),
  folder_id TEXT, -- Parent folder (null = root)
  content_data JSONB, -- Full content for worksheets/quizzes
  color TEXT, -- For folders
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_content_teacher_id ON teacher_content(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_content_folder_id ON teacher_content(folder_id);
CREATE INDEX IF NOT EXISTS idx_teacher_content_type ON teacher_content(type);

-- Enable RLS
ALTER TABLE teacher_content ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read teacher content" ON teacher_content FOR SELECT USING (true);
CREATE POLICY "Teachers can manage their content" ON teacher_content FOR ALL USING (true);

-- Simplify class_shared_content - now only stores folder references
-- Drop old table if exists and recreate
DROP TABLE IF EXISTS class_shared_content;

CREATE TABLE class_shared_content (
  id TEXT PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL,
  folder_id TEXT NOT NULL, -- Reference to teacher_content folder
  folder_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_shared_content_class_id ON class_shared_content(class_id);
CREATE INDEX IF NOT EXISTS idx_class_shared_content_teacher_id ON class_shared_content(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_shared_content_folder_id ON class_shared_content(folder_id);

ALTER TABLE class_shared_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shared content" ON class_shared_content FOR SELECT USING (true);
CREATE POLICY "Teachers can manage their shared content" ON class_shared_content FOR ALL USING (true);

