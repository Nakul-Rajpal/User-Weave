/**
 * API Endpoint: Vote on Final Version
 * POST /api/meet/final-version-vote
 *
 * Allows users to vote on final versions during code review
 * Vote types: approve, request_changes, comment
 * Requires authenticated users
 */

import { type ActionFunctionArgs, json } from '@remix-run/node';
import { createSupabaseServerClient } from '~/lib/supabase/client.server';
import { getVerifiedUser } from '~/lib/supabase/user-helpers';

export async function action({ request }: ActionFunctionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);

  // Require authentication and verify user exists in database
  const user = await getVerifiedUser(supabase);
  if (!user) {
    return json({ error: 'Unauthorized or user record not found' }, { status: 401 });
  }

  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, { status: 405, headers });
  }

  try {
    // Parse request body
    const body = await request.json();
    const { finalVersionId, roomId, vote, commentText } = body;

    // Validate required fields (userId comes from authenticated user)
    if (!finalVersionId || !roomId || !vote) {
      return json(
        {
          success: false,
          error: 'Missing required fields: finalVersionId, roomId, and vote are required',
        },
        { status: 400, headers }
      );
    }

    // Validate vote type
    if (!['like', 'dislike'].includes(vote)) {
      return json(
        {
          success: false,
          error: 'Invalid vote type. Must be: like or dislike',
        },
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
      return json(
        { success: false, error: 'Final version not found' },
        { status: 404, headers }
      );
    }

    // Upsert vote (allows changing vote) - use authenticated user ID
    const { data: voteData, error: voteError } = await supabase
      .from('final_version_votes')
      .upsert(
        {
          final_version_id: finalVersionId,
          room_id: roomId,
          user_id: user.id, // Use authenticated user ID
          vote,
          comment_text: commentText || null,
        },
        {
          onConflict: 'final_version_id,room_id,user_id',
        }
      )
      .select()
      .single();

    if (voteError) {
      console.error('[API] Error upserting vote:', voteError);
      throw new Error(`Failed to save vote: ${voteError.message}`);
    }

    // Get updated vote counts for this version in this room
    const { data: allVotes, error: countsError } = await supabase
      .from('final_version_votes')
      .select('vote')
      .eq('final_version_id', finalVersionId)
      .eq('room_id', roomId);

    if (countsError) {
      console.error('[API] Error fetching vote counts:', countsError);
      throw new Error(`Failed to fetch vote counts: ${countsError.message}`);
    }

    // Aggregate counts
    const updatedCounts = {
      like: allVotes?.filter((v) => v.vote === 'like').length || 0,
      dislike: allVotes?.filter((v) => v.vote === 'dislike').length || 0,
    };

    console.log('[API] Vote recorded successfully:', {
      versionId: finalVersionId,
      roomId,
      userId: user.id,
      vote,
      counts: updatedCounts,
    });

    return json({
      success: true,
      vote: {
        id: voteData.id,
        finalVersionId: voteData.final_version_id,
        roomId: voteData.room_id,
        userId: voteData.user_id,
        vote: voteData.vote,
        commentText: voteData.comment_text,
        createdAt: voteData.created_at,
        updatedAt: voteData.updated_at,
      },
      updatedCounts,
    }, { headers });
  } catch (error: any) {
    console.error('[API] Error voting on final version:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to vote on final version',
      },
      { status: 500, headers }
    );
  }
}
