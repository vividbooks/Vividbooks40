-- Moje třída: předvolby UI (záložka, vybraná třída) — napříč zařízeními, bez localStorage.
CREATE TABLE IF NOT EXISTS teacher_class_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_tab TEXT CHECK (last_tab IN ('results', 'classes', 'individual')),
  selected_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_class_preferences_updated ON teacher_class_preferences(updated_at DESC);

ALTER TABLE teacher_class_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own class preferences"
  ON teacher_class_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
