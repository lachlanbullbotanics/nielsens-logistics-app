import { withAuth } from 'next-auth/middleware';
import { NextResponse, NextRequest } from 'next/server';

// ─── Rate limiting for auth endpoints (in-memory, simple) ──
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); // 15-min window
    return true;
  }

  entry.count++;
  return entry.count <= 10; // Max 10 login attempts per 15 min
}

// Clean up every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of loginAttempts) {
      if (now > entry.resetAt) loginAttempts.delete(key);
    }
  }, 10 * 60 * 1000);
}

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    // ─── CSRF: Origin check on state-changing requests ──
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.headers.get('origin');
      const host = req.headers.get('host');
      if (origin) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            return NextResponse.json({ ok: false, error: 'CSRF validation failed' }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ ok: false, error: 'Invalid origin' }, { status: 403 });
        }
      }
    }

    // Role-gate: admin routes
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    // Role-gate: driver routes
    if (pathname.startsWith('/driver') && role !== 'DRIVER' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    // Role-gate: customer routes
    if (pathname.startsWith('/customer') && role !== 'CUSTOMER' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Rate limit login attempts (NextAuth credential POST)
        if (pathname.startsWith('/api/auth/callback/credentials') && req.method === 'POST') {
          const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
          if (!checkLoginRateLimit(ip)) {
            return false; // Redirects to login with error
          }
        }

        // Public API routes that don't need auth
        if (pathname.startsWith('/api/inbound-email')) return true;

        // All other matched routes require auth
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/admin/:path*',
    '/driver/:path*',
    '/customer/:path*',
    '/api/auth/callback/:path*',
    '/api/runs/:path*',
    '/api/stops/:path*',
    '/api/bookings/:path*',
    '/api/fuel/:path*',
    '/api/trolleys/:path*',
    '/api/profitability/:path*',
    '/api/invoices/:path*',
    '/api/ml/:path*',
    '/api/seed/:path*',
    '/api/confirmations/:path*',
    '/api/upload/:path*',
  ],
};
