/**
 * API Route: Claim Global Admin Role
 * POST /api/meet/claim-admin
 *
 * Allows authenticated users to become global admins by providing the correct password.
 * Admin status applies to ALL meeting rooms, not just one specific room.
 */

import { type ActionFunctionArgs, json } from '@remix-run/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (server-side)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Hardcoded admin password (TODO: Move to environment variable)
const ADMIN_PASSWORD = '1234';

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Parse request body
    const { password } = await request.json();

    console.log('🔐 Admin claim attempt');

    // Validate password
    if (password !== ADMIN_PASSWORD) {
      console.log('❌ Invalid admin password provided');
      return json(
        {
          success: false,
          message: 'Invalid admin password',
        },
        { status: 401 }
      );
    }

    // Get the current user from Supabase session
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      console.log('❌ No authorization header');
      return json(
        {
          success: false,
          message: 'Authentication required',
        },
        { status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.log('❌ Failed to authenticate user:', authError);
      return json(
        {
          success: false,
          message: 'Invalid authentication',
        },
        { status: 401 }
      );
    }

    console.log(`✅ Valid admin password from user: ${user.email}`);

    // Check if user is already admin (idempotent operation)
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingAdmin) {
      console.log(`ℹ️  User ${user.email} is already an admin`);
      return json({
        success: true,
        isAdmin: true,
        message: 'You are already an admin',
      });
    }

    // Insert user as admin
    const { error: insertError } = await supabase
      .from('admins')
      .insert({
        user_id: user.id,
        email: user.email,
      });

    if (insertError) {
      console.error('❌ Failed to insert admin:', insertError);
      return json(
        {
          success: false,
          message: 'Failed to grant admin privileges',
        },
        { status: 500 }
      );
    }

    console.log(`✅ User ${user.email} is now a global admin`);

    return json({
      success: true,
      isAdmin: true,
      message: 'Admin privileges granted successfully',
    });
  } catch (error: any) {
    console.error('❌ Error in claim-admin:', error);
    return json(
      {
        success: false,
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
