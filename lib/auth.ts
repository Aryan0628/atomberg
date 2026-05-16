// lib/auth.ts
// NextAuth v5 (Auth.js) configuration — JWT sessions, role-aware, Credentials provider.
// Azure AD SSO wired but gracefully degraded when env vars are empty.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user || !user.isActive) return null;
        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) return null;

        // Update last login timestamp
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          managerId: user.managerId,
          department: user.department,
          avatarUrl: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as Record<string, unknown>;
        token.role = u.role as string;
        token.userId = user.id;
        token.managerId = u.managerId as string | undefined;
        token.department = u.department as string | undefined;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role as "EMPLOYEE" | "MANAGER" | "ADMIN" | "HR";
      session.user.id = token.userId as string;
      session.user.managerId = token.managerId as string | undefined;
      session.user.department = token.department as string | undefined;
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 hour sessions
});
