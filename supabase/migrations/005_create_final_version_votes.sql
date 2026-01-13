-- =====================================================
-- Create: final_version_votes table
-- Purpose: Track user votes on final versions in code review
-- Missing from original schema but referenced in code
-- =====================================================

-- Create final_version_votes table
CREATE TABLE IF NOT EXISTS public.final_version_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  final_version_id UUID NOT NULL REFERENCES public.final_versions(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('approve', 'request_changes', 'comment')),
  comment_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(final_version_id, room_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_final_version_votes_version
  ON public.final_version_votes(final_version_id);

CREATE INDEX IF NOT EXISTS idx_final_version_votes_room
  ON public.final_version_votes(room_id);

CREATE INDEX IF NOT EXISTS idx_final_version_votes_user
  ON public.final_version_votes(user_id);

CREATE INDEX IF NOT EXISTS idx_final_version_votes_created
  ON public.final_version_votes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.final_version_votes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view all votes" ON public.final_version_votes;
DROP POLICY IF EXISTS "Users can create their own votes" ON public.final_version_votes;
DROP POLICY IF EXISTS "Users can update their own votes" ON public.final_version_votes;
DROP POLICY IF EXISTS "Users can delete their own votes" ON public.final_version_votes;

-- RLS Policy: Allow authenticated users to view all votes
CREATE POLICY "Users can view all votes"
  ON public.final_version_votes
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policy: Allow users to insert their own votes
CREATE POLICY "Users can create their own votes"
  ON public.final_version_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Allow users to update their own votes
CREATE POLICY "Users can update their own votes"
  ON public.final_version_votes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Allow users to delete their own votes
CREATE POLICY "Users can delete their own votes"
  ON public.final_version_votes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE public.final_version_votes IS 'Tracks user votes (approve/request_changes/comment) on final versions during code review';

-- Enable real-time for live updates (safely handle if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'final_version_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.final_version_votes;
  END IF;
END $$;
