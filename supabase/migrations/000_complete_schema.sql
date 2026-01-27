-- =============================================
-- Bolt.DIY Complete Database Schema (Consolidated)
-- =============================================
-- This file consolidates all migrations into a single schema
-- that matches the online database structure exactly.
-- Generated from migration files and codebase analysis.
-- =============================================

-- =============================================
-- EXTENSIONS
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLES
-- =============================================

-- Users table (synced with auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Admins table (global admin tracking)
CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
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
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL REFERENCES public.snapshots(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  selected_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_final_version UNIQUE (user_id)
);

-- Final version votes table
CREATE TABLE IF NOT EXISTS public.final_version_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  final_version_id UUID NOT NULL REFERENCES public.final_versions(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('like', 'dislike')),
  comment_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(final_version_id, room_id, user_id)
);

-- Final version discussions table
CREATE TABLE IF NOT EXISTS public.final_version_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  final_version_id UUID NOT NULL REFERENCES public.final_versions(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.final_version_discussions(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL CHECK (length(message_text) > 0 AND length(message_text) <= 1000),
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('agree', 'disagree', 'neutral')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(summary_id, point_id, user_id)
);

-- Meeting chat messages table (for in-meeting chat)
CREATE TABLE IF NOT EXISTS public.meeting_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image')),
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_username TEXT NOT NULL,
  content TEXT NOT NULL,
  image_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prompt templates table (for room design generation)
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL UNIQUE,
  template TEXT NOT NULL,
  tech_stack TEXT NOT NULL,
  design_preference TEXT NOT NULL,
  complexity_level TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Room design chats table (tracks AI design generation)
CREATE TABLE IF NOT EXISTS public.room_design_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  generated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_used TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

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

-- Final version votes indexes
CREATE INDEX IF NOT EXISTS idx_final_version_votes_version ON public.final_version_votes(final_version_id);
CREATE INDEX IF NOT EXISTS idx_final_version_votes_room ON public.final_version_votes(room_id);
CREATE INDEX IF NOT EXISTS idx_final_version_votes_user ON public.final_version_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_final_version_votes_created ON public.final_version_votes(created_at DESC);

-- Final version discussions indexes
CREATE INDEX IF NOT EXISTS idx_discussions_final_version ON public.final_version_discussions(final_version_id);
CREATE INDEX IF NOT EXISTS idx_discussions_room ON public.final_version_discussions(room_id);
CREATE INDEX IF NOT EXISTS idx_discussions_user ON public.final_version_discussions(user_id);
CREATE INDEX IF NOT EXISTS idx_discussions_parent ON public.final_version_discussions(parent_id);
CREATE INDEX IF NOT EXISTS idx_discussions_created ON public.final_version_discussions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_version_room ON public.final_version_discussions(final_version_id, room_id);

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

-- Admins indexes
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON public.admins(user_id);

-- Meeting chat messages indexes
CREATE INDEX IF NOT EXISTS idx_meeting_chat_messages_room_id ON public.meeting_chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_chat_messages_created_at ON public.meeting_chat_messages(created_at DESC);

-- Prompt templates indexes
CREATE INDEX IF NOT EXISTS idx_prompt_templates_room_id ON public.prompt_templates(room_id);

-- Room design chats indexes
CREATE INDEX IF NOT EXISTS idx_room_design_chats_room_id ON public.room_design_chats(room_id);
CREATE INDEX IF NOT EXISTS idx_room_design_chats_chat_id ON public.room_design_chats(chat_id);
CREATE INDEX IF NOT EXISTS idx_room_design_chats_generated_by ON public.room_design_chats(generated_by);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to handle new user creation (updated with proper error handling)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert new user record, ignore if already exists
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.created_at, NOW()))
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log but don't block auth signup
    RAISE WARNING 'Failed to create user record: %', SQLERRM;
    RETURN NEW;
END;
$$;

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

-- Function to update final_version_discussions.updated_at
CREATE OR REPLACE FUNCTION public.update_final_version_discussions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.is_edited = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

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

-- Trigger to update updated_at on final_version_discussions
DROP TRIGGER IF EXISTS set_updated_at_final_version_discussions ON public.final_version_discussions;
CREATE TRIGGER set_updated_at_final_version_discussions
  BEFORE UPDATE ON public.final_version_discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_final_version_discussions_updated_at();

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.final_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.final_version_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.final_version_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summary_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_design_chats ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- ============ USERS POLICIES ============
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- ============ ADMINS POLICIES ============
CREATE POLICY "Anyone can check admin status"
  ON public.admins FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can become admin"
  ON public.admins FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "Admins can update their own record"
  ON public.admins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ CHATS POLICIES ============
-- Updated policy: Allow viewing chats that have final versions OR own chats
DROP POLICY IF EXISTS "Users can view own chats" ON public.chats;
CREATE POLICY "Users can view chats that have final versions"
  ON public.chats FOR SELECT
  USING (
    -- Allow if chat has a final version
    EXISTS (
      SELECT 1 FROM public.final_versions
      WHERE final_versions.chat_id = chats.id
    )
    OR
    -- OR if user owns the chat
    chats.user_id = auth.uid()
  );

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
-- Updated policy: Allow viewing snapshots that are final versions OR own snapshots
DROP POLICY IF EXISTS "Users can view snapshots from own chats" ON public.snapshots;
CREATE POLICY "Users can view snapshots that are final versions"
  ON public.snapshots FOR SELECT
  USING (
    -- Allow if snapshot is referenced by any final_version
    EXISTS (
      SELECT 1 FROM public.final_versions
      WHERE final_versions.snapshot_id = snapshots.id
    )
    OR
    -- OR if user owns the chat
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

-- ============ FINAL VERSION VOTES POLICIES ============
CREATE POLICY "Users can view all votes"
  ON public.final_version_votes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create their own votes"
  ON public.final_version_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
  ON public.final_version_votes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON public.final_version_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ============ FINAL VERSION DISCUSSIONS POLICIES ============
CREATE POLICY "Users can view all discussions"
  ON public.final_version_discussions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create discussions"
  ON public.final_version_discussions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own discussions"
  ON public.final_version_discussions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own discussions"
  ON public.final_version_discussions FOR DELETE
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

-- ============ MEETING CHAT MESSAGES POLICIES ============
CREATE POLICY "Authenticated users can view all meeting messages"
  ON public.meeting_chat_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create meeting messages"
  ON public.meeting_chat_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own meeting messages"
  ON public.meeting_chat_messages FOR UPDATE
  USING (sender_user_id IS NOT NULL AND auth.uid() = sender_user_id)
  WITH CHECK (sender_user_id IS NOT NULL AND auth.uid() = sender_user_id);

CREATE POLICY "Users can delete their own meeting messages"
  ON public.meeting_chat_messages FOR DELETE
  USING (sender_user_id IS NOT NULL AND auth.uid() = sender_user_id);

-- ============ PROMPT TEMPLATES POLICIES ============
CREATE POLICY "Authenticated users can view all prompt templates"
  ON public.prompt_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create prompt templates"
  ON public.prompt_templates FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update prompt templates"
  ON public.prompt_templates FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete prompt templates"
  ON public.prompt_templates FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============ ROOM DESIGN CHATS POLICIES ============
CREATE POLICY "Authenticated users can view all room design chats"
  ON public.room_design_chats FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create room design chats"
  ON public.room_design_chats FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own room design chats"
  ON public.room_design_chats FOR UPDATE
  USING (generated_by IS NOT NULL AND generated_by = auth.uid())
  WITH CHECK (generated_by IS NOT NULL AND generated_by = auth.uid());

CREATE POLICY "Users can delete their own room design chats"
  ON public.room_design_chats FOR DELETE
  USING (generated_by IS NOT NULL AND generated_by = auth.uid());

-- =============================================
-- VIEWS
-- =============================================

-- Final versions with users view
-- Note: Uses public.users instead of auth.users to avoid permission issues
-- The user_name is derived from the email prefix since public.users doesn't store full_name
CREATE OR REPLACE VIEW public.final_versions_with_users AS
SELECT
  fv.*,
  pu.email as user_email,
  COALESCE(SPLIT_PART(pu.email, '@', 1), 'Unknown') as user_name,
  NULL::text as user_avatar
FROM public.final_versions fv
LEFT JOIN public.users pu ON fv.user_id = pu.id;

GRANT SELECT ON public.final_versions_with_users TO authenticated;

-- Final version discussions with users view
-- Note: Uses public.users instead of auth.users to avoid permission issues
-- The user_name is derived from the email prefix since public.users doesn't store full_name
CREATE OR REPLACE VIEW public.final_version_discussions_with_users AS
SELECT
  d.*,
  pu.email as user_email,
  COALESCE(SPLIT_PART(pu.email, '@', 1), 'Unknown') as user_name,
  NULL::text as user_avatar
FROM public.final_version_discussions d
LEFT JOIN public.users pu ON d.user_id = pu.id;

GRANT SELECT ON public.final_version_discussions_with_users TO authenticated;

-- =============================================
-- ENABLE REALTIME
-- =============================================

-- Enable realtime for workflow and meeting tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'workflow_states'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_states;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'meeting_transcripts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_transcripts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'transcript_summaries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transcript_summaries;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'summary_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.summary_votes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'final_version_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.final_version_votes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'final_version_discussions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.final_version_discussions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'meeting_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_chat_messages;
  END IF;
END $$;

-- =============================================
-- GRANT TABLE PERMISSIONS
-- =============================================
-- Grant permissions to anon and authenticated roles
-- This is required for Supabase client access even when RLS is configured

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON public.users TO anon, authenticated, service_role;
GRANT ALL ON public.admins TO anon, authenticated, service_role;
GRANT ALL ON public.chats TO anon, authenticated, service_role;
GRANT ALL ON public.messages TO anon, authenticated, service_role;
GRANT ALL ON public.snapshots TO anon, authenticated, service_role;
GRANT ALL ON public.final_versions TO anon, authenticated, service_role;
GRANT ALL ON public.final_version_votes TO anon, authenticated, service_role;
GRANT ALL ON public.final_version_discussions TO anon, authenticated, service_role;
GRANT ALL ON public.workflow_states TO anon, authenticated, service_role;
GRANT ALL ON public.meeting_transcripts TO anon, authenticated, service_role;
GRANT ALL ON public.transcript_summaries TO anon, authenticated, service_role;
GRANT ALL ON public.summary_votes TO anon, authenticated, service_role;
GRANT ALL ON public.meeting_chat_messages TO anon, authenticated, service_role;
GRANT ALL ON public.prompt_templates TO anon, authenticated, service_role;
GRANT ALL ON public.room_design_chats TO anon, authenticated, service_role;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
-- Database schema is now fully set up with:
-- ✅ All core tables (users, chats, messages, snapshots, final_versions)
-- ✅ Meeting tables (meeting_transcripts, transcript_summaries, summary_votes)
-- ✅ Code review tables (final_version_votes, final_version_discussions)
-- ✅ Room design tables (meeting_chat_messages, prompt_templates, room_design_chats)
-- ✅ Workflow management (workflow_states)
-- ✅ Admin system (admins)
-- ✅ All indexes for optimal performance
-- ✅ All foreign key relationships (using public.users where appropriate)
-- ✅ Row Level Security (RLS) policies
-- ✅ Triggers for automatic timestamp updates
-- ✅ Views for user information
-- ✅ Realtime subscriptions enabled
-- ✅ Table permissions granted to anon/authenticated/service_role
-- =============================================
