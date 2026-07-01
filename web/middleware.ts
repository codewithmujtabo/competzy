import { NextResponse, type NextRequest } from 'next/server';
import { getMaintenance } from '@/lib/maintenance';
import { BYPASS_COOKIE_NAME, verifyBypass } from '@/lib/admin-bypass';

/**
 * Arena maintenance gate. Polls /api/maintenance/state?host=<host> (cached
 * 30s per host) and rewrites non-admin traffic to /maintenance when the
 * site is in mode='on'. read-only is a softer signal — pages still render
 * and the page-level UI shows banners — so middleware just passes through.
 *
 * Anti-lockout: a small ALWAYS_OPEN list keeps auth surfaces reachable
 * even in mode='on'. The bypass cookie is issued by the backend on admin
 * login, so the admin must be able to reach the login page in the first
 * place to get out of a maintenance lock. The standard route-group
 * /(dashboard)/* layouts still cookie-gate themselves; this exception
 * doesn't widen anything beyond what was already accessible pre-login.
 *
 * Fail-open: getMaintenance() returns 'off' on any network/timeout/bad-JSON
 * scenario. A backend outage cannot lock the portal out through this path.
 *
 * Naming note: Next.js 16 deprecates `middleware.ts` in favour of
 * `proxy.ts`. Both still work — keeping the older convention here to
 * match how competzy-web's file is named (rename together later).
 */

// Auth surfaces that must stay reachable to escape a maintenance lock.
const ALWAYS_OPEN = new Set<string>(['/', '/forgot-password', '/reset-password']);

// Security headers on every page response. Applied here (not only in
// next.config headers()) because responses served from the prerender cache
// were observed shipping without the config-level headers in production —
// middleware runs on every matched request, so this set always lands.
// camera=(self): the exam runner's webcam proctoring needs it.
function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  return res;
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Login + password reset must never be hidden, otherwise an admin who
  // doesn't already have a fresh bypass cookie can't sign in to flip the
  // toggle off.
  if (ALWAYS_OPEN.has(url.pathname)) return withSecurityHeaders(NextResponse.next());

  // Maintenance page itself must always render — both for the
  // unauthenticated takeover view AND for direct testing.
  if (url.pathname === '/maintenance') return withSecurityHeaders(NextResponse.next());

  // Host header determines which site_maintenance row applies. nginx
  // forwards the public Host as-is. Strip the port if present.
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const { mode } = await getMaintenance(host);

  // 'off' = pass through. 'read-only' = pass through (page-level UI may
  // surface a banner — that's outside middleware scope). Only 'on'
  // triggers the takeover.
  if (mode !== 'on') return withSecurityHeaders(NextResponse.next());

  // Bypass cookie issued by backend on admin/superadmin login. Domain=
  // .competzy.com, so it's visible to arena.competzy.com.
  const bypassed = await verifyBypass(req.cookies.get(BYPASS_COOKIE_NAME)?.value);
  if (bypassed) return withSecurityHeaders(NextResponse.next());

  const u = url.clone();
  u.pathname = '/maintenance';
  u.search = '';
  return withSecurityHeaders(NextResponse.rewrite(u));
}

export const config = {
  matcher: [
    // Skip all of these:
    //   - /api/*                  backend proxy (login lives here)
    //   - /_next/*                framework internals + static assets
    //   - /uploads, /uploads-signed proxied file routes
    //   - /maintenance            handled above (defensive — also in function)
    //   - anything with a dot     favicon.ico, .png, .css, etc.
    '/((?!api|_next|uploads|uploads-signed|maintenance|.*\\..*).*)',
  ],
};
