import { supabase } from './client';
import type { User } from '@supabase/supabase-js';
import { authStore } from '~/components/auth/Auth';

export async function signUp(email: string, password: string) {
  console.log('🔐 [AUTH] Starting sign up for:', email);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  console.log('🔐 [AUTH] Sign up result:', {
    hasUser: !!data.user,
    userId: data.user?.id,
    userEmail: data.user?.email,
    hasSession: !!data.session,
    error: error?.message,
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  console.log('🔐 [AUTH] Starting sign in for:', email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  console.log('🔐 [AUTH] Sign in result:', {
    hasUser: !!data.user,
    userId: data.user?.id,
    userEmail: data.user?.email,
    hasSession: !!data.session,
    error: error?.message,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser(): Promise<User | null> {
  // Get user from Supabase auth session
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    console.log('🔐 [AUTH] getCurrentUser from Supabase:', {
      hasUser: true,
      userId: user.id,
      email: user.email,
    });
  } else {
    console.log('🔐 [AUTH] No authenticated user');
  }

  return user;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}
