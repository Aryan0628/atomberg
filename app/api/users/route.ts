// app/api/users/route.ts
// GET — role-scoped user list:
//   EMPLOYEE    → 403 (use /api/users/[id] for self)
//   MANAGER     → own profile + direct reports only (cached 120s)
//   ADMIN / HR  → all users (cached 120s)
// POST — create user (ADMIN / HR only)

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserCreateSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
import { withCache, invalidateCache } from "@/lib/cache";
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

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const myReports = searchParams.get("myReports") === "true";
  const forFeedback = searchParams.get("forFeedback") === "true";

  // Employees can fetch a minimal peer list for the feedback recipient selector only
  if (session.user.role === "EMPLOYEE") {
    if (!forFeedback) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const peers = await withCache(`users:peers:${session.user.id}`, 300, () =>
      prisma.user.findMany({
        where: { isActive: true, id: { not: session.user.id } },
        select: { id: true, name: true, department: true },
        orderBy: { name: "asc" },
      })
    );
    return NextResponse.json(peers);
  }

  if (session.user.role === "MANAGER") {
    // ?myReports=true returns only direct reports (not the manager themselves)
    const where = myReports
      ? { managerId: session.user.id, isActive: true }
      : { OR: [{ id: session.user.id }, { managerId: session.user.id, isActive: true }] };

    const users = await withCache(`users:manager:${session.user.id}:${myReports}`, 120, () =>
      prisma.user.findMany({ where, select: USER_SELECT, orderBy: { name: "asc" } })
    );
    return NextResponse.json(users);
  }

  // ADMIN / HR — full list
  const users = await withCache("users:admin", 120, () =>
    prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { name: "asc" },
    })
  );
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

  // Invalidate admin list and both variants of the manager's team cache.
  // Read keys use users:manager:{id}:{myReports} — must match both variants.
  void Promise.all([
    invalidateCache("users:admin"),
    parsed.data.managerId ? invalidateCache(`users:manager:${parsed.data.managerId}:true`)  : Promise.resolve(),
    parsed.data.managerId ? invalidateCache(`users:manager:${parsed.data.managerId}:false`) : Promise.resolve(),
  ]);

  await writeAudit({
    userId: session.user.id, action: "USER_CREATED", entityType: "User", entityId: user.id,
    newValue: { email: user.email, role: user.role },
  });

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role }, { status: 201 });
}
