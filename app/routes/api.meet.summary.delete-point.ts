/**
 * API Route: Delete Summary Point
 * DELETE /api/meet/summary/delete-point
 *
 * Allows hosts to delete points from a summary.
 */

import { type ActionFunctionArgs, json } from '@remix-run/node';
import { createClient } from '@supabase/supabase-js';
import type { DeletePointRequest } from '~/types/transcript';

// Initialize Supabase client (server-side)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { summaryId, pointId } = await request.json() as DeletePointRequest;

    // Validate input
    if (!summaryId || !pointId) {
      return json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    console.log(`🗑️ Deleting point ${pointId} from summary ${summaryId}`);

    // Get the current user
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const {
        data: { user },
      } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id || null;
    }

    if (!userId) {
      return json({ success: false, message: 'User not authenticated' }, { status: 401 });
    }

    // Fetch the summary
    const { data: summaryData, error: summaryError } = await supabase
      .from('transcript_summaries')
      .select('*')
      .eq('id', summaryId)
      .single();

    if (summaryError) {
      if (summaryError.code === 'PGRST116') {
        return json({ success: false, message: 'Summary not found' }, { status: 404 });
      }
      throw summaryError;
    }

    // Verify user is admin
    const { data: adminData } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (!adminData) {
      return json({ success: false, message: 'Only admins can delete points' }, { status: 403 });
    }

    // Find the point to delete
    const existingPoints = summaryData.summary_points || [];
    const pointIndex = existingPoints.findIndex((p: any) => p.id === pointId);

    if (pointIndex === -1) {
      return json({ success: false, message: 'Point not found' }, { status: 404 });
    }

    // Remove the point from the array
    const updatedPoints = existingPoints.filter((p: any) => p.id !== pointId);

    // Update summary with modified points array
    const { data: updatedSummary, error: updateError } = await supabase
      .from('transcript_summaries')
      .update({ summary_points: updatedPoints })
      .eq('id', summaryId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating summary:', updateError);
      throw updateError;
    }

    console.log(`✅ Point deleted successfully: ${pointId}`);

    return json({
      success: true,
      deletedPointId: pointId,
      summary: {
        id: updatedSummary.id,
        roomId: updatedSummary.room_id,
        summaryPoints: updatedSummary.summary_points,
        llmModel: updatedSummary.llm_model,
        generatedAt: updatedSummary.generated_at,
        generatedByUserId: updatedSummary.generated_by_user_id,
      },
    });
  } catch (error: any) {
    console.error('Failed to delete point:', error);
    return json(
      {
        success: false,
        message: error.message || 'Failed to delete point',
      },
      { status: 500 }
    );
  }
}
