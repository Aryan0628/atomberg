// auth.config.ts — Edge-compatible NextAuth config (NO Prisma, NO bcrypt, NO Node.js modules).
// Used by middleware.ts to validate JWTs at the Edge without pulling in server-only deps.
// lib/auth.ts spreads this config and adds the Credentials provider (Prisma + bcrypt).

import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as Record<string, unknown>;
        token.role      = u.role as string;
        token.userId    = user.id;
        token.managerId = u.managerId as string | undefined;
        token.department = u.department as string | undefined;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role       = token.role as "EMPLOYEE" | "MANAGER" | "ADMIN" | "HR";
      session.user.id         = token.userId as string;
      session.user.managerId  = token.managerId as string | undefined;
      session.user.department = token.department as string | undefined;
      return session;
    },
  },
  providers: [], // Credentials provider lives in lib/auth.ts (server-only)
};
