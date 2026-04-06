-- Plánovaný počet stran knihy (Bookshelf / Workbook Pro).
-- Idempotentní: projekty bez dřívější migrace 20260309_teacher_books_pages.sql dostanou sloupec teď.
ALTER TABLE public.teacher_books
  ADD COLUMN IF NOT EXISTS total_pages INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.teacher_books.total_pages IS 'Plánovaný počet stránek sešitu (UI 1–500).';
