-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. user_events table
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- FK to users table handled by application or separate constraint if users table exists in public
  school_id UUID, -- FK to schools
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster querying by user and time
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at);

-- 2. user_onboarding table
CREATE TABLE IF NOT EXISTS user_onboarding (
  user_id UUID PRIMARY KEY, -- FK to users
  opened_lesson BOOLEAN DEFAULT FALSE,
  edited_lesson BOOLEAN DEFAULT FALSE,
  used_ai_teach_me BOOLEAN DEFAULT FALSE,
  opened_workbook BOOLEAN DEFAULT FALSE,
  created_document BOOLEAN DEFAULT FALSE,
  created_worksheet BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY, -- FK to users
  school_id UUID,
  role TEXT,
  total_time_minutes INTEGER DEFAULT 0,
  lessons_opened INTEGER DEFAULT 0,
  lessons_edited INTEGER DEFAULT 0,
  documents_created INTEGER DEFAULT 0,
  worksheets_created INTEGER DEFAULT 0,
  boards_created INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  ai_cost_cents INTEGER DEFAULT 0,
  last_active_at TIMESTAMP WITH TIME ZONE,
  activity_score INTEGER DEFAULT 0, -- 0-100
  percentile_rank INTEGER DEFAULT 0, -- 0-100
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. school_stats table
CREATE TABLE IF NOT EXISTS school_stats (
  school_id UUID PRIMARY KEY,
  total_teachers INTEGER DEFAULT 0,
  active_teachers_7d INTEGER DEFAULT 0,
  active_teachers_30d INTEGER DEFAULT 0,
  total_students INTEGER DEFAULT 0,
  active_students_7d INTEGER DEFAULT 0,
  activity_level TEXT CHECK (activity_level IN ('very_active', 'active', 'inactive', 'unknown')) DEFAULT 'unknown',
  total_ai_cost_cents INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. cs_tasks table
CREATE TABLE IF NOT EXISTS cs_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL,
  user_id UUID, -- Nullable
  task_type TEXT NOT NULL,
  priority INTEGER CHECK (priority BETWEEN 1 AND 5),
  title TEXT NOT NULL,
  description TEXT,
  ai_reasoning TEXT,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')) DEFAULT 'pending',
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_cs_tasks_school_id ON cs_tasks(school_id);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_status ON cs_tasks(status);

-- RLS Policies (Basic examples - adjust based on actual auth requirements)
-- Enable RLS
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_tasks ENABLE ROW LEVEL SECURITY;

-- Policies
-- user_events: Users can insert their own events, admins can read all
CREATE POLICY "Users can insert their own events" ON user_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own events" ON user_events FOR SELECT USING (auth.uid() = user_id);

-- user_onboarding: Users can view/update their own
CREATE POLICY "Users can view own onboarding" ON user_onboarding FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own onboarding" ON user_onboarding FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage onboarding" ON user_onboarding USING (true) WITH CHECK (true); -- simplify for service role

-- user_stats: Read-only for users (updated by background jobs), read-all for admins
CREATE POLICY "Users can view own stats" ON user_stats FOR SELECT USING (auth.uid() = user_id);

-- school_stats: Viewable by school members (if school logic exists) or admins
-- cs_tasks: Viewable by admins/CS agents


