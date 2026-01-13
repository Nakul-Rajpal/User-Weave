-- =============================================
-- Bolt.DIY Complete Database Schema
-- =============================================
-- This script sets up the complete database schema for Bolt.DIY
-- including workflow management, meeting transcripts, and voting
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. CREATE TABLES
-- =============================================

-- ============ CORE TABLES ============

-- Users table (synced with auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Chats table
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  url_id TEXT UNIQUE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  sequence INTEGER NOT NULL DEFAULT 0,
  annotations JSONB
);

-- Snapshots table
CREATE TABLE IF NOT EXISTS public.snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  message_id TEXT,
  files_json JSONB,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Final versions table (for version tracking)
CREATE TABLE IF NOT EXISTS public.final_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL REFERENCES public.snapshots(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  selected_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_final_version UNIQUE (user_id)
);

-- ============ WORKFLOW & MEETING TABLES ============

-- Workflow states table (manages meeting workflow navigation)
CREATE TABLE IF NOT EXISTS public.workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL UNIQUE,
  current_node TEXT NOT NULL DEFAULT 'meeting',
  host_user_id TEXT NOT NULL,
  visited_nodes TEXT[] DEFAULT ARRAY['meeting'::TEXT],
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Meeting transcripts table (stores live meeting transcriptions)
CREATE TABLE IF NOT EXISTS public.meeting_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  transcript_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Transcript summaries table (AI-generated meeting summaries)
CREATE TABLE IF NOT EXISTS public.transcript_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  summary_points JSONB NOT NULL,
  llm_model TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Summary votes table (voting on summary points)
CREATE TABLE IF NOT EXISTS public.summary_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id UUID NOT NULL REFERENCES public.transcript_summaries(id) ON DELETE CASCADE,
  point_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('agree', 'disagree', 'neutral')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(summary_id, point_id, user_id)
);

-- =============================================
-- 2. CREATE INDEXES
-- =============================================

-- ============ CORE INDEXES ============

-- Chats indexes
CREATE INDEX IF NOT EXISTS chats_user_id_idx ON public.chats(user_id);
CREATE INDEX IF NOT EXISTS chats_url_id_idx ON public.chats(url_id);

-- Messages indexes
CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS messages_sequence_idx ON public.messages(sequence);
CREATE INDEX IF NOT EXISTS idx_messages_annotations ON public.messages USING gin(annotations);

-- Snapshots indexes
CREATE INDEX IF NOT EXISTS snapshots_chat_id_idx ON public.snapshots(chat_id);

-- Final versions indexes
CREATE INDEX IF NOT EXISTS idx_final_versions_user_id ON public.final_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_final_versions_chat_id ON public.final_versions(chat_id);
CREATE INDEX IF NOT EXISTS idx_final_versions_snapshot_id ON public.final_versions(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_final_versions_selected_at ON public.final_versions(selected_at DESC);

-- ============ WORKFLOW & MEETING INDEXES ============

-- Workflow states indexes
CREATE INDEX IF NOT EXISTS idx_workflow_states_room_id ON public.workflow_states(room_id);
CREATE INDEX IF NOT EXISTS idx_workflow_states_host_user_id ON public.workflow_states(host_user_id);

-- Meeting transcripts indexes
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_room_id ON public.meeting_transcripts(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_created_at ON public.meeting_transcripts(created_at DESC);

-- Transcript summaries indexes
CREATE INDEX IF NOT EXISTS idx_transcript_summaries_room_id ON public.transcript_summaries(room_id);

-- Summary votes indexes
CREATE INDEX IF NOT EXISTS idx_summary_votes_summary_id ON public.summary_votes(summary_id);
CREATE INDEX IF NOT EXISTS idx_summary_votes_user_id ON public.summary_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_summary_votes_point_id ON public.summary_votes(point_id);

-- =============================================
-- 3. CREATE FUNCTIONS
-- =============================================

-- Function to handle new user creation
-- This syncs auth.users with public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically update updated_at timestamp (generic)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update workflow_states.updated_at
CREATE OR REPLACE FUNCTION public.update_workflow_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update summary_votes.updated_at
CREATE OR REPLACE FUNCTION public.update_summary_votes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 4. CREATE TRIGGERS
-- =============================================

-- ============ CORE TRIGGERS ============

-- Trigger to create user in public.users when auth.users is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at on chats
DROP TRIGGER IF EXISTS handle_updated_at ON public.chats;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to update updated_at on final_versions
DROP TRIGGER IF EXISTS set_updated_at ON public.final_versions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.final_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============ WORKFLOW & MEETING TRIGGERS ============

-- Trigger to update updated_at on workflow_states
DROP TRIGGER IF EXISTS trigger_update_workflow_states_updated_at ON public.workflow_states;
CREATE TRIGGER trigger_update_workflow_states_updated_at
  BEFORE UPDATE ON public.workflow_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_workflow_states_updated_at();

-- Trigger to update updated_at on summary_votes
DROP TRIGGER IF EXISTS trigger_update_summary_votes_updated_at ON public.summary_votes;
CREATE TRIGGER trigger_update_summary_votes_updated_at
  BEFORE UPDATE ON public.summary_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_summary_votes_updated_at();

-- =============================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.final_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summary_votes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 6. CREATE RLS POLICIES
-- =============================================

-- ============ USERS POLICIES ============
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- ============ CHATS POLICIES ============
CREATE POLICY "Users can view own chats"
  ON public.chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chats"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chats"
  ON public.chats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats"
  ON public.chats FOR DELETE
  USING (auth.uid() = user_id);

-- ============ MESSAGES POLICIES ============
CREATE POLICY "Users can view messages from own chats"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to own chats"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in own chats"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages from own chats"
  ON public.messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- ============ SNAPSHOTS POLICIES ============
CREATE POLICY "Users can view snapshots from own chats"
  ON public.snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = snapshots.chat_id
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert snapshots to own chats"
  ON public.snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = snapshots.chat_id
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update snapshots in own chats"
  ON public.snapshots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = snapshots.chat_id
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete snapshots from own chats"
  ON public.snapshots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = snapshots.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- ============ FINAL VERSIONS POLICIES ============
CREATE POLICY "Anyone can view final versions"
  ON public.final_versions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own final version"
  ON public.final_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own final version"
  ON public.final_versions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own final version"
  ON public.final_versions FOR DELETE
  USING (auth.uid() = user_id);

-- ============ WORKFLOW STATES POLICIES ============
CREATE POLICY "Users can view workflow states for their rooms"
  ON public.workflow_states FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create workflow states"
  ON public.workflow_states FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Host can update workflow state"
  ON public.workflow_states FOR UPDATE
  USING ((auth.uid())::text = host_user_id)
  WITH CHECK ((auth.uid())::text = host_user_id);

CREATE POLICY "Host can delete workflow state"
  ON public.workflow_states FOR DELETE
  USING ((auth.uid())::text = host_user_id);

-- ============ MEETING TRANSCRIPTS POLICIES ============
CREATE POLICY "Users can view transcripts for their rooms"
  ON public.meeting_transcripts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create transcripts"
  ON public.meeting_transcripts FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

-- ============ TRANSCRIPT SUMMARIES POLICIES ============
CREATE POLICY "Users can view summaries for their rooms"
  ON public.transcript_summaries FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create summaries"
  ON public.transcript_summaries FOR INSERT
  WITH CHECK (auth.uid() = generated_by_user_id);

-- Note: We intentionally allow hosts to update summaries for adding/editing/deleting points
-- This is handled at the application level with host verification
CREATE POLICY "Authenticated users can update summaries"
  ON public.transcript_summaries FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============ SUMMARY VOTES POLICIES ============
CREATE POLICY "Users can view all votes"
  ON public.summary_votes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create their own votes"
  ON public.summary_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
  ON public.summary_votes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON public.summary_votes FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 7. ENABLE REALTIME (for live updates)
-- =============================================

-- Enable realtime for workflow and meeting tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_states;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_transcripts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transcript_summaries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.summary_votes;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
-- Database schema is now fully set up with:
-- ✅ Core tables (users, chats, messages, snapshots, final_versions)
-- ✅ Workflow management (workflow_states)
-- ✅ Meeting transcripts (meeting_transcripts)
-- ✅ AI summaries (transcript_summaries)
-- ✅ Voting system (summary_votes)
-- ✅ All indexes for optimal performance
-- ✅ All foreign key relationships
-- ✅ Row Level Security (RLS) policies
-- ✅ Triggers for automatic timestamp updates
-- ✅ Realtime subscriptions enabled
--
-- Next steps:
-- 1. Enable anonymous sign-ins in Authentication > Providers > Anonymous
-- 2. Copy your project URL and anon key
-- 3. Update your .env.local file with these values
-- =============================================
