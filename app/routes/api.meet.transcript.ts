import { type ActionFunctionArgs } from '@remix-run/node';
import { createClient } from '@supabase/supabase-js';
import { getServerEnv } from '~/lib/.server/env.server';

export async function action({ request }: ActionFunctionArgs) {
  console.log('[TRANSCRIPT API] Route hit');
  const env = getServerEnv();
  console.log('[TRANSCRIPT API] Env check:', {
    hasServiceKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
    serviceKeyLength: env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    hasAnonKey: !!env.SUPABASE_ANON_KEY,
    anonKeyLength: env.SUPABASE_ANON_KEY?.length || 0,
  });
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  console.log('[TRANSCRIPT API] Using key type:', env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey
    });
    return new Response(
      JSON.stringify({ success: false, message: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { roomName, transcript } = await request.json();

    console.log(`Saving transcript for room: ${roomName} (${transcript.length} entries)`);

    // Get the current user from the Authorization header or session
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

        if (authError) {
          console.warn('Auth error getting user:', authError.message);
        } else {
          userId = user?.id || null;
        }
      } catch (authErr) {
        console.warn('Failed to get user from token:', authErr);
      }
    }

    console.log(`User ID for transcript: ${userId || 'anonymous'}`);

    // Save transcript to Supabase - userId can be null if auth fails
    const insertData: any = {
      room_id: roomName,
      transcript_data: transcript,
    };

    // Only include user_id if we have a valid one
    if (userId) {
      insertData.created_by_user_id = userId;
    }

    const { data, error } = await supabase
      .from('meeting_transcripts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error saving transcript:', error);
      throw error;
    }

    console.log(`✅ Transcript saved successfully with ID: ${data.id}`);

    // Auto-generate design implications (10 points based on transcript)
    console.log(`🤖 Auto-generating design implications for room: ${roomName}`);
    try {
      // Import and call summarize logic
      const { generateDesignImplications } = await import('./api.meet.summarize');
      const cookieHeader = request.headers.get('Cookie');
      await generateDesignImplications(roomName, authHeader, cookieHeader, undefined);
      console.log(`✅ Design implications auto-generated for room: ${roomName}`);
    } catch (summaryError: any) {
      // Log but don't fail the transcript save if summary generation fails
      console.error('Failed to auto-generate design implications:', summaryError.message);
      console.error('Design implications can be generated manually later.');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transcript saved to database',
        transcriptId: data.id,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Failed to save transcript:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Failed to save transcript',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
