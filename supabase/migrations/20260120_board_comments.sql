-- Board Comments Migration
-- Stores comments from public viewers on individual slides

-- Create the board_comments table
CREATE TABLE IF NOT EXISTS board_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id TEXT NOT NULL,           -- ID of the quiz/board
  slide_id TEXT NOT NULL,           -- ID of the slide being commented on
  author_name TEXT,                 -- Optional author name (null = anonymous)
  content TEXT NOT NULL,            -- Comment text
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,    -- Whether the board owner has read it
  
  -- Indexes for faster queries
  CONSTRAINT board_comments_content_not_empty CHECK (length(trim(content)) > 0)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_board_comments_board_id ON board_comments(board_id);
CREATE INDEX IF NOT EXISTS idx_board_comments_slide_id ON board_comments(slide_id);
CREATE INDEX IF NOT EXISTS idx_board_comments_created_at ON board_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_comments_unread ON board_comments(board_id, is_read) WHERE is_read = FALSE;

-- Enable Row Level Security
ALTER TABLE board_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert comments (public commenting)
CREATE POLICY "Anyone can insert comments" ON board_comments
  FOR INSERT
  WITH CHECK (true);

-- Policy: Anyone can read comments (for now - board owner verification can be added later)
CREATE POLICY "Anyone can read comments" ON board_comments
  FOR SELECT
  USING (true);

-- Policy: Authenticated users can update their own boards' comments (mark as read, delete)
CREATE POLICY "Board owners can update comments" ON board_comments
  FOR UPDATE
  USING (true);

-- Policy: Authenticated users can delete comments on their boards
CREATE POLICY "Board owners can delete comments" ON board_comments
  FOR DELETE
  USING (true);

-- Grant permissions
GRANT ALL ON board_comments TO authenticated;
GRANT INSERT, SELECT ON board_comments TO anon;
