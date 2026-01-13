/**
 * API Endpoint: Get Final Version Votes for Room
 * GET /api/meet/final-version-votes/:roomId?userId=xxx
 *
 * Fetches all votes for final versions in a specific room
 * Returns aggregated vote counts and current user's votes
 * Uses service role to support anonymous meeting users
 */

import { type LoaderFunctionArgs, json } from '@remix-run/node';
import { createClient } from '@supabase/supabase-js';
import type { VoteData } from '~/types/final-versions';
import { getServerEnv } from '~/lib/.server/env.server';

/**
 * Get Supabase client with service role key
 * Uses server-only environment variable utility
 */
function getSupabaseServiceClient() {
  const env = getServerEnv();

  console.log('[VOTES API] Environment check:', {
    hasUrl: !!env.SUPABASE_URL,
    hasServiceKey: !!env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY.length > 100,
    serviceKeyLength: env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    usingFallback: !env.SUPABASE_SERVICE_ROLE_KEY,
  });

  // Use service role key if available, otherwise fall back to anon key
  const apiKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

  return createClient(env.SUPABASE_URL, apiKey);
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    // Get Supabase client with service role key
    const supabase = getSupabaseServiceClient();

    // Get roomId from params
    const { roomId } = params;
    if (!roomId) {
      return json(
        { success: false, error: 'Room ID is required' },
        { status: 400 }
      );
    }

    // Get userId from query params (passed from client)
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    console.log('[API] Fetching votes for room:', roomId, 'userId:', userId);

    // Get all votes for this room
    const { data: votes, error } = await supabase
      .from('final_version_votes')
      .select('*')
      .eq('room_id', roomId);

    if (error) {
      console.error('[API] Error fetching votes:', error);
      throw new Error(`Failed to fetch votes: ${error.message}`);
    }

    console.log('[API] Found votes:', votes?.length || 0);

    // Aggregate votes by final_version_id
    const votesByVersion: Record<string, VoteData> = {};

    votes?.forEach((vote) => {
      const versionId = vote.final_version_id;

      // Initialize if not exists
      if (!votesByVersion[versionId]) {
        votesByVersion[versionId] = {
          like: 0,
          dislike: 0,
        };
      }

      // Count votes
      if (vote.vote === 'like') {
        votesByVersion[versionId].like++;
      } else if (vote.vote === 'dislike') {
        votesByVersion[versionId].dislike++;
      }

      // Track current user's vote (if userId provided)
      if (userId && vote.user_id === userId) {
        votesByVersion[versionId].userVote = {
          vote: vote.vote,
          comment: vote.comment_text,
          createdAt: vote.created_at,
        };
      }
    });

    console.log('[API] Aggregated votes for versions:', Object.keys(votesByVersion).length);

    return json({
      success: true,
      votes: votesByVersion,
      roomId,
    });
  } catch (error: any) {
    console.error('[API] Error in get final version votes:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to fetch votes',
      },
      { status: 500 }
    );
  }
}
