// app/api/users/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserCreateSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true, role: true, department: true,
      designation: true, employeeCode: true, isActive: true, avatarUrl: true,
      managerId: true, lastLoginAt: true, createdAt: true,
      manager: { select: { id: true, name: true } },
      _count: { select: { ownedGoals: true, reports: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UserCreateSchema.safeParse(body);
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
