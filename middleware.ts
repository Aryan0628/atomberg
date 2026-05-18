// middleware.ts
// Auth + role-based route protection — uses NextAuth v5 auth() wrapper
// which decodes the JWT at the Edge without any Node.js crypto imports.
//
// Route map:
//   /dashboard/admin/*     → ADMIN, HR only
//   /dashboard/manager/*   → MANAGER, ADMIN only
//   /dashboard/employee/*  → all authenticated roles
//
// Unauthenticated users → /login
// Wrong-role users      → their own dashboard home

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ROLE_ROUTES: Array<{ prefix: string; allowed: string[] }> = [
  { prefix: "/dashboard/admin",    allowed: ["ADMIN", "HR"] },
  { prefix: "/dashboard/manager",  allowed: ["MANAGER", "ADMIN"] },
  // /dashboard/employee is open to all authenticated roles
];

const ROLE_FALLBACK: Record<string, string> = {
  EMPLOYEE: "/dashboard/employee/dashboard",
  MANAGER:  "/dashboard/manager/dashboard",
  ADMIN:    "/dashboard/admin/dashboard",
  HR:       "/dashboard/admin/dashboard",
};

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // No valid session → login
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = (req.auth.user as { role?: string })?.role ?? "";

  for (const { prefix, allowed } of ROLE_ROUTES) {
    if (pathname.startsWith(prefix) && !allowed.includes(role)) {
      const fallback = ROLE_FALLBACK[role] ?? "/login";
      return NextResponse.redirect(new URL(fallback, req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
