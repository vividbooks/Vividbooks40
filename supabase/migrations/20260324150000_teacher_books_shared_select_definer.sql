-- =====================================================
-- teacher_books_select_shared bez dotazu na teacher_book_shares přes RLS
-- =====================================================
-- I po teacher_book_is_owner může PostgreSQL při SELECT na teacher_books vyhodnocovat
-- politiku teacher_books_select_shared s EXISTS (SELECT … teacher_book_shares),
-- což znovu pouští RLS na sdíleních a za určitých podmínek vede k 500 / rekurzi.
-- Kontrola „je uživatel příjemcem sdílení“ jde přímo přes SECURITY DEFINER (bez RLS na shares).

CREATE OR REPLACE FUNCTION public.user_has_teacher_book_share(p_book_id text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_book_shares s
    WHERE s.book_id = p_book_id AND s.shared_with_user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_teacher_book_share(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_teacher_book_share(text, uuid) TO authenticated;

DROP POLICY IF EXISTS teacher_books_select_shared ON public.teacher_books;
CREATE POLICY teacher_books_select_shared
  ON public.teacher_books FOR SELECT TO authenticated
  USING (public.user_has_teacher_book_share(id, auth.uid()));

DROP POLICY IF EXISTS worksheets_select_shared_book ON public.teacher_worksheets;
CREATE POLICY worksheets_select_shared_book
  ON public.teacher_worksheets FOR SELECT TO authenticated
  USING (
    book_id IS NOT NULL
    AND public.user_has_teacher_book_share(teacher_worksheets.book_id, auth.uid())
  );
