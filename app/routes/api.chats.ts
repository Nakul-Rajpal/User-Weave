import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { createSupabaseServerClient } from '~/lib/supabase/client.server';
import { getVerifiedUser } from '~/lib/supabase/user-helpers';
import type { Database } from '~/lib/supabase/client';

type Chat = Database['public']['Tables']['chats']['Row'];

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { supabase, headers } = createSupabaseServerClient(request);
    const user = await getVerifiedUser(supabase);

    if (!user) {
      return json({ error: 'Unauthorized or user record not found' }, { status: 401 });
    }

    const { data: chats, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return json({ chats }, { headers });
  } catch (error: any) {
    console.error('Error fetching chats:', error);
    return json({ error: 'Failed to fetch chats', details: error.message }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { supabase, headers } = createSupabaseServerClient(request);
    const user = await getVerifiedUser(supabase);

    if (!user) {
      return json({ error: 'Unauthorized or user record not found' }, { status: 401 });
    }

    const formData = await request.formData();
    const action = formData.get('_action') as string;

    switch (action) {
      case 'create': {
        const title = formData.get('title') as string;
        const urlId = formData.get('urlId') as string;

        const { data, error } = await supabase
          .from('chats')
          .insert({
            user_id: user.id,
            title: title || null,
            url_id: urlId,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        return json({ chat: data }, { headers });
      }

      case 'update': {
        const chatId = formData.get('chatId') as string;
        const title = formData.get('title') as string;

        const { data, error } = await supabase
          .from('chats')
          .update({ title })
          .eq('id', chatId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return json({ chat: data }, { headers });
      }

      case 'delete': {
        const chatId = formData.get('chatId') as string;

        const { error } = await supabase
          .from('chats')
          .delete()
          .eq('id', chatId)
          .eq('user_id', user.id);

        if (error) {
          throw error;
        }

        return json({ success: true }, { headers });
      }

      default:
        return json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in chats action:', error);
    return json({ error: 'Operation failed', details: error.message }, { status: 500 });
  }
}
