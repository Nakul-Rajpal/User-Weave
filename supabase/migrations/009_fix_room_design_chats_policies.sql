-- ============================================
-- Fix: RLS Policies for room_design_chats
-- ============================================
-- The issue: generated_by is UUID type, not text
-- Solution: Compare UUID to UUID directly (no casting)
-- ============================================

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Users can update their own room design chats" ON public.room_design_chats;
DROP POLICY IF EXISTS "Users can delete their own room design chats" ON public.room_design_chats;

-- Policy: UPDATE - Users can update their own room design chats (NO CASTING)
CREATE POLICY "Users can update their own room design chats"
  ON public.room_design_chats
  FOR UPDATE
  USING (generated_by IS NOT NULL AND generated_by = auth.uid())
  WITH CHECK (generated_by IS NOT NULL AND generated_by = auth.uid());

-- Policy: DELETE - Users can delete their own room design chats (NO CASTING)
CREATE POLICY "Users can delete their own room design chats"
  ON public.room_design_chats
  FOR DELETE
  USING (generated_by IS NOT NULL AND generated_by = auth.uid());

-- ============================================
-- EXPECTED RESULT: "Success. No rows returned"
-- ============================================
