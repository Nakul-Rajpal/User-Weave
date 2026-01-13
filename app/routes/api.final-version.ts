import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/node';
import {
  setFinalVersion,
  getCurrentUserFinalVersion,
  unsetFinalVersion,
} from '~/lib/persistence/supabase';

/**
 * GET /api/final-version
 * Get the current user's final version
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const finalVersion = await getCurrentUserFinalVersion();

    return json({
      success: true,
      data: finalVersion,
    });
  } catch (error: any) {
    console.error('[API] Error getting final version:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to get final version',
      },
      { status: error.message?.includes('not authenticated') ? 401 : 500 }
    );
  }
}

/**
 * POST /api/final-version
 * Set user's final version
 *
 * Body: { snapshotId: string, chatId: string, notes?: string }
 */
export async function action({ request }: ActionFunctionArgs) {
  const method = request.method;

  try {
    if (method === 'POST') {
      const body = await request.json();
      const { snapshotId, chatId, notes } = body;

      if (!snapshotId || !chatId) {
        return json(
          {
            success: false,
            error: 'Missing required fields: snapshotId and chatId',
          },
          { status: 400 }
        );
      }

      await setFinalVersion(snapshotId, chatId, notes);

      return json({
        success: true,
        message: 'Final version set successfully',
      });
    }

    if (method === 'DELETE') {
      await unsetFinalVersion();

      return json({
        success: true,
        message: 'Final version removed successfully',
      });
    }

    return json(
      {
        success: false,
        error: `Method ${method} not allowed`,
      },
      { status: 405 }
    );
  } catch (error: any) {
    console.error('[API] Error in final version action:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to process request',
      },
      { status: error.message?.includes('not authenticated') ? 401 : 500 }
    );
  }
}
