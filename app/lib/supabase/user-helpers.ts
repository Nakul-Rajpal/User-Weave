import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from './client';

/**
 * User verification utilities
 * These functions ensure that authenticated users have corresponding records in public.users table
 * This prevents foreign key violations when creating chats, votes, etc.
 */

/**
 * Verify that a user exists in public.users table
 * This is critical because database triggers may fail or have delays
 * @param supabase - Supabase client
 * @param userId - User ID to verify
 * @throws Error if user doesn't exist in database
 */
export async function verifyUserExists(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('❌ [USER VERIFICATION] User not found in database:', {
      userId,
      error: error?.message,
    });
    throw new Error(
      'User record not found in database. Please try logging out and back in, or contact support if the issue persists.'
    );
  }

  console.log('✅ [USER VERIFICATION] User verified:', userId);
}

/**
 * Get authenticated user with database verification
 * Returns user only if they exist in both auth.users and public.users
 * This is safer than getCurrentUser() for operations that require DB user record
 * @param supabase - Supabase client
 * @returns User object or null if not authenticated or not in database
 */
export async function getVerifiedUser(
  supabase: SupabaseClient<Database>
): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('🔐 [USER VERIFICATION] Error getting user:', error.message);
    return null;
  }

  if (!user) {
    console.log('🔐 [USER VERIFICATION] No authenticated user');
    return null;
  }

  // Verify user exists in database
  try {
    await verifyUserExists(supabase, user.id);
    console.log('🔐 [USER VERIFICATION] User authenticated and verified:', {
      userId: user.id,
      email: user.email,
    });
    return user;
  } catch (err) {
    console.error('🔐 [USER VERIFICATION] User exists in auth but not in database:', {
      userId: user.id,
      email: user.email,
      error: err,
    });
    return null;
  }
}

/**
 * Require authenticated user with database verification
 * Throws error if user is not authenticated or doesn't exist in database
 * Use this instead of requireAuth() for API endpoints that create/modify data
 * @param supabase - Supabase client
 * @returns User object
 * @throws Response(401) if not authenticated or user record doesn't exist
 */
export async function requireVerifiedUser(
  supabase: SupabaseClient<Database>
): Promise<User> {
  const user = await getVerifiedUser(supabase);

  if (!user) {
    throw new Response('Unauthorized or user record not found', { status: 401 });
  }

  return user;
}

/**
 * Create user record if it doesn't exist (recovery helper)
 * This can be used to recover from cases where auth user exists but DB record doesn't
 * Should rarely be needed if triggers are working correctly
 * @param supabase - Supabase client
 * @param user - Auth user object
 * @returns true if created/verified, false if failed
 */
export async function ensureUserRecordExists(
  supabase: SupabaseClient<Database>,
  user: User
): Promise<boolean> {
  // First check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existingUser) {
    console.log('✅ [USER RECOVERY] User record already exists:', user.id);
    return true;
  }

  // Try to create the user record
  console.log('⚠️ [USER RECOVERY] User record missing, attempting to create:', user.id);
  const { error } = await supabase
    .from('users')
    .insert({
      id: user.id,
      email: user.email || null,
      created_at: user.created_at || new Date().toISOString(),
    });

  if (error) {
    console.error('❌ [USER RECOVERY] Failed to create user record:', {
      userId: user.id,
      error: error.message,
    });
    return false;
  }

  console.log('✅ [USER RECOVERY] User record created successfully:', user.id);
  return true;
}
