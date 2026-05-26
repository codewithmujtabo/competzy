/**
 * Verifies an HMAC-signed bypass cookie issued by arena's own backend on
 * admin/superadmin login. Mirrors competzy-web/lib/admin-bypass.ts so both
 * repos use the same secret + payload format. Cookie format:
 *
 *   competzy_bypass = <base64url(payload)>.<base64url(hmac_sha256(payload, secret))>
 *
 * payload = JSON.stringify({ role: 'admin' | 'superadmin', exp: <unix_seconds> })
 *
 * The same BYPASS_COOKIE_SECRET env var must be set on this web container
 * AND on the backend container (where the cookie is issued). If the
 * cookie is missing, malformed, expired, signature mismatches, or the
 * secret env var is unset, this returns false (no bypass — visitor sees
 * the maintenance page like everyone else).
 *
 * Edge-runtime safe — uses Web Crypto API (crypto.subtle), not Node's
 * crypto module. Middleware runs on the edge by default.
 */
export const BYPASS_COOKIE_NAME = 'competzy_bypass';

export async function verifyBypass(cookieValue: string | undefined | null): Promise<boolean> {
  if (!cookieValue) return false;
  const secret = process.env.BYPASS_COOKIE_SECRET;
  if (!secret) return false;

  try {
    const [payloadB64, sigB64] = cookieValue.split('.');
    if (!payloadB64 || !sigB64) return false;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signed = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
    const expectedSig = base64UrlEncode(signed);
    if (!timingSafeEqual(expectedSig, sigB64)) return false;

    const payloadJson = base64UrlDecode(payloadB64);
    const payload = JSON.parse(payloadJson) as { role?: unknown; exp?: unknown };
    if (typeof payload.exp !== 'number') return false;
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;
    if (payload.role !== 'admin' && payload.role !== 'superadmin') return false;
    return true;
  } catch {
    return false;
  }
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return atob(padded);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
