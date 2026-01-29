-- Grant SELECT on discussion/version views to anon so server-side API (using anon key
-- when SUPABASE_SERVICE_ROLE_KEY is not set, e.g. on Render) can read them.
-- authenticated already has SELECT from 000_complete_schema.sql.
--
-- Apply: Supabase Dashboard → SQL Editor → New Query → paste this file → Run.
-- Or: supabase db push (if using Supabase CLI linked to your project).

GRANT SELECT ON public.final_version_discussions_with_users TO anon;
GRANT SELECT ON public.final_versions_with_users TO anon;
