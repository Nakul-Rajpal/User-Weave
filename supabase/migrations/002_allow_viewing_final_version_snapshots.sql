-- =============================================
-- Migration: Allow viewing snapshots that are final versions
-- =============================================
-- This allows authenticated users to view snapshots that have
-- been marked as final versions, even if they don't own the chat.
-- This is necessary for the code review page to display all
-- users' final versions.
-- =============================================

-- Add policy to allow viewing snapshots that are referenced by final_versions
CREATE POLICY "Users can view snapshots that are final versions"
  ON public.snapshots FOR SELECT
  USING (
    -- Allow if snapshot is referenced by any final_version
    EXISTS (
      SELECT 1 FROM public.final_versions
      WHERE final_versions.snapshot_id = snapshots.id
    )
    OR
    -- OR if user owns the chat (existing policy logic)
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = snapshots.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view snapshots from own chats" ON public.snapshots;

-- =============================================
-- Also allow viewing chats that have final versions
-- =============================================

-- Add policy to allow viewing chats that have final versions
CREATE POLICY "Users can view chats that have final versions"
  ON public.chats FOR SELECT
  USING (
    -- Allow if chat has a final version
    EXISTS (
      SELECT 1 FROM public.final_versions
      WHERE final_versions.chat_id = chats.id
    )
    OR
    -- OR if user owns the chat (existing policy logic)
    chats.user_id = auth.uid()
  );

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view own chats" ON public.chats;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
-- Changes:
-- ✅ Updated snapshots RLS policy to allow viewing final version snapshots
-- ✅ Updated chats RLS policy to allow viewing chats with final versions
-- ✅ Code review page can now display all users' final versions with files
-- =============================================
