import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const AgendaItemSchema = z.object({
  title: z.string().min(1).max(200),
  goalId: z.string().cuid().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const meeting = await prisma.oneOnOneMeeting.findUnique({
    where: { id },
    include: {
      manager: { select: { id: true, name: true, avatarUrl: true } },
      employee: { select: { id: true, name: true, avatarUrl: true } },
      agendaItems: { orderBy: { order: "asc" } },
    },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only manager and employee in the meeting can view
  if (meeting.managerId !== session.user.id && meeting.employeeId !== session.user.id &&
      !["ADMIN", "HR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(meeting);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const meeting = await prisma.oneOnOneMeeting.findUnique({ where: { id } });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (meeting.managerId !== session.user.id && meeting.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const data = body.data as Record<string, unknown>;

  if (data.addAgendaItem) {
    const item = AgendaItemSchema.safeParse(data.addAgendaItem);
    if (!item.success) return NextResponse.json({ error: item.error.flatten() }, { status: 422 });
    const count = await prisma.meetingAgendaItem.count({ where: { meetingId: id } });
    const created = await prisma.meetingAgendaItem.create({
      data: { meetingId: id, ...item.data, addedBy: session.user.id, order: count },
    });
    return NextResponse.json(created, { status: 201 });
  }

  if (data.toggleAgendaItem) {
    const itemId = data.toggleAgendaItem as string;
    const existing = await prisma.meetingAgendaItem.findUnique({ where: { id: itemId } });
    if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    const updated = await prisma.meetingAgendaItem.update({
      where: { id: itemId }, data: { done: !existing.done },
    });
    return NextResponse.json(updated);
  }

  if (data.notes !== undefined) {
    const updated = await prisma.oneOnOneMeeting.update({
      where: { id }, data: { notes: data.notes as string },
    });
    return NextResponse.json(updated);
  }

  if (data.complete) {
    const updated = await prisma.oneOnOneMeeting.update({
      where: { id }, data: { completedAt: new Date() },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "No valid operation" }, { status: 400 });
}
