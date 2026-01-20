-- Add missing columns to teacher_files for file storage system
ALTER TABLE teacher_files ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE teacher_files ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE teacher_files ADD COLUMN IF NOT EXISTS slide_count INTEGER;



