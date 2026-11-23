/**
 * Pure helpers for the /api/proxy route handler. Kept free of Next.js imports so they can be
 * unit-tested.
 */

export const API_PREFIX = "/api/v1";

export function backendBaseUrl(): string {
  return (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

/**
 * Build the back-end URL for a proxied request. Each path segment is re-encoded, so a segment
 * such as ".." or "a/b" can never escape the /api/v1 prefix.
 */
export function buildBackendUrl(base: string, segments: string[], search: string): string {
  const safe = segments.map((s) => {
    if (s === "." || s === "..") throw new Error("Invalid path segment");
    return encodeURIComponent(s);
  });
  return `${base}${API_PREFIX}/${safe.join("/")}${search}`;
}

const REQUEST_HEADERS = ["content-type", "accept", "x-request-id"];
const RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "x-request-id",
  "retry-after",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
];

/** Only forward a small allowlist of headers; the API key comes from the session cookie. */
export function pickRequestHeaders(incoming: Headers, apiKey: string): Headers {
  const out = new Headers();
  for (const name of REQUEST_HEADERS) {
    const v = incoming.get(name);
    if (v) out.set(name, v);
  }
  out.set("x-api-key", apiKey);
  return out;
}

export function pickResponseHeaders(incoming: Headers): Headers {
  const out = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const v = incoming.get(name);
    if (v) out.set(name, v);
  }
  out.set("cache-control", "no-store");
  return out;
}

export function errorJson(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message, request_id: null } }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
