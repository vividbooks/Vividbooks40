-- =====================================================
-- DIAGNOSTIC SCRIPT: Check Database Status
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Check if teacher content tables exist
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename IN (
  'teacher_boards',
  'teacher_documents', 
  'teacher_folders',
  'teacher_worksheets',
  'teacher_files',
  'teacher_links',
  'teacher_deleted_items',
  'students',
  'classes',
  'assignments',
  'results'
)
ORDER BY tablename;

-- 2. Check teacher_boards structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'teacher_boards'
ORDER BY ordinal_position;

-- 3. Check RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN (
  'teacher_boards',
  'teacher_documents',
  'teacher_folders',
  'teacher_worksheets',
  'teacher_files',
  'teacher_links',
  'students',
  'results'
)
ORDER BY tablename;

-- 4. Check RLS policies for teacher_boards
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'teacher_boards'
ORDER BY policyname;

-- 5. Check students table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'students'
ORDER BY ordinal_position;

-- 6. Check RLS policies for students
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'students'
ORDER BY policyname;

-- 7. Count data in tables
SELECT 
  'teacher_boards' as table_name,
  COUNT(*) as row_count
FROM teacher_boards
UNION ALL
SELECT 
  'teacher_folders' as table_name,
  COUNT(*) as row_count
FROM teacher_folders
UNION ALL
SELECT 
  'students' as table_name,
  COUNT(*) as row_count
FROM students
UNION ALL
SELECT 
  'results' as table_name,
  COUNT(*) as row_count
FROM results;
