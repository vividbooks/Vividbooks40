-- Class Chat Messages table
CREATE TABLE IF NOT EXISTS class_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('student', 'teacher')),
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES class_chat_messages(id) ON DELETE CASCADE,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class Chat Reactions table
CREATE TABLE IF NOT EXISTS class_chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES class_chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('student', 'teacher')),
  user_name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_chat_messages_class_id ON class_chat_messages(class_id);
CREATE INDEX IF NOT EXISTS idx_class_chat_messages_created_at ON class_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_chat_messages_parent_id ON class_chat_messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_class_chat_reactions_message_id ON class_chat_reactions(message_id);

-- Enable RLS
ALTER TABLE class_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_chat_reactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all for authenticated users" ON class_chat_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON class_chat_reactions
  FOR ALL USING (true) WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_class_chat_messages_updated_at
  BEFORE UPDATE ON class_chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

