-- Migration 011: Fix Foreign Key References
-- Purpose: Standardize all user_id foreign keys to reference public.users instead of auth.users
-- Issue: Inconsistent FK references cause confusion and potential issues
-- Fix: Update final_versions and summary_votes to reference public.users(id)

-- Fix final_versions table
-- Drop the existing constraint that references auth.users
ALTER TABLE IF EXISTS public.final_versions
  DROP CONSTRAINT IF EXISTS final_versions_user_id_fkey;

-- Add new constraint referencing public.users
ALTER TABLE IF EXISTS public.final_versions
  ADD CONSTRAINT final_versions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix summary_votes table (if it exists)
ALTER TABLE IF EXISTS public.summary_votes
  DROP CONSTRAINT IF EXISTS summary_votes_user_id_fkey;

ALTER TABLE IF EXISTS public.summary_votes
  ADD CONSTRAINT summary_votes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix final_version_votes table (if it exists)
ALTER TABLE IF EXISTS public.final_version_votes
  DROP CONSTRAINT IF EXISTS final_version_votes_user_id_fkey;

ALTER TABLE IF EXISTS public.final_version_votes
  ADD CONSTRAINT final_version_votes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON CONSTRAINT final_versions_user_id_fkey ON public.final_versions IS
'References public.users for consistency with other tables (updated in migration 011)';

COMMENT ON CONSTRAINT summary_votes_user_id_fkey ON public.summary_votes IS
'References public.users for consistency with other tables (updated in migration 011)';

COMMENT ON CONSTRAINT final_version_votes_user_id_fkey ON public.final_version_votes IS
'References public.users for consistency with other tables (updated in migration 011)';

-- Verify all user_id columns now reference public.users
-- This query can be run to check (commented out for migration):
-- SELECT
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND kcu.column_name = 'user_id'
--   AND tc.table_schema = 'public';
