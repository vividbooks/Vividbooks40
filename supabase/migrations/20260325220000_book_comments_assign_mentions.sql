-- Přiřazení komentáře uživateli + @jméno (slug) pro vlastníka knihy a pozvané

ALTER TABLE public.teacher_book_comment_threads
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_book_comment_threads_assignee
  ON public.teacher_book_comment_threads(book_id, assigned_to_user_id)
  WHERE assigned_to_user_id IS NOT NULL;

-- Jeden @handle na knihu u vlastníka (volitelné)
ALTER TABLE public.teacher_books
  ADD COLUMN IF NOT EXISTS owner_mention_slug TEXT;

ALTER TABLE public.teacher_books
  DROP CONSTRAINT IF EXISTS teacher_books_owner_mention_slug_format;

ALTER TABLE public.teacher_books
  ADD CONSTRAINT teacher_books_owner_mention_slug_format
  CHECK (
    owner_mention_slug IS NULL
    OR (length(owner_mention_slug) BETWEEN 2 AND 32 AND owner_mention_slug ~ '^[a-z0-9_]+$')
  );

-- @handle u pozvaného v rámci knihy (unikátní per book)
ALTER TABLE public.teacher_book_shares
  ADD COLUMN IF NOT EXISTS mention_slug TEXT;

ALTER TABLE public.teacher_book_shares
  DROP CONSTRAINT IF EXISTS teacher_book_shares_mention_slug_format;

ALTER TABLE public.teacher_book_shares
  ADD CONSTRAINT teacher_book_shares_mention_slug_format
  CHECK (
    mention_slug IS NULL
    OR (length(mention_slug) BETWEEN 2 AND 32 AND mention_slug ~ '^[a-z0-9_]+$')
  );

DROP INDEX IF EXISTS teacher_book_shares_book_mention_slug_unique;

CREATE UNIQUE INDEX teacher_book_shares_book_mention_slug_unique
  ON public.teacher_book_shares (book_id, lower(mention_slug))
  WHERE mention_slug IS NOT NULL;
