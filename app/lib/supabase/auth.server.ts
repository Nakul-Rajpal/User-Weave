import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from './client';

/**
 * Server-side authentication utilities
 * These functions work with the server Supabase client that has cookie-based sessions
 */

/**
 * Get the currently authenticated user from a server Supabase client
 * @param supabase - Server Supabase client with request context
 * @returns User object or null if not authenticated
 */
export async function getCurrentUser(supabase: SupabaseClient<Database>): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('🔐 [AUTH SERVER] Error getting user:', error.message);
    return null;
  }

  if (user) {
    console.log('🔐 [AUTH SERVER] getCurrentUser:', {
      hasUser: true,
      userId: user.id,
      email: user.email,
    });
  } else {
    console.log('🔐 [AUTH SERVER] No authenticated user');
  }

  return user;
}

/**
 * Get the current session from a server Supabase client
 * @param supabase - Server Supabase client with request context
 * @returns Session object or null if not authenticated
 */
export async function getSession(supabase: SupabaseClient<Database>) {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('🔐 [AUTH SERVER] Error getting session:', error.message);
    return null;
  }

  return session;
}

/**
 * Require authentication - throws error if user is not authenticated
 * @param supabase - Server Supabase client with request context
 * @returns User object
 * @throws Error if not authenticated
 */
export async function requireAuth(supabase: SupabaseClient<Database>): Promise<User> {
  const user = await getCurrentUser(supabase);

  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  return user;
}

/**
 * Sign up a new user (server-side)
 * @param supabase - Server Supabase client with request context
 * @param email - User email
 * @param password - User password
 * @returns Auth response with user data
 */
export async function signUp(supabase: SupabaseClient<Database>, email: string, password: string) {
  console.log('🔐 [AUTH SERVER] Starting sign up for:', email);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  console.log('🔐 [AUTH SERVER] Sign up result:', {
    hasUser: !!data.user,
    userId: data.user?.id,
    userEmail: data.user?.email,
    hasSession: !!data.session,
    error: error?.message,
  });
  return { data, error };
}

/**
 * Sign in an existing user (server-side)
 * @param supabase - Server Supabase client with request context
 * @param email - User email
 * @param password - User password
 * @returns Auth response with user and session data
 */
export async function signIn(supabase: SupabaseClient<Database>, email: string, password: string) {
  console.log('🔐 [AUTH SERVER] Starting sign in for:', email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  console.log('🔐 [AUTH SERVER] Sign in result:', {
    hasUser: !!data.user,
    userId: data.user?.id,
    userEmail: data.user?.email,
    hasSession: !!data.session,
    error: error?.message,
  });
  return { data, error };
}

/**
 * Sign out the current user (server-side)
 * @param supabase - Server Supabase client with request context
 * @returns Auth response
 */
export async function signOut(supabase: SupabaseClient<Database>) {
  const { error } = await supabase.auth.signOut();
  return { error };
}
