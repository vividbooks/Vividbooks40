-- =====================================================
-- Teacher books: sdileni s jinym uzivatelem (Google SSO / auth.users)
-- + oprava RLS teacher_worksheets (odstraneni allow_all z curriculum fix)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.teacher_book_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id TEXT NOT NULL REFERENCES public.teacher_books(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_book_shares_unique_recipient UNIQUE (book_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_book_shares_recipient
  ON public.teacher_book_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_book_shares_book
  ON public.teacher_book_shares(book_id);

ALTER TABLE public.teacher_book_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY teacher_book_shares_select
  ON public.teacher_book_shares FOR SELECT TO authenticated
  USING (
    shared_with_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = book_id AND b.teacher_id = auth.uid()
    )
  );

CREATE POLICY teacher_book_shares_insert_owner
  ON public.teacher_book_shares FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = book_id AND b.teacher_id = auth.uid()
    )
    AND shared_with_user_id IS DISTINCT FROM auth.uid()
  );

CREATE POLICY teacher_book_shares_delete_owner_or_recipient
  ON public.teacher_book_shares FOR DELETE TO authenticated
  USING (
    shared_with_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = book_id AND b.teacher_id = auth.uid()
    )
  );

CREATE POLICY teacher_books_select_shared
  ON public.teacher_books FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_book_shares s
      WHERE s.book_id = teacher_books.id
        AND s.shared_with_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "allow_all_teacher_worksheets" ON public.teacher_worksheets;
DROP POLICY IF EXISTS "worksheets_select" ON public.teacher_worksheets;
DROP POLICY IF EXISTS "worksheets_insert" ON public.teacher_worksheets;
DROP POLICY IF EXISTS "worksheets_update" ON public.teacher_worksheets;
DROP POLICY IF EXISTS "worksheets_delete" ON public.teacher_worksheets;
DROP POLICY IF EXISTS "worksheets_select_own" ON public.teacher_worksheets;
DROP POLICY IF EXISTS "worksheets_select_shared_book" ON public.teacher_worksheets;
DROP POLICY IF EXISTS "worksheets_insert_own" ON public.teacher_worksheets;
DROP POLICY IF EXISTS "worksheets_update_own" ON public.teacher_worksheets;
DROP POLICY IF EXISTS "worksheets_delete_own" ON public.teacher_worksheets;
DROP POLICY IF EXISTS "Teachers can manage own worksheets" ON public.teacher_worksheets;

CREATE POLICY worksheets_select_own
  ON public.teacher_worksheets FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY worksheets_select_shared_book
  ON public.teacher_worksheets FOR SELECT TO authenticated
  USING (
    book_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.teacher_book_shares s
      WHERE s.book_id = teacher_worksheets.book_id
        AND s.shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY worksheets_insert_own
  ON public.teacher_worksheets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY worksheets_update_own
  ON public.teacher_worksheets FOR UPDATE TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY worksheets_delete_own
  ON public.teacher_worksheets FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id);

CREATE OR REPLACE FUNCTION public.lookup_user_id_for_book_share(target_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM auth.users u
  WHERE auth.uid() IS NOT NULL
    AND target_email IS NOT NULL
    AND length(trim(target_email)) > 0
    AND lower(trim(u.email::text)) = lower(trim(target_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_user_id_for_book_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_user_id_for_book_share(text) TO authenticated;
