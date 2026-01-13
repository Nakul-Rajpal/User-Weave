import { type ActionFunctionArgs, json } from '@remix-run/node';
import OpenAI from 'openai';

export async function action({ request }: ActionFunctionArgs) {
  const { prompt, roomId, username } = await request.json();

  // Validate input
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return json(
      { error: 'Please provide a valid image description.' },
      { status: 400 }
    );
  }

  // Check prompt length (DALL-E has a limit)
  if (prompt.length > 4000) {
    return json(
      { error: 'Image description is too long. Please keep it under 4000 characters.' },
      { status: 400 }
    );
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    // Generate image using simple Images API with DALL-E 3
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt.trim(),
      size: '1024x1024',
      quality: 'standard',
      n: 1
    });

    if (!response.data || response.data.length === 0 || !response.data[0].url) {
      return json(
        { error: 'Failed to generate image. No image returned.' },
        { status: 500 }
      );
    }

    // Return OpenAI URL directly - will be proxied on client side to avoid CORS
    const imageUrl = response.data[0].url;

    return json({
      imageUrl,
      prompt: prompt.trim(),
      roomId,
      username
    });
  } catch (error: any) {
    console.error('Image generation API error:', error);

    // Handle specific error cases
    if (error.status === 400) {
      return json(
        { error: 'Invalid prompt. Please check your description and try again.' },
        { status: 400 }
      );
    }

    if (error.status === 401) {
      return json(
        { error: 'OpenAI API key is invalid or missing. Please check your configuration.' },
        { status: 500 }
      );
    }

    if (error.status === 429) {
      return json(
        { error: 'Rate limit exceeded. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    return json(
      { error: 'Failed to generate image. Please try again later.' },
      { status: 500 }
    );
  }
}
