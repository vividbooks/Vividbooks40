-- =====================================================
-- Kniha: komentáře (vlákna + zprávy) a úkoly (kanban)
-- Přístup: vlastník knihy nebo uživatel v teacher_book_shares
-- (využívá public.user_has_teacher_book_share z předchozích migrací)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.teacher_book_comment_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id TEXT NOT NULL REFERENCES public.teacher_books(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL DEFAULT 'book'
    CHECK (target_type IN ('book', 'worksheet', 'block')),
  worksheet_id TEXT,
  block_id TEXT,
  anchor JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_teacher_book_comment_threads_book
  ON public.teacher_book_comment_threads(book_id);
CREATE INDEX IF NOT EXISTS idx_teacher_book_comment_threads_status
  ON public.teacher_book_comment_threads(book_id, status);

CREATE TABLE IF NOT EXISTS public.teacher_book_comment_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.teacher_book_comment_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  CONSTRAINT teacher_book_comment_messages_body_nonempty CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_teacher_book_comment_messages_thread
  ON public.teacher_book_comment_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS public.teacher_book_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id TEXT NOT NULL REFERENCES public.teacher_books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  assignee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ,
  sort_order DOUBLE PRECISION NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  comment_thread_id UUID REFERENCES public.teacher_book_comment_threads(id) ON DELETE SET NULL,
  worksheet_id TEXT,
  block_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_book_tasks_title_nonempty CHECK (length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_teacher_book_tasks_book
  ON public.teacher_book_tasks(book_id, status, sort_order);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_teacher_book_comment_threads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teacher_book_comment_threads_updated ON public.teacher_book_comment_threads;
CREATE TRIGGER trg_teacher_book_comment_threads_updated
  BEFORE UPDATE ON public.teacher_book_comment_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_teacher_book_comment_threads_updated_at();

CREATE OR REPLACE FUNCTION public.touch_teacher_book_tasks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teacher_book_tasks_updated ON public.teacher_book_tasks;
CREATE TRIGGER trg_teacher_book_tasks_updated
  BEFORE UPDATE ON public.teacher_book_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_teacher_book_tasks_updated_at();

-- RLS helper: vlastník nebo sdílený uživatel
-- (user_has_teacher_book_share je SECURITY DEFINER z 20260324150000)

ALTER TABLE public.teacher_book_comment_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_book_comment_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_book_tasks ENABLE ROW LEVEL SECURITY;

-- Threads
CREATE POLICY teacher_book_comment_threads_select
  ON public.teacher_book_comment_threads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = teacher_book_comment_threads.book_id AND b.teacher_id = auth.uid()
    )
    OR public.user_has_teacher_book_share(teacher_book_comment_threads.book_id, auth.uid())
  );

CREATE POLICY teacher_book_comment_threads_insert
  ON public.teacher_book_comment_threads FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.teacher_books b
        WHERE b.id = book_id AND b.teacher_id = auth.uid()
      )
      OR public.user_has_teacher_book_share(book_id, auth.uid())
    )
  );

CREATE POLICY teacher_book_comment_threads_update
  ON public.teacher_book_comment_threads FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = teacher_book_comment_threads.book_id AND b.teacher_id = auth.uid()
    )
    OR public.user_has_teacher_book_share(teacher_book_comment_threads.book_id, auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = teacher_book_comment_threads.book_id AND b.teacher_id = auth.uid()
    )
    OR public.user_has_teacher_book_share(teacher_book_comment_threads.book_id, auth.uid())
  );

CREATE POLICY teacher_book_comment_threads_delete
  ON public.teacher_book_comment_threads FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = teacher_book_comment_threads.book_id AND b.teacher_id = auth.uid()
    )
    OR public.user_has_teacher_book_share(teacher_book_comment_threads.book_id, auth.uid())
  );

-- Messages
CREATE POLICY teacher_book_comment_messages_select
  ON public.teacher_book_comment_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_book_comment_threads t
      WHERE t.id = thread_id
      AND (
        EXISTS (SELECT 1 FROM public.teacher_books b WHERE b.id = t.book_id AND b.teacher_id = auth.uid())
        OR public.user_has_teacher_book_share(t.book_id, auth.uid())
      )
    )
  );

CREATE POLICY teacher_book_comment_messages_insert
  ON public.teacher_book_comment_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.teacher_book_comment_threads t
      WHERE t.id = thread_id
      AND (
        EXISTS (SELECT 1 FROM public.teacher_books b WHERE b.id = t.book_id AND b.teacher_id = auth.uid())
        OR public.user_has_teacher_book_share(t.book_id, auth.uid())
      )
    )
  );

CREATE POLICY teacher_book_comment_messages_update
  ON public.teacher_book_comment_messages FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY teacher_book_comment_messages_delete
  ON public.teacher_book_comment_messages FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teacher_book_comment_threads t
      JOIN public.teacher_books b ON b.id = t.book_id
      WHERE t.id = thread_id AND b.teacher_id = auth.uid()
    )
  );

-- Tasks
CREATE POLICY teacher_book_tasks_select
  ON public.teacher_book_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = teacher_book_tasks.book_id AND b.teacher_id = auth.uid()
    )
    OR public.user_has_teacher_book_share(teacher_book_tasks.book_id, auth.uid())
  );

CREATE POLICY teacher_book_tasks_insert
  ON public.teacher_book_tasks FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.teacher_books b
        WHERE b.id = book_id AND b.teacher_id = auth.uid()
      )
      OR public.user_has_teacher_book_share(book_id, auth.uid())
    )
  );

CREATE POLICY teacher_book_tasks_update
  ON public.teacher_book_tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = teacher_book_tasks.book_id AND b.teacher_id = auth.uid()
    )
    OR public.user_has_teacher_book_share(teacher_book_tasks.book_id, auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = teacher_book_tasks.book_id AND b.teacher_id = auth.uid()
    )
    OR public.user_has_teacher_book_share(teacher_book_tasks.book_id, auth.uid())
  );

CREATE POLICY teacher_book_tasks_delete
  ON public.teacher_book_tasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_books b
      WHERE b.id = teacher_book_tasks.book_id AND b.teacher_id = auth.uid()
    )
    OR public.user_has_teacher_book_share(teacher_book_tasks.book_id, auth.uid())
  );

GRANT ALL ON public.teacher_book_comment_threads TO authenticated;
GRANT ALL ON public.teacher_book_comment_messages TO authenticated;
GRANT ALL ON public.teacher_book_tasks TO authenticated;

-- Realtime (volitelné; stejný vzor jako live_sessions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'teacher_book_comment_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_book_comment_threads;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'teacher_book_comment_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_book_comment_messages;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'teacher_book_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_book_tasks;
  END IF;
END $$;
