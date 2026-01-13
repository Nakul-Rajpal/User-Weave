/**
 * API Route: Get Summary (Read-Only)
 * GET /api/meet/summary/:roomId
 *
 * Fetches the most recent summary for a room.
 * Note: Voting functionality has been removed from polling.
 * Requires authenticated users
 */

import { type LoaderFunctionArgs, json } from '@remix-run/node';
import { createSupabaseServerClient } from '~/lib/supabase/client.server';
import { getCurrentUser } from '~/lib/supabase/auth.server';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);

  // Require authentication
  const user = await getCurrentUser(supabase);
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roomId } = params;

    if (!roomId) {
      return json({ success: false, message: 'Room ID is required' }, { status: 400, headers });
    }

    console.log(`📊 Fetching summary for room: ${roomId}`);

    // Fetch the most recent summary for this room
    const { data: summaryData, error: summaryError } = await supabase
      .from('transcript_summaries')
      .select('*')
      .eq('room_id', roomId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (summaryError) {
      if (summaryError.code === 'PGRST116') {
        // No summary found
        return json({
          success: true,
          summary: null,
          message: 'No summary found for this room',
        }, { headers });
      }
      throw summaryError;
    }

    console.log(`✅ Found summary: ${summaryData.id}`);

    // Return summary points as-is (no vote data)
    const summaryPoints = summaryData.summary_points;

    const summary = {
      id: summaryData.id,
      roomId: summaryData.room_id,
      points: summaryPoints,
      llmModel: summaryData.llm_model,
      generatedAt: summaryData.generated_at,
      generatedByUserId: summaryData.generated_by_user_id,
    };

    return json({
      success: true,
      summary,
    }, { headers });
  } catch (error: any) {
    console.error('Failed to fetch summary:', error);
    return json(
      {
        success: false,
        message: error.message || 'Failed to fetch summary',
      },
      { status: 500, headers }
    );
  }
}
