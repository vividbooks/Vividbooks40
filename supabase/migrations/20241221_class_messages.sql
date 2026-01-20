-- Class Messages - Teacher messages to class
-- Messages from teacher to students in a class

CREATE TABLE IF NOT EXISTS class_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal', -- normal, important, urgent
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for tracking which students have read the message
CREATE TABLE IF NOT EXISTS class_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES class_messages(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_class_messages_class_id ON class_messages(class_id);
CREATE INDEX IF NOT EXISTS idx_class_messages_created_at ON class_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_message_reads_message_id ON class_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_class_message_reads_student_id ON class_message_reads(student_id);

-- Enable RLS
ALTER TABLE class_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_message_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all for authenticated users" ON class_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON class_message_reads
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_class_messages_updated_at
  BEFORE UPDATE ON class_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

