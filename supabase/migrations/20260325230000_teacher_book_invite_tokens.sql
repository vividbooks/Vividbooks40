-- Odkazy na pozvání ke knize (po přihlášení přijme RPC a přidá řádek do teacher_book_shares).

CREATE TABLE IF NOT EXISTS public.teacher_book_invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id TEXT NOT NULL REFERENCES public.teacher_books(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INT NOT NULL DEFAULT 50,
  use_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_book_invite_tokens_token_unique UNIQUE (token),
  CONSTRAINT teacher_book_invite_tokens_max_uses_check CHECK (max_uses >= 1 AND max_uses <= 1000),
  CONSTRAINT teacher_book_invite_tokens_use_count_check CHECK (use_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_teacher_book_invite_tokens_book
  ON public.teacher_book_invite_tokens(book_id);

ALTER TABLE public.teacher_book_invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY teacher_book_invite_tokens_insert_owner
  ON public.teacher_book_invite_tokens FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = book_id AND b.teacher_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY teacher_book_invite_tokens_select_owner
  ON public.teacher_book_invite_tokens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = book_id AND b.teacher_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.accept_teacher_book_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.teacher_book_invite_tokens%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO rec
  FROM public.teacher_book_invite_tokens
  WHERE token = trim(p_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF rec.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF rec.use_count >= rec.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'exhausted');
  END IF;

  IF EXISTS (SELECT 1 FROM public.teacher_books b WHERE b.id = rec.book_id AND b.teacher_id = uid) THEN
    RETURN jsonb_build_object('ok', true, 'book_id', rec.book_id, 'note', 'owner_skip');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.teacher_book_shares s
    WHERE s.book_id = rec.book_id AND s.shared_with_user_id = uid
  ) THEN
    UPDATE public.teacher_book_invite_tokens SET use_count = use_count + 1 WHERE id = rec.id;
    RETURN jsonb_build_object('ok', true, 'book_id', rec.book_id, 'note', 'already_shared');
  END IF;

  INSERT INTO public.teacher_book_shares (book_id, shared_with_user_id)
  VALUES (rec.book_id, uid);

  UPDATE public.teacher_book_invite_tokens SET use_count = use_count + 1 WHERE id = rec.id;

  RETURN jsonb_build_object('ok', true, 'book_id', rec.book_id, 'note', 'added');
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.teacher_book_invite_tokens SET use_count = use_count + 1 WHERE id = rec.id;
    RETURN jsonb_build_object('ok', true, 'book_id', rec.book_id, 'note', 'already_shared');
END;
$$;

REVOKE ALL ON FUNCTION public.accept_teacher_book_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_teacher_book_invite(text) TO authenticated;
