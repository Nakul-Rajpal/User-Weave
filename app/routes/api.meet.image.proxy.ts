import { type LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get('url');

  // Validate input
  if (!imageUrl || typeof imageUrl !== 'string') {
    return new Response('Missing image URL parameter', { status: 400 });
  }

  // Validate it's an OpenAI URL for security
  if (!imageUrl.startsWith('https://oaidalleapiprodscus.blob.core.windows.net/')) {
    return new Response('Invalid image URL', { status: 400 });
  }

  try {
    // Fetch the image from OpenAI
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      return new Response('Failed to fetch image', { status: 500 });
    }

    // Get the image data
    const imageBuffer = await imageResponse.arrayBuffer();

    // Return the image with proper headers to avoid CORS
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*', // Allow all origins
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error: any) {
    console.error('Image proxy error:', error);
    return new Response('Failed to proxy image', { status: 500 });
  }
}
