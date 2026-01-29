/**
 * API Endpoint: Get Final Version Discussions
 * GET /api/meet/final-version-discussions/:versionId/:roomId
 *
 * Fetches all threaded discussions for a specific final version
 * Returns hierarchical discussion tree with user information
 */

import { type LoaderFunctionArgs, json } from '@remix-run/node';
import { createClient } from '@supabase/supabase-js';
import type { FinalVersionDiscussionWithUser, DiscussionThread } from '~/types/final-versions';
import { getServerEnv } from '~/lib/.server/env.server';

/**
 * Get Supabase client with service role key
 * Uses server-only environment variable utility
 */
function getSupabaseServiceClient() {
  console.log('[DISCUSSIONS API] 🔧 Getting Supabase client...');
  const env = getServerEnv();

  const envCheck = {
    timestamp: new Date().toISOString(),
    hasUrl: !!env.SUPABASE_URL,
    urlPreview: env.SUPABASE_URL ? env.SUPABASE_URL.substring(0, 30) + '...' : 'MISSING',
    hasAnonKey: !!env.SUPABASE_ANON_KEY,
    anonKeyLength: env.SUPABASE_ANON_KEY?.length || 0,
    hasServiceKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
    serviceKeyLength: env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    serviceKeyPreview: env.SUPABASE_SERVICE_ROLE_KEY ? env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...' : 'MISSING',
    usingFallback: !env.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log('[DISCUSSIONS API] 🔐 Environment check:', JSON.stringify(envCheck, null, 2));

  // Use service role key if available, otherwise fall back to anon key
  const apiKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

  console.log('[DISCUSSIONS API] ✅ Supabase client created with', envCheck.usingFallback ? 'ANON key (fallback)' : 'SERVICE ROLE key');

  return createClient(env.SUPABASE_URL, apiKey);
}

/**
 * Builds a hierarchical discussion tree from flat messages
 */
function buildDiscussionTree(discussions: FinalVersionDiscussionWithUser[]): DiscussionThread[] {
  const discussionMap = new Map<string, DiscussionThread>();
  const rootDiscussions: DiscussionThread[] = [];

  // First pass: Create thread objects for each discussion
  discussions.forEach((discussion) => {
    discussionMap.set(discussion.id, {
      ...discussion,
      replies: [],
      replyCount: 0,
    });
  });

  // Second pass: Build parent-child relationships
  discussions.forEach((discussion) => {
    const thread = discussionMap.get(discussion.id)!;

    if (discussion.parent_id) {
      // This is a reply - add to parent's replies
      const parent = discussionMap.get(discussion.parent_id);
      if (parent) {
        parent.replies.push(thread);
        parent.replyCount++;
      } else {
        // Parent not found (shouldn't happen with proper FK), treat as root
        rootDiscussions.push(thread);
      }
    } else {
      // This is a root-level discussion
      rootDiscussions.push(thread);
    }
  });

  // Sort root discussions by creation date (newest first)
  rootDiscussions.sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Recursively sort replies by creation date (oldest first for conversation flow)
  function sortReplies(thread: DiscussionThread) {
    thread.replies.sort((a, b) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    thread.replies.forEach(sortReplies);
  }

  rootDiscussions.forEach(sortReplies);

  return rootDiscussions;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`[DISCUSSIONS API] 🚀 ========== NEW REQUEST ${requestId} ==========`);

  try {
    // Get Supabase client with service role key
    console.log(`[DISCUSSIONS API] [${requestId}] Step 1: Creating Supabase client...`);
    const supabase = getSupabaseServiceClient();
    console.log(`[DISCUSSIONS API] [${requestId}] ✅ Supabase client created`);

    // Get params
    console.log(`[DISCUSSIONS API] [${requestId}] Step 2: Parsing params...`);
    const { versionId, roomId } = params;
    console.log(`[DISCUSSIONS API] [${requestId}] 📋 Params received:`, {
      versionId: versionId || 'UNDEFINED',
      versionIdType: typeof versionId,
      versionIdLength: versionId?.length || 0,
      roomId: roomId || 'UNDEFINED',
      roomIdType: typeof roomId,
      roomIdLength: roomId?.length || 0,
      allParams: params,
    });

    if (!versionId || !roomId) {
      console.error(`[DISCUSSIONS API] [${requestId}] ❌ Missing required params`);
      return json(
        {
          success: false,
          error: 'Version ID and Room ID are required',
          debug: { versionId, roomId, requestId }
        },
        { status: 400 }
      );
    }

    console.log(`[DISCUSSIONS API] [${requestId}] ✅ Params validated`);

    // Fetch discussions from table + join users (avoids view permission issues)
    console.log(`[DISCUSSIONS API] [${requestId}] Step 3: Querying discussions with user join...`);

    const { data: rawRows, error } = await supabase
      .from('final_version_discussions')
      .select(`
        *,
        users (
          email
        )
      `)
      .eq('final_version_id', versionId)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    // Map to FinalVersionDiscussionWithUser shape (same as view; Supabase returns nested relation as array)
    const discussions: FinalVersionDiscussionWithUser[] = (rawRows || []).map((row: any) => {
      const userRow = Array.isArray(row.users) ? row.users[0] : row.users;
      const email = userRow?.email ?? null;
      const user_name = email ? email.split('@')[0] : 'Unknown';
      return {
        id: row.id,
        final_version_id: row.final_version_id,
        room_id: row.room_id,
        user_id: row.user_id,
        parent_id: row.parent_id,
        message_text: row.message_text,
        is_edited: row.is_edited,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user_email: email,
        user_name,
        user_avatar: null,
      };
    });

    console.log(`[DISCUSSIONS API] [${requestId}] 📊 Discussions query result:`, {
      hasData: !!discussions,
      discussionsCount: discussions?.length || 0,
      hasError: !!error,
      error: error,
      errorCode: error?.code,
      errorMessage: error?.message,
      errorDetails: error?.details,
    });

    if (error) {
      console.error(`[DISCUSSIONS API] [${requestId}] ❌ Error fetching discussions:`, JSON.stringify(error, null, 2));
      throw new Error(`Failed to fetch discussions: ${error.message}`);
    }

    console.log(`[DISCUSSIONS API] [${requestId}] ✅ Found ${discussions?.length || 0} discussions`);

    if (discussions && discussions.length > 0) {
      console.log(`[DISCUSSIONS API] [${requestId}] 📝 Sample discussion:`, {
        id: discussions[0].id,
        message_text: discussions[0].message_text?.substring(0, 50) + '...',
        user_email: discussions[0].user_email,
        created_at: discussions[0].created_at,
      });
    }

    // Build hierarchical tree structure
    console.log(`[DISCUSSIONS API] [${requestId}] Step 4: Building discussion tree...`);
    const discussionTree = discussions ? buildDiscussionTree(discussions) : [];
    console.log(`[DISCUSSIONS API] [${requestId}] ✅ Built discussion tree with ${discussionTree.length} root threads`);

    // Calculate total count (including all nested replies)
    const totalCount = discussions?.length || 0;

    console.log(`[DISCUSSIONS API] [${requestId}] Step 5: Returning response...`);
    const response = {
      success: true,
      discussions: discussionTree,
      totalCount,
      versionId,
      roomId,
      debug: {
        requestId,
        timestamp: new Date().toISOString(),
      }
    };

    console.log(`[DISCUSSIONS API] [${requestId}] ✅ Response prepared:`, {
      success: response.success,
      discussionCount: response.discussions.length,
      totalCount: response.totalCount,
    });

    console.log(`[DISCUSSIONS API] [${requestId}] 🏁 ========== REQUEST COMPLETE ==========`);

    return json(response);
  } catch (error: any) {
    console.error(`[DISCUSSIONS API] ❌ UNCAUGHT ERROR:`, {
      message: error.message,
      stack: error.stack,
      error: error,
    });
    return json(
      {
        success: false,
        error: error.message || 'Failed to fetch discussions',
        debug: {
          timestamp: new Date().toISOString(),
          errorType: error.constructor.name,
          stack: error.stack,
        }
      },
      { status: 500 }
    );
  }
}
