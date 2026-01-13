import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { createSupabaseServerClient } from '~/lib/supabase/client.server';
import { getVerifiedUser } from '~/lib/supabase/user-helpers';
import type { Database } from '~/lib/supabase/client';

type Message = Database['public']['Tables']['messages']['Row'];
type Chat = Database['public']['Tables']['chats']['Row'];

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const { supabase, headers } = createSupabaseServerClient(request);
    const user = await getVerifiedUser(supabase);
    const chatId = params.id;

    if (!user) {
      return json({ error: 'Unauthorized or user record not found' }, { status: 401 });
    }

    if (!chatId) {
      return json({ error: 'Chat ID required' }, { status: 400 });
    }

    // Verify the chat belongs to the user - look up by url_id since URLs use url_id
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('url_id', chatId)
      .eq('user_id', user.id)
      .single();

    if (chatError || !chat) {
      return json({ error: 'Chat not found or access denied' }, { status: 404 });
    }

    // Get messages for the chat
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    return json({ chat, messages }, { headers });
  } catch (error: any) {
    console.error('Error fetching chat:', error);
    return json({ error: 'Failed to fetch chat', details: error.message }, { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const { supabase, headers } = createSupabaseServerClient(request);
    const user = await getVerifiedUser(supabase);
    const chatId = params.id;

    if (!user) {
      return json({ error: 'Unauthorized or user record not found' }, { status: 401 });
    }

    if (!chatId) {
      return json({ error: 'Chat ID required' }, { status: 400 });
    }

    // Verify the chat belongs to the user - look up by url_id since URLs use url_id
    const { data: chat } = await supabase
      .from('chats')
      .select('*')
      .eq('url_id', chatId)
      .eq('user_id', user.id)
      .single();

    if (!chat) {
      return json({ error: 'Chat not found or access denied' }, { status: 404 });
    }

    const formData = await request.formData();
    const action = formData.get('_action') as string;

    switch (action) {
      case 'add_message': {
        const role = formData.get('role') as string;
        const content = JSON.parse(formData.get('content') as string);

        const { data, error } = await supabase
          .from('messages')
          .insert({
            chat_id: chatId,
            role,
            content,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        // Update chat's updated_at timestamp
        await supabase
          .from('chats')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', chatId);

        return json({ message: data }, { headers });
      }

      case 'add_messages': {
        const messages = JSON.parse(formData.get('messages') as string);

        const { data, error } = await supabase
          .from('messages')
          .insert(
            messages.map((msg: any) => ({
              chat_id: chatId,
              role: msg.role,
              content: msg.content,
            }))
          )
          .select();

        if (error) {
          throw error;
        }

        // Update chat's updated_at timestamp
        await supabase
          .from('chats')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', chatId);

        return json({ messages: data }, { headers });
      }

      case 'create_snapshot': {
        const messageId = formData.get('messageId') as string;
        const filesJson = formData.get('filesJson') ? JSON.parse(formData.get('filesJson') as string) : null;
        const summary = formData.get('summary') as string;

        const { data, error } = await supabase
          .from('snapshots')
          .insert({
            chat_id: chat.id,
            message_id: messageId || null,
            files_json: filesJson,
            summary,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        return json({ snapshot: data }, { headers });
      }

      case 'get_snapshot': {
        const { data, error } = await supabase
          .from('snapshots')
          .select('*')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
          throw error;
        }

        return json({ snapshot: data }, { headers });
      }

      default:
        return json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in chat action:', error);
    return json({ error: 'Operation failed', details: error.message }, { status: 500 });
  }
}
