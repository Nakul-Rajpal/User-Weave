/**
 * Migration: Create Global Admins Table
 *
 * This table tracks users who have admin privileges across ALL meeting rooms.
 * Admin status is global - once a user becomes admin, they have admin
 * privileges in all rooms they join.
 *
 * Password-protected: Users must provide correct password to become admin.
 */

-- ============================================
-- 1. CREATE ADMINS TABLE
-- ============================================

-- Create admins table (global admin tracking, not per-room)
CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. CREATE INDEX
-- ============================================

-- Index for fast admin lookups
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON public.admins(user_id);

-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. CREATE RLS POLICIES
-- ============================================

-- Policy: Anyone can check if a user is admin (needed for UI)
CREATE POLICY "Anyone can check admin status"
  ON public.admins
  FOR SELECT
  USING (true);

-- Policy: Authenticated users can become admin (password validated server-side)
CREATE POLICY "Authenticated users can become admin"
  ON public.admins
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- Policy: Admins can update their own record (for future use)
CREATE POLICY "Admins can update their own record"
  ON public.admins
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- SUMMARY
-- ============================================
--
-- Created global admins table for platform-wide admin privileges:
-- ✅ admins table (user_id PRIMARY KEY)
-- ✅ Index on user_id for fast lookups
-- ✅ RLS policies (SELECT for all, INSERT for authenticated)
--
-- Admin role is GLOBAL - applies to all meeting rooms
-- ============================================
