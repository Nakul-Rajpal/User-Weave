/**
 * API Route: Add Host Point to Summary
 * POST /api/meet/summary/add-point
 *
 * Allows hosts to add new points to an existing summary.
 * Points are added to the summary_points JSONB array.
 */

import { type ActionFunctionArgs, json } from '@remix-run/node';
import { createClient } from '@supabase/supabase-js';
import type { AddPointRequest, SummaryPoint } from '~/types/transcript';

// Initialize Supabase client (server-side)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { roomId, text, category } = await request.json() as AddPointRequest;

    // Validate input
    if (!roomId || !text || !category) {
      return json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    if (!['decision', 'action', 'discussion', 'question'].includes(category)) {
      return json({ success: false, message: 'Invalid category' }, { status: 400 });
    }

    console.log(`➕ Adding host point to room ${roomId}: ${text}`);

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

    // Verify user is host
    const { data: workflowData } = await supabase
      .from('workflow_states')
      .select('host_user_id')
      .eq('room_id', roomId)
      .single();

    if (!workflowData || workflowData.host_user_id !== userId) {
      return json({ success: false, message: 'Only the host can add points' }, { status: 403 });
    }

    // Fetch the most recent summary for this room
    const { data: summaryData, error: summaryError } = await supabase
      .from('transcript_summaries')
      .select('*')
      .eq('room_id', roomId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    // Create new point
    const newPointId = `host-point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newPoint: SummaryPoint = {
      id: newPointId,
      text: text.trim(),
      category,
      source: 'host',
      addedBy: userId,
      addedAt: new Date().toISOString(),
    };

    // If no summary exists, create a new one with this point
    if (summaryError) {
      if (summaryError.code === 'PGRST116') {
        console.log('📝 No summary found. Creating new manual summary...');

        const { data: newSummary, error: createError } = await supabase
          .from('transcript_summaries')
          .insert({
            room_id: roomId,
            summary_points: [newPoint],
            llm_model: null, // null indicates manually created
            generated_by_user_id: userId,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating summary:', createError);
          throw createError;
        }

        console.log(`✅ Manual summary created with first point: ${newPointId}`);

        return json({
          success: true,
          point: newPoint,
          summary: {
            id: newSummary.id,
            roomId: newSummary.room_id,
            summaryPoints: newSummary.summary_points,
            llmModel: newSummary.llm_model,
            generatedAt: newSummary.generated_at,
            generatedByUserId: newSummary.generated_by_user_id,
          },
        });
      }
      throw summaryError;
    }

    // Append new point to existing summary points
    const existingPoints = summaryData.summary_points || [];
    const updatedPoints = [...existingPoints, newPoint];

    // Update summary with new points array
    const { data: updatedSummary, error: updateError } = await supabase
      .from('transcript_summaries')
      .update({ summary_points: updatedPoints })
      .eq('id', summaryData.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating summary:', updateError);
      throw updateError;
    }

    console.log(`✅ Point added successfully: ${newPointId}`);

    return json({
      success: true,
      point: newPoint,
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
    console.error('Failed to add point:', error);
    return json(
      {
        success: false,
        message: error.message || 'Failed to add point',
      },
      { status: 500 }
    );
  }
}
