import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const MeetingSchema = z.object({
  employeeId: z.string().cuid(),
  scheduledAt: z.coerce.date(),
  agendaItems: z.array(z.object({
    title: z.string().min(1).max(200),
    goalId: z.string().cuid().optional(),
  })).default([]),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = session.user.role as string;

  const where = role === "MANAGER"
    ? { managerId: session.user.id }
    : role === "EMPLOYEE"
    ? { employeeId: session.user.id }
    : {};

  const upcomingOnly = searchParams.get("upcoming") === "true";
  if (upcomingOnly) Object.assign(where, { scheduledAt: { gte: new Date() } });

  const meetings = await prisma.oneOnOneMeeting.findMany({
    where,
    include: {
      manager: { select: { id: true, name: true, avatarUrl: true } },
      employee: { select: { id: true, name: true, avatarUrl: true } },
      agendaItems: { orderBy: { order: "asc" } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 50,
  });
  return NextResponse.json(meetings);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["MANAGER", "ADMIN"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only managers can schedule 1:1s" }, { status: 403 });
  }

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const parsed = MeetingSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const meeting = await prisma.oneOnOneMeeting.create({
    data: {
      managerId: session.user.id,
      employeeId: parsed.data.employeeId,
      scheduledAt: parsed.data.scheduledAt,
      agendaItems: {
        create: parsed.data.agendaItems.map((item, i) => ({
          title: item.title,
          goalId: item.goalId,
          addedBy: session.user.id,
          order: i,
        })),
      },
    },
    include: { agendaItems: true },
  });

  await writeAudit({
    userId: session.user.id, action: "MEETING_CREATED", entityType: "OneOnOneMeeting",
    entityId: meeting.id, newValue: { employeeId: parsed.data.employeeId, scheduledAt: parsed.data.scheduledAt },
  });

  void createNotification({
    userId: parsed.data.employeeId,
    type: "MEETING_SCHEDULED",
    title: "1:1 meeting scheduled",
    message: `A 1:1 meeting has been scheduled for ${new Date(parsed.data.scheduledAt).toLocaleDateString()}.`,
    link: "/dashboard/employee/meetings",
  });

  return NextResponse.json(meeting, { status: 201 });
}
