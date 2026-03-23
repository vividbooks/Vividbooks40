-- Live sessions migrated from Firebase to Supabase
-- Covers standard live board sessions and shared/student sessions.

CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('live', 'share')),
  join_code TEXT UNIQUE,
  share_slug TEXT UNIQUE,
  source_board_id TEXT,
  title TEXT NOT NULL,
  teacher_user_id TEXT,
  teacher_name TEXT NOT NULL DEFAULT 'Učitel',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  current_slide_index INTEGER NOT NULL DEFAULT 0,
  mode TEXT CHECK (mode IN ('live', 'competition', 'team-competition', 'duel-competition', 'tactical-competition')),
  competition_phase TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT TRUE,
  is_paused BOOLEAN NOT NULL DEFAULT FALSE,
  show_results BOOLEAN NOT NULL DEFAULT FALSE,
  competition_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  team_competition_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  duel_competition_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  tactical_competition_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS live_session_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  session_public_id TEXT NOT NULL UNIQUE REFERENCES live_sessions(public_id) ON DELETE CASCADE,
  quiz_id TEXT,
  board_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  session_public_id TEXT NOT NULL REFERENCES live_sessions(public_id) ON DELETE CASCADE,
  client_identity_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  school_name TEXT,
  device_id TEXT,
  current_slide_index INTEGER NOT NULL DEFAULT 0,
  responses JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_online BOOLEAN NOT NULL DEFAULT TRUE,
  is_focused BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_time_ms INTEGER NOT NULL DEFAULT 0,
  UNIQUE(session_public_id, client_identity_id)
);

CREATE TABLE IF NOT EXISTS live_session_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  session_public_id TEXT NOT NULL REFERENCES live_sessions(public_id) ON DELETE CASCADE,
  slide_id TEXT NOT NULL,
  client_identity_id TEXT NOT NULL,
  selected_options TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voter_name TEXT,
  UNIQUE(session_public_id, slide_id, client_identity_id)
);

CREATE TABLE IF NOT EXISTS live_session_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  session_public_id TEXT NOT NULL REFERENCES live_sessions(public_id) ON DELETE CASCADE,
  slide_id TEXT NOT NULL,
  client_identity_id TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'student' CHECK (author_role IN ('teacher', 'student')),
  author_name TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'youtube')),
  background_color TEXT,
  column_side TEXT CHECK (column_side IN ('left', 'right')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS live_session_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  session_public_id TEXT NOT NULL REFERENCES live_sessions(public_id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES live_session_posts(id) ON DELETE CASCADE,
  client_identity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, client_identity_id),
  UNIQUE(session_public_id, post_id, client_identity_id)
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_kind ON live_sessions(kind);
CREATE INDEX IF NOT EXISTS idx_live_sessions_source_board_id ON live_sessions(source_board_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_join_code ON live_sessions(join_code);
CREATE INDEX IF NOT EXISTS idx_live_session_participants_public ON live_session_participants(session_public_id);
CREATE INDEX IF NOT EXISTS idx_live_session_votes_public_slide ON live_session_votes(session_public_id, slide_id);
CREATE INDEX IF NOT EXISTS idx_live_session_posts_public_slide ON live_session_posts(session_public_id, slide_id);
CREATE INDEX IF NOT EXISTS idx_live_session_post_likes_public_post ON live_session_post_likes(session_public_id, post_id);

ALTER TABLE live_sessions REPLICA IDENTITY FULL;
ALTER TABLE live_session_content REPLICA IDENTITY FULL;
ALTER TABLE live_session_participants REPLICA IDENTITY FULL;
ALTER TABLE live_session_votes REPLICA IDENTITY FULL;
ALTER TABLE live_session_posts REPLICA IDENTITY FULL;
ALTER TABLE live_session_post_likes REPLICA IDENTITY FULL;

ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_sessions_read_all" ON live_sessions
  FOR SELECT USING (true);
CREATE POLICY "live_sessions_insert_all" ON live_sessions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "live_sessions_update_all" ON live_sessions
  FOR UPDATE USING (true);

CREATE POLICY "live_session_content_read_all" ON live_session_content
  FOR SELECT USING (true);
CREATE POLICY "live_session_content_insert_all" ON live_session_content
  FOR INSERT WITH CHECK (true);
CREATE POLICY "live_session_content_update_all" ON live_session_content
  FOR UPDATE USING (true);

CREATE POLICY "live_session_participants_read_all" ON live_session_participants
  FOR SELECT USING (true);
CREATE POLICY "live_session_participants_insert_all" ON live_session_participants
  FOR INSERT WITH CHECK (true);
CREATE POLICY "live_session_participants_update_all" ON live_session_participants
  FOR UPDATE USING (true);

CREATE POLICY "live_session_votes_read_all" ON live_session_votes
  FOR SELECT USING (true);
CREATE POLICY "live_session_votes_insert_all" ON live_session_votes
  FOR INSERT WITH CHECK (true);
CREATE POLICY "live_session_votes_update_all" ON live_session_votes
  FOR UPDATE USING (true);

CREATE POLICY "live_session_posts_read_all" ON live_session_posts
  FOR SELECT USING (true);
CREATE POLICY "live_session_posts_insert_all" ON live_session_posts
  FOR INSERT WITH CHECK (true);
CREATE POLICY "live_session_posts_update_all" ON live_session_posts
  FOR UPDATE USING (true);

CREATE POLICY "live_session_post_likes_read_all" ON live_session_post_likes
  FOR SELECT USING (true);
CREATE POLICY "live_session_post_likes_insert_all" ON live_session_post_likes
  FOR INSERT WITH CHECK (true);
CREATE POLICY "live_session_post_likes_delete_all" ON live_session_post_likes
  FOR DELETE USING (true);

GRANT ALL ON live_sessions TO authenticated;
GRANT ALL ON live_session_content TO authenticated;
GRANT ALL ON live_session_participants TO authenticated;
GRANT ALL ON live_session_votes TO authenticated;
GRANT ALL ON live_session_posts TO authenticated;
GRANT ALL ON live_session_post_likes TO authenticated;

GRANT SELECT, INSERT, UPDATE ON live_sessions TO anon;
GRANT SELECT, INSERT, UPDATE ON live_session_content TO anon;
GRANT SELECT, INSERT, UPDATE ON live_session_participants TO anon;
GRANT SELECT, INSERT, UPDATE ON live_session_votes TO anon;
GRANT SELECT, INSERT, UPDATE ON live_session_posts TO anon;
GRANT SELECT, INSERT, DELETE ON live_session_post_likes TO anon;

CREATE OR REPLACE FUNCTION get_live_session_preview(input_join_code TEXT)
RETURNS TABLE (
  public_id TEXT,
  title TEXT,
  status TEXT,
  current_slide_index INTEGER
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT public_id, title, status, current_slide_index
  FROM live_sessions
  WHERE kind = 'live' AND join_code = upper(input_join_code)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_share_session(input_public_id TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'public_id', s.public_id,
    'title', s.title,
    'status', s.status,
    'settings', s.settings,
    'content', c.board_snapshot
  )
  FROM live_sessions s
  LEFT JOIN live_session_content c ON c.session_public_id = s.public_id
  WHERE s.kind = 'share' AND s.public_id = input_public_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION join_live_session(
  input_join_code TEXT,
  input_display_name TEXT,
  input_client_identity_id TEXT,
  input_device_id TEXT,
  input_school_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_session live_sessions%ROWTYPE;
BEGIN
  SELECT * INTO target_session
  FROM live_sessions
  WHERE kind = 'live'
    AND join_code = upper(input_join_code)
  LIMIT 1;

  IF target_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'session_not_found');
  END IF;

  INSERT INTO live_session_participants (
    session_id,
    session_public_id,
    client_identity_id,
    display_name,
    school_name,
    device_id,
    joined_at,
    last_seen_at,
    is_online,
    is_focused
  ) VALUES (
    target_session.id,
    target_session.public_id,
    input_client_identity_id,
    input_display_name,
    input_school_name,
    input_device_id,
    now(),
    now(),
    true,
    true
  )
  ON CONFLICT (session_public_id, client_identity_id)
  DO UPDATE SET
    display_name = EXCLUDED.display_name,
    school_name = EXCLUDED.school_name,
    device_id = EXCLUDED.device_id,
    last_seen_at = now(),
    is_online = true,
    is_focused = true;

  RETURN jsonb_build_object(
    'success', true,
    'public_id', target_session.public_id,
    'status', target_session.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION join_share_session(
  input_public_id TEXT,
  input_display_name TEXT,
  input_client_identity_id TEXT,
  input_device_id TEXT,
  input_school_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_session live_sessions%ROWTYPE;
BEGIN
  SELECT * INTO target_session
  FROM live_sessions
  WHERE kind = 'share'
    AND public_id = input_public_id
  LIMIT 1;

  IF target_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'share_not_found');
  END IF;

  INSERT INTO live_session_participants (
    session_id,
    session_public_id,
    client_identity_id,
    display_name,
    school_name,
    device_id,
    joined_at,
    last_seen_at,
    is_online,
    is_focused
  ) VALUES (
    target_session.id,
    target_session.public_id,
    input_client_identity_id,
    input_display_name,
    input_school_name,
    input_device_id,
    now(),
    now(),
    true,
    true
  )
  ON CONFLICT (session_public_id, client_identity_id)
  DO UPDATE SET
    display_name = EXCLUDED.display_name,
    school_name = EXCLUDED.school_name,
    device_id = EXCLUDED.device_id,
    last_seen_at = now(),
    is_online = true,
    is_focused = true;

  RETURN jsonb_build_object(
    'success', true,
    'public_id', target_session.public_id,
    'status', target_session.status
  );
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_session_content'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_content;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_session_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_participants;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_session_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_votes;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_session_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_posts;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_session_post_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_post_likes;
  END IF;
END
$$;
