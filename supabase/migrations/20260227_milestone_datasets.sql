-- Uzlové body (Milestone Datasets)
-- Přidá sloupce milestone a milestone_data do topic_data_sets

ALTER TABLE topic_data_sets
  ADD COLUMN IF NOT EXISTS milestone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS milestone_data jsonb;

-- Index pro rychlé filtrování milestone datasetů
CREATE INDEX IF NOT EXISTS idx_topic_data_sets_milestone
  ON topic_data_sets (milestone)
  WHERE milestone = true;

COMMENT ON COLUMN topic_data_sets.milestone IS
  'True = uzlový bod (uzavření tematického celku) – obsahuje souhrnný test, písemku a hodnoticí dokument';

COMMENT ON COLUMN topic_data_sets.milestone_data IS
  'JSON s MilestoneData: topicGroupName, coveredWeekNumbers, coveredTopics, test, pisemka, hodnoceni';
