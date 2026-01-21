import { type LoaderFunctionArgs, json } from '@remix-run/node';

// Catch-all route for Chrome DevTools and other browser extension requests
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  // Handle Chrome DevTools specific paths
  if (url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
    return json({
      name: 'Bolt.diy',
      version: '1.0.0',
      description: 'AI-powered development environment',
      homepage: 'https://bolt.diy',
      repository: 'https://github.com/stackblitz-labs/bolt.diy'
    });
  }

  // For any other unmatched routes, return a 404
  return json({ error: 'Not Found' }, { status: 404 });
}
