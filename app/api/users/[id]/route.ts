// app/api/users/[id]/route.ts
// GET user detail, PUT update user, DELETE deactivate user

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Employees can only get their own profile
  if (session.user.role === "EMPLOYEE" && session.user.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
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
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const oldRole = existing.role;

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      email: body.email ?? existing.email,
      role: body.role ?? existing.role,
      department: body.department ?? existing.department,
      designation: body.designation ?? existing.designation,
      employeeCode: body.employeeCode ?? existing.employeeCode,
      managerId: body.managerId !== undefined ? body.managerId : existing.managerId,
      skipManagerId: body.skipManagerId !== undefined ? body.skipManagerId : existing.skipManagerId,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
    },
    select: {
      id: true, name: true, email: true, role: true, department: true,
      designation: true, employeeCode: true, managerId: true, isActive: true,
    },
  });

  if (body.role && body.role !== oldRole) {
    await writeAudit({
      userId: session.user.id,
      action: "USER_ROLE_CHANGED",
      entityType: "User",
      entityId: id,
      oldValue: { role: oldRole },
      newValue: { role: body.role },
    });
  } else {
    await writeAudit({
      userId: session.user.id,
      action: "USER_CREATED",
      entityType: "User",
      entityId: id,
      oldValue: { name: existing.name, department: existing.department },
      newValue: { name: updated.name, department: updated.department },
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
  await prisma.user.update({ where: { id }, data: { isActive: false } });

  await writeAudit({
    userId: session.user.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: id,
    newValue: { isActive: false, action: "deactivated" },
  });

  return NextResponse.json({ success: true });
}
