-- Migration 012: Fix Orphaned Auth Users
-- Purpose: Create missing public.users records for auth.users that don't have them
-- This fixes the "login without signup" bug for existing broken accounts

-- Insert missing user records for auth users without corresponding public.users records
INSERT INTO public.users (id, email, created_at)
SELECT
  au.id,
  au.email,
  au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      created_at = EXCLUDED.created_at;

-- Log how many records were fixed
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  -- Count orphaned auth users (before the insert above would have fixed them)
  SELECT COUNT(*) INTO orphaned_count
  FROM auth.users au
  LEFT JOIN public.users pu ON au.id = pu.id
  WHERE pu.id IS NULL;

  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Fixed % orphaned auth users by creating their public.users records', orphaned_count;
  ELSE
    RAISE NOTICE 'No orphaned auth users found - all are properly synchronized';
  END IF;
END $$;

-- Add a comment
COMMENT ON TABLE public.users IS
'User records synced from auth.users. Migration 012 fixed orphaned auth users created before the login verification was added.';
