// app/api/users/route.ts
// GET — role-scoped user list:
//   EMPLOYEE    → 403 (use /api/users/[id] for self)
//   MANAGER     → own profile + direct reports only
//   ADMIN / HR  → all users
// POST — create user (ADMIN / HR only)

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserCreateSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
import { parseJson } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

const USER_SELECT = {
  id: true, email: true, name: true, role: true, department: true,
  designation: true, employeeCode: true, isActive: true, avatarUrl: true,
  managerId: true, lastLoginAt: true, createdAt: true,
  manager: { select: { id: true, name: true } },
  _count: { select: { ownedGoals: true, reports: true } },
} as const;

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.user.role === "MANAGER") {
    // Managers see only themselves + their direct reports
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { id: session.user.id },
          { managerId: session.user.id, isActive: true },
        ],
      },
      select: USER_SELECT,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(users);
  }

  // ADMIN / HR — full list
  const users = await prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await parseJson(req);
  if (!body.ok) return body.error;

  const parsed = UserCreateSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return NextResponse.json({ error: "Email already exists" }, { status: 409 });

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: { ...parsed.data, password: hashedPassword },
  });

  await writeAudit({
    userId: session.user.id, action: "USER_CREATED", entityType: "User", entityId: user.id,
    newValue: { email: user.email, role: user.role },
  });

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role }, { status: 201 });
}
