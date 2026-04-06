-- Role u pozvaných uživatelů: editor (výchozí) | komentátor
-- Vlastník zůstává teacher_books.teacher_id (v UI jako „Vlastník“).

ALTER TABLE public.teacher_book_shares
  ADD COLUMN IF NOT EXISTS access_role TEXT DEFAULT 'editor';

UPDATE public.teacher_book_shares
SET access_role = 'editor'
WHERE access_role IS NULL OR trim(access_role) = '';

ALTER TABLE public.teacher_book_shares
  ALTER COLUMN access_role SET DEFAULT 'editor';

ALTER TABLE public.teacher_book_shares
  ALTER COLUMN access_role SET NOT NULL;

ALTER TABLE public.teacher_book_shares
  DROP CONSTRAINT IF EXISTS teacher_book_shares_access_role_check;

ALTER TABLE public.teacher_book_shares
  ADD CONSTRAINT teacher_book_shares_access_role_check
  CHECK (access_role IN ('editor', 'commenter'));

DROP POLICY IF EXISTS teacher_book_shares_update_owner ON public.teacher_book_shares;

CREATE POLICY teacher_book_shares_update_owner
  ON public.teacher_book_shares FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = teacher_book_shares.book_id AND b.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = teacher_book_shares.book_id AND b.teacher_id = auth.uid()
    )
    AND access_role IN ('editor', 'commenter')
  );
