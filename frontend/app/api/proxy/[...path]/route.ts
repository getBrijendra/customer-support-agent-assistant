import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import {
  backendBaseUrl,
  buildBackendUrl,
  errorJson,
  pickRequestHeaders,
  pickResponseHeaders,
} from "@/lib/server/forward";
import { KEY_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(req: NextRequest, ctx: Ctx): Promise<Response> {
  const key = (await cookies()).get(KEY_COOKIE)?.value;
  if (!key) return errorJson(401, "UNAUTHORIZED", "Not signed in");

  const { path } = await ctx.params;
  let url: string;
  try {
    url = buildBackendUrl(backendBaseUrl(), path, req.nextUrl.search);
  } catch {
    return errorJson(400, "VALIDATION_ERROR", "Invalid path");
  }

  const hasBody = !["GET", "HEAD"].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers: pickRequestHeaders(req.headers, key),
      body: hasBody ? await req.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return errorJson(502, "BACKEND_UNAVAILABLE", "The support-assistant API is not reachable");
  }

  const headers = pickResponseHeaders(upstream.headers);
  if (upstream.status === 204 || upstream.status === 304) {
    return new Response(null, { status: upstream.status, headers });
  }
  return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
