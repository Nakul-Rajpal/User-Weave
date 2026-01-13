import { type LoaderFunctionArgs, json } from '@remix-run/node';
import { getFinalVersionDetails } from '~/lib/persistence/supabase';

/**
 * GET /api/final-versions/:id
 * Get detailed information about a specific final version
 *
 * Used for viewing a specific user's final version in detail
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { id } = params;

  if (!id) {
    return json(
      {
        success: false,
        error: 'Final version ID is required',
      },
      { status: 400 }
    );
  }

  try {
    const finalVersion = await getFinalVersionDetails(id);

    if (!finalVersion) {
      return json(
        {
          success: false,
          error: 'Final version not found',
        },
        { status: 404 }
      );
    }

    return json({
      success: true,
      data: finalVersion,
    });
  } catch (error: any) {
    console.error('[API] Error getting final version details:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to get final version details',
      },
      { status: error.message?.includes('not authenticated') ? 401 : 500 }
    );
  }
}
