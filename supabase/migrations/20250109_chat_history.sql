-- Create table for teacher chat history
CREATE TABLE IF NOT EXISTS public.teacher_chat_history (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nový chat',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.teacher_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_updated_at ON public.teacher_chat_history(updated_at DESC);

-- Enable RLS
ALTER TABLE public.teacher_chat_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own chat history"
    ON public.teacher_chat_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat history"
    ON public.teacher_chat_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat history"
    ON public.teacher_chat_history FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat history"
    ON public.teacher_chat_history FOR DELETE
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.teacher_chat_history TO authenticated;
GRANT ALL ON public.teacher_chat_history TO service_role;





