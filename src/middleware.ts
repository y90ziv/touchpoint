import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, isAuthDisabled } from '@/lib/session';

const PUBLIC_PREFIXES = [
  '/_next',
  '/favicon.ico',
  '/api/auth/',
  '/api/setup',
  '/api/calendar/',
  '/api/health',
];

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isCrossSiteRequest(request: NextRequest): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return true;
  }

  const origin = request.headers.get('origin');
  if (!origin) {
    return false;
  }

  const expectedHost =
    request.headers.get('x-forwarded-host')?.split(',')[0].trim() ||
    request.headers.get('host') ||
    request.nextUrl.host;

  try {
    const originHost = new URL(origin).host;
    return originHost !== expectedHost;
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const requestId =
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id') ||
    crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const applyResponseHeaders = (res: NextResponse) => {
    res.headers.set('x-request-id', requestId);
    return res;
  };

  // If user has disabled authentication via environment flag, allow all traffic
  if (isAuthDisabled()) {
    return applyResponseHeaders(
      NextResponse.next({
        request: { headers: requestHeaders },
      })
    );
  }

  const { pathname } = request.nextUrl;

  // Lightweight CSRF protection for mutating browser API requests using cookie auth
  if (
    pathname.startsWith('/api/') &&
    MUTATING_METHODS.has(request.method.toUpperCase()) &&
    !request.headers.get('authorization')?.startsWith('Bearer ') &&
    isCrossSiteRequest(request)
  ) {
    return applyResponseHeaders(
      NextResponse.json({ error: 'Forbidden: Cross-site request blocked', requestId }, { status: 403 })
    );
  }

  // Allow static assets, public auth endpoints, and tokenized calendar feed
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return applyResponseHeaders(
      NextResponse.next({
        request: { headers: requestHeaders },
      })
    );
  }

  // Check session cookie
  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session = await verifySessionToken(cookieToken);

  // Check Authorization Bearer header if cookie is missing
  if (!session) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      session = await verifySessionToken(authHeader.slice(7).trim());
    }
  }

  // Reject unauthenticated API requests
  if (pathname.startsWith('/api/')) {
    if (!session) {
      return applyResponseHeaders(
        NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 })
      );
    }

    // Attach user id header for downstream route handlers
    requestHeaders.set('x-user-id', String(session.userId));
    return applyResponseHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    );
  }

  return applyResponseHeaders(
    NextResponse.next({
      request: { headers: requestHeaders },
    })
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
