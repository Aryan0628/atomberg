// middleware.ts — Auth + role-based route protection at the Edge.
//
// Uses authConfig (NO Prisma, NO bcrypt) so no Node.js native modules
// are bundled into the Edge runtime — fixes the node:path error.
//
// Role map:
//   /dashboard/admin/*     → ADMIN, HR only
//   /dashboard/manager/*   → MANAGER, ADMIN only
//   /dashboard/employee/*  → all authenticated roles
//
// Unauthenticated → /login
// Wrong role      → own dashboard home

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const ROLE_ROUTES: Array<{ prefix: string; allowed: string[] }> = [
  { prefix: "/dashboard/admin",   allowed: ["ADMIN", "HR"] },
  { prefix: "/dashboard/manager", allowed: ["MANAGER", "ADMIN"] },
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

  if (!req.auth) {
    return Response.redirect(new URL("/login", req.url));
  }

  const role = (req.auth.user as { role?: string })?.role ?? "";

  for (const { prefix, allowed } of ROLE_ROUTES) {
    if (pathname.startsWith(prefix) && !allowed.includes(role)) {
      const fallback = ROLE_FALLBACK[role] ?? "/login";
      return Response.redirect(new URL(fallback, req.url));
    }
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
