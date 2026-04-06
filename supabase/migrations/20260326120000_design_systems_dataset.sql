-- Persist design system reference dataset (text + image URLs with catalog notes) for AI canvas / generation.
ALTER TABLE public.design_systems
  ADD COLUMN IF NOT EXISTS dataset jsonb NOT NULL DEFAULT '{"files":[]}'::jsonb;

COMMENT ON COLUMN public.design_systems.dataset IS 'DesignSystemDataset JSON: files (text/image URLs), topic — never base64 blobs';
