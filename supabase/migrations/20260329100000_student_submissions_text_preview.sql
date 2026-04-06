-- Náhled textu odevzdání pro učitele (plain text, žádné base64).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_submissions'
  ) THEN
    ALTER TABLE public.student_submissions ADD COLUMN IF NOT EXISTS text_preview TEXT;
    COMMENT ON COLUMN public.student_submissions.text_preview IS 'Krátký text odevzdání pro náhled u učitele (bez HTML/base64).';
  END IF;
END $$;
