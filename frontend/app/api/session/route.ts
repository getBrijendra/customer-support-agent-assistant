import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { API_PREFIX, backendBaseUrl, errorJson } from "@/lib/server/forward";
import { KEY_COOKIE, ROLE_COOKIE, type Role } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_AGE = 60 * 60 * 12; // 12 hours

async function probe(path: string, key: string): Promise<number> {
  const res = await fetch(`${backendBaseUrl()}${API_PREFIX}${path}`, {
    headers: { "x-api-key": key },
    cache: "no-store",
  });
  return res.status;
}

/** Sign in: verify the key against the back end and work out its role. */
export async function POST(req: NextRequest): Promise<Response> {
  let key = "";
  try {
    const body = (await req.json()) as { key?: unknown };
    key = typeof body.key === "string" ? body.key.trim() : "";
  } catch {
    /* fall through */
  }
  if (!key || key.length > 500) return errorJson(422, "VALIDATION_ERROR", "API key is required");

  let role: Role;
  try {
    const agent = await probe("/companies", key);
    if (agent === 401 || agent === 403) return errorJson(401, "UNAUTHORIZED", "Invalid API key");
    if (agent >= 400) return errorJson(502, "BACKEND_ERROR", `Back end answered ${agent}`);
    // /capabilities is admin-only and cheap: 200 = admin key, 403 = agent key.
    role = (await probe("/capabilities", key)) === 200 ? "admin" : "agent";
  } catch {
    return errorJson(502, "BACKEND_UNAVAILABLE", "The support-assistant API is not reachable");
  }

  const jar = await cookies();
  // Secure cookies only when the browser actually talks HTTPS (directly or via a TLS proxy).
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.nextUrl.protocol.replace(":", "");
  const secure = proto === "https";
  jar.set(KEY_COOKIE, key, { httpOnly: true, sameSite: "strict", secure, path: "/", maxAge: MAX_AGE });
  jar.set(ROLE_COOKIE, role, { httpOnly: false, sameSite: "strict", secure, path: "/", maxAge: MAX_AGE });
  return NextResponse.json({ role });
}

/** Sign out. */
export async function DELETE(): Promise<Response> {
  const jar = await cookies();
  jar.delete(KEY_COOKIE);
  jar.delete(ROLE_COOKIE);
  return new Response(null, { status: 204 });
}
