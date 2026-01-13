import { parseCookies } from '~/lib/api/cookies';

/**
 * Cookie utilities for Supabase SSR
 * These helpers integrate Supabase's cookie-based auth with Remix's Request/Response objects
 */

export interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Get a cookie value from Remix Request
 */
export function getCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);
  return cookies[name];
}

/**
 * Set a cookie in Remix Response headers
 * Returns a Set-Cookie header value
 */
export function setCookieHeader(name: string, value: string, options: CookieOptions = {}): string {
  const {
    maxAge,
    expires,
    path = '/',
    domain,
    secure = true,
    httpOnly = true,
    sameSite = 'lax',
  } = options;

  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (maxAge !== undefined) {
    cookie += `; Max-Age=${maxAge}`;
  }

  if (expires) {
    cookie += `; Expires=${expires.toUTCString()}`;
  }

  cookie += `; Path=${path}`;

  if (domain) {
    cookie += `; Domain=${domain}`;
  }

  if (secure) {
    cookie += '; Secure';
  }

  if (httpOnly) {
    cookie += '; HttpOnly';
  }

  if (sameSite) {
    cookie += `; SameSite=${sameSite.charAt(0).toUpperCase() + sameSite.slice(1)}`;
  }

  return cookie;
}

/**
 * Remove a cookie by setting it to expire immediately
 */
export function removeCookieHeader(name: string, options: CookieOptions = {}): string {
  return setCookieHeader(name, '', {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Helper to create cookie methods for Supabase SSR client
 * This accumulates Set-Cookie headers in an array that can be added to the response
 */
export function createCookieHandler(request: Request) {
  const cookieHeaders: string[] = [];

  return {
    get: (name: string) => getCookie(request, name),
    set: (name: string, value: string, options: CookieOptions) => {
      cookieHeaders.push(setCookieHeader(name, value, options));
    },
    remove: (name: string, options: CookieOptions) => {
      cookieHeaders.push(removeCookieHeader(name, options));
    },
    getSetCookieHeaders: () => cookieHeaders,
  };
}
