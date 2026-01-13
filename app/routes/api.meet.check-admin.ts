/**
 * API Route: Check Global Admin Status
 * GET /api/meet/check-admin
 *
 * Checks if the current authenticated user has global admin privileges.
 * Returns { isAdmin: boolean }
 */

import { type LoaderFunctionArgs, json } from '@remix-run/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (server-side)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get the current user from Supabase session
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      // Not authenticated - not an admin
      return json({
        isAdmin: false,
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      // Failed to authenticate - not an admin
      return json({
        isAdmin: false,
      });
    }

    // Check if user exists in admins table
    const { data: adminRecord, error: queryError } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (queryError || !adminRecord) {
      // Not in admins table - not an admin
      return json({
        isAdmin: false,
      });
    }

    // User is an admin
    console.log(`✅ User ${user.email} verified as admin`);
    return json({
      isAdmin: true,
    });
  } catch (error: any) {
    console.error('❌ Error checking admin status:', error);
    // On error, default to not admin
    return json({
      isAdmin: false,
    });
  }
}
