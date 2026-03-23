-- Add total_pages to teacher_books
ALTER TABLE teacher_books
  ADD COLUMN IF NOT EXISTS total_pages INTEGER NOT NULL DEFAULT 0;
