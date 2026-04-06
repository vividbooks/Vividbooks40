-- Uložení zavření dialogu „Kam uložit výsledky?“ (náhrada za quiz_setup_dismissed_${sessionId} v localStorage).
ALTER TABLE teacher_class_preferences
  ADD COLUMN IF NOT EXISTS quiz_setup_dismissed_sessions JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN teacher_class_preferences.quiz_setup_dismissed_sessions IS
  'Mapa session_public_id -> true po zavření first-time setup dialogu u výsledků kvízu.';
