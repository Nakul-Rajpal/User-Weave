import { createServerClient } from '@supabase/ssr';
import type { Database } from './client';
import { createCookieHandler } from './cookies.server';

/**
 * Server-side Supabase client factory
 * Creates a new client instance for each request with cookie-based session handling
 *
 * IMPORTANT: Do not use this as a singleton. Always create a new client per request.
 *
 * Usage:
 * ```typescript
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const { supabase, headers } = createSupabaseServerClient(request);
 *   const { data } = await supabase.from('table').select();
 *   return json({ data }, { headers });
 * }
 * ```
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/**
 * Create a Supabase client for server-side use with cookie handling
 * @param request - The Remix Request object
 * @returns Object containing the Supabase client and headers to set cookies
 */
export function createSupabaseServerClient(request: Request) {
  const cookieHandler = createCookieHandler(request);

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get: (name) => cookieHandler.get(name),
        set: (name, value, options) => cookieHandler.set(name, value, options),
        remove: (name, options) => cookieHandler.remove(name, options),
      },
    }
  );

  return {
    supabase,
    headers: new Headers(cookieHandler.getSetCookieHeaders().map(cookie => ['Set-Cookie', cookie])),
  };
}

// For backward compatibility with existing code that imports 'supabase' directly
// This will work but won't have cookie handling - use createSupabaseServerClient instead
export { supabaseUrl, supabaseAnonKey };
