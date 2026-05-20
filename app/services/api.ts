import { API_BASE_URL } from "../config/api";
import { getToken } from "./token.service";

/**
 * Absolutize a server file URL. Signed file URLs come back relative
 * (`/uploads-signed/<token>`) and are served from the backend ORIGIN — not the
 * `/api` base — so `WebBrowser.openBrowserAsync` / `<Image>` (which need an
 * absolute `http(s)://` URL) reject them. Already-absolute URLs pass through.
 */
export function resolveFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const origin = (API_BASE_URL ?? "").replace(/\/api\/?$/, "");
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

interface RequestOptions {
  method?: string;
  body?: any;
  auth?: boolean;
}

/**
 * Error type for non-2xx HTTP responses. Carries the status + the parsed
 * response body so callers that care about specific codes (e.g.
 * `409 PROFILE_INCOMPLETE`) can branch on `.body`. Existing call sites that
 * only read `.message` keep working — this extends Error.
 */
export class HttpError extends Error {
  status: number;
  body: Record<string, any>;
  constructor(message: string, status: number, body: Record<string, any>) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  // Add timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data?.message || `Request failed: ${res.status}`;
      throw new HttpError(message, res.status, data ?? {});
    }

    return data as T;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }

    throw error;
  }
}
