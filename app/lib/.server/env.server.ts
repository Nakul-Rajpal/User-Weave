/**
 * Server-only environment variable access
 * This file MUST only be imported from server-side code (.server.ts files or Remix loaders/actions)
 * NEVER import this from client-side code!
 */

/**
 * Get server-side environment variables
 * Works in both development and Vercel production
 */
export function getServerEnv() {
  return {
    SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

/**
 * Validate that required server environment variables are set
 */
export function validateServerEnv() {
  const env = getServerEnv();
  const missing: string[] = [];

  if (!env.SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!env.SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY');
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  return {
    isValid: missing.length === 0,
    missing,
    env,
  };
}
