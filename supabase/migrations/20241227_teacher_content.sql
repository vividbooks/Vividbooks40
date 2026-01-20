-- =============================================
-- TEACHER CONTENT TABLES
-- Stores all user-generated content (folders, documents, boards, etc.)
-- =============================================

-- Teacher Folders (hierarchical structure)
CREATE TABLE IF NOT EXISTS teacher_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  parent_id UUID REFERENCES teacher_folders(id) ON DELETE CASCADE,
  copied_from TEXT, -- 'vividbooks-category', 'vividbooks-book', etc.
  original_id TEXT, -- original item ID if copied
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teacher Documents
CREATE TABLE IF NOT EXISTS teacher_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES teacher_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Nový dokument',
  content TEXT,
  description TEXT,
  document_type TEXT DEFAULT 'document',
  copied_from TEXT,
  original_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teacher Boards (Quizzes/VividBoards)
CREATE TABLE IF NOT EXISTS teacher_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES teacher_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Nový board',
  subject TEXT,
  grade INTEGER,
  slides JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  copied_from TEXT,
  original_id TEXT,
  slides_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teacher Worksheets
CREATE TABLE IF NOT EXISTS teacher_worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES teacher_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Nový pracovní list',
  source_page_id TEXT,
  source_page_title TEXT,
  source_page_slug TEXT,
  worksheet_type TEXT,
  content JSONB,
  pdf_settings JSONB,
  copied_from TEXT,
  original_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teacher Files (uploaded files)
CREATE TABLE IF NOT EXISTS teacher_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES teacher_folders(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teacher Links
CREATE TABLE IF NOT EXISTS teacher_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES teacher_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_teacher_folders_teacher ON teacher_folders(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_folders_parent ON teacher_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_teacher_documents_teacher ON teacher_documents(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_documents_folder ON teacher_documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_teacher_boards_teacher ON teacher_boards(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_boards_folder ON teacher_boards(folder_id);
CREATE INDEX IF NOT EXISTS idx_teacher_worksheets_teacher ON teacher_worksheets(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_worksheets_folder ON teacher_worksheets(folder_id);
CREATE INDEX IF NOT EXISTS idx_teacher_files_teacher ON teacher_files(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_files_folder ON teacher_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_teacher_links_teacher ON teacher_links(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_links_folder ON teacher_links(folder_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE teacher_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_links ENABLE ROW LEVEL SECURITY;

-- Policies: Teachers can only see/edit their own content
CREATE POLICY "Teachers can manage own folders" ON teacher_folders
  FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can manage own documents" ON teacher_documents
  FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can manage own boards" ON teacher_boards
  FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can manage own worksheets" ON teacher_worksheets
  FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can manage own files" ON teacher_files
  FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can manage own links" ON teacher_links
  FOR ALL USING (auth.uid() = teacher_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_teacher_folders_updated_at ON teacher_folders;
CREATE TRIGGER update_teacher_folders_updated_at
  BEFORE UPDATE ON teacher_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teacher_documents_updated_at ON teacher_documents;
CREATE TRIGGER update_teacher_documents_updated_at
  BEFORE UPDATE ON teacher_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teacher_boards_updated_at ON teacher_boards;
CREATE TRIGGER update_teacher_boards_updated_at
  BEFORE UPDATE ON teacher_boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teacher_worksheets_updated_at ON teacher_worksheets;
CREATE TRIGGER update_teacher_worksheets_updated_at
  BEFORE UPDATE ON teacher_worksheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

