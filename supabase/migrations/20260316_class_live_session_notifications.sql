ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS active_session_id TEXT,
  ADD COLUMN IF NOT EXISTS active_session_path TEXT,
  ADD COLUMN IF NOT EXISTS active_session_title TEXT;

ALTER TABLE public.classes REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'classes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;
  END IF;
END $$;
