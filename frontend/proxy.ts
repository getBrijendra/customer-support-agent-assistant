import { NextResponse, type NextRequest } from "next/server";

import { KEY_COOKIE } from "@/lib/session";

/** Next.js 16 request proxy (formerly middleware): send visitors without a session to /login. */
export function proxy(req: NextRequest) {
  if (!req.cookies.get(KEY_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (req.nextUrl.pathname !== "/") url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the login page, API routes and static assets.
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
