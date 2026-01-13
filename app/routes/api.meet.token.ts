import { type LoaderFunctionArgs, json } from '@remix-run/node';
import { AccessToken } from 'livekit-server-sdk';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const room = url.searchParams.get('room');
  const username = url.searchParams.get('username');

  if (!room || !username) {
    return json({ error: 'Missing room or username' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
  const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
  const livekitUrl = process.env.LIVEKIT_URL || 'ws://localhost:7880';

  const at = new AccessToken(apiKey, apiSecret, {
    identity: username,
    name: username,
  });

  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  return json({
    token,
    url: livekitUrl,
  });
}
