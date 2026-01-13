import { json, type ActionFunctionArgs } from '@remix-run/node';
import { createSupabaseServerClient } from '~/lib/supabase/client.server';
import { signIn, signUp, signOut } from '~/lib/supabase/auth.server';

export async function action({ request }: ActionFunctionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();
  const action = formData.get('action') as string;

  switch (action) {
    case 'signin': {
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      const { data, error } = await signIn(supabase, email, password);

      if (error) {
        return json({ error: error.message }, { status: 400 });
      }

      // Verify user exists in database (prevents auto-signup-on-login bug)
      // This catches cases where Supabase auto-creates accounts when email confirmation is disabled
      if (data.user) {
        const { data: dbUser, error: dbError } = await supabase
          .from('users')
          .select('id')
          .eq('id', data.user.id)
          .single();

        if (!dbUser || dbError) {
          // User was auto-created in auth.users but doesn't exist in public.users
          // This means they tried to login without signing up
          console.error('❌ Login attempt for non-existent user:', {
            userId: data.user.id,
            email: data.user.email,
            error: dbError?.message,
          });

          // Sign out the auto-created session
          await signOut(supabase);

          return json({
            error: 'Invalid login credentials. Please sign up first.'
          }, { status: 401 });
        }

        console.log('✅ User verified in database on login:', data.user.id);
      }

      return json({ user: data.user, session: data.session }, { headers });
    }

    case 'signup': {
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      const { data, error } = await signUp(supabase, email, password);

      if (error) {
        return json({ error: error.message }, { status: 400 });
      }

      // Verify user record was created in database
      // Wait for the database trigger to complete with retry logic
      if (data.user) {
        let retries = 5;
        let userExists = false;

        while (retries > 0 && !userExists) {
          const { data: dbUser, error: dbError } = await supabase
            .from('users')
            .select('id')
            .eq('id', data.user.id)
            .single();

          if (dbUser && !dbError) {
            userExists = true;
            console.log('✅ User record verified in database:', data.user.id);
          } else {
            console.log(`⏳ Waiting for user record creation... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, 500));
            retries--;
          }
        }

        if (!userExists) {
          console.error('❌ Failed to create user record in database:', data.user.id);
          // User record was not created - this is a critical error
          // The auth user exists but DB record doesn't, which will cause FK violations
          return json({
            error: 'Failed to complete account creation. Please try again or contact support if the issue persists.'
          }, { status: 500 });
        }
      }

      return json({ user: data.user }, { headers });
    }

    case 'signout': {
      const { error } = await signOut(supabase);

      if (error) {
        return json({ error: error.message }, { status: 400 });
      }

      return json({ success: true }, { headers });
    }

    default:
      return json({ error: 'Invalid action' }, { status: 400 });
  }
}
