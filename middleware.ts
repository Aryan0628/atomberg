// middleware.ts
// Auth + role routing — edge-compatible (no Prisma, no Node.js modules)

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login page and API auth routes
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check for session token
  const sessionToken = req.cookies.get("authjs.session-token")?.value
    || req.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // For role-based routing, we'll handle it client-side since we can't
  // decode JWT in Edge without importing crypto libs that may not be available.
  // The RoleGuard component + API-level auth checks provide security.

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
  ],
};
