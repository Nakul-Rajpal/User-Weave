-- Migration 010: Fix User Creation Trigger
-- Purpose: Update handle_new_user() function to properly handle errors
-- Issue: ON CONFLICT DO NOTHING silently fails, causing FK violations later
-- Fix: Change to DO UPDATE and add proper error handling

-- Drop and recreate the function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new user record, or update if conflict occurs
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        created_at = EXCLUDED.created_at;

  -- Log successful user creation
  RAISE NOTICE 'User record created/updated for: % (ID: %)', NEW.email, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details
    RAISE WARNING 'Failed to create user record for % (ID: %): %', NEW.email, NEW.id, SQLERRM;
    -- Re-raise the exception to prevent auth user creation from succeeding
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger should already exist from migration 000, but recreate just in case
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS
'Automatically creates a user record in public.users when a new auth.users record is created.
Updated to use ON CONFLICT DO UPDATE and proper error handling to prevent silent failures.';
