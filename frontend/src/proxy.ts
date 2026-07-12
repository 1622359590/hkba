import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    'x-hkba-forwarded-host',
    request.headers.get('host') || request.nextUrl.host,
  );

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/api/:path*', '/uploads/:path*'],
};
