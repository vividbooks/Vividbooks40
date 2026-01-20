-- =====================================================
-- FIX RLS POLICIES FOR TEACHER CONTENT TABLES
-- Problem: Policies block upsert when record exists
-- Solution: Separate policies + ensure teacher_id consistency
-- =====================================================
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- First, drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Teachers can manage own boards" ON teacher_boards;
DROP POLICY IF EXISTS "Teachers can view own boards" ON teacher_boards;
DROP POLICY IF EXISTS "Teachers can insert own boards" ON teacher_boards;
DROP POLICY IF EXISTS "Teachers can update own boards" ON teacher_boards;
DROP POLICY IF EXISTS "Teachers can delete own boards" ON teacher_boards;

DROP POLICY IF EXISTS "Teachers can manage own folders" ON teacher_folders;
DROP POLICY IF EXISTS "Teachers can view own folders" ON teacher_folders;
DROP POLICY IF EXISTS "Teachers can insert own folders" ON teacher_folders;
DROP POLICY IF EXISTS "Teachers can update own folders" ON teacher_folders;
DROP POLICY IF EXISTS "Teachers can delete own folders" ON teacher_folders;

DROP POLICY IF EXISTS "Teachers can manage own documents" ON teacher_documents;
DROP POLICY IF EXISTS "Teachers can view own documents" ON teacher_documents;
DROP POLICY IF EXISTS "Teachers can insert own documents" ON teacher_documents;
DROP POLICY IF EXISTS "Teachers can update own documents" ON teacher_documents;
DROP POLICY IF EXISTS "Teachers can delete own documents" ON teacher_documents;

DROP POLICY IF EXISTS "Teachers can manage own worksheets" ON teacher_worksheets;
DROP POLICY IF EXISTS "Teachers can view own worksheets" ON teacher_worksheets;
DROP POLICY IF EXISTS "Teachers can insert own worksheets" ON teacher_worksheets;
DROP POLICY IF EXISTS "Teachers can update own worksheets" ON teacher_worksheets;
DROP POLICY IF EXISTS "Teachers can delete own worksheets" ON teacher_worksheets;

DROP POLICY IF EXISTS "Teachers can manage own files" ON teacher_files;
DROP POLICY IF EXISTS "Teachers can view own files" ON teacher_files;
DROP POLICY IF EXISTS "Teachers can insert own files" ON teacher_files;
DROP POLICY IF EXISTS "Teachers can update own files" ON teacher_files;
DROP POLICY IF EXISTS "Teachers can delete own files" ON teacher_files;

DROP POLICY IF EXISTS "Teachers can manage own links" ON teacher_links;
DROP POLICY IF EXISTS "Teachers can view own links" ON teacher_links;
DROP POLICY IF EXISTS "Teachers can insert own links" ON teacher_links;
DROP POLICY IF EXISTS "Teachers can update own links" ON teacher_links;
DROP POLICY IF EXISTS "Teachers can delete own links" ON teacher_links;

-- =====================================================
-- teacher_boards: Full CRUD for authenticated users
-- =====================================================
CREATE POLICY "boards_select" ON teacher_boards
  FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "boards_insert" ON teacher_boards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "boards_update" ON teacher_boards
  FOR UPDATE TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "boards_delete" ON teacher_boards
  FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id);

-- =====================================================
-- teacher_folders: Full CRUD for authenticated users
-- =====================================================
CREATE POLICY "folders_select" ON teacher_folders
  FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "folders_insert" ON teacher_folders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "folders_update" ON teacher_folders
  FOR UPDATE TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "folders_delete" ON teacher_folders
  FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id);

-- =====================================================
-- teacher_documents: Full CRUD for authenticated users
-- =====================================================
CREATE POLICY "documents_select" ON teacher_documents
  FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "documents_insert" ON teacher_documents
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "documents_update" ON teacher_documents
  FOR UPDATE TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "documents_delete" ON teacher_documents
  FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id);

-- =====================================================
-- teacher_worksheets: Full CRUD for authenticated users
-- =====================================================
CREATE POLICY "worksheets_select" ON teacher_worksheets
  FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "worksheets_insert" ON teacher_worksheets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "worksheets_update" ON teacher_worksheets
  FOR UPDATE TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "worksheets_delete" ON teacher_worksheets
  FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id);

-- =====================================================
-- teacher_files: Full CRUD for authenticated users
-- =====================================================
CREATE POLICY "files_select" ON teacher_files
  FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "files_insert" ON teacher_files
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "files_update" ON teacher_files
  FOR UPDATE TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "files_delete" ON teacher_files
  FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id);

-- =====================================================
-- teacher_links: Full CRUD for authenticated users
-- =====================================================
CREATE POLICY "links_select" ON teacher_links
  FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "links_insert" ON teacher_links
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "links_update" ON teacher_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "links_delete" ON teacher_links
  FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id);

