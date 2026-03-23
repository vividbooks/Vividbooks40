-- =============================================
-- TEACHER BOOKS
-- Dedicated table for pro workbooks.
-- Each book groups worksheets (chapters).
-- =============================================

CREATE TABLE IF NOT EXISTS teacher_books (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  teacher_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'Nová kniha',
  subject      TEXT,
  grade        TEXT,
  color        TEXT DEFAULT '#3B82F6',
  cover_url    TEXT,
  design_system_id TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- index for fast per-teacher queries
CREATE INDEX IF NOT EXISTS idx_teacher_books_teacher ON teacher_books(teacher_id);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_teacher_books_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teacher_books_updated_at ON teacher_books;
CREATE TRIGGER trg_teacher_books_updated_at
  BEFORE UPDATE ON teacher_books
  FOR EACH ROW EXECUTE FUNCTION update_teacher_books_updated_at();

-- RLS
ALTER TABLE teacher_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can manage own books" ON teacher_books;
CREATE POLICY "Teachers can manage own books" ON teacher_books
  FOR ALL USING (auth.uid() = teacher_id);

-- Add book_id to teacher_worksheets (worksheets link to a book)
ALTER TABLE teacher_worksheets
  ADD COLUMN IF NOT EXISTS book_id TEXT REFERENCES teacher_books(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_worksheets_book ON teacher_worksheets(book_id);
