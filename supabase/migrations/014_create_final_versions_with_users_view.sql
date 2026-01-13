-- Migration 014: Create Final Versions With Users View
-- Purpose: Create a view that joins final_versions with user information
-- This fixes the display issue where final versions show placeholder user data

-- Create a view for final versions with real user information
CREATE OR REPLACE VIEW public.final_versions_with_users AS
SELECT
  fv.*,
  pu.email as user_email,
  au.raw_user_meta_data->>'full_name' as user_name,
  au.raw_user_meta_data->>'avatar_url' as user_avatar
FROM public.final_versions fv
LEFT JOIN public.users pu ON fv.user_id = pu.id
LEFT JOIN auth.users au ON fv.user_id = au.id;

-- Grant access to the view
GRANT SELECT ON public.final_versions_with_users TO authenticated;

-- Add comment
COMMENT ON VIEW public.final_versions_with_users IS
'Final versions with user profile information (email, full_name, avatar_url). Fixes the placeholder user data issue where only truncated user IDs were displayed.';

-- Verify the view works
DO $$
DECLARE
  view_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'public'
  AND table_name = 'final_versions_with_users';

  IF view_count > 0 THEN
    RAISE NOTICE '✅ Successfully created final_versions_with_users view';
  ELSE
    RAISE WARNING '⚠️ Failed to create final_versions_with_users view';
  END IF;
END $$;
