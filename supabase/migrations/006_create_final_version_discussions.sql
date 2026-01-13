-- =====================================================
-- Create: final_version_discussions table
-- Purpose: Threaded discussion system for final versions
-- Supports nested replies (parent_id) for conversation threads
-- =====================================================

-- Create final_version_discussions table
CREATE TABLE IF NOT EXISTS public.final_version_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  final_version_id UUID NOT NULL REFERENCES public.final_versions(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.final_version_discussions(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL CHECK (length(message_text) > 0 AND length(message_text) <= 1000),
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_discussions_final_version
  ON public.final_version_discussions(final_version_id);

CREATE INDEX IF NOT EXISTS idx_discussions_room
  ON public.final_version_discussions(room_id);

CREATE INDEX IF NOT EXISTS idx_discussions_user
  ON public.final_version_discussions(user_id);

CREATE INDEX IF NOT EXISTS idx_discussions_parent
  ON public.final_version_discussions(parent_id);

CREATE INDEX IF NOT EXISTS idx_discussions_created
  ON public.final_version_discussions(created_at DESC);

-- Composite index for fetching discussions by version and room
CREATE INDEX IF NOT EXISTS idx_discussions_version_room
  ON public.final_version_discussions(final_version_id, room_id);

-- Enable Row Level Security
ALTER TABLE public.final_version_discussions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view all discussions" ON public.final_version_discussions;
DROP POLICY IF EXISTS "Users can create discussions" ON public.final_version_discussions;
DROP POLICY IF EXISTS "Users can update own discussions" ON public.final_version_discussions;
DROP POLICY IF EXISTS "Users can delete own discussions" ON public.final_version_discussions;

-- RLS Policy: Allow authenticated users to view all discussions
CREATE POLICY "Users can view all discussions"
  ON public.final_version_discussions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policy: Allow authenticated users to create discussions
CREATE POLICY "Users can create discussions"
  ON public.final_version_discussions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

-- RLS Policy: Allow users to update their own discussions
CREATE POLICY "Users can update own discussions"
  ON public.final_version_discussions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Allow users to delete their own discussions
CREATE POLICY "Users can delete own discussions"
  ON public.final_version_discussions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE public.final_version_discussions IS 'Threaded discussion messages for final versions in code review. Supports nested replies via parent_id.';
COMMENT ON COLUMN public.final_version_discussions.parent_id IS 'References parent message for threaded replies. NULL for top-level messages.';
COMMENT ON COLUMN public.final_version_discussions.is_edited IS 'Tracks if message has been edited after creation.';

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_final_version_discussions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.is_edited = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists before creating (for idempotency)
DROP TRIGGER IF EXISTS set_updated_at_final_version_discussions ON public.final_version_discussions;

-- Trigger to update updated_at on row update
CREATE TRIGGER set_updated_at_final_version_discussions
  BEFORE UPDATE ON public.final_version_discussions
  FOR EACH ROW
  EXECUTE FUNCTION update_final_version_discussions_updated_at();

-- Enable real-time for live updates (safely handle if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'final_version_discussions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.final_version_discussions;
  END IF;
END $$;

-- Optional: Create a view for easier querying of discussion threads with user info
CREATE OR REPLACE VIEW public.final_version_discussions_with_users AS
SELECT
  d.*,
  u.email as user_email,
  u.raw_user_meta_data->>'full_name' as user_name,
  u.raw_user_meta_data->>'avatar_url' as user_avatar
FROM public.final_version_discussions d
LEFT JOIN auth.users u ON d.user_id = u.id;

-- Grant access to the view
GRANT SELECT ON public.final_version_discussions_with_users TO authenticated;

COMMENT ON VIEW public.final_version_discussions_with_users IS 'Discussion messages with user profile information for display purposes.';
