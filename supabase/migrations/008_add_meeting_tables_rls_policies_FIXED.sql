/**
 * Migration: Add RLS Policies for Meeting Tables (FIXED VERSION)
 *
 * Adds Row Level Security policies for tables that exist but were missing policies:
 * - meeting_chat_messages
 * - room_design_chats (FIXED type casting)
 * - prompt_templates
 *
 * These tables were causing "new row violates row-level security policy" errors
 * because RLS was enabled but no policies existed.
 */

-- ============================================
-- 1. MEETING CHAT MESSAGES
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE public.meeting_chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Authenticated users can view all meeting messages" ON public.meeting_chat_messages;
DROP POLICY IF EXISTS "Authenticated users can create meeting messages" ON public.meeting_chat_messages;
DROP POLICY IF EXISTS "Users can update their own meeting messages" ON public.meeting_chat_messages;
DROP POLICY IF EXISTS "Users can delete their own meeting messages" ON public.meeting_chat_messages;

-- Policy: Allow authenticated users to read all messages (multi-user chat rooms)
CREATE POLICY "Authenticated users can view all meeting messages"
  ON public.meeting_chat_messages
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to create messages
CREATE POLICY "Authenticated users can create meeting messages"
  ON public.meeting_chat_messages
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Allow users to update their own messages
CREATE POLICY "Users can update their own meeting messages"
  ON public.meeting_chat_messages
  FOR UPDATE
  USING (sender_user_id IS NOT NULL AND auth.uid() = sender_user_id)
  WITH CHECK (sender_user_id IS NOT NULL AND auth.uid() = sender_user_id);

-- Policy: Allow users to delete their own messages
CREATE POLICY "Users can delete their own meeting messages"
  ON public.meeting_chat_messages
  FOR DELETE
  USING (sender_user_id IS NOT NULL AND auth.uid() = sender_user_id);

-- ============================================
-- 2. ROOM DESIGN CHATS (FIXED)
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE public.room_design_chats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Authenticated users can view all room design chats" ON public.room_design_chats;
DROP POLICY IF EXISTS "Authenticated users can create room design chats" ON public.room_design_chats;
DROP POLICY IF EXISTS "Users can update their own room design chats" ON public.room_design_chats;
DROP POLICY IF EXISTS "Users can delete their own room design chats" ON public.room_design_chats;

-- Policy: Allow authenticated users to read all design chats
CREATE POLICY "Authenticated users can view all room design chats"
  ON public.room_design_chats
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to create design chats
CREATE POLICY "Authenticated users can create room design chats"
  ON public.room_design_chats
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Allow creators to update their own design chats (FIXED casting)
CREATE POLICY "Users can update their own room design chats"
  ON public.room_design_chats
  FOR UPDATE
  USING (generated_by IS NOT NULL AND generated_by = auth.uid()::text)
  WITH CHECK (generated_by IS NOT NULL AND generated_by = auth.uid()::text);

-- Policy: Allow creators to delete their own design chats (FIXED casting)
CREATE POLICY "Users can delete their own room design chats"
  ON public.room_design_chats
  FOR DELETE
  USING (generated_by IS NOT NULL AND generated_by = auth.uid()::text);

-- ============================================
-- 3. PROMPT TEMPLATES
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Authenticated users can view all prompt templates" ON public.prompt_templates;
DROP POLICY IF EXISTS "Authenticated users can create prompt templates" ON public.prompt_templates;
DROP POLICY IF EXISTS "Authenticated users can update prompt templates" ON public.prompt_templates;
DROP POLICY IF EXISTS "Authenticated users can delete prompt templates" ON public.prompt_templates;

-- Policy: Allow authenticated users to read all templates
-- (Templates are shared across room participants)
CREATE POLICY "Authenticated users can view all prompt templates"
  ON public.prompt_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to create templates
CREATE POLICY "Authenticated users can create prompt templates"
  ON public.prompt_templates
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to update templates
-- (Any authenticated user can update templates for collaboration)
CREATE POLICY "Authenticated users can update prompt templates"
  ON public.prompt_templates
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to delete templates
CREATE POLICY "Authenticated users can delete prompt templates"
  ON public.prompt_templates
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================
-- SUMMARY
-- ============================================
--
-- Created RLS policies for:
-- ✅ meeting_chat_messages (4 policies: SELECT, INSERT, UPDATE, DELETE)
-- ✅ room_design_chats (4 policies: SELECT, INSERT, UPDATE, DELETE) - FIXED type casting
-- ✅ prompt_templates (4 policies: SELECT, INSERT, UPDATE, DELETE)
--
-- All policies require authentication via auth.role() = 'authenticated'
-- Update/Delete policies enforce ownership where applicable
--
-- FIXES:
-- - Changed meeting_chat_messages to use UUID comparison directly
-- - Changed room_design_chats from `auth.uid()::text = generated_by`
--   to `generated_by = auth.uid()::text` (correct type casting order)
-- - Added NULL checks for nullable user ID fields
-- ============================================
