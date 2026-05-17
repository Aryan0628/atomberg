// app/api/users/[id]/route.ts
// GET user detail, PUT update user, DELETE deactivate user
//
// Scope rules (GET):
//   EMPLOYEE → self only
//   MANAGER  → self or one of their direct reports
//   ADMIN/HR → any user

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { UserUpdateSchema } from "@/lib/validations";
import { withCache, invalidateCache } from "@/lib/cache";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (session.user.role === "EMPLOYEE" && session.user.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.user.role === "MANAGER" && session.user.id !== id) {
    // Managers may only fetch their own direct reports
    const isReport = await prisma.user.findFirst({
      where: { id, managerId: session.user.id, isActive: true },
      select: { id: true },
    });
    if (!isReport) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await withCache(`user:${id}`, 120, () =>
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, role: true, department: true,
        designation: true, employeeCode: true, isActive: true, avatarUrl: true,
        managerId: true, skipManagerId: true, lastLoginAt: true, createdAt: true,
        manager: { select: { id: true, name: true, role: true } },
        skipManager: { select: { id: true, name: true } },
        reports: { select: { id: true, name: true, role: true, department: true } },
        _count: { select: { ownedGoals: true, reports: true } },
      },
    })
  );
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.error;

  const parsed = UserUpdateSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const oldRole = existing.role;
  const data = parsed.data;

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      role: data.role ?? existing.role,
      department: data.department !== undefined ? data.department : existing.department,
      designation: data.designation !== undefined ? data.designation : existing.designation,
      managerId: data.managerId !== undefined ? data.managerId : existing.managerId,
      skipManagerId: data.skipManagerId !== undefined ? data.skipManagerId : existing.skipManagerId,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
    },
    select: {
      id: true, name: true, email: true, role: true, department: true,
      designation: true, employeeCode: true, managerId: true, isActive: true,
    },
  });

  // Invalidate user detail + both old and new manager team lists + admin list
  void Promise.all([
    invalidateCache(`user:${id}`),
    invalidateCache("users:admin"),
    existing.managerId ? invalidateCache(`users:manager:${existing.managerId}`) : Promise.resolve(),
    data.managerId && data.managerId !== existing.managerId
      ? invalidateCache(`users:manager:${data.managerId}`)
      : Promise.resolve(),
  ]);

  if (data.role && data.role !== oldRole) {
    await writeAudit({
      userId: session.user.id,
      action: "USER_ROLE_CHANGED",
      entityType: "User",
      entityId: id,
      oldValue: { role: oldRole },
      newValue: { role: data.role },
    });
  } else {
    await writeAudit({
      userId: session.user.id,
      action: "USER_ROLE_CHANGED",
      entityType: "User",
      entityId: id,
      oldValue: { name: existing.name, department: existing.department, managerId: existing.managerId },
      newValue: { name: updated.name, department: updated.department, managerId: updated.managerId },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
  }

  // Soft delete — deactivate instead of remove to preserve audit history
  const target = await prisma.user.findUnique({ where: { id }, select: { managerId: true } });
  await prisma.user.update({ where: { id }, data: { isActive: false } });

  void Promise.all([
    invalidateCache(`user:${id}`),
    invalidateCache("users:admin"),
    target?.managerId ? invalidateCache(`users:manager:${target.managerId}`) : Promise.resolve(),
  ]);

  await writeAudit({
    userId: session.user.id,
    action: "USER_ROLE_CHANGED",
    entityType: "User",
    entityId: id,
    newValue: { isActive: false, action: "deactivated" },
  });

  return NextResponse.json({ success: true });
}
