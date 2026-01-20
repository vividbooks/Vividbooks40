-- Add missing columns to teacher_links table
-- Run this after the initial migration if table already exists

ALTER TABLE teacher_links ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE teacher_links ADD COLUMN IF NOT EXISTS transcript TEXT;











