-- ============================================
-- Fix RLS policies for user_events table
-- Allow authenticated users to insert and view their events
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own events" ON user_events;
DROP POLICY IF EXISTS "Users can view their own events" ON user_events;
DROP POLICY IF EXISTS "Anyone can insert events" ON user_events;
DROP POLICY IF EXISTS "Anyone can view events" ON user_events;

-- Create new, more permissive policies for analytics
-- Allow any authenticated user to insert events
CREATE POLICY "Authenticated users can insert events" ON user_events 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Allow users to view their own events
CREATE POLICY "Users can view their own events" ON user_events 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Allow anon to insert (for unauthenticated tracking if needed)
CREATE POLICY "Anon can insert events" ON user_events 
  FOR INSERT 
  TO anon
  WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Service role has full access" ON user_events 
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Also make school_id column nullable and TEXT-compatible
-- Since our school IDs are TEXT like 'school-123...'
-- We might need to alter the column type

-- Check if school_id needs to be changed to TEXT
-- Comment: If you want to keep UUID, the frontend now handles non-UUID school_ids
-- by storing them in event_data.school_id_text instead




