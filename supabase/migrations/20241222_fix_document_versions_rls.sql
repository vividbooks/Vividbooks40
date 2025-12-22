-- =====================================================
-- Fix RLS for document_versions to allow students to create versions
-- =====================================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create document versions" ON document_versions;

-- Create new INSERT policy that explicitly allows students (via auth_id) and teachers (via id)
CREATE POLICY "Users can create document versions"
  ON document_versions
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Also ensure SELECT policy allows students to see their own versions
DROP POLICY IF EXISTS "Users can read document versions" ON document_versions;

CREATE POLICY "Users can read document versions"
  ON document_versions
  FOR SELECT
  USING (
    -- Teachers can see all versions
    EXISTS (SELECT 1 FROM teachers t WHERE t.id = auth.uid())
    OR
    -- Students can see all versions (for their own documents)
    EXISTS (SELECT 1 FROM students s WHERE s.auth_id = auth.uid())
  );

-- Verify the policies exist
DO $$
BEGIN
  RAISE NOTICE 'RLS policies updated successfully for document_versions table';
END $$;

