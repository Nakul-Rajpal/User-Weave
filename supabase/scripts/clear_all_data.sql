-- =============================================
-- Clear All Data Script
-- =============================================
-- This script removes all data from the database while preserving the schema.
-- Run this in Supabase SQL Editor to reset the database.
--
-- WARNING: This will DELETE ALL DATA. Use with caution!
-- =============================================

-- Disable triggers temporarily for faster deletion
SET session_replication_role = 'replica';

-- =============================================
-- Delete in order of dependencies (leaf tables first)
-- =============================================

-- Discussion and voting tables (depend on final_versions)
TRUNCATE TABLE public.final_version_discussions CASCADE;
TRUNCATE TABLE public.final_version_votes CASCADE;

-- Final versions (depends on snapshots, chats, users)
TRUNCATE TABLE public.final_versions CASCADE;

-- Summary votes (depends on transcript_summaries)
TRUNCATE TABLE public.summary_votes CASCADE;

-- Room design chats (depends on chats)
TRUNCATE TABLE public.room_design_chats CASCADE;

-- Messages and snapshots (depend on chats)
TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.snapshots CASCADE;

-- Chats (depends on users)
TRUNCATE TABLE public.chats CASCADE;

-- Meeting-related tables (minimal dependencies)
TRUNCATE TABLE public.meeting_transcripts CASCADE;
TRUNCATE TABLE public.transcript_summaries CASCADE;
TRUNCATE TABLE public.meeting_chat_messages CASCADE;

-- Workflow and config tables (no user dependencies)
TRUNCATE TABLE public.workflow_states CASCADE;
TRUNCATE TABLE public.prompt_templates CASCADE;

-- Admin table (depends on auth.users)
TRUNCATE TABLE public.admins CASCADE;

-- Users table (depends on auth.users) - OPTIONAL
-- Uncomment the line below if you want to clear users too
-- Note: This will NOT delete auth.users, only public.users
-- TRUNCATE TABLE public.users CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- =============================================
-- Verify tables are empty
-- =============================================
SELECT 'final_version_discussions' as table_name, COUNT(*) as row_count FROM public.final_version_discussions
UNION ALL SELECT 'final_version_votes', COUNT(*) FROM public.final_version_votes
UNION ALL SELECT 'final_versions', COUNT(*) FROM public.final_versions
UNION ALL SELECT 'summary_votes', COUNT(*) FROM public.summary_votes
UNION ALL SELECT 'room_design_chats', COUNT(*) FROM public.room_design_chats
UNION ALL SELECT 'messages', COUNT(*) FROM public.messages
UNION ALL SELECT 'snapshots', COUNT(*) FROM public.snapshots
UNION ALL SELECT 'chats', COUNT(*) FROM public.chats
UNION ALL SELECT 'meeting_transcripts', COUNT(*) FROM public.meeting_transcripts
UNION ALL SELECT 'transcript_summaries', COUNT(*) FROM public.transcript_summaries
UNION ALL SELECT 'meeting_chat_messages', COUNT(*) FROM public.meeting_chat_messages
UNION ALL SELECT 'workflow_states', COUNT(*) FROM public.workflow_states
UNION ALL SELECT 'prompt_templates', COUNT(*) FROM public.prompt_templates
UNION ALL SELECT 'admins', COUNT(*) FROM public.admins
UNION ALL SELECT 'users', COUNT(*) FROM public.users
ORDER BY table_name;
