/**
 * API Endpoint: Manage Final Version Discussions
 * POST   /api/meet/final-version-discussion - Create new discussion/reply
 * PUT    /api/meet/final-version-discussion - Update existing discussion
 * DELETE /api/meet/final-version-discussion - Delete discussion
 *
 * Handles CRUD operations for threaded discussions on final versions
 * Requires authenticated users
 */

import { type ActionFunctionArgs, json } from '@remix-run/node';
import { createSupabaseServerClient } from '~/lib/supabase/client.server';
import { getCurrentUser } from '~/lib/supabase/auth.server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '~/lib/supabase/client';

/**
 * POST: Create new discussion message or reply
 */
async function handleCreate(
  request: Request,
  supabase: SupabaseClient<Database>,
  user: User,
  headers: Headers
) {
  // Parse request body
  const body = await request.json();
  const { finalVersionId, roomId, messageText, parentId } = body;

  // Validate required fields (userId comes from authenticated user)
  if (!finalVersionId || !roomId || !messageText) {
    return json(
      {
        success: false,
        error: 'Missing required fields: finalVersionId, roomId, and messageText are required',
      },
      { status: 400, headers }
    );
  }

  // Validate message length
  if (messageText.trim().length === 0) {
    return json(
      { success: false, error: 'Message cannot be empty' },
      { status: 400, headers }
    );
  }

  if (messageText.length > 1000) {
    return json(
      { success: false, error: 'Message exceeds maximum length of 1000 characters' },
      { status: 400, headers }
    );
  }

  // Verify final version exists
  const { data: finalVersion, error: versionError } = await supabase
    .from('final_versions')
    .select('id')
    .eq('id', finalVersionId)
    .single();

  if (versionError || !finalVersion) {
    return json({ success: false, error: 'Final version not found' }, { status: 404, headers });
  }

  // If this is a reply, verify parent exists
  if (parentId) {
    const { data: parentDiscussion, error: parentError } = await supabase
      .from('final_version_discussions')
      .select('id, final_version_id, room_id')
      .eq('id', parentId)
      .single();

    if (parentError || !parentDiscussion) {
      return json({ success: false, error: 'Parent discussion not found' }, { status: 404, headers });
    }

    // Verify parent belongs to same version and room
    if (
      parentDiscussion.final_version_id !== finalVersionId ||
      parentDiscussion.room_id !== roomId
    ) {
      return json(
        { success: false, error: 'Parent discussion does not match version or room' },
        { status: 400, headers }
      );
    }
  }

  // Insert discussion - use authenticated user ID
  const { data: discussion, error: insertError } = await supabase
    .from('final_version_discussions')
    .insert({
      final_version_id: finalVersionId,
      room_id: roomId,
      user_id: user.id, // Use authenticated user ID
      parent_id: parentId || null,
      message_text: messageText.trim(),
    })
    .select('*')
    .single();

  if (insertError) {
    console.error('[API] Error creating discussion:', insertError);
    throw new Error(`Failed to create discussion: ${insertError.message}`);
  }

  // Fetch discussion with user info (table + join; avoids view permission issues)
  const { data: row, error: fetchError } = await supabase
    .from('final_version_discussions')
    .select('*, users ( email )')
    .eq('id', discussion.id)
    .single();

  if (fetchError || !row) {
    console.log('[API] Discussion created (fetch with user info failed):', { id: discussion.id });
    return json({
      success: true,
      discussion: {
        ...discussion,
        user_email: null,
        user_name: null,
        user_avatar: null,
      },
    }, { headers });
  }

  const userRow = Array.isArray(row.users) ? row.users[0] : row.users;
  const email = userRow?.email ?? null;
  const discussionWithUser = {
    ...row,
    users: undefined,
    user_email: email,
    user_name: email ? email.split('@')[0] : 'Unknown',
    user_avatar: null,
  };

  return json({
    success: true,
    discussion: discussionWithUser,
  }, { headers });
}

/**
 * PUT: Update existing discussion message
 */
async function handleUpdate(
  request: Request,
  supabase: SupabaseClient<Database>,
  user: User,
  headers: Headers
) {
  const body = await request.json();
  const { id, messageText } = body;

  // Validate required fields (userId comes from authenticated user)
  if (!id || !messageText) {
    return json(
      { success: false, error: 'Missing required fields: id and messageText are required' },
      { status: 400, headers }
    );
  }

  // Validate message length
  if (messageText.trim().length === 0) {
    return json({ success: false, error: 'Message cannot be empty' }, { status: 400, headers });
  }

  if (messageText.length > 1000) {
    return json(
      { success: false, error: 'Message exceeds maximum length of 1000 characters' },
      { status: 400, headers }
    );
  }

  // Verify discussion exists and user owns it
  const { data: existingDiscussion, error: fetchError } = await supabase
    .from('final_version_discussions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingDiscussion) {
    return json({ success: false, error: 'Discussion not found' }, { status: 404, headers });
  }

  if (existingDiscussion.user_id !== user.id) {
    return json(
      { success: false, error: 'You can only edit your own messages' },
      { status: 403, headers }
    );
  }

  // Update discussion
  const { data: discussion, error: updateError } = await supabase
    .from('final_version_discussions')
    .update({
      message_text: messageText.trim(),
      is_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    console.error('[API] Error updating discussion:', updateError);
    throw new Error(`Failed to update discussion: ${updateError.message}`);
  }

  // Fetch discussion with user info (table + join; avoids view permission issues)
  const { data: row, error: joinError } = await supabase
    .from('final_version_discussions')
    .select('*, users ( email )')
    .eq('id', id)
    .single();

  if (joinError || !row) {
    return json({
      success: true,
      discussion: {
        ...discussion,
        user_email: null,
        user_name: null,
        user_avatar: null,
      },
    }, { headers });
  }

  const userRow = Array.isArray(row.users) ? row.users[0] : row.users;
  const email = userRow?.email ?? null;
  const discussionWithUser = {
    ...row,
    users: undefined,
    user_email: email,
    user_name: email ? email.split('@')[0] : 'Unknown',
    user_avatar: null,
  };

  return json({
    success: true,
    discussion: discussionWithUser,
  }, { headers });
}

/**
 * DELETE: Delete discussion message
 */
async function handleDelete(
  request: Request,
  supabase: SupabaseClient<Database>,
  user: User,
  headers: Headers
) {
  const body = await request.json();
  const { id } = body;

  if (!id) {
    return json({ success: false, error: 'Discussion ID is required' }, { status: 400, headers });
  }

  // Verify discussion exists and user owns it
  const { data: existingDiscussion, error: fetchError } = await supabase
    .from('final_version_discussions')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchError || !existingDiscussion) {
    return json({ success: false, error: 'Discussion not found' }, { status: 404, headers });
  }

  if (existingDiscussion.user_id !== user.id) {
    return json(
      { success: false, error: 'You can only delete your own messages' },
      { status: 403, headers }
    );
  }

  // Delete discussion (CASCADE will delete all replies)
  const { error: deleteError } = await supabase
    .from('final_version_discussions')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('[API] Error deleting discussion:', deleteError);
    throw new Error(`Failed to delete discussion: ${deleteError.message}`);
  }

  console.log('[API] Discussion deleted successfully:', { id, userId: user.id });

  return json({ success: true, id }, { headers });
}

/**
 * Main action handler
 */
export async function action({ request }: ActionFunctionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);

  // Require authentication
  const user = await getCurrentUser(supabase);
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const method = request.method;

    switch (method) {
      case 'POST':
        return await handleCreate(request, supabase, user, headers);
      case 'PUT':
        return await handleUpdate(request, supabase, user, headers);
      case 'DELETE':
        return await handleDelete(request, supabase, user, headers);
      default:
        return json({ success: false, error: 'Method not allowed' }, { status: 405, headers });
    }
  } catch (error: any) {
    console.error('[API] Error managing discussion:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to manage discussion',
      },
      { status: 500, headers }
    );
  }
}
