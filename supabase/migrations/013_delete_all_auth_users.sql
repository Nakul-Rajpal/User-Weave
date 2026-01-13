-- Migration 013: Delete All Auth Users
-- Purpose: Clean slate - remove all existing users to start fresh
-- WARNING: This will delete ALL user data including chats, messages, and related records
-- This is irreversible - only run if you're sure you want to delete everything

-- Step 1: Delete all records from public.users
-- This will CASCADE delete all related records (chats, messages, final_versions, etc.)
-- due to ON DELETE CASCADE constraints set in migration 011
DELETE FROM public.users;

-- Log the deletion
DO $$
DECLARE
  deleted_public_count INTEGER;
BEGIN
  -- The count will be 0 since we just deleted, but we can check auth.users
  SELECT COUNT(*) INTO deleted_public_count FROM auth.users;
  RAISE NOTICE 'Deleted all public.users records. Found % auth.users to delete', deleted_public_count;
END $$;

-- Step 2: Delete all auth.users
-- Note: This directly manipulates Supabase's auth schema
-- The trigger handle_new_user will NOT fire on DELETE, so no conflicts
DELETE FROM auth.users;

-- Verify deletion
DO $$
DECLARE
  remaining_auth INTEGER;
  remaining_public INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_auth FROM auth.users;
  SELECT COUNT(*) INTO remaining_public FROM public.users;

  IF remaining_auth = 0 AND remaining_public = 0 THEN
    RAISE NOTICE '✅ Successfully deleted all users. Database is now clean.';
    RAISE NOTICE '📝 Users can now sign up with the fixed authentication flow.';
  ELSE
    RAISE WARNING '⚠️ Some records remain: auth.users = %, public.users = %', remaining_auth, remaining_public;
  END IF;
END $$;

-- Add a comment documenting this cleanup
COMMENT ON TABLE public.users IS
'User records synced from auth.users. Migration 013 deleted all existing users on 2025-11-21 to start fresh with fixed authentication flow.';
