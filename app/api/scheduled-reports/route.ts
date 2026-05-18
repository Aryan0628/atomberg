import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const ScheduledReportSchema = z.object({
  name: z.string().min(1).max(100),
  columns: z.array(z.string()).min(1),
  filters: z.object({
    cycleId: z.string().optional(),
    department: z.string().optional(),
    status: z.string().optional(),
  }).default({}),
  schedule: z.enum(["0 9 * * 1", "0 9 * * *", "0 9 1 * *"]), // weekly Mon, daily, monthly
  recipients: z.array(z.string().email()).min(1),
  format: z.enum(["excel", "csv"]).default("excel"),
});

export async function GET() {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const reports = await prisma.scheduledReport.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(reports);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const parsed = ScheduledReportSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const report = await prisma.scheduledReport.create({
    data: { ...parsed.data, createdById: session.user.id },
  });
  return NextResponse.json(report, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.scheduledReport.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
