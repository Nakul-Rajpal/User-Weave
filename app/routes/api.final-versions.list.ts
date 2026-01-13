import { type LoaderFunctionArgs, json } from '@remix-run/node';
import { getAllFinalVersions } from '~/lib/persistence/supabase';

/**
 * GET /api/final-versions/list
 * Get all users' final versions (for the merge page)
 *
 * This endpoint returns all final versions from all users
 * Used for the collaborative merge/review page
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const finalVersions = await getAllFinalVersions();

    return json({
      success: true,
      data: finalVersions,
      count: finalVersions.length,
    });
  } catch (error: any) {
    console.error('[API] Error getting all final versions:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to get final versions',
      },
      { status: error.message?.includes('not authenticated') ? 401 : 500 }
    );
  }
}
