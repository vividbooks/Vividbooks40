-- =============================================
-- PUBLIC BOARDS SUPPORT
-- Add is_public column and RLS policy for public access
-- =============================================

-- Add is_public column to teacher_boards
ALTER TABLE teacher_boards 
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Create index for public boards
CREATE INDEX IF NOT EXISTS idx_teacher_boards_is_public 
  ON teacher_boards(is_public) 
  WHERE is_public = true;

-- Drop existing public policy if exists (for re-running)
DROP POLICY IF EXISTS "Anyone can view public boards" ON teacher_boards;

-- Create policy for public read access
-- Anyone can read boards where is_public = true
CREATE POLICY "Anyone can view public boards" 
  ON teacher_boards 
  FOR SELECT 
  USING (is_public = true OR auth.uid() = teacher_id);

-- Note: The existing "Teachers can manage own boards" policy handles INSERT/UPDATE/DELETE
-- We need to modify it to not conflict with the new SELECT policy

-- First drop the old policy
DROP POLICY IF EXISTS "Teachers can manage own boards" ON teacher_boards;

-- Create separate policies for each operation
CREATE POLICY "Teachers can insert own boards" ON teacher_boards
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own boards" ON teacher_boards
  FOR UPDATE USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete own boards" ON teacher_boards
  FOR DELETE USING (auth.uid() = teacher_id);
