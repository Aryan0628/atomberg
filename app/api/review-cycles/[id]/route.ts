import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const cycle = await prisma.reviewCycle.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      responses: {
        include: {
          reviewer: { select: { id: true, name: true, department: true } },
          subject: { select: { id: true, name: true, department: true } },
        },
      },
    },
  });
  if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(cycle);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const { status } = body.data as { status?: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED" };
  if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });

  const updated = await prisma.reviewCycle.update({ where: { id }, data: { status } });
  return NextResponse.json(updated);
}
