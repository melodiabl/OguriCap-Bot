import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isPublicPath = (pathname: string) => {
  if (pathname === '/login') return true;
  if (pathname === '/register') return true;
  if (pathname.startsWith('/maintenance')) return true;
  return false;
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const token = req.cookies.get('token')?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
