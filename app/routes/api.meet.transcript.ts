import { type ActionFunctionArgs, json } from '@remix-run/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (server-side)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { roomName, transcript } = await request.json();

    console.log(`Saving transcript for room: ${roomName} (${transcript.length} entries)`);

    // Get the current user from the Authorization header or session
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const {
        data: { user },
      } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id || null;
    }

    // Save transcript to Supabase
    const { data, error } = await supabase.from('meeting_transcripts').insert({
      room_id: roomName,
      transcript_data: transcript,
      created_by_user_id: userId,
    }).select().single();

    if (error) {
      console.error('Error saving transcript:', error);
      throw error;
    }

    console.log(`✅ Transcript saved successfully with ID: ${data.id}`);

    return json({
      success: true,
      message: 'Transcript saved to database',
      transcriptId: data.id,
    });
  } catch (error: any) {
    console.error('Failed to save transcript:', error);
    return json(
      {
        success: false,
        message: error.message || 'Failed to save transcript',
      },
      { status: 500 }
    );
  }
}
