import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PROTECTED_ROUTES = [
  '/admin',
  '/dashboard',
  '/judge',
  '/api/dashboard',
  '/api/judge',
  '/profile',
  '/cases',
  '/api/cases',
  '/api/case-requests',
  '/api/profile',
  '/api/users',
  '/api/admin',
  '/api/audit-logs',
  '/api/chats',
];

const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/api/auth/',
];

const MAX_JSON_BODY_SIZE = 1 * 1024 * 1024;

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}


function verifyCsrf(req: NextRequest): boolean {
  const headerToken = req.headers.get('x-csrf-token');
  const cookieToken = req.cookies.get('csrf-token')?.value;

  if (!headerToken || !cookieToken) return false;

  return headerToken === cookieToken;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.png')
  ) {
    return NextResponse.next();
  }

  const method = req.method.toUpperCase();
  if (
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/csrf-token')
  ) {
    if (!verifyCsrf(req)) {
      return NextResponse.json(
        { error: 'CSRF token missing or invalid.' },
        { status: 403 }
      );
    }
  }

  const contentType = req.headers.get('content-type') || '';

  if (
    pathname.startsWith('/api/') &&
    !pathname.includes('/register') &&
    !pathname.startsWith('/api/cases') &&
    !contentType.toLowerCase().startsWith('multipart/form-data') &&
    ['POST', 'PUT', 'PATCH'].includes(method)
  ) {
    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_JSON_BODY_SIZE) {
      return NextResponse.json(
        { error: 'Request body too large.' },
        { status: 413 }
      );
    }
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get('token')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', (payload.userId as string) || '');
    requestHeaders.set('x-user-email', (payload.email as string) || '');
    requestHeaders.set('x-user-role', (payload.role as string) || '');

    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin') || pathname.startsWith('/api/audit-logs')) {
      if (payload.role !== 'admin') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Access denied.' },
            { status: 403 }
          );
        }

        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    return response;
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Invalid or expired token.' },
        { status: 401 }
      );
    }

    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.set('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
