/** Browser-side API client. Every call goes through the Next.js proxy at /api/proxy. */

export const PROXY_BASE = "/api/proxy";

export class ApiError extends Error {
  status: number;
  code: string;
  requestId: string | null;
  details: unknown;

  constructor(status: number, code: string, message: string, requestId: string | null = null, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

/** Turn any failed response body into an ApiError, using the back end's error envelope. */
export function parseError(status: number, body: unknown, statusText = ""): ApiError {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error: Record<string, unknown> }).error ?? {};
    return new ApiError(
      status,
      typeof e.code === "string" ? e.code : `HTTP_${status}`,
      typeof e.message === "string" ? e.message : statusText || `Request failed (${status})`,
      typeof e.request_id === "string" ? e.request_id : null,
      e.details ?? null,
    );
  }
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    return new ApiError(status, `HTTP_${status}`, typeof d === "string" ? d : JSON.stringify(d));
  }
  return new ApiError(status, `HTTP_${status}`, statusText || `Request failed (${status})`);
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function buildPath(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return `${PROXY_BASE}${path}${qs ? `?${qs}` : ""}`;
}

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  json?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(buildPath(path, opts.query), {
    method: opts.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    signal: opts.signal,
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const err = parseError(res.status, data, res.statusText);
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/session")) {
      // Hard navigation on purpose: this runs outside React (no router), and clears client state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw err;
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
