-- =====================================================
-- FIX COMMON SYNC ISSUES
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- =====================================================
-- 1. FIX: teacher_boards.id should accept TEXT (not just UUID)
-- Problem: Code uses string IDs like "board-1768463272992"
-- =====================================================

-- Check current type
DO $$ 
BEGIN
  -- If id is UUID, convert to TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teacher_boards' 
    AND column_name = 'id' 
    AND data_type = 'uuid'
  ) THEN
    -- Drop constraints that depend on UUID type
    ALTER TABLE teacher_boards ALTER COLUMN id DROP DEFAULT;
    
    -- Convert to TEXT
    ALTER TABLE teacher_boards ALTER COLUMN id TYPE TEXT USING id::TEXT;
    
    RAISE NOTICE 'teacher_boards.id converted from UUID to TEXT';
  ELSE
    RAISE NOTICE 'teacher_boards.id is already TEXT';
  END IF;
END $$;

-- Do the same for other tables
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teacher_documents' 
    AND column_name = 'id' 
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE teacher_documents ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE teacher_documents ALTER COLUMN id TYPE TEXT USING id::TEXT;
    RAISE NOTICE 'teacher_documents.id converted to TEXT';
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teacher_folders' 
    AND column_name = 'id' 
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE teacher_folders ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE teacher_folders ALTER COLUMN id TYPE TEXT USING id::TEXT;
    RAISE NOTICE 'teacher_folders.id converted to TEXT';
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teacher_worksheets' 
    AND column_name = 'id' 
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE teacher_worksheets ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE teacher_worksheets ALTER COLUMN id TYPE TEXT USING id::TEXT;
    RAISE NOTICE 'teacher_worksheets.id converted to TEXT';
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teacher_files' 
    AND column_name = 'id' 
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE teacher_files ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE teacher_files ALTER COLUMN id TYPE TEXT USING id::TEXT;
    RAISE NOTICE 'teacher_files.id converted to TEXT';
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teacher_links' 
    AND column_name = 'id' 
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE teacher_links ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE teacher_links ALTER COLUMN id TYPE TEXT USING id::TEXT;
    RAISE NOTICE 'teacher_links.id converted to TEXT';
  END IF;
END $$;

-- =====================================================
-- 2. FIX: Add missing students auth columns
-- =====================================================

-- Add auth_id if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE students ADD COLUMN auth_id UUID UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_students_auth_id ON students(auth_id);
    RAISE NOTICE 'Added students.auth_id column';
  END IF;
END $$;

-- Add password_setup_token if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'password_setup_token'
  ) THEN
    ALTER TABLE students ADD COLUMN password_setup_token VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_students_password_setup_token ON students(password_setup_token);
    RAISE NOTICE 'Added students.password_setup_token column';
  END IF;
END $$;

-- Add password_setup_expires if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'password_setup_expires'
  ) THEN
    ALTER TABLE students ADD COLUMN password_setup_expires TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Added students.password_setup_expires column';
  END IF;
END $$;

-- Add is_online if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'is_online'
  ) THEN
    ALTER TABLE students ADD COLUMN is_online BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added students.is_online column';
  END IF;
END $$;

-- Add last_seen if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'last_seen'
  ) THEN
    ALTER TABLE students ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Added students.last_seen column';
  END IF;
END $$;

-- =====================================================
-- 3. VERIFY: Check if everything is OK
-- =====================================================

-- Show final status
SELECT 
  'teacher_boards.id' as check_name,
  data_type as status
FROM information_schema.columns
WHERE table_name = 'teacher_boards' AND column_name = 'id'
UNION ALL
SELECT 
  'students.auth_id' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'auth_id'
  ) THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'students RLS' as check_name,
  CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_tables
WHERE tablename = 'students'
UNION ALL
SELECT 
  'teacher_boards RLS' as check_name,
  CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_tables
WHERE tablename = 'teacher_boards';
