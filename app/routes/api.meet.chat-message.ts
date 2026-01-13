import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/node';
import { createSupabaseServerClient } from '~/lib/supabase/client.server';
import { getVerifiedUser } from '~/lib/supabase/user-helpers';

/**
 * GET: Fetch all chat messages for a room
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);

  // Require authentication and verify user exists in database
  const user = await getVerifiedUser(supabase);
  if (!user) {
    return json({ error: 'Unauthorized or user record not found' }, { status: 401 });
  }

  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');

  if (!roomId) {
    return json({ error: 'Missing roomId parameter' }, { status: 400 });
  }

  try {
    const { data: messages, error } = await supabase
      .from('meeting_chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return json({ messages: messages || [] }, { headers });
  } catch (error: any) {
    console.error('Failed to fetch chat messages:', error);
    return json(
      { error: error.message || 'Failed to fetch messages' },
      { status: 500, headers }
    );
  }
}

/**
 * POST: Save a new chat message
 */
export async function action({ request }: ActionFunctionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);

  // Require authentication and verify user exists in database
  const user = await getVerifiedUser(supabase);
  if (!user) {
    return json({ error: 'Unauthorized or user record not found' }, { status: 401 });
  }

  try {
    const { roomId, messageType, content, senderUsername, imagePrompt } = await request.json();

    // Validate input
    if (!roomId || !messageType || !content || !senderUsername) {
      return json(
        { error: 'Missing required fields: roomId, messageType, content, senderUsername' },
        { status: 400, headers }
      );
    }

    if (messageType !== 'text' && messageType !== 'image') {
      return json(
        { error: 'messageType must be either "text" or "image"' },
        { status: 400, headers }
      );
    }

    // Save message to database with authenticated user ID
    const { data, error } = await supabase
      .from('meeting_chat_messages')
      .insert({
        room_id: roomId,
        message_type: messageType,
        sender_user_id: user.id, // Use authenticated user ID
        sender_username: senderUsername,
        content,
        image_prompt: imagePrompt || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving chat message:', error);
      throw error;
    }

    return json({ message: data }, { headers });
  } catch (error: any) {
    console.error('Failed to save chat message:', error);
    return json(
      { error: error.message || 'Failed to save message' },
      { status: 500, headers }
    );
  }
}
