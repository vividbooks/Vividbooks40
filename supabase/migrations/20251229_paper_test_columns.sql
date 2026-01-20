-- Add columns for paper test functionality
-- Run this in Supabase SQL Editor

-- 1. Add 'questions' column to assignments table
-- This stores the test questions structure for paper tests
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS questions JSONB;

-- 2. Add 'answers' column to results table
-- This stores individual question answers for paper tests
ALTER TABLE results 
ADD COLUMN IF NOT EXISTS answers JSONB;

-- 3. Add 'worksheet_id' column to assignments table (optional, for reference)
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS worksheet_id TEXT;

-- Example structure for questions:
-- [
--   { "number": 1, "type": "abc", "question": "...", "options": [...], "correctAnswer": "A", "maxPoints": 1 },
--   { "number": 2, "type": "open", "question": "...", "maxPoints": 2 }
-- ]

-- Example structure for answers:
-- [
--   { "questionNumber": 1, "questionType": "abc", "answer": "A", "isCorrect": true, "points": 1, "maxPoints": 1 },
--   { "questionNumber": 2, "questionType": "open", "answer": "Přepsaný text...", "points": 2, "maxPoints": 2 }
-- ]

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_assignments_type ON assignments(type);
CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_results_assignment_id ON results(assignment_id);







