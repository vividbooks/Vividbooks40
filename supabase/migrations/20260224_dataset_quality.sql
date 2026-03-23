ALTER TABLE topic_data_sets
  ADD COLUMN IF NOT EXISTS quality_score integer,
  ADD COLUMN IF NOT EXISTS quality_flags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS teacher_note text DEFAULT '';
