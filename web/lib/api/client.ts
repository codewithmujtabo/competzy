// lib/api/client.ts
//
// Web HTTP client. Auth is via httpOnly cookie (set by backend on login),
// not localStorage. Every request includes credentials so the browser
// attaches the cookie automatically.
//
// Three named exports (adminHttp, organizerHttp, schoolHttp) exist for
// historical reasons — they all hit the same backend with the same
// session cookie. The named-ness lets each portal's components stay
// decoupled if they ever need different transport behaviour later.

const BASE = '/api';

async function httpReq<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function httpFormData<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function makeHttp() {
  return {
    get:          <T>(path: string)                     => httpReq<T>(path),
    post:         <T>(path: string, body: unknown)      => httpReq<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
    put:          <T>(path: string, body: unknown)      => httpReq<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
    delete:       <T>(path: string)                     => httpReq<T>(path, { method: 'DELETE' }),
    postFormData: <T>(path: string, formData: FormData) => httpFormData<T>(path, formData),
  };
}

export const adminHttp     = makeHttp();
export const organizerHttp = makeHttp();
export const schoolHttp    = makeHttp();
// Per-competition portals (e.g. /emc/login) — same cookie jar; the namespacing
// keeps the new EMC code path decoupled if it ever needs different transport behaviour.
export const emcHttp       = makeHttp();
// Question-bank workspace (admin + organizer) — same cookie jar.
export const questionBankHttp = makeHttp();
// Commerce — products / vouchers / orders, served inside the question-bank
// workspace; admin + organizer; same cookie jar.
export const commerceHttp = makeHttp();
// Marketing — referrals / announcements / materials / suggestions, served
// inside the question-bank workspace; admin + organizer; same cookie jar.
export const marketingHttp = makeHttp();

// Used by callers that need the raw Response (e.g. CSV downloads).
export async function schoolFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${path}`, { ...init, credentials: 'include' });
}
