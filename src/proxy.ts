import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'better-auth.session_token';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/admin');

  if (!isProtected) return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE);

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/checkout/:path*', '/admin/:path*'],
};
