-- =====================================================
-- Oprava: infinite recursion detected in policy for relation 'teacher_books'
-- =====================================================
-- teacher_books_select_shared čte teacher_book_shares (RLS).
-- Politiky na teacher_book_shares používají EXISTS (SELECT … FROM teacher_books),
-- což znovu spustí RLS na teacher_books včetně select_shared → cyklus.
-- Řešení: kontrola vlastnictví knihy přes SECURITY DEFINER funkci (obchází RLS).

CREATE OR REPLACE FUNCTION public.teacher_book_is_owner(p_book_id text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_books b
    WHERE b.id = p_book_id AND b.teacher_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.teacher_book_is_owner(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_book_is_owner(text, uuid) TO authenticated;

DROP POLICY IF EXISTS teacher_book_shares_select ON public.teacher_book_shares;
DROP POLICY IF EXISTS teacher_book_shares_insert_owner ON public.teacher_book_shares;
DROP POLICY IF EXISTS teacher_book_shares_delete_owner_or_recipient ON public.teacher_book_shares;

CREATE POLICY teacher_book_shares_select
  ON public.teacher_book_shares FOR SELECT TO authenticated
  USING (
    shared_with_user_id = auth.uid()
    OR public.teacher_book_is_owner(book_id, auth.uid())
  );

CREATE POLICY teacher_book_shares_insert_owner
  ON public.teacher_book_shares FOR INSERT TO authenticated
  WITH CHECK (
    public.teacher_book_is_owner(book_id, auth.uid())
    AND shared_with_user_id IS DISTINCT FROM auth.uid()
  );

CREATE POLICY teacher_book_shares_delete_owner_or_recipient
  ON public.teacher_book_shares FOR DELETE TO authenticated
  USING (
    shared_with_user_id = auth.uid()
    OR public.teacher_book_is_owner(book_id, auth.uid())
  );
