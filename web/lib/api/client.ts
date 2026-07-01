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

/**
 * Error type for non-2xx HTTP responses. Carries the status + the parsed
 * response body so callers that care about specific codes (e.g.
 * `409 PROFILE_INCOMPLETE`) can branch on `.body`. Existing call sites that
 * only read `.message` keep working — this extends Error.
 */
export class HttpError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(message: string, status: number, body: Record<string, unknown>) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

// A user should NEVER see a raw "HTTP 502" / "HTTP 500" / "Failed to fetch".
// Those happen on transient server or gateway problems (a deploy restart, an
// upstream blip) and network drops — none of which the user can act on, and
// none of which should leak a status code into the UI. We return a calm,
// localized fallback instead. 4xx are kept as-is because their messages are
// meaningful and actionable ("Email already registered", validation, etc.).
// Localized off <html lang> so it matches the active locale without needing
// React context here. status 0 = network/fetch failure.
function friendlyMessage(status: number): string {
  const isId = typeof document !== 'undefined' && document.documentElement.lang === 'id';
  if (status === 0) {
    return isId
      ? 'Koneksi bermasalah. Periksa internetmu lalu coba lagi.'
      : 'Connection problem. Please check your internet and try again.';
  }
  return isId
    ? 'Ada gangguan sementara di sisi kami. Mohon coba lagi sebentar lagi.'
    : 'Something went wrong on our end. Please try again in a moment.';
}

// Turn a non-ok Response into an HttpError. Preserves the parsed body (so
// callers can still branch on `.body.code`, e.g. PROFILE_INCOMPLETE) but keeps
// any raw status code out of the user-facing `.message` for 5xx / non-JSON.
async function errorFromResponse(res: Response): Promise<HttpError> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const backendMsg = typeof body.message === 'string' ? body.message : undefined;
  // 5xx (server + gateway) or a body with no usable message → friendly.
  // 4xx with a message → keep it (it's meant for the user).
  const message = res.status >= 500 || !backendMsg ? friendlyMessage(res.status) : backendMsg;
  return new HttpError(message, res.status, body);
}

async function httpReq<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  };

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
  } catch {
    // Network failure (offline, DNS, connection reset) — fetch rejects.
    throw new HttpError(friendlyMessage(0), 0, {});
  }

  if (!res.ok) throw await errorFromResponse(res);
  return res.json() as Promise<T>;
}

async function httpFormData<T>(path: string, formData: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData, credentials: 'include' });
  } catch {
    throw new HttpError(friendlyMessage(0), 0, {});
  }
  if (!res.ok) throw await errorFromResponse(res);
  return res.json() as Promise<T>;
}

function makeHttp() {
  return {
    get:          <T>(path: string)                     => httpReq<T>(path),
    post:         <T>(path: string, body: unknown)      => httpReq<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
    put:          <T>(path: string, body: unknown)      => httpReq<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
    patch:        <T>(path: string, body: unknown)      => httpReq<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
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
// Certificates — operator certificate management, served inside the
// question-bank workspace; admin + organizer; same cookie jar.
export const certificatesHttp = makeHttp();
// Country-representative portal — /api/rep/* + admin /api/country-representatives.
export const countryRepHttp = makeHttp();

// Used by callers that need the raw Response (e.g. CSV downloads).
export async function schoolFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${path}`, { ...init, credentials: 'include' });
}
